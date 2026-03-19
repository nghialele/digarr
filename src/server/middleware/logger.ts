import type { MiddlewareHandler } from 'hono'

export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path
    // Skip health check noise from k8s/container probes
    if (path === '/health') {
      await next()
      return
    }

    const start = Date.now()
    const method = c.req.method

    await next()

    const duration = Date.now() - start
    const status = c.res.status
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    const msg = `[http] ${method} ${path} ${status} ${duration}ms`

    if (level === 'error') {
      console.error(msg)
    } else if (level === 'warn') {
      console.warn(msg)
    } else {
      console.log(msg)
    }
  }
}
