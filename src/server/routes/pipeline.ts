import { Hono } from 'hono'
import type { PipelineDeps } from '@/core/pipeline/orchestrator'
import type { AppDependencies } from '@/server'
import { createPipelineSSEStream } from '@/server/sse'

export function pipelineRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.post('/api/pipeline/run', async (c) => {
    if (deps.orchestrator.isRunning) {
      return c.json({ error: 'Pipeline already running' }, 409)
    }

    const settings = await deps.getSettings()
    if (!settings) {
      return c.json({ error: 'Settings not found' }, 400)
    }

    // Fire-and-forget -- cast to PipelineDeps since AppDependencies uses loose types
    deps.orchestrator
      .run({ db: deps.db, settings } as unknown as PipelineDeps)
      .catch((err: unknown) => {
        console.error('Pipeline run failed:', err)
      })

    return c.json({ message: 'Pipeline started' }, 202)
  })

  router.get('/api/pipeline/status', async (c) => {
    const lastBatch = await deps.getLastBatch()
    return c.json({
      running: deps.orchestrator.isRunning,
      lastRun: lastBatch
        ? {
            batchId: lastBatch.id,
            completedAt: lastBatch.createdAt,
            status: lastBatch.status,
          }
        : undefined,
    })
  })

  router.get('/api/pipeline/events', (_c) => {
    const stream = createPipelineSSEStream(deps.orchestrator)
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })

  return router
}
