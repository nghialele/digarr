import { describe, it, expect } from 'vitest'
import { createApp } from '@/server'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp({
      db: {},
      orchestrator: {},
      scheduler: {},
      isSetupComplete: async () => true,
    })
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

describe('setup guard', () => {
  it('blocks /api/* with 403 when setup is not complete', async () => {
    const app = createApp({
      db: {},
      orchestrator: {},
      scheduler: {},
      isSetupComplete: async () => false,
    })
    const res = await app.request('/api/something')
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Setup not complete')
    expect(body.redirect).toBe('/setup')
  })

  it('allows /api/setup/* through when setup is not complete', async () => {
    const app = createApp({
      db: {},
      orchestrator: {},
      scheduler: {},
      isSetupComplete: async () => false,
    })
    // No setup route registered yet -- expect 404, not 403
    const res = await app.request('/api/setup/status')
    expect(res.status).not.toBe(403)
  })

  it('allows /health through when setup is not complete', async () => {
    const app = createApp({
      db: {},
      orchestrator: {},
      scheduler: {},
      isSetupComplete: async () => false,
    })
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })

  it('allows /api/* through when setup is complete', async () => {
    const app = createApp({
      db: {},
      orchestrator: {},
      scheduler: {},
      isSetupComplete: async () => true,
    })
    // No route registered -- expect 404, not 403
    const res = await app.request('/api/something')
    expect(res.status).not.toBe(403)
  })
})
