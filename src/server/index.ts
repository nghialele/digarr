import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRoutes } from './routes/health'
import { setupRoutes } from './routes/setup'
import { settingsRoutes } from './routes/settings'
import { setupGuard } from './middleware/setup-guard'
import type { SetupConfig } from '@/db/queries/settings'

export type AppDependencies = {
  db: unknown
  orchestrator: unknown
  scheduler: unknown
  isSetupComplete: () => Promise<boolean>
  getSettings: () => Promise<Record<string, unknown> | null>
  updateSettings: (partial: Record<string, unknown>) => Promise<void>
  completeSetup: (config: SetupConfig) => Promise<unknown>
}

export function createApp(deps: AppDependencies) {
  const app = new Hono()

  app.use('*', cors())
  app.use('*', setupGuard(deps.isSetupComplete))
  app.route('/', healthRoutes())
  app.route('/', setupRoutes(deps))
  app.route('/', settingsRoutes(deps))

  return app
}
