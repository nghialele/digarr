import { Hono } from 'hono'
import {
  getBatchesWithCounts,
  getOverviewStats,
  getSourceEffectiveness,
  getTopGenres,
} from '@/db/queries/analytics'
import type { AppDependencies } from '@/server'

export function analyticsRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/analytics/overview', async (c) => {
    const stats = await getOverviewStats(deps.db)
    return c.json(stats)
  })

  router.get('/api/analytics/batches', async (c) => {
    const batches = await getBatchesWithCounts(deps.db)
    return c.json(batches)
  })

  router.get('/api/analytics/genres', async (c) => {
    const genres = await getTopGenres(deps.db)
    return c.json(genres)
  })

  router.get('/api/analytics/sources', async (c) => {
    const sources = await getSourceEffectiveness(deps.db)
    return c.json(sources)
  })

  return router
}
