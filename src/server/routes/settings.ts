import { Hono } from 'hono'
import { createLastFmClient } from '@/core/clients/lastfm'
import { createLidarrClient } from '@/core/clients/lidarr'
import { createListenBrainzClient } from '@/core/clients/listenbrainz'
import { sendWebhook } from '@/core/notifications'
import { isHttpUrl } from '@/core/validation'
import { getUserConnections, updateUserConnections } from '@/db/queries/users'
import type { AppDependencies } from '@/server'
import type { HonoEnv } from '@/server/types'

const SECRET_FIELDS = [
  'lidarrApiKey',
  'listenbrainzToken',
  'lastfmApiKey',
  'aiApiKey',
  'oidcClientSecret',
  'plexToken',
  'jellyfinApiKey',
  'discogsToken',
] as const

type SettingsResponse = Record<string, unknown>

function maskSecrets(settings: Record<string, unknown>): SettingsResponse {
  const masked: SettingsResponse = { ...settings }
  for (const field of SECRET_FIELDS) {
    masked[field] = '***'
  }
  return masked
}

async function buildSettingsResponse(
  deps: AppDependencies,
  userId: number | undefined,
): Promise<Record<string, unknown> | null> {
  const row = await deps.getSettings()
  if (!row) return null

  const response: Record<string, unknown> = { ...(row as Record<string, unknown>) }

  if (userId) {
    const userConns = await getUserConnections(deps.db, userId)
    if (userConns) {
      if (userConns.listenbrainzUsername !== null) {
        response.listenbrainzUsername = userConns.listenbrainzUsername
        response.listenbrainzToken = userConns.listenbrainzToken
        response._listenbrainzScope = 'user'
      }
      if (userConns.lastfmUsername !== null) {
        response.lastfmUsername = userConns.lastfmUsername
        response.lastfmApiKey = userConns.lastfmApiKey
        response._lastfmScope = 'user'
      }
      if (userConns.plexUrl !== null) {
        response.plexUrl = userConns.plexUrl
        response.plexToken = userConns.plexToken
        response._plexScope = 'user'
      }
      if (userConns.jellyfinUrl !== null) {
        response.jellyfinUrl = userConns.jellyfinUrl
        response.jellyfinApiKey = userConns.jellyfinApiKey
        response.jellyfinUserId = userConns.jellyfinUserId
        response._jellyfinScope = 'user'
      }
      if (userConns.discogsUsername !== null) {
        response.discogsUsername = userConns.discogsUsername
        response.discogsToken = userConns.discogsToken
        response._discogsScope = 'user'
      }
    }
  }

  return response
}

export function settingsRoutes(deps: AppDependencies) {
  const router = new Hono<HonoEnv>()

  router.get('/api/settings', async (c) => {
    const userId = c.get('userId')
    const response = await buildSettingsResponse(deps, userId)
    if (!response) {
      return c.json({ error: 'Settings not found' }, 404)
    }
    return c.json(maskSecrets(response))
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
    'oidcIssuerUrl',
    'oidcClientId',
    'oidcClientSecret',
    'oidcScopes',
    'plexUrl',
    'plexToken',
    'jellyfinUrl',
    'jellyfinApiKey',
    'jellyfinUserId',
    'discogsToken',
    'discogsUsername',
  ])

  const USER_CONNECTION_FIELDS = new Set([
    'listenbrainzUsername',
    'listenbrainzToken',
    'lastfmUsername',
    'lastfmApiKey',
    'plexUrl',
    'plexToken',
    'jellyfinUrl',
    'jellyfinApiKey',
    'jellyfinUserId',
    'discogsToken',
    'discogsUsername',
  ])

  router.patch('/api/settings', async (c) => {
    const body = await c.req.json()
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (MUTABLE_FIELDS.has(key)) {
        sanitized[key] = value
      }
    }

    const userId = c.get('userId')
    if (userId) {
      const userUpdate: Record<string, string | null> = {}
      const globalSanitized: Record<string, unknown> = {}

      for (const [key, val] of Object.entries(sanitized)) {
        if (USER_CONNECTION_FIELDS.has(key)) {
          userUpdate[key] = (val as string | null | undefined) ?? null
        } else {
          globalSanitized[key] = val
        }
      }

      if (Object.keys(userUpdate).length > 0) {
        await updateUserConnections(deps.db, userId, userUpdate)
      }

      // Replace sanitized with only global fields
      for (const key of Object.keys(sanitized)) {
        delete sanitized[key]
      }
      for (const [key, val] of Object.entries(globalSanitized)) {
        sanitized[key] = val
      }
    }

    await deps.updateSettings(sanitized)

    const prefs = sanitized.preferences as Record<string, unknown> | undefined
    if (prefs?.scheduleCron !== undefined && typeof prefs.scheduleCron === 'string') {
      try {
        deps.restartScheduler(prefs.scheduleCron || null)
      } catch (err: unknown) {
        console.error('Failed to apply cron expression:', err)
        const row = await buildSettingsResponse(deps, userId)
        return c.json({
          ...maskSecrets((row ?? {}) as Record<string, unknown>),
          warning: 'Settings saved but cron expression is invalid',
        })
      }
    }

    const response = await buildSettingsResponse(deps, userId)
    if (!response) {
      return c.json({ error: 'Settings not found' }, 404)
    }
    return c.json(maskSecrets(response))
  })

  router.post('/api/settings/test/:service', async (c) => {
    const service = c.req.param('service')
    const body = await c.req.json()

    // SSRF mitigation: reject non-HTTP URLs before they reach service clients
    for (const field of ['url', 'baseUrl'] as const) {
      const val = (body as Record<string, unknown>)[field]
      if (typeof val === 'string' && val && !isHttpUrl(val)) {
        return c.json({ success: false, message: 'URL must start with http:// or https://' }, 400)
      }
    }

    // Fall back to stored credentials when the request sends empty keys
    const stored = (await deps.getSettings()) as Record<string, unknown> | null
    const testUserId = c.get('userId')
    const userConns = testUserId ? await getUserConnections(deps.db, testUserId) : null

    switch (service) {
      case 'lidarr': {
        const url = body.url || (stored?.lidarrUrl as string) || ''
        const apiKey = body.apiKey || (stored?.lidarrApiKey as string) || ''
        const client = createLidarrClient(url, apiKey, body.skipTlsVerify)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'listenbrainz': {
        const username =
          body.username ||
          userConns?.listenbrainzUsername ||
          (stored?.listenbrainzUsername as string) ||
          ''
        const token =
          body.token || userConns?.listenbrainzToken || (stored?.listenbrainzToken as string) || ''
        const client = createListenBrainzClient(username, token)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'lastfm': {
        const username =
          body.username || userConns?.lastfmUsername || (stored?.lastfmUsername as string) || ''
        const apiKey =
          body.apiKey || userConns?.lastfmApiKey || (stored?.lastfmApiKey as string) || ''
        const client = createLastFmClient(username, apiKey)
        const result = await client.testConnection()
        return c.json(result)
      }
      case 'ai': {
        try {
          const provider = await deps.providerRegistry.create(
            body.provider || (stored?.aiProvider as string) || '',
            {
              apiKey: body.apiKey || (stored?.aiApiKey as string) || null,
              model: body.model || (stored?.aiModel as string) || '',
              baseUrl: body.baseUrl || (stored?.aiBaseUrl as string) || null,
            },
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
