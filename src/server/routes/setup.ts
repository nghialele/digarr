import { Hono } from 'hono'
import type { AppDependencies } from '@/server'

export function setupRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/setup/status', async (c) => {
    const complete = await deps.isSetupComplete()
    return c.json({ setupComplete: complete })
  })

  router.post('/api/setup/complete', async (c) => {
    const body = await c.req.json()

    const missing: string[] = []
    if (!body.lidarrUrl) missing.push('lidarrUrl')
    if (!body.lidarrApiKey) missing.push('lidarrApiKey')
    if (!body.aiProvider) missing.push('aiProvider')
    if (!body.aiModel) missing.push('aiModel')
    if (!body.listenbrainzUsername && !body.lastfmUsername) {
      missing.push('listenbrainzUsername or lastfmUsername')
    }

    if (missing.length > 0) {
      return c.json({ error: 'Missing required fields', fields: missing }, 400)
    }

    await deps.completeSetup(body)
    return c.json({ success: true }, 200)
  })

  return router
}
