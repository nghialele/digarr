import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'
import { PipelineOrchestrator } from './core/pipeline/orchestrator'
import { PipelineScheduler } from './core/pipeline/scheduler'
import type { StoreDb } from './core/pipeline/store'
import { db, pool } from './db'
import { getArtistById, upsertArtist } from './db/queries/artists'
import { getBatch, listBatches } from './db/queries/batches'
import {
  bulkUpdateStatus,
  getRecommendation,
  insertRecommendation,
  listRecommendations,
  updateRecommendationStatus,
} from './db/queries/recommendations'
import { completeSetup, getSettings, isSetupComplete, updateSettings } from './db/queries/settings'
import { artists, recommendationBatches, recommendations } from './db/schema'
import { createApp } from './server'

const storeDb: StoreDb = {
  getExistingRecommendationMbids: async () => {
    const rows = await db
      .select({ mbid: artists.mbid })
      .from(recommendations)
      .innerJoin(artists, eq(recommendations.artistId, artists.id))
    return new Set(rows.map((r) => r.mbid))
  },
  insertBatch: async (data) => {
    const rows = await db
      .insert(recommendationBatches)
      .values({ status: data.status, stats: data.stats })
      .returning({ id: recommendationBatches.id })
    const row = rows[0]
    if (!row) throw new Error('insertBatch: no row returned')
    return row
  },
  upsertArtist: async (data) => {
    const row = await upsertArtist(db, data)
    return { id: row.id }
  },
  insertRecommendation: (data) => insertRecommendation(db, data),
}

const orchestrator = new PipelineOrchestrator()
const scheduler = new PipelineScheduler()

const app = createApp({
  db: storeDb,
  orchestrator,
  scheduler,
  isSetupComplete: () => isSetupComplete(db),
  getSettings: () => getSettings(db),
  updateSettings: (partial) => updateSettings(db, partial),
  completeSetup: (config) => completeSetup(db, config),
  getLastBatch: async () => {
    const batches = await listBatches(db)
    return batches[0] ?? null
  },
  listRecommendations: (filters) => listRecommendations(db, filters),
  getRecommendation: (id) => getRecommendation(db, id),
  updateRecommendationStatus: (id, status, extra) =>
    updateRecommendationStatus(db, id, status, extra),
  bulkUpdateStatus: (ids, status) => bulkUpdateStatus(db, ids, status),
  listBatches: () => listBatches(db),
  getBatch: (id) => getBatch(db, id),
  getArtistById: (id) => getArtistById(db, id),
})

const port = Number(process.env.PORT ?? 3000)
const server = serve({ fetch: app.fetch, port })

console.log(`Digarr running on http://localhost:${port}`)

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, shutting down...`)
    scheduler.stop()
    server.close()
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await pool.end()
    process.exit(0)
  })
}
