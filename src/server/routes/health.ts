import { Hono } from 'hono'

export function healthRoutes() {
  const router = new Hono()

  router.get('/health', async (c) => {
    return c.json({ status: 'ok' })
  })

  return router
}
