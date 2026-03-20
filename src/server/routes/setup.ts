import { Hono } from 'hono'
import type { AppDependencies } from '@/server'
import type { HonoEnv } from '@/server/types'

export function setupRoutes(deps: AppDependencies) {
  const router = new Hono<HonoEnv>()

  router.get('/api/setup/status', async (c) => {
    const complete = await deps.isSetupComplete()
    return c.json({ setupComplete: complete })
  })

  router.post('/api/setup/complete', async (c) => {
    const alreadyDone = await deps.isSetupComplete()
    if (alreadyDone) {
      return c.json({ error: 'Setup already complete' }, 409)
    }

    const body = await c.req.json()

    const missing: string[] = []
    if (!body.aiProvider) missing.push('aiProvider')
    if (!body.aiModel) missing.push('aiModel')
    if (!body.listenbrainzUsername && !body.lastfmUsername) {
      missing.push('listenbrainzUsername or lastfmUsername')
    }
    // Lidarr is optional -- only validate if partially provided
    if (body.lidarrUrl && !body.lidarrApiKey) {
      missing.push('lidarrApiKey (required when lidarrUrl is set)')
    }
    if (!body.lidarrUrl && body.lidarrApiKey) {
      missing.push('lidarrUrl (required when lidarrApiKey is set)')
    }

    if (missing.length > 0) {
      return c.json({ error: 'Missing required fields', fields: missing }, 400)
    }

    await deps.completeSetup(body)

    // Auto-create Lidarr target if Lidarr was configured during setup
    const userId = c.get('userId')
    if (body.lidarrUrl && body.lidarrApiKey && userId) {
      try {
        await deps.targetQueries.createTarget({
          type: 'lidarr',
          name: 'Lidarr',
          config: {
            url: body.lidarrUrl,
            apiKey: body.lidarrApiKey,
            skipTlsVerify: body.skipTlsVerify ?? false,
          },
          userId,
        })
      } catch {
        // Best-effort -- the boot-time backfill will handle it on next restart
      }
    }

    return c.json({ success: true }, 200)
  })

  return router
}
