import { Hono } from 'hono'
import { createLidarrClient } from '@/core/clients/lidarr'
import { errMsg } from '@/core/validation'
import type { AppDependencies } from '@/server'

export function lidarrRoutes(deps: AppDependencies) {
  const router = new Hono()

  async function getClient() {
    const settings = await deps.getSettings()
    if (!settings?.lidarrUrl || !settings?.lidarrApiKey) {
      throw new Error('Lidarr not configured')
    }
    return createLidarrClient(
      settings.lidarrUrl as string,
      settings.lidarrApiKey as string,
      (settings.skipTlsVerify as boolean) ?? false,
    )
  }

  router.onError((err, c) => c.json({ error: errMsg(err) }, 500))

  router.get('/api/lidarr/stats', async (c) => {
    const client = await getClient()
    const artists = await client.getArtists()
    return c.json({
      artists: artists.length,
      monitored: artists.filter((a) => a.monitored).length,
    })
  })

  router.get('/api/lidarr/metadataprofiles', async (c) => {
    const client = await getClient()
    return c.json(await client.getMetadataProfiles())
  })

  router.get('/api/lidarr/profiles', async (c) => {
    const client = await getClient()
    return c.json(await client.getQualityProfiles())
  })

  router.get('/api/lidarr/rootfolders', async (c) => {
    const client = await getClient()
    return c.json(await client.getRootFolders())
  })

  router.post('/api/lidarr/add', async (c) => {
    const body = await c.req.json()
    const { foreignArtistId, artistName, qualityProfileId, metadataProfileId, rootFolderId } =
      body as {
        foreignArtistId: string
        artistName: string
        qualityProfileId: number
        metadataProfileId: number
        rootFolderId: number
      }

    if (!foreignArtistId || !artistName) {
      return c.json({ error: 'foreignArtistId and artistName are required' }, 400)
    }

    const client = await getClient()
    const artist = await client.addArtist(
      foreignArtistId,
      artistName,
      qualityProfileId ?? 1,
      metadataProfileId ?? 1,
      rootFolderId ?? 1,
    )
    return c.json(artist)
  })

  return router
}
