import type { Context, Next } from 'hono'

export function setupGuard(isSetupComplete: () => Promise<boolean>) {
  return async (c: Context, next: Next) => {
    const path = c.req.path
    if (
      path.startsWith('/api/setup/') ||
      path === '/api/setup' ||
      path.startsWith('/api/settings/test/') ||
      path.startsWith('/api/auth/') ||
      path === '/health'
    ) {
      return next()
    }
    if (path.startsWith('/api/')) {
      const complete = await isSetupComplete()
      if (!complete) {
        return c.json({ error: 'Setup not complete', redirect: '/setup' }, 403)
      }
    }
    return next()
  }
}
