import { Hono } from 'hono'
import { createLidarrClient } from '@/core/clients/lidarr'
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

  router.get('/api/lidarr/stats', async (c) => {
    try {
      const client = await getClient()
      const artists = await client.getArtists()
      return c.json({
        artists: artists.length,
        monitored: artists.filter((a) => a.monitored).length,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  router.get('/api/lidarr/metadataprofiles', async (c) => {
    try {
      const client = await getClient()
      const profiles = await client.getMetadataProfiles()
      return c.json(profiles)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  router.get('/api/lidarr/profiles', async (c) => {
    try {
      const client = await getClient()
      const profiles = await client.getQualityProfiles()
      return c.json(profiles)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  router.get('/api/lidarr/rootfolders', async (c) => {
    try {
      const client = await getClient()
      const folders = await client.getRootFolders()
      return c.json(folders)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
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

    try {
      const client = await getClient()
      const artist = await client.addArtist(
        foreignArtistId,
        artistName,
        qualityProfileId ?? 1,
        metadataProfileId ?? 1,
        rootFolderId ?? 1,
      )
      return c.json(artist)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return router
}
