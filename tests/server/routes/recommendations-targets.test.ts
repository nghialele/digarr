// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { HonoEnv } from '@/server/types'

const mockDeps = {
  getRecommendation: vi.fn(),
  updateRecommendationStatus: vi.fn().mockResolvedValue(undefined),
  bulkUpdateStatus: vi.fn().mockResolvedValue(undefined),
  listRecommendations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getSettings: vi.fn().mockResolvedValue({ preferences: {} }),
  skyhookWarmer: null,
  getEnabledTargetsForUser: vi.fn().mockResolvedValue([]),
}

const { recommendationRoutes } = await import('@/server/routes/recommendations')

function createTestApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', async (c, next) => {
    c.set('userId', 1)
    await next()
  })
  app.route('/', recommendationRoutes(mockDeps as never))
  return app
}

describe('target-aware approval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approves without targets -- sets status to approved', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('approved')
    expect(mockDeps.updateRecommendationStatus).toHaveBeenCalledWith(
      1,
      'approved',
      expect.objectContaining({ targetActions: {} }),
    )
  })

  it('approves with Lidarr target -- adds to Lidarr and sets added_to_lidarr', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const mockTarget = {
      id: 'lidarr-1',
      type: 'lidarr',
      capabilities: ['addArtist'],
      addArtist: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'lidarr',
        targetId: 1,
        externalId: 42,
      }),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([mockTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })

    const body = await res.json()
    expect(body.status).toBe('added_to_lidarr')
    expect(mockTarget.addArtist).toHaveBeenCalledWith(
      { mbid: 'mbid-1', name: 'Radiohead' },
      expect.any(Object),
    )
  })

  it('approves with failing Lidarr target -- sets add_failed', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const mockTarget = {
      id: 'lidarr-1',
      type: 'lidarr',
      capabilities: ['addArtist'],
      addArtist: vi.fn().mockResolvedValue({
        success: false,
        targetType: 'lidarr',
        targetId: 1,
        error: 'Already exists',
      }),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([mockTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })

    const body = await res.json()
    expect(body.status).toBe('add_failed')
  })

  it('approves to Navidrome target -- calls addToFavorites', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const mockTarget = {
      id: 'navidrome-1',
      type: 'navidrome',
      capabilities: ['createPlaylist', 'addToFavorites'],
      addToFavorites: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'navidrome',
        targetId: 1,
      }),
      testConnection: vi.fn(),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([mockTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })

    const body = await res.json()
    expect(body.status).toBe('approved')
    expect(mockTarget.addToFavorites).toHaveBeenCalledWith([
      { mbid: 'mbid-1', name: 'Radiohead' },
    ])
  })

  it('approves to specific target via targetId', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const lidarrTarget = {
      id: 'lidarr-1',
      type: 'lidarr',
      capabilities: ['addArtist'],
      addArtist: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'lidarr',
        targetId: 1,
        externalId: 42,
      }),
      testConnection: vi.fn(),
    }
    const navidromeTarget = {
      id: 'navidrome-2',
      type: 'navidrome',
      capabilities: ['createPlaylist', 'addToFavorites'],
      addToFavorites: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'navidrome',
        targetId: 2,
      }),
      testConnection: vi.fn(),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([lidarrTarget, navidromeTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', targetId: 'navidrome-2' }),
    })

    const body = await res.json()
    expect(body.status).toBe('approved')
    // Only Navidrome target should be called
    expect(navidromeTarget.addToFavorites).toHaveBeenCalled()
    expect(lidarrTarget.addArtist).not.toHaveBeenCalled()
  })

  it('handles mixed targets -- calls both addArtist and addToFavorites', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const lidarrTarget = {
      id: 'lidarr-1',
      type: 'lidarr',
      capabilities: ['addArtist'],
      addArtist: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'lidarr',
        targetId: 1,
        externalId: 42,
      }),
      testConnection: vi.fn(),
    }
    const navidromeTarget = {
      id: 'navidrome-1',
      type: 'navidrome',
      capabilities: ['createPlaylist', 'addToFavorites'],
      addToFavorites: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'navidrome',
        targetId: 2,
      }),
      testConnection: vi.fn(),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([lidarrTarget, navidromeTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })

    const body = await res.json()
    // Lidarr present -> added_to_lidarr status
    expect(body.status).toBe('added_to_lidarr')
    expect(lidarrTarget.addArtist).toHaveBeenCalled()
    expect(navidromeTarget.addToFavorites).toHaveBeenCalled()
    // Both targets recorded in targetActions
    expect(body.targetActions['lidarr-1'].status).toBe('added')
    expect(body.targetActions['navidrome-1'].action).toBe('addToFavorites')
    expect(body.targetActions['navidrome-1'].status).toBe('added')
  })

  it('bulk approve with addToFavorites targets', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    const mockTarget = {
      id: 'navidrome-1',
      type: 'navidrome',
      capabilities: ['createPlaylist', 'addToFavorites'],
      addToFavorites: vi.fn().mockResolvedValue({
        success: true,
        targetType: 'navidrome',
        targetId: 1,
      }),
      testConnection: vi.fn(),
    }
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([mockTarget])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [1], action: 'approve' }),
    })

    const body = await res.json()
    expect(body.results[0].status).toBe('approved')
    expect(mockTarget.addToFavorites).toHaveBeenCalledWith([
      { mbid: 'mbid-1', name: 'Radiohead' },
    ])
  })

  it('bulk approve without targets marks all as approved', async () => {
    mockDeps.getRecommendation.mockResolvedValue({
      id: 1,
      artist: { mbid: 'mbid-1', name: 'Radiohead' },
    })
    mockDeps.getEnabledTargetsForUser.mockResolvedValue([])

    const app = createTestApp()
    const res = await app.request('/api/recommendations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [1], action: 'approve' }),
    })

    const body = await res.json()
    expect(body.results[0].status).toBe('approved')
  })
})
