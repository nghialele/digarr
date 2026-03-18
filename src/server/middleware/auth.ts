import { timingSafeEqual } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import { envConfig } from '@/config/env'

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.byteLength !== bb.byteLength) return false
  return timingSafeEqual(ab, bb)
}

export function authGuard() {
  return createMiddleware(async (c, next) => {
    const token = envConfig.authToken
    if (!token) return next() // auth disabled

    // Skip auth for health check and auth status
    if (c.req.path === '/health' || c.req.path === '/api/auth/status') return next()

    // Check Authorization header first, then fall back to ?token= query param
    // (EventSource/SSE does not support custom headers)
    const header = c.req.header('Authorization')
    let provided: string | undefined
    if (header?.startsWith('Bearer ')) {
      provided = header.slice(7)
    } else {
      const qp = c.req.query('token')
      if (qp) provided = qp
    }

    if (!provided || !safeCompare(provided, token)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return next()
  })
}
