import { Cron } from 'croner'
import { Hono } from 'hono'
import type { AppDependencies } from '@/server'
import type { HonoEnv } from '@/server/types'

const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'enabled',
  'sourceConfig',
  'maxArtistsPerRun',
  'cron',
  'action',
  'scoreThreshold',
  'scoringWeightPreset',
])

export function subscriptionRoutes(deps: AppDependencies) {
  const router = new Hono<HonoEnv>()

  router.get('/api/subscriptions', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const subs = await deps.subscriptionQueries.getSubscriptionsByUser(userId)
    return c.json(subs)
  })

  router.post('/api/subscriptions', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { name, sourceType, sourceProvider, sourceConfig, cron } = body as Record<string, unknown>

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'name is required' }, 400)
    }
    if (!sourceType || typeof sourceType !== 'string') {
      return c.json({ error: 'sourceType is required' }, 400)
    }
    if (!sourceProvider || typeof sourceProvider !== 'string') {
      return c.json({ error: 'sourceProvider is required' }, 400)
    }
    if (!sourceConfig || typeof sourceConfig !== 'object' || Array.isArray(sourceConfig)) {
      return c.json({ error: 'sourceConfig is required' }, 400)
    }
    if (!cron || typeof cron !== 'string') {
      return c.json({ error: 'cron is required' }, 400)
    }

    try {
      new Cron(cron, { maxRuns: 0 })
    } catch {
      return c.json({ error: 'Invalid cron expression' }, 400)
    }

    const sub = await deps.subscriptionQueries.createSubscription({
      name,
      userId,
      sourceType,
      sourceProvider,
      sourceConfig: sourceConfig as Record<string, unknown>,
      cron,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      maxArtistsPerRun:
        typeof body.maxArtistsPerRun === 'number' ? body.maxArtistsPerRun : undefined,
      action: typeof body.action === 'string' ? body.action : undefined,
      scoreThreshold: typeof body.scoreThreshold === 'number' ? body.scoreThreshold : undefined,
      scoringWeightPreset:
        typeof body.scoringWeightPreset === 'string' ? body.scoringWeightPreset : undefined,
    })

    return c.json(sub, 201)
  })

  router.patch('/api/subscriptions/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const id = Number(c.req.param('id'))
    const existing = await deps.subscriptionQueries.getSubscription(id)
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404)
    }
    if (existing.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (Object.hasOwn(body, key)) {
        update[key] = (body as Record<string, unknown>)[key]
      }
    }

    if (Object.hasOwn(update, 'cron') && update.cron !== undefined) {
      try {
        new Cron(update.cron as string, { maxRuns: 0 })
      } catch {
        return c.json({ error: 'Invalid cron expression' }, 400)
      }
    }

    await deps.subscriptionQueries.updateSubscription(id, update)
    return c.json({ updated: true })
  })

  router.delete('/api/subscriptions/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const id = Number(c.req.param('id'))
    const existing = await deps.subscriptionQueries.getSubscription(id)
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404)
    }
    if (existing.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await deps.subscriptionQueries.deleteSubscription(id)
    deps.scheduler.remove(`subscription-${id}`)
    return c.json({ deleted: true })
  })

  router.post('/api/subscriptions/:id/run', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const id = Number(c.req.param('id'))
    const existing = await deps.subscriptionQueries.getSubscription(id)
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404)
    }
    if (existing.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fire-and-forget
    Promise.resolve()
      .then(() => deps.runSubscription(id))
      .catch((err: unknown) => {
        console.error(`Manual subscription run failed (id=${id}):`, err)
      })

    return c.json({ message: 'Subscription run started' }, 202)
  })

  router.get('/api/subscriptions/:id/runs', async (c) => {
    const userId = c.get('userId')
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const id = Number(c.req.param('id'))
    const existing = await deps.subscriptionQueries.getSubscription(id)
    if (!existing) {
      return c.json({ error: 'Subscription not found' }, 404)
    }
    if (existing.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const runs = await deps.subscriptionQueries.getRunsForSubscription(id)
    return c.json(runs)
  })

  return router
}
