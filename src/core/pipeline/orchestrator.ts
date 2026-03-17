import { EventEmitter } from 'node:events'
import type { StoreDb } from './store'
import { collect } from './collect'
import { analyze } from './analyze'
import { discover } from './discover'
import { resolve } from './resolve'
import { score } from './score'
import { filter } from './filter'
import { store } from './store'
import { createLidarrClient } from '@/core/clients/lidarr'
import { createListenBrainzClient } from '@/core/clients/listenbrainz'
import { createLastFmClient } from '@/core/clients/lastfm'
import { createMusicBrainzClient } from '@/core/clients/musicbrainz'
import { createProvider } from '@/core/providers/factory'
import type { Preferences } from '@/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Settings row shape -- all fields from the DB settings table we actually need
export interface PipelineSettings {
  lidarrUrl: string | null
  lidarrApiKey: string | null
  listenbrainzUsername: string | null
  listenbrainzToken: string | null
  lastfmUsername: string | null
  lastfmApiKey: string | null
  aiProvider: string | null
  aiApiKey: string | null
  aiModel: string | null
  aiBaseUrl: string | null
  preferences: Preferences | null
}

export interface PipelineDeps {
  db: StoreDb
  settings: PipelineSettings
}

// Extended StoreDb for stale batch cleanup
interface BatchManagementDb extends StoreDb {
  updateBatch: (id: number, data: { status: string }) => Promise<void>
  getRunningBatches: (olderThanMs: number) => Promise<Array<{ id: number }>>
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class PipelineOrchestrator extends EventEmitter {
  private running = false

  async run(deps: PipelineDeps): Promise<{ batchId: number }> {
    if (this.running) throw new Error('Pipeline already running')
    this.running = true

    try {
      const { db, settings } = deps
      const prefs = settings.preferences ?? {
        qualityProfileId: 1,
        rootFolderId: 1,
        scheduleCron: '0 0 * * 0',
        scoreThreshold: 0.5,
        scoringWeights: {
          consensus: 0.3,
          similarity: 0.25,
          genreOverlap: 0.2,
          aiConfidence: 0.15,
          feedbackBoost: 0.1,
        },
        rejectionCooldownDays: 90,
        topArtistsLimit: 30,
      }

      // -- Build clients from settings ----------------------------------------

      if (!settings.lidarrUrl || !settings.lidarrApiKey) {
        throw new Error('Lidarr URL and API key are required')
      }
      const lidarrClient = createLidarrClient(settings.lidarrUrl, settings.lidarrApiKey)

      const lbClient =
        settings.listenbrainzUsername && settings.listenbrainzToken
          ? createListenBrainzClient(settings.listenbrainzUsername, settings.listenbrainzToken)
          : null

      const lfmClient =
        settings.lastfmUsername && settings.lastfmApiKey
          ? createLastFmClient(settings.lastfmUsername, settings.lastfmApiKey)
          : null

      const mbClient = createMusicBrainzClient()

      const aiProvider =
        settings.aiProvider && settings.aiModel
          ? await createProvider(
              settings.aiProvider,
              settings.aiApiKey ?? null,
              settings.aiModel,
              settings.aiBaseUrl ?? undefined,
            )
          : null

      // -- Stage 1: COLLECT ---------------------------------------------------

      this.emit('progress', { stage: 'collect' })
      const libraryArtists = await collect(lidarrClient)

      // Build lookup structures for score + filter
      const libraryMbids = new Set(libraryArtists.map((a) => a.mbid))
      // Library genres are not available at this stage -- MB lookup happens in
      // resolve. Pass an empty array; genre overlap scoring will be zero for
      // library genres until task-12 query modules populate this.
      const libraryGenres: string[] = []
      // Rejected MBIDs and feedback history come from DB queries (task 12).
      // For now pass empty structures so the pipeline can run end-to-end.
      const rejectedMbids = new Map<string, Date>()
      const feedbackHistory = new Map<string, { approved: number; total: number }>()

      // -- Stage 2: ANALYZE ---------------------------------------------------

      this.emit('progress', { stage: 'analyze' })
      const tasteProfile = await analyze(lbClient, lfmClient)

      // -- Stage 3: DISCOVER --------------------------------------------------

      this.emit('progress', { stage: 'discover' })
      const discovered = await discover(
        tasteProfile,
        {
          listenbrainz: lbClient,
          lastfm: lfmClient,
          musicbrainz: mbClient,
          ai: aiProvider,
        },
        prefs.topArtistsLimit,
      )

      // -- Stage 4: RESOLVE ---------------------------------------------------

      this.emit('progress', { stage: 'resolve' })
      const resolved = await resolve(discovered, mbClient, (progress) => {
        this.emit('progress', { stage: 'resolve', ...progress })
      })

      // -- Stage 5: SCORE -----------------------------------------------------

      this.emit('progress', { stage: 'score' })
      const scored = score(resolved, libraryGenres, prefs.scoringWeights, feedbackHistory)

      // -- Stage 6: FILTER ----------------------------------------------------

      this.emit('progress', { stage: 'filter' })
      const filtered = filter(
        scored,
        libraryMbids,
        rejectedMbids,
        prefs.rejectionCooldownDays,
        prefs.scoreThreshold,
      )

      // -- Stage 7: STORE -----------------------------------------------------

      this.emit('progress', { stage: 'store' })
      const batchId = await store(filtered, db)

      this.emit('progress', { stage: 'complete' })
      return { batchId }
    } catch (err) {
      this.emit('error', err)
      throw err
    } finally {
      this.running = false
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Mark any 'running' batches older than 30 minutes as 'failed'.
   * Call on startup to handle crashes/restarts.
   */
  async cleanupStaleBatches(db: BatchManagementDb): Promise<void> {
    const thirtyMinutes = 30 * 60 * 1000
    const staleBatches = await db.getRunningBatches(thirtyMinutes)
    for (const batch of staleBatches) {
      await db.updateBatch(batch.id, { status: 'failed' })
    }
  }
}
