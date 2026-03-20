import { Hono } from 'hono'
import type { AppDependencies } from '@/server'
import type { HonoEnv } from '@/server/types'

export function recommendationRoutes(deps: AppDependencies) {
  const router = new Hono<HonoEnv>()

  router.get('/api/recommendations', async (c) => {
    const query = c.req.query()
    const userId = c.get('userId')
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
      const prefs = (settings?.preferences as Record<string, unknown> | null) ?? {}

      // Get targets for this user
      const userId = c.get('userId')
      const targets = userId ? await deps.getEnabledTargetsForUser(userId) : []

      // Pre-warm SkyHook if any Lidarr target exists
      if (deps.skyhookWarmer && rec.artist?.mbid && targets.some((t) => t.type === 'lidarr')) {
        try {
          await deps.skyhookWarmer.warm(rec.artist.mbid)
        } catch {
          // Best-effort
        }
      }

      const addOptions = {
        monitorOption: monitorOption ?? 'all',
        selectedAlbumIds,
        qualityProfileId: Number(prefs.qualityProfileId ?? 1),
        metadataProfileId: Number(prefs.metadataProfileId ?? 1),
        rootFolderId: Number(prefs.rootFolderId ?? 1),
      }

      // No targets configured -- just mark as approved (discovery-only mode)
      if (targets.length === 0) {
        await deps.updateRecommendationStatus(id, 'approved', { targetActions: {} })
        return c.json({ status: 'approved' })
      }

      // Run through all enabled targets with addArtist capability
      const targetActions: Record<string, unknown> = {}
      let anySuccess = false
      let lidarrResult: { externalId?: number | string; error?: string } | null = null

      for (const target of targets) {
        if (!target.capabilities?.includes('addArtist')) continue
        const result = await target.addArtist(
          { mbid: rec.artist.mbid, name: rec.artist.name },
          addOptions,
        )
        targetActions[target.id] = {
          status: result.success ? 'added' : 'failed',
          externalId: result.externalId,
          error: result.error,
        }
        if (result.success) anySuccess = true
        if (target.type === 'lidarr') lidarrResult = result
      }

      // Backward compat: write Lidarr-specific columns
      const extra: Record<string, unknown> = { targetActions }
      if (lidarrResult) {
        if (lidarrResult.externalId) extra.lidarrArtistId = lidarrResult.externalId
        if (lidarrResult.error) extra.lidarrError = lidarrResult.error
      }

      // Use Lidarr-specific statuses for backward compat when Lidarr is involved
      const hasLidarr = targets.some((t) => t.type === 'lidarr')
      const finalStatus = anySuccess ? (hasLidarr ? 'added_to_lidarr' : 'approved') : 'add_failed'
      await deps.updateRecommendationStatus(id, finalStatus, extra)
      return c.json({
        status: finalStatus,
        targetActions,
        ...(lidarrResult?.error ? { lidarrError: lidarrResult.error } : {}),
      })
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

    // Approve: route through targets
    const userId = c.get('userId')
    const targets = userId ? await deps.getEnabledTargetsForUser(userId) : []
    const settings = await deps.getSettings()
    const prefs = (settings?.preferences as Record<string, unknown> | null) ?? {}
    const addOptions = {
      qualityProfileId: Number(prefs.qualityProfileId ?? 1),
      metadataProfileId: Number(prefs.metadataProfileId ?? 1),
      rootFolderId: Number(prefs.rootFolderId ?? 1),
    }

    const results: Array<{ id: number; status: string; error?: string }> = []

    for (const id of ids) {
      const rec = await deps.getRecommendation(id)
      if (!rec) {
        results.push({ id, status: 'not_found' })
        continue
      }

      if (targets.length === 0) {
        await deps.updateRecommendationStatus(id, 'approved', { targetActions: {} })
        results.push({ id, status: 'approved' })
        continue
      }

      const targetActions: Record<string, unknown> = {}
      let anySuccess = false

      for (const target of targets) {
        if (!target.capabilities?.includes('addArtist')) continue
        const result = await target.addArtist(
          { mbid: rec.artist.mbid, name: rec.artist.name },
          addOptions,
        )
        targetActions[target.id] = {
          status: result.success ? 'added' : 'failed',
          externalId: result.externalId,
          error: result.error,
        }
        if (result.success) anySuccess = true

        // Backward compat: Lidarr-specific columns
        if (target.type === 'lidarr') {
          const extra: Record<string, unknown> = { targetActions }
          if (result.success && result.externalId) {
            extra.lidarrArtistId = result.externalId
          } else if (result.error) {
            extra.lidarrError = result.error
          }
        }
      }

      const hasLidarr = targets.some((t) => t.type === 'lidarr')
      const status = anySuccess ? (hasLidarr ? 'added_to_lidarr' : 'approved') : 'add_failed'
      await deps.updateRecommendationStatus(id, status, { targetActions })
      results.push({ id, status })
    }

    return c.json({ results })
  })

  return router
}
