function env(key: string): string | undefined {
  const val = process.env[key]
  return val || undefined
}

function envBool(key: string, fallback = false): boolean {
  const val = process.env[key]
  if (!val) return fallback
  return val === 'true' || val === '1'
}

function envInt(key: string): number | undefined {
  const val = process.env[key]
  if (!val) return undefined
  const n = Number.parseInt(val, 10)
  return Number.isNaN(n) ? undefined : n
}

export const envConfig = {
  // Database
  databaseUrl: env('DATABASE_URL'),
  dbHost: env('DB_HOST'),
  dbPort: envInt('DB_PORT'),
  dbUser: env('DB_USER'),
  dbPass: env('DB_PASS'),
  dbName: env('DB_NAME'),

  // Server
  port: envInt('PORT') ?? 3000,
  allowedOrigin: env('ALLOWED_ORIGIN'),

  // Lidarr
  lidarrUrl: env('LIDARR_URL'),
  lidarrApiKey: env('LIDARR_API_KEY'),
  skipTlsVerify: envBool('SKIP_TLS_VERIFY'),

  // ListenBrainz
  listenbrainzUsername: env('LISTENBRAINZ_USERNAME'),
  listenbrainzToken: env('LISTENBRAINZ_TOKEN'),

  // Last.fm
  lastfmUsername: env('LASTFM_USERNAME'),
  lastfmApiKey: env('LASTFM_API_KEY'),

  // AI provider
  aiProvider: env('AI_PROVIDER'),
  aiApiKey: env('AI_API_KEY'),
  aiModel: env('AI_MODEL'),
  aiBaseUrl: env('AI_BASE_URL'),

  // Auth
  authToken: env('DIGARR_AUTH_TOKEN') ?? null,

  // Initial user (created on boot if no users exist)
  initialUsername: env('DIGARR_INITIAL_USERNAME'),
  initialPassword: env('DIGARR_INITIAL_PASSWORD'),

  // Webhook (injected into preferences during auto-setup only)
  webhookUrl: env('WEBHOOK_URL'),

  // Proxy auth
  proxyAuthEnabled: envBool('PROXY_AUTH_ENABLED'),
  proxyAuthTrustedProxies: env('PROXY_AUTH_TRUSTED_PROXIES'), // comma-separated CIDRs

  // OIDC (fallbacks for DB settings)
  oidcIssuerUrl: env('OIDC_ISSUER_URL'),
  oidcClientId: env('OIDC_CLIENT_ID'),
  oidcClientSecret: env('OIDC_CLIENT_SECRET'),
  oidcScopes: env('OIDC_SCOPES'),
} as const

export type EnvConfig = typeof envConfig

/**
 * Build a DATABASE_URL from either the env var directly or individual DB_* vars.
 * Throws if neither is configured.
 */
export function buildDatabaseUrl(): string {
  if (envConfig.databaseUrl) return envConfig.databaseUrl

  const { dbHost, dbPort, dbUser, dbPass, dbName } = envConfig
  if (dbHost && dbUser && dbName) {
    const port = dbPort ?? 5432
    const pass = dbPass ? `:${dbPass}` : ''
    return `postgresql://${dbUser}${pass}@${dbHost}:${port}/${dbName}`
  }

  throw new Error('DATABASE_URL or DB_HOST + DB_USER + DB_NAME must be set')
}

/** Settings fields that can be sourced from env vars (fallback for null DB values). */
export function envSettingsOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {}
  if (envConfig.lidarrUrl) overrides.lidarrUrl = envConfig.lidarrUrl
  if (envConfig.lidarrApiKey) overrides.lidarrApiKey = envConfig.lidarrApiKey
  // skipTlsVerify is NOT NULL in the DB (defaults false), so null-merge never applies
  if (envConfig.listenbrainzUsername)
    overrides.listenbrainzUsername = envConfig.listenbrainzUsername
  if (envConfig.listenbrainzToken) overrides.listenbrainzToken = envConfig.listenbrainzToken
  if (envConfig.lastfmUsername) overrides.lastfmUsername = envConfig.lastfmUsername
  if (envConfig.lastfmApiKey) overrides.lastfmApiKey = envConfig.lastfmApiKey
  if (envConfig.aiProvider) overrides.aiProvider = envConfig.aiProvider
  if (envConfig.aiApiKey) overrides.aiApiKey = envConfig.aiApiKey
  if (envConfig.aiModel) overrides.aiModel = envConfig.aiModel
  if (envConfig.aiBaseUrl) overrides.aiBaseUrl = envConfig.aiBaseUrl
  if (envConfig.oidcIssuerUrl) overrides.oidcIssuerUrl = envConfig.oidcIssuerUrl
  if (envConfig.oidcClientId) overrides.oidcClientId = envConfig.oidcClientId
  if (envConfig.oidcClientSecret) overrides.oidcClientSecret = envConfig.oidcClientSecret
  if (envConfig.oidcScopes) overrides.oidcScopes = envConfig.oidcScopes
  return overrides
}

/** True if env vars contain all required fields to auto-complete setup. */
export function canAutoSetup(): boolean {
  const { aiProvider, aiModel, listenbrainzUsername, lastfmUsername } = envConfig
  // AI provider + model are always required
  if (!aiProvider || !aiModel) return false
  // At least one listening source is required for the pipeline to produce results
  if (!listenbrainzUsername && !lastfmUsername) return false
  // Lidarr is optional -- if not set, runs in discovery-only mode
  return true
}
