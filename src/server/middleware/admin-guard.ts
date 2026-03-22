import { createMiddleware } from 'hono/factory'
import type { HonoEnv } from '@/server/types'

type GetUserById = (id: number) => Promise<{ isAdmin: boolean } | null>

/**
 * Middleware that rejects non-admin users with 403.
 * No userId (legacy token auth) is treated as admin for backward compatibility.
 */
export function adminGuard(getUserById: GetUserById) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const uid = c.get('userId')
    if (uid) {
      const u = await getUserById(uid)
      if (!u?.isAdmin) return c.json({ error: 'Admin access required' }, 403)
    }
    await next()
  })
}

/** Inline admin check for routes that need the isAdmin boolean for branching. */
export async function resolveAdmin(
  userId: number | undefined,
  getUserById: GetUserById,
): Promise<boolean> {
  if (!userId) return true
  const user = await getUserById(userId)
  return user?.isAdmin ?? false
}
