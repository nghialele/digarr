import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { canAutoSetup, envConfig } from './config/env'
import { hashPassword } from './core/auth'
import { OidcService } from './core/auth/oidc'
import { createLidarrClient } from './core/clients/lidarr'
import { createMusicBrainzClient } from './core/clients/musicbrainz'
import { GenreService } from './core/genre/service'
import { runGenreSubscription } from './core/genre/subscription-runner'
import { LibraryHealthService } from './core/library/health'
import { SkyHookWarmer } from './core/library/skyhook-warmer'
import { PipelineOrchestrator } from './core/pipeline/orchestrator'
import type { StoreDb } from './core/pipeline/store'
import { SubscriptionScheduler } from './core/pipeline/subscription-scheduler'
import { createLastFmSource } from './core/plugins/lastfm'
import { createListenBrainzSource } from './core/plugins/listenbrainz'
import { SourceRegistry } from './core/plugins/registry'
import { createDefaultRegistry } from './core/providers/registry'
import { db, pool } from './db'
import { getArtistById, upsertArtist } from './db/queries/artists'
import { sessionQueries } from './db/queries/sessions'
import { completeBatch, getBatch, listBatches } from './db/queries/batches'
import {
  getAllGenres,
  getChildGenres,
  getGenreBySlug,
  searchGenres,
  upsertGenre,
} from './db/queries/genres'
import {
  bulkUpdateStatus,
  getGenreFeedbackHistory,
  getRecommendation,
  getRejectedArtistMbids,
  insertRecommendation,
  listRecommendations,
  updateRecommendationStatus,
} from './db/queries/recommendations'
import type { SetupConfig } from './db/queries/settings'
import { completeSetup, getSettings, isSetupComplete, updateSettings } from './db/queries/settings'
import {
  completeRun,
  createSubscription,
  deleteSubscription,
  getEnabledSubscriptions,
  getRunsForSubscription,
  getSubscription,
  getSubscriptionsByUser,
  insertRun,
  updateSubscription,
} from './db/queries/subscriptions'
import {
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByOidcSubject,
  getUserByUsername,
  getUserCount,
  listUsers,
  updatePassword,
  updateUser,
} from './db/queries/users'
import { artists, DEFAULT_PREFERENCES, recommendationBatches, recommendations } from './db/schema'
import { setSessionStore } from './core/sessions'
import { createApp } from './server'

// Run pending database migrations before anything else.
// Uses drizzle-orm's programmatic migrator -- safe to run every boot (idempotent).
await migrate(db, { migrationsFolder: './drizzle' })
console.log('Database migrations applied')

// Wire up DB-backed session store after migrations are applied.
setSessionStore(sessionQueries(db))

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
  completeBatch: async (id, stats) => {
    await completeBatch(db, id, { ...stats, filtered: 0, scored: 0 })
  },
  upsertArtist: async (data) => {
    const row = await upsertArtist(db, data)
    return { id: row.id }
  },
  insertRecommendation: (data) => insertRecommendation(db, data),
  getRejectedMbids: (cooldownDays) => getRejectedArtistMbids(db, cooldownDays),
  getFeedbackHistory: () => getGenreFeedbackHistory(db),
}

const orchestrator = new PipelineOrchestrator()
const scheduler = new SubscriptionScheduler()
const providerRegistry = createDefaultRegistry()

// Map DB genre rows (artistCount: number | null) to GenreInfo (artistCount: number)
function mapGenreRow(row: Awaited<ReturnType<typeof upsertGenre>>) {
  return { ...row, artistCount: row.artistCount ?? 0 }
}

const genreService = new GenreService({
  genreQueries: {
    upsertGenre: async (data) => mapGenreRow(await upsertGenre(db, data)),
    getGenreBySlug: async (slug) => {
      const row = await getGenreBySlug(db, slug)
      return row ? mapGenreRow(row) : null
    },
    getChildGenres: async (parentId) => {
      const rows = await getChildGenres(db, parentId)
      return rows.map(mapGenreRow)
    },
    searchGenres: async (query, limit) => {
      const rows = await searchGenres(db, query, limit)
      return rows.map(mapGenreRow)
    },
    getAllGenres: async () => {
      const rows = await getAllGenres(db)
      return rows.map(mapGenreRow)
    },
  },
})

// LibraryHealthService uses a lazy Lidarr client that reads current settings per call.
// This avoids the chicken-and-egg problem of needing settings at construction time.
function makeLazyLidarrClient() {
  async function getClient() {
    const s = await getSettings(db)
    if (s?.lidarrUrl && s?.lidarrApiKey) {
      return createLidarrClient(s.lidarrUrl, s.lidarrApiKey, s.skipTlsVerify ?? false)
    }
    return null
  }

  return {
    getArtists: async () => (await getClient())?.getArtists() ?? [],
    getAlbums: async (artistId: number) => (await getClient())?.getAlbums(artistId) ?? [],
    lookupArtist: async (term: string) => (await getClient())?.lookupArtist(term) ?? [],
    updateArtist: async (
      id: number,
      data: Parameters<ReturnType<typeof createLidarrClient>['updateArtist']>[1],
    ) => {
      const client = await getClient()
      if (!client) throw new Error('Lidarr not configured')
      return client.updateArtist(id, data)
    },
    triggerCommand: async (name: string, body?: Record<string, unknown>) => {
      const client = await getClient()
      if (!client) throw new Error('Lidarr not configured')
      return client.triggerCommand(name, body)
    },
    getRootFolders: async () => (await getClient())?.getRootFolders() ?? [],
  }
}

const lazyLidarrClient = makeLazyLidarrClient()

const libraryHealth = new LibraryHealthService({
  lidarrClient: lazyLidarrClient,
  artistCache: {
    getAll: async () => db.select().from(artists),
  },
})

const skyhookWarmer = new SkyHookWarmer({ lookupArtist: lazyLidarrClient.lookupArtist })

const runPipeline = async () => {
  const currentSettings = await getSettings(db)
  if (currentSettings) {
    await orchestrator.run({ db: storeDb, settings: currentSettings, providerRegistry })
  }
}

// Shared subscription query facade (used both by routes and scheduler)
const subscriptionQueriesImpl = {
  createSubscription: (data: Parameters<typeof createSubscription>[1]) =>
    createSubscription(db, data),
  getSubscription: (id: number) => getSubscription(db, id),
  getSubscriptionsByUser: (userId: number) => getSubscriptionsByUser(db, userId),
  updateSubscription: (id: number, data: Parameters<typeof updateSubscription>[2]) =>
    updateSubscription(db, id, data),
  deleteSubscription: (id: number) => deleteSubscription(db, id),
  getRunsForSubscription: (id: number, limit?: number) => getRunsForSubscription(db, id, limit),
  insertRun: (data: Parameters<typeof insertRun>[1]) => insertRun(db, data),
  completeRun: (id: number, data: Parameters<typeof completeRun>[2]) => completeRun(db, id, data),
}

async function executeSubscription(subscriptionId: number): Promise<void> {
  const sub = await getSubscription(db, subscriptionId)
  if (!sub) {
    console.warn(`[subscription-runner] Subscription ${subscriptionId} not found -- skipping`)
    return
  }

  const settings = await getSettings(db)
  const prefs = {
    ...DEFAULT_PREFERENCES,
    ...settings?.preferences,
    scoringWeights: {
      ...DEFAULT_PREFERENCES.scoringWeights,
      ...settings?.preferences?.scoringWeights,
    },
  }

  const lidarrClient =
    settings?.lidarrUrl && settings?.lidarrApiKey
      ? createLidarrClient(
          settings.lidarrUrl,
          settings.lidarrApiKey,
          settings.skipTlsVerify ?? false,
        )
      : null

  const rejectedMbids = await storeDb.getRejectedMbids(prefs.rejectionCooldownDays)
  const feedbackHistory = await storeDb.getFeedbackHistory()

  // Build source registry fresh per run (same pattern as orchestrator)
  const sourceRegistry = new SourceRegistry()
  if (settings?.listenbrainzUsername && settings?.listenbrainzToken) {
    sourceRegistry.register(
      createListenBrainzSource(settings.listenbrainzUsername, settings.listenbrainzToken),
    )
  }
  if (settings?.lastfmUsername && settings?.lastfmApiKey) {
    sourceRegistry.register(createLastFmSource(settings.lastfmUsername, settings.lastfmApiKey))
  }

  await runGenreSubscription({
    subscription: {
      id: sub.id,
      userId: sub.userId,
      sourceConfig: sub.sourceConfig,
      maxArtistsPerRun: sub.maxArtistsPerRun,
      scoreThreshold: sub.scoreThreshold,
      scoringWeightPreset: sub.scoringWeightPreset,
      scoringWeightOverrides: sub.scoringWeightOverrides,
    },
    sources: sourceRegistry.withCapability('genreArtists'),
    mbClient: createMusicBrainzClient(),
    lidarrClient,
    storeDb,
    subscriptionQueries: subscriptionQueriesImpl,
    libraryMbids: new Set<string>(),
    libraryGenres: [],
    rejectedMbids,
    feedbackHistory,
    cooldownDays: prefs.rejectionCooldownDays,
    defaultScoreThreshold: prefs.scoreThreshold,
  })
}

// Lazy OIDC service getter -- reads current settings from DB on each call,
// reconstructs the service only when the config (issuer/client/secret/scopes) changes.
// This ensures settings-UI changes to OIDC config take effect without a restart.
let oidcServiceCache: { service: OidcService; configKey: string } | null = null

async function getOidcService(): Promise<OidcService | null> {
  const settings = await getSettings(db)

  // DB settings take precedence; env vars are fallback
  const issuerUrl =
    (settings?.oidcIssuerUrl as string | undefined) ?? envConfig.oidcIssuerUrl ?? ''
  const clientId = (settings?.oidcClientId as string | undefined) ?? envConfig.oidcClientId ?? ''
  const clientSecret =
    (settings?.oidcClientSecret as string | undefined) ?? envConfig.oidcClientSecret ?? ''
  const scopes =
    (settings?.oidcScopes as string | undefined) ?? envConfig.oidcScopes ?? 'openid profile email'

  if (!issuerUrl || !clientId) return null

  const configKey = `${issuerUrl}|${clientId}|${clientSecret}|${scopes}`
  if (oidcServiceCache?.configKey === configKey) {
    return oidcServiceCache.service
  }

  const service = new OidcService({ issuerUrl, clientId, clientSecret, scopes })
  oidcServiceCache = { service, configKey }
  return service
}

const app = createApp({
  db,
  storeDb,
  orchestrator,
  scheduler,
  providerRegistry,
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
  restartScheduler: (cron: string | null) => {
    if (!cron) {
      scheduler.remove('main-pipeline')
      console.log('Scheduler stopped')
      return
    }
    scheduler.schedule('main-pipeline', cron, runPipeline)
    console.log(`Scheduler restarted with cron: ${cron}`)
  },
  createUser: (data) => createUser(db, data),
  getUserByUsername: (username) => getUserByUsername(db, username),
  getUserById: (id) => getUserById(db, id),
  getUserCount: () => getUserCount(db),
  updatePassword: (id, hash) => updatePassword(db, id, hash),
  getOidcService,
  getUserByOidcSubject: (subject) => getUserByOidcSubject(db, subject),
  getUserByEmail: (email) => getUserByEmail(db, email),
  updateUser: (id, data) => updateUser(db, id, data),
  listUsers: () => listUsers(db),
  deleteUser: (id) => deleteUser(db, id),
  genreService,
  libraryHealth,
  skyhookWarmer,
  subscriptionQueries: subscriptionQueriesImpl,
  runSubscription: (id) => executeSubscription(id),
})

const port = envConfig.port
const server = serve({ fetch: app.fetch, port })

// Auto-complete setup from env vars, then bootstrap user, then start scheduler
isSetupComplete(db)
  .then(async (done) => {
    if (!done && canAutoSetup()) {
      const config: SetupConfig = {
        lidarrUrl: envConfig.lidarrUrl ?? '',
        lidarrApiKey: envConfig.lidarrApiKey ?? '',
        skipTlsVerify: envConfig.skipTlsVerify,
        listenbrainzUsername: envConfig.listenbrainzUsername,
        listenbrainzToken: envConfig.listenbrainzToken,
        lastfmUsername: envConfig.lastfmUsername,
        lastfmApiKey: envConfig.lastfmApiKey,
        aiProvider: envConfig.aiProvider,
        aiApiKey: envConfig.aiApiKey,
        aiModel: envConfig.aiModel,
        aiBaseUrl: envConfig.aiBaseUrl,
      }
      // Include webhook URL in initial preferences with full defaults
      if (envConfig.webhookUrl) {
        config.preferences = { ...DEFAULT_PREFERENCES, webhookUrl: envConfig.webhookUrl }
      }
      await completeSetup(db, config)
      console.log('Setup auto-completed from environment variables')
    }
  })
  .then(async () => {
    // Bootstrap initial admin user from env vars if no users exist
    const { initialUsername, initialPassword } = envConfig
    if (initialUsername && initialPassword) {
      if (initialPassword.length < 8) {
        console.error(
          'DIGARR_INITIAL_PASSWORD must be at least 8 characters -- skipping user creation',
        )
      } else {
        const count = await getUserCount(db)
        if (count === 0) {
          const passwordHash = hashPassword(initialPassword)
          await createUser(db, { username: initialUsername, passwordHash, isAdmin: true })
          console.log(`Initial admin user "${initialUsername}" created from environment variables`)
        }
      }
    }
  })
  .then(() => getSettings(db))
  .then((settings) => {
    const cron = settings?.preferences?.scheduleCron
    if (cron) {
      scheduler.schedule('main-pipeline', cron, runPipeline)
      console.log(`Scheduler started with cron: ${cron}`)
    }
  })
  .then(() => getEnabledSubscriptions(db))
  .then((subs) => {
    for (const sub of subs) {
      scheduler.schedule(`subscription-${sub.id}`, sub.cron, () => executeSubscription(sub.id))
      console.log(`Subscription '${sub.name}' (id=${sub.id}) scheduled with cron: ${sub.cron}`)
    }
  })
  .catch((err: unknown) => {
    console.error('Failed to initialize:', err)
  })

// Clean up expired sessions every 6 hours
setInterval(async () => {
  try {
    await sessionQueries(db).deleteExpired()
  } catch { /* best-effort cleanup */ }
}, 6 * 60 * 60 * 1000)

console.log(`Digarr running on http://localhost:${port}`)
if (!envConfig.allowedOrigin && process.env.NODE_ENV === 'production') {
  console.warn(
    'ALLOWED_ORIGIN not set -- CORS allows all origins. Set ALLOWED_ORIGIN for production security.',
  )
}

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, shutting down...`)
    scheduler.stopAll()
    server.close()
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await pool.end()
    process.exit(0)
  })
}
