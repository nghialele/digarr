import { resolve } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { envConfig } from '@/config/env'
import type { PipelineOrchestrator } from '@/core/pipeline/orchestrator'
import type { PipelineScheduler } from '@/core/pipeline/scheduler'
import type { AiProviderRegistry } from '@/core/providers/registry'
import type {
  ListRecommendationsFilters,
  ListRecommendationsResult,
  RecommendationWithArtist,
  StatusUpdateExtra,
} from '@/db/queries/recommendations'
import type { SetupConfig } from '@/db/queries/settings'
import type { UserPublic } from '@/db/queries/users'
import { authGuard } from './middleware/auth'
import { setupGuard } from './middleware/setup-guard'
import { analyticsRoutes } from './routes/analytics'
import { artistRoutes } from './routes/artists'
import { authRoutes } from './routes/auth'
import { batchRoutes } from './routes/batches'
import { healthRoutes } from './routes/health'
import { lidarrRoutes } from './routes/lidarr'
import { listeningRoutes } from './routes/listening'
import { pipelineRoutes } from './routes/pipeline'
import { recommendationRoutes } from './routes/recommendations'
import { settingsRoutes } from './routes/settings'
import { setupRoutes } from './routes/setup'

export type AppDependencies = {
  db: import('@/db').Database
  storeDb: import('@/core/pipeline/store').StoreDb
  orchestrator: PipelineOrchestrator
  scheduler: PipelineScheduler
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
}

export function createApp(deps: AppDependencies) {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: envConfig.allowedOrigin ?? (process.env.NODE_ENV === 'production' ? '' : '*'),
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
    return c.json({
      required: userCount > 0 || !!envConfig.authToken,
      hasUsers: userCount > 0,
    })
  })

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
