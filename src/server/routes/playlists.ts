import { Hono } from 'hono'
import type { GenerationResult } from '@/core/playlists/generator'
import { generatePlaylist } from '@/core/playlists/generator'
import type { PlaylistScheduler } from '@/core/playlists/scheduler'
import { buildStrategyDeps } from '@/core/playlists/strategy-deps'
import type { PlaylistItem } from '@/core/targets/types'
import type { Database } from '@/db'
import type {
  PlaylistInsert,
  PlaylistRow,
  PlaylistTrackInsert,
  PlaylistTrackRow,
} from '@/db/queries/playlists'
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistsByUser,
  getPlaylistWithTracks,
  replacePlaylistTracks,
  updatePlaylist,
} from '@/db/queries/playlists'
import type { TargetRow } from '@/db/queries/targets'
import type { PlaylistConfig, PlaylistStrategy } from '@/db/schema'
import type { HonoEnv } from '@/server/types'

export type PlaylistDeps = {
  db: Database
  playlistScheduler: PlaylistScheduler
  getTargetsByUser: (userId: number) => Promise<TargetRow[]>
  buildPlaylistTarget: (row: TargetRow) => import('@/core/targets/types').DestinationTarget | null
}

const ALLOWED_UPDATE_FIELDS = new Set<string>([
  'name',
  'strategy',
  'targetIds',
  'schedule',
  'config',
  'enabled',
])

async function runGeneration(
  db: Database,
  playlist: PlaylistRow,
  deps: PlaylistDeps,
): Promise<void> {
  const userId = playlist.userId
  const strategyDeps = buildStrategyDeps(db, userId ?? null)

  const cfg = playlist.config ?? {
    size: 25,
    trackSourcePriority: ['spotify' as const],
  }

  const generationConfig = {
    size: cfg.size,
    genre: cfg.genre,
    mood: cfg.mood,
    trackSourcePriority: cfg.trackSourcePriority,
  }

  const result: GenerationResult = await generatePlaylist(
    playlist.strategy as PlaylistStrategy,
    generationConfig,
    strategyDeps,
    {}, // no track resolver deps -- tracks come from strategy
  )

  const trackInserts: PlaylistTrackInsert[] = result.tracks.map((t, i) => ({
    playlistId: playlist.id,
    artistName: t.artistName,
    trackName: t.trackName ?? null,
    mbid: t.mbid ?? null,
    spotifyUri: t.spotifyUri ?? null,
    deezerId: t.deezerId ?? null,
    localPath: t.localPath ?? null,
    position: i,
  }))

  await replacePlaylistTracks(db, playlist.id, trackInserts)
  await updatePlaylist(db, playlist.id, {
    lastGeneratedAt: new Date(),
    trackCount: result.tracks.length,
  })

  // Push to configured targets if any
  if (playlist.targetIds.length > 0 && userId != null) {
    const targetRows = await deps.getTargetsByUser(userId)
    const enabledTargetRows = targetRows.filter(
      (r) => r.enabled && playlist.targetIds.includes(r.id),
    )

    const playlistItems: PlaylistItem[] = result.tracks.map((t) => ({
      artistName: t.artistName,
      artistMbid: t.mbid ?? '',
      trackName: t.trackName ?? undefined,
      trackMbid: t.mbid ?? undefined,
    }))

    for (const targetRow of enabledTargetRows) {
      const target = deps.buildPlaylistTarget(targetRow)
      if (!target?.createPlaylist) continue
      try {
        await target.createPlaylist(playlist.name, playlistItems)
      } catch (err: unknown) {
        console.error(
          `[playlists] Failed to push to target ${targetRow.type}(${targetRow.id}):`,
          err,
        )
      }
    }
  }
}

export function playlistRoutes(deps: PlaylistDeps) {
  const router = new Hono<HonoEnv>()
  const { db } = deps

  // GET /api/playlists/scheduler -- must be registered before :id route
  router.get('/api/playlists/scheduler', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const next = deps.playlistScheduler.nextRun()
    return c.json({ nextRun: next ? next.toISOString() : null })
  })

  // GET /api/playlists
  router.get('/api/playlists', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const rows = await getPlaylistsByUser(db, userId)
    return c.json(rows)
  })

  // POST /api/playlists
  router.post('/api/playlists', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const body: Record<string, unknown> = await c.req.json()
    const { name, strategy } = body

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'name is required' }, 400)
    }
    if (!strategy || typeof strategy !== 'string') {
      return c.json({ error: 'strategy is required' }, 400)
    }

    const validStrategies = ['weekly_digest', 'genre_focus', 'mood_mix', 'rediscover']
    if (!validStrategies.includes(strategy)) {
      return c.json({ error: `strategy must be one of: ${validStrategies.join(', ')}` }, 400)
    }

    const data: PlaylistInsert = {
      name,
      userId,
      strategy: strategy as PlaylistStrategy,
      targetIds: Array.isArray(body.targetIds) ? (body.targetIds as number[]) : [],
      schedule: typeof body.schedule === 'string' ? body.schedule : null,
      config: body.config != null ? (body.config as PlaylistConfig) : null,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
    }

    const row = await createPlaylist(db, data)
    return c.json(row, 201)
  })

  // GET /api/playlists/:id
  router.get('/api/playlists/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const result = await getPlaylistWithTracks(db, id)
    if (!result) return c.json({ error: 'Not found' }, 404)
    if (result.playlist.userId !== userId) return c.json({ error: 'Forbidden' }, 403)

    return c.json(result)
  })

  // PATCH /api/playlists/:id
  router.patch('/api/playlists/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const existing = await getPlaylistWithTracks(db, id)
    if (!existing) return c.json({ error: 'Not found' }, 404)
    if (existing.playlist.userId !== userId) return c.json({ error: 'Forbidden' }, 403)

    const body: Record<string, unknown> = await c.req.json()
    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (Object.hasOwn(body, key)) {
        update[key] = body[key]
      }
    }

    await updatePlaylist(db, id, update)
    return c.json({ updated: true })
  })

  // DELETE /api/playlists/:id
  router.delete('/api/playlists/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const result = await getPlaylistWithTracks(db, id)
    if (!result) return c.json({ error: 'Not found' }, 404)
    if (result.playlist.userId !== userId) return c.json({ error: 'Forbidden' }, 403)

    await deletePlaylist(db, id)
    return c.json({ deleted: true })
  })

  // POST /api/playlists/:id/generate
  router.post('/api/playlists/:id/generate', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const result = await getPlaylistWithTracks(db, id)
    if (!result) return c.json({ error: 'Not found' }, 404)
    if (result.playlist.userId !== userId) return c.json({ error: 'Forbidden' }, 403)

    const playlist = result.playlist

    // Fire-and-forget
    Promise.resolve()
      .then(() => runGeneration(db, playlist, deps))
      .catch((err: unknown) => {
        console.error(`[playlists] Generation failed for playlist ${id}:`, err)
      })

    return c.json({ status: 'generating' }, 202)
  })

  return router
}

export type { PlaylistRow, PlaylistTrackRow }
