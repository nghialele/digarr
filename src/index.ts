import { serve } from '@hono/node-server'
import { db, pool } from './db'
import { createApp } from './server'
import { PipelineOrchestrator } from './core/pipeline/orchestrator'
import { PipelineScheduler } from './core/pipeline/scheduler'
import { isSetupComplete } from './db/queries/settings'

const orchestrator = new PipelineOrchestrator()
const scheduler = new PipelineScheduler()

const app = createApp({
  db,
  orchestrator,
  scheduler,
  isSetupComplete: () => isSetupComplete(db),
})

const port = Number(process.env.PORT ?? 3000)
const server = serve({ fetch: app.fetch, port })

console.log(`Digarr running on http://localhost:${port}`)

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, shutting down...`)
    scheduler.stop()
    server.close()
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await pool.end()
    process.exit(0)
  })
}
