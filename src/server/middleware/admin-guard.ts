import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@/server/types'

type GetUserById = (id: number) => Promise<{ isAdmin: boolean } | null>

/**
 * Middleware that rejects non-admin users with 403.
 * Legacy token auth (no userId) is NOT admin -- users should migrate to session auth.
 * If no auth is configured at all (authSkipped), allow through for fresh installs.
 */
export function adminGuard(getUserById: GetUserById) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    if (c.get('authSkipped')) return next()
    const uid = c.get('userId')
    if (!uid) return c.json({ error: 'Admin access required' }, 403)
    const u = await getUserById(uid)
    if (!u?.isAdmin) return c.json({ error: 'Admin access required' }, 403)
    await next()
  })
}

/**
 * Inline admin check for routes that need the isAdmin boolean for branching.
 * Pass authSkipped=true when no auth is configured (fresh installs).
 */
export async function resolveAdmin(
  userId: number | undefined,
  getUserById: GetUserById,
  authSkipped?: boolean,
): Promise<boolean> {
  if (authSkipped) return true
  if (!userId) return false
  const user = await getUserById(userId)
  return user?.isAdmin ?? false
}
