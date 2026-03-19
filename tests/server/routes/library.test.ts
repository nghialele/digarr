// @vitest-environment node

import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDependencies } from '@/server'
import { createApp } from '@/server'

vi.mock('@/core/clients/lidarr', () => ({
  createLidarrClient: vi.fn(),
}))

import { createLidarrClient } from '@/core/clients/lidarr'

function makeMockOrchestrator() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    isRunning: false,
    run: vi.fn(async () => ({ batchId: 1 })),
  })
}

const mockChecks = [
  {
    id: 'missing-metadata',
    name: 'Missing Metadata',
    description: 'Artists in Lidarr with no genres and no image in local cache.',
    severity: 'warning',
    count: 0,
    items: [],
    fixable: true,
  },
]

const mockStats = {
  totalArtists: 10,
  totalAlbums: 0,
  monitoredArtists: 8,
  genreDistribution: [{ genre: 'Rock', count: 5 }],
  rootFolders: [{ path: '/music', freeSpace: 1000000 }],
}

const mockFixProgress = {
  checkId: 'unmonitored',
  total: 2,
  completed: 2,
  failed: 0,
  status: 'completed',
  errors: [],
}

function makeMockLibraryHealth(opts: { hasCached?: boolean } = {}) {
  return {
    getLastResults: vi.fn(() => (opts.hasCached ? mockChecks : null)),
    runChecks: vi.fn(async () => mockChecks),
    fixCheck: vi.fn(async () => mockFixProgress),
    getStats: vi.fn(async () => mockStats),
  }
}

function makeDeps(overrides: Partial<AppDependencies> = {}): AppDependencies {
  return {
    db: { execute: vi.fn(async () => []) } as unknown as AppDependencies['db'],
    storeDb: {} as unknown as AppDependencies['storeDb'],
    orchestrator: makeMockOrchestrator() as unknown as AppDependencies['orchestrator'],
    scheduler: {} as AppDependencies['scheduler'],
    providerRegistry: {} as unknown as AppDependencies['providerRegistry'],
    isSetupComplete: async () => true,
    getSettings: vi.fn(async () => ({
      id: 1,
      lidarrUrl: 'http://lidarr:8686',
      lidarrApiKey: 'key',
      preferences: { qualityProfileId: 1, rootFolderId: 1 },
    })),
    updateSettings: vi.fn(async () => {}),
    completeSetup: vi.fn(async () => ({ id: 1, setupComplete: true })),
    getLastBatch: vi.fn(async () => null),
    listRecommendations: vi.fn(async () => ({ items: [], total: 0 })),
    getRecommendation: vi.fn(async () => null),
    updateRecommendationStatus: vi.fn(async () => {}),
    bulkUpdateStatus: vi.fn(async () => {}),
    listBatches: vi.fn(async () => []),
    getBatch: vi.fn(async () => null),
    getArtistById: vi.fn(async () => null),
    restartScheduler: vi.fn(),
    createUser: vi.fn(async () => ({
      id: 1,
      username: 'test',
      isAdmin: false,
      preferences: null,
      createdAt: new Date(),
    })),
    getUserByUsername: vi.fn(async () => null),
    getUserById: vi.fn(async () => null),
    getUserCount: vi.fn(async () => 0),
    updatePassword: vi.fn(async () => {}),
    genreService: {} as unknown as AppDependencies['genreService'],
    libraryHealth: makeMockLibraryHealth() as unknown as AppDependencies['libraryHealth'],
    subscriptionQueries: {
      createSubscription: vi.fn(async () => ({}) as never),
      getSubscription: vi.fn(async () => null),
      getSubscriptionsByUser: vi.fn(async () => []),
      updateSubscription: vi.fn(async () => {}),
      deleteSubscription: vi.fn(async () => {}),
      getRunsForSubscription: vi.fn(async () => []),
    },
    runSubscription: vi.fn(async () => {}),
    ...overrides,
  }
}

const mockLidarrClient = {
  addArtist: vi.fn(),
  getQualityProfiles: vi.fn(async () => []),
  getMetadataProfiles: vi.fn(async () => []),
  getRootFolders: vi.fn(async () => []),
  getArtists: vi.fn(async () => []),
  lookupArtist: vi.fn(async () => []),
  getAlbums: vi.fn(async () => []),
  updateArtist: vi.fn(async () => ({
    id: 0,
    artistName: '',
    foreignArtistId: '',
    qualityProfileId: 0,
    rootFolderPath: '',
    monitored: false,
    status: '',
  })),
  triggerCommand: vi.fn(async () => ({ id: 0, name: '', status: '' })),
  testConnection: vi.fn(async () => ({ success: true, message: 'ok' })),
}

beforeEach(() => {
  vi.mocked(createLidarrClient).mockReturnValue(
    mockLidarrClient as ReturnType<typeof createLidarrClient>,
  )
  vi.clearAllMocks()
  vi.mocked(createLidarrClient).mockReturnValue(
    mockLidarrClient as ReturnType<typeof createLidarrClient>,
  )
})

describe('GET /api/library/health', () => {
  it('returns cached results when available', async () => {
    const libraryHealth = makeMockLibraryHealth({
      hasCached: true,
    }) as unknown as AppDependencies['libraryHealth']
    const app = createApp(makeDeps({ libraryHealth }))
    const res = await app.request('/api/library/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(true)
    expect(body.checks).toHaveLength(1)
    expect(body.checks[0].id).toBe('missing-metadata')
    // Should NOT have called runChecks since cached
    expect((libraryHealth.runChecks as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('runs fresh checks when no cache', async () => {
    const libraryHealth = makeMockLibraryHealth({
      hasCached: false,
    }) as unknown as AppDependencies['libraryHealth']
    const app = createApp(makeDeps({ libraryHealth }))
    const res = await app.request('/api/library/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(false)
    expect(body.checks).toHaveLength(1)
    expect((libraryHealth.runChecks as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })
})

describe('POST /api/library/health/scan', () => {
  it('always forces a fresh scan', async () => {
    const libraryHealth = makeMockLibraryHealth({
      hasCached: true,
    }) as unknown as AppDependencies['libraryHealth']
    const app = createApp(makeDeps({ libraryHealth }))
    const res = await app.request('/api/library/health/scan', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(false)
    expect(body.checks).toHaveLength(1)
    expect((libraryHealth.runChecks as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })
})

describe('POST /api/library/health/:checkId/fix', () => {
  it('triggers fix for a valid check ID', async () => {
    const libraryHealth = makeMockLibraryHealth() as unknown as AppDependencies['libraryHealth']
    const app = createApp(makeDeps({ libraryHealth }))
    const res = await app.request('/api/library/health/unmonitored/fix', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checkId).toBe('unmonitored')
    expect(body.status).toBe('completed')
    const fixCalls = (libraryHealth.fixCheck as ReturnType<typeof vi.fn>).mock.calls
    expect(fixCalls).toHaveLength(1)
    expect(fixCalls[0]?.[0]).toBe('unmonitored')
  })

  it('returns 400 for invalid check ID', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/api/library/health/totally-bogus/fix', { method: 'POST' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid check ID')
  })

  it('returns 400 when fixCheck throws', async () => {
    const libraryHealth = {
      ...makeMockLibraryHealth(),
      fixCheck: vi.fn(async () => {
        throw new Error('duplicate-artists check is not fixable')
      }),
    } as unknown as AppDependencies['libraryHealth']
    const app = createApp(makeDeps({ libraryHealth }))
    const res = await app.request('/api/library/health/duplicate-artists/fix', { method: 'POST' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not fixable/i)
  })
})

describe('GET /api/library/stats', () => {
  it('returns library statistics', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/api/library/stats')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalArtists).toBe(10)
    expect(body.monitoredArtists).toBe(8)
    expect(body.genreDistribution).toHaveLength(1)
    expect(body.rootFolders).toHaveLength(1)
  })
})
