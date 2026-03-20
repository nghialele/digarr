import { Hono } from 'hono'
import { createLidarrClient } from '@/core/clients/lidarr'
import { collect } from '@/core/pipeline/collect'
import { getArtistsByGenre, getExampleArtistsByGenre } from '@/db/queries/artists'
import type { AppDependencies } from '@/server'

export function genreRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/genres', async (c) => {
    const [genres, examples] = await Promise.all([
      deps.genreService.getLibraryGenres(),
      getExampleArtistsByGenre(deps.db, 3),
    ])
    const enriched = genres.map((g) => ({
      ...g,
      exampleArtists: examples.get(g.name) ?? [],
    }))
    return c.json(enriched)
  })

  router.get('/api/genres/search', async (c) => {
    const q = c.req.query('q') ?? ''
    if (q.length < 2) {
      return c.json({ error: 'Query must be at least 2 characters' }, 400)
    }
    const results = await deps.genreService.search(q)
    return c.json(results)
  })

  router.get('/api/genres/:slug', async (c) => {
    const slug = c.req.param('slug')
    const genre = await deps.genreService.getOrFetchGenre(slug)
    if (!genre) {
      return c.json({ error: 'Genre not found' }, 404)
    }
    const [subGenres, libraryArtists] = await Promise.all([
      deps.genreService.getSubGenres(genre.id),
      getArtistsByGenre(deps.db, genre.name),
    ])
    return c.json({ ...genre, subGenres, libraryArtists })
  })

  router.post('/api/genres/seed', async (c) => {
    const settings = await deps.getSettings()
    if (!settings?.lidarrUrl || !settings?.lidarrApiKey) {
      return c.json({ error: 'Lidarr not configured' }, 400)
    }

    const lidarr = createLidarrClient(
      settings.lidarrUrl as string,
      settings.lidarrApiKey as string,
      (settings.skipTlsVerify as boolean) ?? false,
    )

    // Fire-and-forget
    collect(lidarr)
      .then((artists) => deps.genreService.seedFromLibrary(artists))
      .catch((err: unknown) => {
        console.error('Genre seed failed:', err)
      })

    return c.json({ message: 'Genre seed started' }, 202)
  })

  return router
}
