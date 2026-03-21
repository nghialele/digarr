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

  router.get('/api/recommendations/feedback-summary', async (c) => {
    const history = await deps.getFeedbackHistory()
    const summary = [...history.entries()]
      .map(([genre, { approved, total }]) => ({
        genre,
        approved,
        rejected: total - approved,
        total,
        rate: total > 0 ? approved / total : 0,
      }))
      .filter((e) => e.total >= 3)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 20)

    return c.json({ summary })
  })

  router.get('/api/recommendations/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const rec = await deps.getRecommendation(id)
    if (!rec) {
      return c.json({ error: 'Recommendation not found' }, 404)
    }
    // Ownership check: legacy recs (userId=null) are accessible to all
    const userId = c.get('userId')
    if (rec.userId && userId && rec.userId !== userId) {
      return c.json({ error: 'Recommendation not found' }, 404)
    }
    return c.json(rec)
  })

  router.patch('/api/recommendations/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const {
      status,
      monitorOption,
      selectedAlbumIds,
      targetId,
      qualityProfileId: qpOverride,
      metadataProfileId: mpOverride,
      rootFolderId: rfOverride,
    } = body as {
      status: string
      monitorOption?: 'all' | 'new' | 'none' | 'selected'
      selectedAlbumIds?: string[]
      targetId?: string
      qualityProfileId?: number
      metadataProfileId?: number
      rootFolderId?: number
    }

    if (!status) {
      return c.json({ error: 'status is required' }, 400)
    }

    if (status === 'approved') {
      const rec = await deps.getRecommendation(id)
      if (!rec) {
        return c.json({ error: 'Recommendation not found' }, 404)
      }

      // Ownership check: legacy recs (userId=null) are accessible to all
      const userId = c.get('userId')
      if (rec.userId && userId && rec.userId !== userId) {
        return c.json({ error: 'Recommendation not found' }, 404)
      }

      const settings = await deps.getSettings()
      const prefs = (settings?.preferences as Record<string, unknown> | null) ?? {}
      const targets = userId ? await deps.getEnabledTargetsForUser(userId) : []

      // Filter to specific target if targetId specified
      const effectiveTargets = targetId ? targets.filter((t) => t.id === targetId) : targets

      // Pre-warm SkyHook if any Lidarr target exists
      if (
        deps.skyhookWarmer &&
        rec.artist?.mbid &&
        effectiveTargets.some((t) => t.type === 'lidarr')
      ) {
        try {
          await deps.skyhookWarmer.warm(rec.artist.mbid)
        } catch {
          // Best-effort
        }
      }

      const addOptions = {
        monitorOption: monitorOption ?? 'all',
        selectedAlbumIds,
        qualityProfileId: qpOverride ?? Number(prefs.qualityProfileId ?? 1),
        metadataProfileId: mpOverride ?? Number(prefs.metadataProfileId ?? 1),
        rootFolderId: rfOverride ?? Number(prefs.rootFolderId ?? 1),
      }

      // No targets configured -- just mark as approved (discovery-only mode)
      if (effectiveTargets.length === 0) {
        await deps.updateRecommendationStatus(id, 'approved', { targetActions: {} })
        return c.json({ status: 'approved' })
      }

      // Run through all enabled targets with addArtist capability
      const targetActions: Record<string, unknown> = {}
      let anySuccess = false
      let lidarrResult: { externalId?: number | string; error?: string } | null = null

      for (const target of effectiveTargets) {
        if (!target.capabilities?.includes('addArtist')) continue
        const result = await target.addArtist?.(
          { mbid: rec.artist.mbid, name: rec.artist.name },
          addOptions,
        )
        if (!result) continue
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
      const hasLidarr = effectiveTargets.some((t) => t.type === 'lidarr')
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

    // Ownership check for non-approve status changes
    const rec = await deps.getRecommendation(id)
    if (!rec) {
      return c.json({ error: 'Recommendation not found' }, 404)
    }
    const userId = c.get('userId')
    if (rec.userId && userId && rec.userId !== userId) {
      return c.json({ error: 'Recommendation not found' }, 404)
    }

    await deps.updateRecommendationStatus(id, status)
    return c.json({ status })
  })

  router.post('/api/recommendations/bulk', async (c) => {
    const body = await c.req.json()
    const {
      ids,
      action,
      targetId,
      qualityProfileId: qpOverride,
      metadataProfileId: mpOverride,
      rootFolderId: rfOverride,
    } = body as {
      ids: number[]
      action: 'approve' | 'reject'
      targetId?: string
      qualityProfileId?: number
      metadataProfileId?: number
      rootFolderId?: number
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'ids array is required' }, 400)
    }
    if (action !== 'approve' && action !== 'reject') {
      return c.json({ error: 'action must be approve or reject' }, 400)
    }

    const userId = c.get('userId')

    if (action === 'reject') {
      // Filter to only recs owned by (or accessible to) this user
      const ownedIds: number[] = []
      for (const id of ids) {
        const rec = await deps.getRecommendation(id)
        if (!rec) continue
        if (rec.userId && userId && rec.userId !== userId) continue
        ownedIds.push(id)
      }
      if (ownedIds.length > 0) {
        await deps.bulkUpdateStatus(ownedIds, 'rejected')
      }
      return c.json({ updated: ownedIds.length })
    }

    // Approve: route through targets
    const targets = userId ? await deps.getEnabledTargetsForUser(userId) : []

    // Filter to specific target if targetId specified
    const effectiveTargets = targetId ? targets.filter((t) => t.id === targetId) : targets

    const settings = await deps.getSettings()
    const prefs = (settings?.preferences as Record<string, unknown> | null) ?? {}
    const addOptions = {
      qualityProfileId: qpOverride ?? Number(prefs.qualityProfileId ?? 1),
      metadataProfileId: mpOverride ?? Number(prefs.metadataProfileId ?? 1),
      rootFolderId: rfOverride ?? Number(prefs.rootFolderId ?? 1),
    }

    const results: Array<{ id: number; status: string; error?: string }> = []

    for (const id of ids) {
      const rec = await deps.getRecommendation(id)
      if (!rec) {
        results.push({ id, status: 'not_found' })
        continue
      }
      // Ownership check: skip recs that don't belong to this user
      if (rec.userId && userId && rec.userId !== userId) {
        results.push({ id, status: 'not_found' })
        continue
      }

      if (effectiveTargets.length === 0) {
        await deps.updateRecommendationStatus(id, 'approved', { targetActions: {} })
        results.push({ id, status: 'approved' })
        continue
      }

      const targetActions: Record<string, unknown> = {}
      let anySuccess = false
      let lidarrArtistId: number | string | undefined
      let lidarrError: string | undefined

      for (const target of effectiveTargets) {
        if (!target.capabilities?.includes('addArtist')) continue
        const result = await target.addArtist?.(
          { mbid: rec.artist.mbid, name: rec.artist.name },
          addOptions,
        )
        if (!result) continue
        targetActions[target.id] = {
          status: result.success ? 'added' : 'failed',
          externalId: result.externalId,
          error: result.error,
        }
        if (result.success) anySuccess = true

        if (target.type === 'lidarr') {
          if (result.success && result.externalId) lidarrArtistId = result.externalId
          if (result.error) lidarrError = result.error
        }
      }

      const hasLidarr = effectiveTargets.some((t) => t.type === 'lidarr')
      const status = anySuccess ? (hasLidarr ? 'added_to_lidarr' : 'approved') : 'add_failed'
      const extra: Record<string, unknown> = { targetActions }
      if (lidarrArtistId) extra.lidarrArtistId = lidarrArtistId
      if (lidarrError) extra.lidarrError = lidarrError
      await deps.updateRecommendationStatus(id, status, extra)
      results.push({ id, status })
    }

    return c.json({ results })
  })

  return router
}
