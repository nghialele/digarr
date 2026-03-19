import { Hono } from 'hono'
import { createMusicBrainzClient } from '@/core/clients/musicbrainz'
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

  router.get('/api/albums/:mbid', async (c) => {
    const mbid = c.req.param('mbid')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mbid)) {
      return c.json({ error: 'Invalid MBID format' }, 400)
    }
    const mb = createMusicBrainzClient()
    const releaseGroups = await mb.getReleaseGroups(mbid)
    return c.json(releaseGroups)
  })

  return router
}
