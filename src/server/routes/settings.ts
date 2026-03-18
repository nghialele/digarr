import { Hono } from 'hono'
import { createLastFmClient } from '@/core/clients/lastfm'
import { createLidarrClient } from '@/core/clients/lidarr'
import { createListenBrainzClient } from '@/core/clients/listenbrainz'
import { sendWebhook } from '@/core/notifications'
import { createProvider } from '@/core/providers/factory'
import { isHttpUrl } from '@/core/validation'
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

  const MUTABLE_FIELDS = new Set([
    'lidarrUrl',
    'lidarrApiKey',
    'skipTlsVerify',
    'listenbrainzUsername',
    'listenbrainzToken',
    'lastfmUsername',
    'lastfmApiKey',
    'aiProvider',
    'aiApiKey',
    'aiModel',
    'aiBaseUrl',
    'preferences',
  ])

  router.patch('/api/settings', async (c) => {
    const body = await c.req.json()
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (MUTABLE_FIELDS.has(key)) {
        sanitized[key] = value
      }
    }
    await deps.updateSettings(sanitized)

    const prefs = sanitized.preferences as Record<string, unknown> | undefined
    if (prefs?.scheduleCron !== undefined && typeof prefs.scheduleCron === 'string') {
      try {
        deps.restartScheduler(prefs.scheduleCron || null)
      } catch (err: unknown) {
        console.error('Failed to apply cron expression:', err)
        const row = await deps.getSettings()
        return c.json({
          ...maskSecrets((row ?? {}) as Record<string, unknown>),
          warning: 'Settings saved but cron expression is invalid',
        })
      }
    }

    const row = await deps.getSettings()
    if (!row) {
      return c.json({ error: 'Settings not found' }, 404)
    }
    return c.json(maskSecrets(row as Record<string, unknown>))
  })

  router.post('/api/settings/test/:service', async (c) => {
    const service = c.req.param('service')
    const body = await c.req.json()

    for (const field of ['url', 'baseUrl'] as const) {
      const val = (body as Record<string, unknown>)[field]
      if (typeof val === 'string' && val && !isHttpUrl(val)) {
        return c.json({ success: false, message: 'URL must start with http:// or https://' }, 400)
      }
    }

    // Fall back to stored credentials when the request sends empty keys
    const stored = (await deps.getSettings()) as Record<string, unknown> | null

    switch (service) {
      case 'lidarr': {
        const url = body.url || (stored?.lidarrUrl as string) || ''
        const apiKey = body.apiKey || (stored?.lidarrApiKey as string) || ''
        const client = createLidarrClient(url, apiKey, body.skipTlsVerify)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'listenbrainz': {
        const username = body.username || (stored?.listenbrainzUsername as string) || ''
        const token = body.token || (stored?.listenbrainzToken as string) || ''
        const client = createListenBrainzClient(username, token)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'lastfm': {
        const username = body.username || (stored?.lastfmUsername as string) || ''
        const apiKey = body.apiKey || (stored?.lastfmApiKey as string) || ''
        const client = createLastFmClient(username, apiKey)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'ai': {
        try {
          const provider = await createProvider(
            body.provider || (stored?.aiProvider as string) || '',
            body.apiKey || (stored?.aiApiKey as string) || null,
            body.model || (stored?.aiModel as string) || '',
            body.baseUrl || (stored?.aiBaseUrl as string) || null,
          )
          const result = await provider.testConnection()
          return c.json(result)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          return c.json({ success: false, message })
        }
      }
      default:
        return c.json({ error: `Unknown service: ${service}` }, 400)
    }
  })

  // Test webhook by sending a test payload to the configured URL
  router.post('/api/settings/test-webhook', async (c) => {
    const stored = await deps.getSettings()
    const prefs = (stored as Record<string, unknown> | null)?.preferences as
      | Record<string, unknown>
      | undefined
    const url = prefs?.webhookUrl as string | undefined
    if (!url) {
      return c.json({ success: false, message: 'No webhook URL configured' })
    }
    try {
      await sendWebhook(url, {
        event: 'batch_complete',
        batchId: 0,
        stats: { discovered: 3, added: 3, failed: 0 },
        message: 'Test notification from digarr.',
        timestamp: new Date().toISOString(),
      })
      return c.json({ success: true, message: 'Test webhook sent' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, message })
    }
  })

  return router
}
