import { Hono } from 'hono'
import type { LibraryHealthService } from '@/core/library/health'
import type { HealthCheckId } from '@/core/library/types'

const VALID_CHECK_IDS: Set<string> = new Set([
  'missing-metadata',
  'stale-mbids',
  'unmonitored',
  'missing-albums',
  'duplicate-artists',
  'genre-gaps',
  'image-gaps',
])

type LibraryRouteDeps = {
  libraryHealth: LibraryHealthService
}

export function libraryRoutes(deps: LibraryRouteDeps) {
  const app = new Hono()

  // GET /api/library/health -- return cached or fresh health checks
  app.get('/api/library/health', async (c) => {
    const cached = deps.libraryHealth.getLastResults()
    if (cached) return c.json({ checks: cached, cached: true })
    const checks = await deps.libraryHealth.runChecks()
    return c.json({ checks, cached: false })
  })

  // POST /api/library/health/scan -- force fresh scan
  app.post('/api/library/health/scan', async (c) => {
    const checks = await deps.libraryHealth.runChecks()
    return c.json({ checks, cached: false })
  })

  // POST /api/library/health/:checkId/fix -- trigger fix for a check
  app.post('/api/library/health/:checkId/fix', async (c) => {
    const checkId = c.req.param('checkId')
    if (!VALID_CHECK_IDS.has(checkId)) {
      return c.json({ error: 'Invalid check ID' }, 400)
    }
    try {
      const progress = await deps.libraryHealth.fixCheck(checkId as HealthCheckId)
      return c.json(progress)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // GET /api/library/stats -- library statistics
  app.get('/api/library/stats', async (c) => {
    const stats = await deps.libraryHealth.getStats()
    return c.json(stats)
  })

  return app
}
