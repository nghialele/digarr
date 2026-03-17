import { Hono } from 'hono'
import type { AppDependencies } from '@/server'

export function batchRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/batches', async (c) => {
    const batches = await deps.listBatches()
    return c.json(batches)
  })

  router.get('/api/batches/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const batch = await deps.getBatch(id)
    if (!batch) {
      return c.json({ error: 'Batch not found' }, 404)
    }
    return c.json(batch)
  })

  return router
}
