import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRoutes } from './routes/health'
import { setupGuard } from './middleware/setup-guard'

export type AppDependencies = {
  db: unknown
  orchestrator: unknown
  scheduler: unknown
  isSetupComplete: () => Promise<boolean>
}

export function createApp(deps: AppDependencies) {
  const app = new Hono()

  app.use('*', cors())
  app.use('*', setupGuard(deps.isSetupComplete))
  app.route('/', healthRoutes())
  // More routes will be added in Tasks 14-15

  return app
}
