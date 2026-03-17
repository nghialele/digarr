import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRoutes } from './routes/health'
import { setupRoutes } from './routes/setup'
import { settingsRoutes } from './routes/settings'
import { pipelineRoutes } from './routes/pipeline'
import { recommendationRoutes } from './routes/recommendations'
import { batchRoutes } from './routes/batches'
import { artistRoutes } from './routes/artists'
import { lidarrRoutes } from './routes/lidarr'
import { setupGuard } from './middleware/setup-guard'
import type { SetupConfig } from '@/db/queries/settings'
import type { PipelineOrchestrator } from '@/core/pipeline/orchestrator'
import type { PipelineScheduler } from '@/core/pipeline/scheduler'
import type { ListRecommendationsFilters, ListRecommendationsResult, RecommendationWithArtist, StatusUpdateExtra } from '@/db/queries/recommendations'

export type AppDependencies = {
  db: unknown
  orchestrator: PipelineOrchestrator
  scheduler: PipelineScheduler
  isSetupComplete: () => Promise<boolean>
  getSettings: () => Promise<Record<string, unknown> | null>
  updateSettings: (partial: Record<string, unknown>) => Promise<void>
  completeSetup: (config: SetupConfig) => Promise<unknown>
  // Pipeline status
  getLastBatch: () => Promise<{ id: number; createdAt: Date | string; status: string } | null>
  // Recommendation query functions
  listRecommendations: (filters?: ListRecommendationsFilters) => Promise<ListRecommendationsResult>
  getRecommendation: (id: number) => Promise<RecommendationWithArtist | null>
  updateRecommendationStatus: (id: number, status: string, extra?: StatusUpdateExtra) => Promise<void>
  bulkUpdateStatus: (ids: number[], status: string) => Promise<void>
  // Batch query functions
  listBatches: () => Promise<unknown[]>
  getBatch: (id: number) => Promise<unknown | null>
  // Artist query functions
  getArtistById: (id: number) => Promise<unknown | null>
}

export function createApp(deps: AppDependencies) {
  const app = new Hono()

  app.use('*', cors())
  app.use('*', setupGuard(deps.isSetupComplete))
  app.route('/', healthRoutes())
  app.route('/', setupRoutes(deps))
  app.route('/', settingsRoutes(deps))
  app.route('/', pipelineRoutes(deps))
  app.route('/', recommendationRoutes(deps))
  app.route('/', batchRoutes(deps))
  app.route('/', artistRoutes(deps))
  app.route('/', lidarrRoutes(deps))

  return app
}
