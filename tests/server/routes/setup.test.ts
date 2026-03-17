// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '@/server'
import type { AppDependencies } from '@/server'

function makeDeps(overrides: Partial<AppDependencies> = {}): AppDependencies {
  return {
    db: {},
    orchestrator: {},
    scheduler: {},
    isSetupComplete: vi.fn(async () => false),
    getSettings: vi.fn(async () => null),
    updateSettings: vi.fn(async () => {}),
    completeSetup: vi.fn(async () => ({ id: 1, setupComplete: true })),
    ...overrides,
  }
}

describe('GET /api/setup/status', () => {
  it('returns setupComplete: false when setup is not done', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/api/setup/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.setupComplete).toBe(false)
  })

  it('returns setupComplete: true after setup is complete', async () => {
    const app = createApp(makeDeps({ isSetupComplete: async () => true }))
    const res = await app.request('/api/setup/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.setupComplete).toBe(true)
  })
})

describe('POST /api/setup/complete', () => {
  const validBody = {
    lidarrUrl: 'http://lidarr:8686',
    lidarrApiKey: 'abc123',
    aiProvider: 'ollama',
    aiModel: 'llama3',
    listenbrainzUsername: 'testuser',
  }

  it('accepts valid config and returns 200', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(200)
  })

  it('calls completeSetup with the config', async () => {
    const completeSetup = vi.fn(async () => ({ id: 1, setupComplete: true }))
    const app = createApp(makeDeps({ completeSetup }))
    await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(completeSetup).toHaveBeenCalledTimes(1)
  })

  it('rejects missing lidarrUrl with 400', async () => {
    const app = createApp(makeDeps())
    const { lidarrUrl: _, ...body } = validBody
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing lidarrApiKey with 400', async () => {
    const app = createApp(makeDeps())
    const { lidarrApiKey: _, ...body } = validBody
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing aiProvider with 400', async () => {
    const app = createApp(makeDeps())
    const { aiProvider: _, ...body } = validBody
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing aiModel with 400', async () => {
    const app = createApp(makeDeps())
    const { aiModel: _, ...body } = validBody
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
  })

  it('rejects when neither listenbrainzUsername nor lastfmUsername is provided', async () => {
    const app = createApp(makeDeps())
    const body = {
      lidarrUrl: 'http://lidarr:8686',
      lidarrApiKey: 'abc123',
      aiProvider: 'ollama',
      aiModel: 'llama3',
    }
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
  })

  it('accepts lastfmUsername as the music source', async () => {
    const app = createApp(makeDeps())
    const body = {
      lidarrUrl: 'http://lidarr:8686',
      lidarrApiKey: 'abc123',
      aiProvider: 'ollama',
      aiModel: 'llama3',
      lastfmUsername: 'lfmuser',
    }
    const res = await app.request('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
  })
})
