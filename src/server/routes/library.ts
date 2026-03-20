import { Hono } from 'hono'
import type { LibraryHealthService } from '@/core/library/health'
import type { SkyHookWarmer } from '@/core/library/skyhook-warmer'
import type { HealthCheckId } from '@/core/library/types'

const VALID_CHECK_IDS: Set<string> = new Set([
  'missing-metadata',
  'unmonitored',
  'missing-albums',
  'duplicate-artists',
  'genre-gaps',
  'image-gaps',
])

type LibraryRouteDeps = {
  libraryHealth: LibraryHealthService
  skyhookWarmer?: SkyHookWarmer | null
}

export function libraryRoutes(deps: LibraryRouteDeps) {
  const app = new Hono()

  // GET /api/library/health -- return cached results + scanning status
  app.get('/api/library/health', (c) => {
    const checks = deps.libraryHealth.getLastResults() ?? []
    return c.json({ checks, scanning: deps.libraryHealth.scanning })
  })

  // POST /api/library/health/scan -- kick off background scan, return 202
  app.post('/api/library/health/scan', (c) => {
    deps.libraryHealth.startScan()
    return c.json({ scanning: true }, 202)
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

  // POST /api/library/warm -- trigger background warming for a batch of MBIDs
  app.post('/api/library/warm', async (c) => {
    if (!deps.skyhookWarmer) {
      return c.json({ error: 'SkyHook warming not available (Lidarr not configured)' }, 400)
    }
    const body = await c.req.json()
    const rawMbids = body.mbids
    if (!Array.isArray(rawMbids) || rawMbids.length === 0) {
      return c.json({ error: 'mbids array required' }, 400)
    }
    const mbids = rawMbids.filter((m): m is string => typeof m === 'string')
    if (mbids.length === 0) {
      return c.json({ error: 'mbids array required' }, 400)
    }
    const batch = mbids.slice(0, 50) // Limit batch size
    for (const mbid of batch) {
      deps.skyhookWarmer.warmInBackground(mbid)
    }
    return c.json({ queued: batch.length }, 202)
  })

  // GET /api/library/warm/status -- check warm status for MBIDs
  app.get('/api/library/warm/status', async (c) => {
    if (!deps.skyhookWarmer) {
      return c.json({ statuses: {} })
    }
    const mbidsParam = c.req.query('mbids') ?? ''
    const mbids = mbidsParam.split(',').filter(Boolean).slice(0, 100)
    const statuses: Record<string, string> = {}
    for (const mbid of mbids) {
      statuses[mbid] = deps.skyhookWarmer.getStatus(mbid)
    }
    return c.json({ statuses })
  })

  return app
}
