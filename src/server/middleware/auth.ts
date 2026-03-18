import { timingSafeEqual } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { envConfig } from '@/config/env'
import { getSession } from '@/core/sessions'

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.byteLength !== bb.byteLength) return false
  return timingSafeEqual(ab, bb)
}

// Paths that never require authentication
const PUBLIC_PATHS = new Set([
  '/health',
  '/api/auth/status',
  '/api/auth/login',
  '/api/auth/register',
])

export function authGuard(hasUsers: () => Promise<boolean>) {
  return createMiddleware(async (c, next) => {
    // Skip auth for public paths
    if (PUBLIC_PATHS.has(c.req.path)) return next()

    // Extract token from Authorization header or query param (SSE fallback)
    const header = c.req.header('Authorization')
    let provided: string | undefined
    if (header?.startsWith('Bearer ')) {
      provided = header.slice(7)
    } else {
      const qp = c.req.query('token')
      if (qp) provided = qp
    }

    // Try session token first
    if (provided) {
      const session = getSession(provided)
      if (session) {
        c.set('userId' as never, session.userId as never)
        return next()
      }
    }

    // Fall back to legacy DIGARR_AUTH_TOKEN
    const legacyToken = envConfig.authToken
    if (legacyToken && provided && safeCompare(provided, legacyToken)) {
      return next()
    }

    // Auth is required if a legacy token is configured OR users have been registered
    const usersExist = await hasUsers()
    if (!legacyToken && !usersExist) {
      return next() // No auth configured at all
    }

    return c.json({ error: 'Unauthorized' }, 401)
  })
}
