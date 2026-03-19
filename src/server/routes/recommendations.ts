import { Hono } from 'hono'
import { createLidarrClient } from '@/core/clients/lidarr'
import type { AppDependencies } from '@/server'

export function recommendationRoutes(deps: AppDependencies) {
  const router = new Hono()

  router.get('/api/recommendations', async (c) => {
    const query = c.req.query()
    const userId = c.get('userId' as never) as number | undefined
    const filters = {
      status: query.status,
      batchId: query.batchId !== undefined ? Number(query.batchId) : undefined,
      userId,
      sort: query.sort as 'score_desc' | 'score_asc' | 'created_desc' | undefined,
      limit:
        query.limit !== undefined
          ? Math.max(1, Math.min(200, Number(query.limit) || 20))
          : undefined,
      offset: query.offset !== undefined ? Math.max(0, Number(query.offset) || 0) : undefined,
    }
    const result = await deps.listRecommendations(filters)
    return c.json(result)
  })

  router.get('/api/recommendations/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const rec = await deps.getRecommendation(id)
    if (!rec) {
      return c.json({ error: 'Recommendation not found' }, 404)
    }
    return c.json(rec)
  })

  router.patch('/api/recommendations/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const { status, monitorOption, selectedAlbumIds } = body as {
      status: string
      monitorOption?: 'all' | 'new' | 'none' | 'selected'
      selectedAlbumIds?: string[]
    }

    if (!status) {
      return c.json({ error: 'status is required' }, 400)
    }

    if (status === 'approved') {
      const rec = await deps.getRecommendation(id)
      if (!rec) {
        return c.json({ error: 'Recommendation not found' }, 404)
      }

      const settings = await deps.getSettings()
      if (!settings?.lidarrUrl || !settings?.lidarrApiKey) {
        return c.json({ error: 'Lidarr not configured' }, 400)
      }

      const prefs = (settings.preferences as Record<string, unknown> | null) ?? {}
      const qualityProfileId = Number(prefs.qualityProfileId ?? 1)
      const metadataProfileId = Number(prefs.metadataProfileId ?? 1)
      const rootFolderId = Number(prefs.rootFolderId ?? 1)

      const lidarr = createLidarrClient(
        settings.lidarrUrl as string,
        settings.lidarrApiKey as string,
        (settings.skipTlsVerify as boolean) ?? false,
      )

      // Pre-warm SkyHook cache before adding to Lidarr to avoid 503s
      if (deps.skyhookWarmer && rec.artist?.mbid) {
        try {
          await deps.skyhookWarmer.warm(rec.artist.mbid)
        } catch {
          // Best-effort -- continue with add even if warming fails
        }
      }

      // Map 'selected' to 'none' for initial add -- we'll monitor individual albums after
      const effectiveMonitor = monitorOption === 'selected' ? 'none' : (monitorOption ?? 'all')

      try {
        const added = await lidarr.addArtist(
          rec.artist.mbid,
          rec.artist.name,
          qualityProfileId,
          metadataProfileId,
          rootFolderId,
          { monitorOption: effectiveMonitor },
        )

        // If 'selected' mode, monitor specific albums after the add
        if (monitorOption === 'selected' && selectedAlbumIds?.length && added.id) {
          try {
            const albums = await lidarr.getAlbums(added.id)
            for (const albumMbid of selectedAlbumIds) {
              const album = albums.find((a) => a.foreignAlbumId === albumMbid)
              if (album) {
                await lidarr.updateAlbum(album.id, { monitored: true })
              }
            }
          } catch {
            // Best-effort -- artist was added, album monitoring is secondary
          }
        }

        await deps.updateRecommendationStatus(id, 'added_to_lidarr', {
          lidarrArtistId: added.id,
        })
        return c.json({ status: 'added_to_lidarr' })
      } catch (err: unknown) {
        const lidarrError = err instanceof Error ? err.message : String(err)
        await deps.updateRecommendationStatus(id, 'add_failed', { lidarrError })
        return c.json({ status: 'add_failed', lidarrError })
      }
    }

    const VALID_STATUSES = new Set(['rejected', 'pending', 'approved'])
    if (!VALID_STATUSES.has(status)) {
      return c.json({ error: `Invalid status: ${status}` }, 400)
    }

    await deps.updateRecommendationStatus(id, status)
    return c.json({ status })
  })

  router.post('/api/recommendations/bulk', async (c) => {
    const body = await c.req.json()
    const { ids, action } = body as { ids: number[]; action: 'approve' | 'reject' }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'ids array is required' }, 400)
    }
    if (action !== 'approve' && action !== 'reject') {
      return c.json({ error: 'action must be approve or reject' }, 400)
    }

    if (action === 'reject') {
      await deps.bulkUpdateStatus(ids, 'rejected')
      return c.json({ updated: ids.length })
    }

    // approve: add each to Lidarr individually
    const settings = await deps.getSettings()
    if (!settings?.lidarrUrl || !settings?.lidarrApiKey) {
      return c.json({ error: 'Lidarr not configured' }, 400)
    }

    const prefs = (settings.preferences as Record<string, unknown> | null) ?? {}
    const qualityProfileId = Number(prefs.qualityProfileId ?? 1)
    const metadataProfileId = Number(prefs.metadataProfileId ?? 1)
    const rootFolderId = Number(prefs.rootFolderId ?? 1)

    const lidarr = createLidarrClient(
      settings.lidarrUrl as string,
      settings.lidarrApiKey as string,
      (settings.skipTlsVerify as boolean) ?? false,
    )

    const results: Array<{ id: number; status: string; error?: string }> = []

    for (const id of ids) {
      const rec = await deps.getRecommendation(id)
      if (!rec) {
        results.push({ id, status: 'not_found' })
        continue
      }
      try {
        const added = await lidarr.addArtist(
          rec.artist.mbid,
          rec.artist.name,
          qualityProfileId,
          metadataProfileId,
          rootFolderId,
        )
        await deps.updateRecommendationStatus(id, 'added_to_lidarr', {
          lidarrArtistId: added.id,
        })
        results.push({ id, status: 'added_to_lidarr' })
      } catch (err: unknown) {
        const lidarrError = err instanceof Error ? err.message : String(err)
        await deps.updateRecommendationStatus(id, 'add_failed', { lidarrError })
        results.push({ id, status: 'add_failed', error: lidarrError })
      }
    }

    return c.json({ results })
  })

  return router
}
