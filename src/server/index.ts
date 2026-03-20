import { resolve } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { envConfig } from '@/config/env'
import type { ServiceTestResult } from '@/core/types'
import type { OidcService } from '@/core/auth/oidc'
import type { GenreService } from '@/core/genre/service'
import type { LibraryHealthService } from '@/core/library/health'
import type { SkyHookWarmer } from '@/core/library/skyhook-warmer'
import type { PipelineOrchestrator } from '@/core/pipeline/orchestrator'
import type { SubscriptionScheduler } from '@/core/pipeline/subscription-scheduler'
import type { AiProviderRegistry } from '@/core/providers/registry'
import type {
  ListRecommendationsFilters,
  ListRecommendationsResult,
  RecommendationWithArtist,
  StatusUpdateExtra,
} from '@/db/queries/recommendations'
import type { SetupConfig } from '@/db/queries/settings'
import type { SubscriptionInsert, SubscriptionUpdate } from '@/db/queries/subscriptions'
import type { TargetInsert, TargetRow, TargetUpdate } from '@/db/queries/targets'
import type { UserPublic } from '@/db/queries/users'
import { VERSION } from '@/version'
import { authGuard } from './middleware/auth'
import { requestLogger } from './middleware/logger'
import { proxyAuthMiddleware } from './middleware/proxy-auth'
import { setupGuard } from './middleware/setup-guard'
import { analyticsRoutes } from './routes/analytics'
import { exportRoutes } from './routes/exports'
import { artistRoutes } from './routes/artists'
import { authRoutes } from './routes/auth'
import { batchRoutes } from './routes/batches'
import { genreRoutes } from './routes/genres'
import { healthRoutes } from './routes/health'
import { libraryRoutes } from './routes/library'
import { lidarrRoutes } from './routes/lidarr'
import { listeningRoutes } from './routes/listening'
import { oidcRoutes } from './routes/oidc'
import { pipelineRoutes } from './routes/pipeline'
import { recommendationRoutes } from './routes/recommendations'
import { settingsRoutes } from './routes/settings'
import { setupRoutes } from './routes/setup'
import { subscriptionRoutes } from './routes/subscriptions'
import { targetRoutes } from './routes/targets'
import { userRoutes } from './routes/users'
import type { HonoEnv } from './types'

export type AppDependencies = {
  db: import('@/db').Database
  storeDb: import('@/core/pipeline/store').StoreDb
  orchestrator: PipelineOrchestrator
  scheduler: SubscriptionScheduler
  providerRegistry: AiProviderRegistry
  isSetupComplete: () => Promise<boolean>
  getSettings: () => Promise<Record<string, unknown> | null>
  updateSettings: (partial: Record<string, unknown>) => Promise<void>
  completeSetup: (config: SetupConfig) => Promise<unknown>
  // Pipeline status
  getLastBatch: () => Promise<{ id: number; createdAt: Date | string; status: string } | null>
  // Recommendation query functions
  listRecommendations: (filters?: ListRecommendationsFilters) => Promise<ListRecommendationsResult>
  getRecommendation: (id: number) => Promise<RecommendationWithArtist | null>
  updateRecommendationStatus: (
    id: number,
    status: string,
    extra?: StatusUpdateExtra,
  ) => Promise<void>
  bulkUpdateStatus: (ids: number[], status: string) => Promise<void>
  // Batch query functions
  listBatches: () => Promise<unknown[]>
  getBatch: (id: number) => Promise<unknown | null>
  // Artist query functions
  getArtistById: (id: number) => Promise<unknown | null>
  restartScheduler: (cron: string | null) => void
  // User query functions
  createUser: (data: {
    username: string
    passwordHash: string
    isAdmin?: boolean
  }) => Promise<UserPublic>
  getUserByUsername: (
    username: string,
  ) => Promise<{ id: number; username: string; passwordHash: string; isAdmin: boolean } | null>
  getUserById: (id: number) => Promise<UserPublic | null>
  getUserCount: () => Promise<number>
  updatePassword: (id: number, passwordHash: string) => Promise<void>
  // OIDC + user management
  getOidcService: () => Promise<OidcService | null>
  getUserByOidcSubject: (subject: string) => Promise<{ id: number; username: string } | null>
  getUserByEmail: (email: string) => Promise<{ id: number; username: string } | null>
  updateUser: (
    id: number,
    data: { isAdmin?: boolean; email?: string; oidcSubject?: string },
  ) => Promise<void>
  listUsers: () => Promise<UserPublic[]>
  deleteUser: (id: number) => Promise<void>
  // Genre service
  genreService: GenreService
  // Library health service
  libraryHealth: LibraryHealthService
  // SkyHook cache warmer (optional -- absent if Lidarr is not configured)
  skyhookWarmer?: SkyHookWarmer | null
  // Subscription query functions
  subscriptionQueries: {
    createSubscription: (data: SubscriptionInsert) => Promise<{ id: number; userId: number | null }>
    getSubscription: (id: number) => Promise<{ id: number; userId: number | null } | null>
    getSubscriptionsByUser: (userId: number) => Promise<{ id: number; userId: number | null }[]>
    updateSubscription: (id: number, data: SubscriptionUpdate) => Promise<void>
    deleteSubscription: (id: number) => Promise<void>
    getRunsForSubscription: (id: number, limit?: number) => Promise<unknown[]>
  }
  // Manual subscription trigger
  runSubscription: (id: number) => Promise<void>
  // Target management
  targetQueries: {
    createTarget: (data: TargetInsert) => Promise<{ id: number }>
    getTargetsByUser: (userId: number) => Promise<TargetRow[]>
    getTarget: (id: number) => Promise<TargetRow | null>
    updateTarget: (id: number, data: TargetUpdate) => Promise<void>
    deleteTarget: (id: number) => Promise<void>
  }
  testTargetConnection: (
    type: string,
    config: Record<string, unknown>,
  ) => Promise<ServiceTestResult>
  getEnabledTargetsForUser: (
    userId: number,
  ) => Promise<import('@/core/targets/types').DestinationTarget[]>
}

export function createApp(deps: AppDependencies) {
  const app = new Hono<HonoEnv>()

  // Log all requests first -- before auth/cors so we capture everything
  app.use('*', requestLogger())

  app.use(
    '*',
    cors({
      origin: envConfig.allowedOrigin ?? '*',
    }),
  )
  app.use(
    '*',
    proxyAuthMiddleware({
      enabled: envConfig.proxyAuthEnabled,
      trustedProxies:
        envConfig.proxyAuthTrustedProxies
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean) ?? [],
      getUserByUsername: deps.getUserByUsername,
      createUser: deps.createUser,
      getUserCount: deps.getUserCount,
    }),
  )
  app.use(
    '*',
    authGuard(async () => (await deps.getUserCount()) > 0),
  )
  app.use('*', setupGuard(deps.isSetupComplete))

  // Auth status (unauthenticated -- tells the frontend whether auth is required)
  app.get('/api/auth/status', async (c) => {
    const userCount = await deps.getUserCount()
    const proxyAuth = c.get('proxyAuth')
    const sessionToken = c.get('sessionToken')
    const settings = await deps.getSettings()
    const oidcEnabled = !!(
      settings &&
      (settings as Record<string, unknown>).oidcIssuerUrl &&
      (settings as Record<string, unknown>).oidcClientId
    )

    const response: Record<string, unknown> = {
      required: userCount > 0 || !!envConfig.authToken,
      hasUsers: userCount > 0,
      oidcEnabled,
      proxyAuthEnabled: envConfig.proxyAuthEnabled,
      version: VERSION,
    }

    if (proxyAuth && sessionToken) {
      response.proxyAuth = true
      response.token = sessionToken
      response.userId = c.get('userId')
    }

    return c.json(response)
  })

  app.route(
    '/',
    oidcRoutes({
      getOidcService: deps.getOidcService,
      getUserByOidcSubject: deps.getUserByOidcSubject,
      getUserByEmail: deps.getUserByEmail,
      getUserByUsername: deps.getUserByUsername,
      createUser: deps.createUser,
      getUserCount: deps.getUserCount,
      updateUser: deps.updateUser,
    }),
  )
  app.route('/', authRoutes(deps))
  app.route('/', healthRoutes({ db: deps.db }))
  app.route('/', setupRoutes(deps))
  app.route('/', settingsRoutes(deps))
  app.route('/', pipelineRoutes(deps))
  app.route('/', recommendationRoutes(deps))
  app.route('/', batchRoutes(deps))
  app.route('/', analyticsRoutes(deps))
  app.route('/', artistRoutes(deps))
  app.route('/', lidarrRoutes(deps))
  app.route('/', listeningRoutes(deps))
  app.route('/', genreRoutes(deps))
  app.route('/', subscriptionRoutes(deps))
  app.route('/', userRoutes(deps))
  app.route('/', targetRoutes(deps))
  app.route('/', exportRoutes(deps))
  app.route(
    '/',
    libraryRoutes({ libraryHealth: deps.libraryHealth, skyhookWarmer: deps.skyhookWarmer }),
  )

  // Serve built SPA in production (dev uses Vite's dev server with proxy)
  // Absolute path required: @hono/node-server serveStatic resolves relative
  // to the module directory (dist/server/), not process.cwd()
  if (process.env.NODE_ENV === 'production') {
    const webRoot = resolve(process.cwd(), 'dist/web')
    app.use('/*', serveStatic({ root: webRoot }))
    app.get('*', serveStatic({ root: webRoot, path: 'index.html' }))
  }

  return app
}
