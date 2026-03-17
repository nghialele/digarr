import { Hono } from 'hono'
import type { AppDependencies } from '@/server'
import { createLidarrClient } from '@/core/clients/lidarr'

export function lidarrRoutes(deps: AppDependencies) {
  const router = new Hono()

  async function getClient() {
    const settings = await deps.getSettings()
    if (!settings?.lidarrUrl || !settings?.lidarrApiKey) {
      throw new Error('Lidarr not configured')
    }
    return createLidarrClient(settings.lidarrUrl as string, settings.lidarrApiKey as string)
  }

  router.get('/api/lidarr/profiles', async (c) => {
    try {
      const client = await getClient()
      const profiles = await client.getQualityProfiles()
      return c.json(profiles)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  router.get('/api/lidarr/rootfolders', async (c) => {
    try {
      const client = await getClient()
      const folders = await client.getRootFolders()
      return c.json(folders)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  router.post('/api/lidarr/add', async (c) => {
    const body = await c.req.json()
    const { foreignArtistId, qualityProfileId, rootFolderId } = body as {
      foreignArtistId: string
      qualityProfileId: number
      rootFolderId: number
    }

    if (!foreignArtistId || qualityProfileId === undefined || rootFolderId === undefined) {
      return c.json({ error: 'foreignArtistId, qualityProfileId, rootFolderId are required' }, 400)
    }

    try {
      const client = await getClient()
      const artist = await client.addArtist(foreignArtistId, qualityProfileId, rootFolderId)
      return c.json(artist)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return router
}
