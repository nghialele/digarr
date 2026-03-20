import { Hono } from 'hono'
import type { AppDependencies } from '@/server'
import type { HonoEnv } from '@/server/types'

export function userRoutes(deps: AppDependencies) {
  const router = new Hono<HonoEnv>()

  // GET /api/users -- list all users (admin only)
  router.get('/api/users', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    const caller = await deps.getUserById(userId)
    if (!caller?.isAdmin) return c.json({ error: 'Admin access required' }, 403)

    const userList = await deps.listUsers()
    return c.json(userList)
  })

  // PATCH /api/users/:id -- update user (admin only)
  // Body: { isAdmin?: boolean }
  // Guard: can't remove own admin role
  router.patch('/api/users/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    const caller = await deps.getUserById(userId)
    if (!caller?.isAdmin) return c.json({ error: 'Admin access required' }, 403)

    const targetId = Number(c.req.param('id'))
    if (!Number.isFinite(targetId)) return c.json({ error: 'Invalid user id' }, 400)

    const body = (await c.req.json()) as Record<string, unknown>

    // Guard: admin cannot remove their own admin role
    if (body.isAdmin === false && caller.id === targetId) {
      return c.json({ error: 'Cannot remove your own admin role' }, 400)
    }

    const target = await deps.getUserById(targetId)
    if (!target) return c.json({ error: 'User not found' }, 404)

    const updateData: { isAdmin?: boolean } = {}
    if (typeof body.isAdmin === 'boolean') updateData.isAdmin = body.isAdmin

    await deps.updateUser(targetId, updateData)
    return c.json({ ok: true })
  })

  // DELETE /api/users/:id -- delete user (admin only)
  // Guard: can't delete self
  router.delete('/api/users/:id', async (c) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    const caller = await deps.getUserById(userId)
    if (!caller?.isAdmin) return c.json({ error: 'Admin access required' }, 403)

    const targetId = Number(c.req.param('id'))
    if (!Number.isFinite(targetId)) return c.json({ error: 'Invalid user id' }, 400)

    if (caller.id === targetId) {
      return c.json({ error: 'Cannot delete your own account' }, 400)
    }

    const target = await deps.getUserById(targetId)
    if (!target) return c.json({ error: 'User not found' }, 404)

    await deps.deleteUser(targetId)
    return c.json({ ok: true })
  })

  return router
}
