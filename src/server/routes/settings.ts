import { Hono } from 'hono'
import { createLastFmClient } from '@/core/clients/lastfm'
import { createLidarrClient } from '@/core/clients/lidarr'
import { createListenBrainzClient } from '@/core/clients/listenbrainz'
import { createProvider } from '@/core/providers/factory'
import type { AppDependencies } from '@/server'

const SECRET_FIELDS = ['lidarrApiKey', 'listenbrainzToken', 'lastfmApiKey', 'aiApiKey'] as const

type SettingsResponse = Record<string, unknown>

function maskSecrets(settings: Record<string, unknown>): SettingsResponse {
  const masked: SettingsResponse = { ...settings }
  for (const field of SECRET_FIELDS) {
    masked[field] = '***'
  }
  return masked
}

export function settingsRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/settings', async (c) => {
    const row = await deps.getSettings()
    if (!row) {
      return c.json({ error: 'Settings not found' }, 404)
    }
    return c.json(maskSecrets(row as Record<string, unknown>))
  })

  router.patch('/api/settings', async (c) => {
    const body = await c.req.json()
    await deps.updateSettings(body)
    const row = await deps.getSettings()
    if (!row) {
      return c.json({ error: 'Settings not found' }, 404)
    }
    return c.json(maskSecrets(row as Record<string, unknown>))
  })

  router.post('/api/settings/test/:service', async (c) => {
    const service = c.req.param('service')
    const body = await c.req.json()

    switch (service) {
      case 'lidarr': {
        const client = createLidarrClient(body.url ?? '', body.apiKey ?? '', body.skipTlsVerify)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'listenbrainz': {
        const client = createListenBrainzClient(body.username ?? '', body.token ?? '')
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'lastfm': {
        const client = createLastFmClient(body.username ?? '', body.apiKey ?? '')
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'ai': {
        try {
          const provider = await createProvider(
            body.provider ?? '',
            body.apiKey ?? null,
            body.model ?? '',
            body.baseUrl ?? null,
          )
          const result = await provider.testConnection()
          return c.json(result)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return c.json({ success: false, message })
        }
      }
      default:
        return c.json({ error: `Unknown service: ${service}` }, 400)
    }
  })

  return router
}
