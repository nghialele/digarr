import { Hono } from 'hono'
import type { AppDependencies } from '@/server'

export function artistRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/artists/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const artist = await deps.getArtistById(id)
    if (!artist) {
      return c.json({ error: 'Artist not found' }, 404)
    }
    return c.json(artist)
  })

  return router
}
