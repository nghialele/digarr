// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LidarrArtist, QualityProfile, RootFolder } from '@/core/clients/lidarr'
import { createLidarrClient } from '@/core/clients/lidarr'

// Mock the HTTP client module so we never hit a real server.
const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('@/core/clients/http', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
    post: mockPost,
    put: vi.fn(),
    delete: vi.fn(),
  })),
}))

const { createHttpClient } = await import('@/core/clients/http')

const TEST_URL = 'http://lidarr.local:8686'
const TEST_KEY = 'abc123key'

const mockArtists: LidarrArtist[] = [
  {
    id: 1,
    artistName: 'Radiohead',
    foreignArtistId: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
    qualityProfileId: 1,
    rootFolderPath: '/music',
    monitored: true,
    status: 'ended',
  },
  {
    id: 2,
    artistName: 'Portishead',
    foreignArtistId: '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0a11',
    qualityProfileId: 1,
    rootFolderPath: '/music',
    monitored: true,
    status: 'continuing',
  },
]

const mockProfiles: QualityProfile[] = [
  { id: 1, name: 'Any' },
  { id: 2, name: 'Lossless' },
]

const mockFolders: RootFolder[] = [
  { id: 1, path: '/music', freeSpace: 10_000_000_000 },
  { id: 2, path: '/music2', freeSpace: 5_000_000_000 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createLidarrClient', () => {
  describe('constructor / auth header', () => {
    it('creates an HTTP client with X-Api-Key header', () => {
      createLidarrClient(TEST_URL, TEST_KEY)
      expect(createHttpClient).toHaveBeenCalledOnce()
      const config = vi.mocked(createHttpClient).mock.calls[0]?.[0]
      expect(config?.baseUrl).toBe(TEST_URL)
      expect(config?.headers?.['X-Api-Key']).toBe(TEST_KEY)
    })
  })

  describe('getArtists()', () => {
    it('GETs /api/v1/artist and returns artist array', async () => {
      mockGet.mockResolvedValueOnce(mockArtists)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.getArtists()
      expect(mockGet).toHaveBeenCalledWith('/api/v1/artist')
      expect(result).toEqual(mockArtists)
    })
  })

  describe('lookupArtist()', () => {
    it('GETs /api/v1/artist/lookup with encoded term', async () => {
      const searchResults = [mockArtists[0]]
      mockGet.mockResolvedValueOnce(searchResults)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.lookupArtist('Radiohead')
      expect(mockGet).toHaveBeenCalledWith('/api/v1/artist/lookup?term=Radiohead')
      expect(result).toEqual(searchResults)
    })

    it('URL-encodes terms with special characters', async () => {
      mockGet.mockResolvedValueOnce([])
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      await client.lookupArtist('At the Drive-In')
      expect(mockGet).toHaveBeenCalledWith('/api/v1/artist/lookup?term=At+the+Drive-In')
    })
  })

  describe('getQualityProfiles()', () => {
    it('GETs /api/v1/qualityprofile and returns profiles', async () => {
      mockGet.mockResolvedValueOnce(mockProfiles)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.getQualityProfiles()
      expect(mockGet).toHaveBeenCalledWith('/api/v1/qualityprofile')
      expect(result).toEqual(mockProfiles)
    })
  })

  describe('getRootFolders()', () => {
    it('GETs /api/v1/rootfolder and returns folders', async () => {
      mockGet.mockResolvedValueOnce(mockFolders)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.getRootFolders()
      expect(mockGet).toHaveBeenCalledWith('/api/v1/rootfolder')
      expect(result).toEqual(mockFolders)
    })
  })

  describe('addArtist()', () => {
    it('resolves rootFolderId to path and POSTs to /api/v1/artist', async () => {
      // getRootFolders() call, then post
      mockGet.mockResolvedValueOnce(mockFolders)
      mockPost.mockResolvedValueOnce({ ...mockArtists[0], id: 10 })

      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.addArtist(
        'a74b1b7f-71a5-4011-9441-d0b5e4122711',
        1,
        1,
      )

      expect(mockGet).toHaveBeenCalledWith('/api/v1/rootfolder')
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/artist',
        expect.objectContaining({
          foreignArtistId: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
          qualityProfileId: 1,
          rootFolderPath: '/music',
          monitored: true,
          addOptions: { monitor: 'all', searchForMissingAlbums: true },
        }),
      )
      expect(result).toMatchObject({ id: 10 })
    })

    it('throws if rootFolderId does not exist', async () => {
      mockGet.mockResolvedValueOnce(mockFolders)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      await expect(
        client.addArtist('mbid-xyz', 1, 999),
      ).rejects.toThrow(/root folder/i)
    })

    it('caches getRootFolders() -- only calls the API once across multiple addArtist calls', async () => {
      mockGet.mockResolvedValue(mockFolders)
      mockPost.mockResolvedValue({ id: 11 })

      const client = createLidarrClient(TEST_URL, TEST_KEY)
      await client.addArtist('mbid-a', 1, 1)
      await client.addArtist('mbid-b', 1, 2)

      const rootFolderGetCalls = mockGet.mock.calls.filter(
        (c) => c[0] === '/api/v1/rootfolder',
      )
      expect(rootFolderGetCalls).toHaveLength(1)
    })
  })

  describe('testConnection()', () => {
    it('returns success:true when getQualityProfiles() resolves', async () => {
      mockGet.mockResolvedValueOnce(mockProfiles)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.testConnection()
      expect(result.success).toBe(true)
      expect(typeof result.message).toBe('string')
    })

    it('returns success:false with error message when getQualityProfiles() rejects', async () => {
      mockGet.mockRejectedValueOnce(new Error('connection refused'))
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.testConnection()
      expect(result.success).toBe(false)
      expect(result.message).toMatch(/connection refused/)
    })

    it('returns ServiceTestResult shape (success, message)', async () => {
      mockGet.mockResolvedValueOnce(mockProfiles)
      const client = createLidarrClient(TEST_URL, TEST_KEY)
      const result = await client.testConnection()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })
  })
})
