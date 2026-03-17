// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLastFmClient } from '@/core/clients/lastfm'

// Mock the HTTP client module so we never hit a real server.
const mockGet = vi.fn()

vi.mock('@/core/clients/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/clients/http')>()
  return {
    ...actual,
    createHttpClient: vi.fn(() => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
  }
})

const { createHttpClient } = await import('@/core/clients/http')

const TEST_USERNAME = 'testuser'
const TEST_API_KEY = 'deadbeef1234'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createLastFmClient', () => {
  describe('constructor', () => {
    it('creates an HTTP client with the Last.fm base URL', () => {
      createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      expect(createHttpClient).toHaveBeenCalledOnce()
      const config = vi.mocked(createHttpClient).mock.calls[0]?.[0]
      expect(config?.baseUrl).toBe('https://ws.audioscrobbler.com/2.0/')
    })
  })

  describe('getSimilarArtists(artist)', () => {
    it('GETs artist.getSimilar with api_key in query params', async () => {
      mockGet.mockResolvedValueOnce({
        similarartists: {
          artist: [
            { name: 'Portishead', match: '0.82', mbid: 'some-mbid' },
            { name: 'Massive Attack', match: '0.75', mbid: '' },
          ],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getSimilarArtists('Radiohead')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('method=artist.getSimilar'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('artist=Radiohead'))
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        name: 'Portishead',
        mbid: 'some-mbid',
        similarityScore: 0.82,
        source: 'lastfm',
      })
      expect(result[1]).toMatchObject({
        name: 'Massive Attack',
        similarityScore: 0.75,
        source: 'lastfm',
      })
    })

    it('returns DiscoveredArtist shape with parsed similarityScore', async () => {
      mockGet.mockResolvedValueOnce({
        similarartists: {
          artist: [{ name: 'Thom Yorke', match: '0.95', mbid: 'mbid-ty' }],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getSimilarArtists('Radiohead')
      expect(result[0]).toEqual({
        name: 'Thom Yorke',
        mbid: 'mbid-ty',
        similarityScore: 0.95,
        source: 'lastfm',
      })
    })

    it('accepts an optional mbid parameter', async () => {
      mockGet.mockResolvedValueOnce({ similarartists: { artist: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getSimilarArtists('Radiohead', 'a74b1b7f-71a5-4011-9441-d0b5e4122711')
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('mbid=a74b1b7f-71a5-4011-9441-d0b5e4122711'),
      )
    })

    it('returns empty array when no similar artists found', async () => {
      mockGet.mockResolvedValueOnce({ similarartists: { artist: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getSimilarArtists('UnknownBand')
      expect(result).toEqual([])
    })
  })

  describe('getTopArtists(period)', () => {
    it('GETs user.getTopArtists with correct period and api_key', async () => {
      mockGet.mockResolvedValueOnce({
        topartists: {
          artist: [
            { name: 'Radiohead', mbid: 'mbid-rh', playcount: '123' },
            { name: 'Portishead', mbid: '', playcount: '77' },
          ],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getTopArtists('7day')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('method=user.getTopArtists'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`user=${TEST_USERNAME}`))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('period=7day'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        name: 'Radiohead',
        mbid: 'mbid-rh',
        playCount: 123,
        source: 'lastfm',
      })
    })

    it('parses playcount as integer', async () => {
      mockGet.mockResolvedValueOnce({
        topartists: {
          artist: [{ name: 'Boards of Canada', mbid: 'boc-mbid', playcount: '456' }],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getTopArtists('overall')
      expect(result[0]?.playCount).toBe(456)
      expect(typeof result[0]?.playCount).toBe('number')
    })

    it('handles all valid period values', async () => {
      const periods = ['7day', '1month', '3month', '6month', '12month', 'overall'] as const
      for (const period of periods) {
        mockGet.mockResolvedValueOnce({ topartists: { artist: [] } })
        const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
        await client.getTopArtists(period)
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`period=${period}`))
        vi.clearAllMocks()
      }
    })
  })

  describe('getRecentTracks()', () => {
    it('GETs user.getRecentTracks with api_key and limit=50', async () => {
      mockGet.mockResolvedValueOnce({
        recenttracks: {
          track: [
            { artist: { '#text': 'Radiohead' }, name: 'Creep' },
            { artist: { '#text': 'Portishead' }, name: 'Sour Times' },
          ],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getRecentTracks()
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('method=user.getRecentTracks'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`user=${TEST_USERNAME}`))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('limit=50'))
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ artist: { '#text': 'Radiohead' }, name: 'Creep' })
    })

    it('returns raw track array', async () => {
      mockGet.mockResolvedValueOnce({
        recenttracks: { track: [] },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getRecentTracks()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getArtistInfo(artist)', () => {
    it('GETs artist.getInfo with artist name and api_key', async () => {
      mockGet.mockResolvedValueOnce({
        artist: {
          bio: { summary: 'Radiohead are a British rock band.' },
          image: [
            { '#text': 'http://img.example.com/small.jpg', size: 'small' },
            { '#text': 'http://img.example.com/large.jpg', size: 'large' },
          ],
          tags: { tag: [{ name: 'alternative rock' }, { name: 'art rock' }] },
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.getArtistInfo('Radiohead')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('method=artist.getInfo'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('artist=Radiohead'))
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
      expect(result).toMatchObject({
        bio: { summary: 'Radiohead are a British rock band.' },
        image: expect.arrayContaining([expect.objectContaining({ size: 'small' })]),
        tags: { tag: expect.arrayContaining([{ name: 'alternative rock' }]) },
      })
    })

    it('accepts optional mbid parameter', async () => {
      mockGet.mockResolvedValueOnce({
        artist: {
          bio: { summary: '' },
          image: [],
          tags: { tag: [] },
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getArtistInfo('Radiohead', 'a74b1b7f-71a5-4011-9441-d0b5e4122711')
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('mbid=a74b1b7f-71a5-4011-9441-d0b5e4122711'),
      )
    })
  })

  describe('api_key appended to all requests', () => {
    it('includes api_key in getSimilarArtists URL', async () => {
      mockGet.mockResolvedValueOnce({ similarartists: { artist: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getSimilarArtists('TestArtist')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
    })

    it('includes api_key in getTopArtists URL', async () => {
      mockGet.mockResolvedValueOnce({ topartists: { artist: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getTopArtists('1month')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
    })

    it('includes api_key in getRecentTracks URL', async () => {
      mockGet.mockResolvedValueOnce({ recenttracks: { track: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getRecentTracks()
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
    })

    it('includes api_key in getArtistInfo URL', async () => {
      mockGet.mockResolvedValueOnce({
        artist: { bio: { summary: '' }, image: [], tags: { tag: [] } },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      await client.getArtistInfo('TestArtist')
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(`api_key=${TEST_API_KEY}`))
    })
  })

  describe('testConnection()', () => {
    it('returns success:true when getTopArtists resolves', async () => {
      mockGet.mockResolvedValueOnce({
        topartists: {
          artist: [{ name: 'Radiohead', mbid: 'mbid-rh', playcount: '10' }],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.testConnection()
      expect(result.success).toBe(true)
      expect(typeof result.message).toBe('string')
    })

    it('includes artist count in details', async () => {
      mockGet.mockResolvedValueOnce({
        topartists: {
          artist: [
            { name: 'Radiohead', mbid: '', playcount: '10' },
            { name: 'Portishead', mbid: '', playcount: '5' },
          ],
        },
      })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.testConnection()
      expect(result.details).toMatchObject({ artistCount: 2 })
    })

    it('returns success:false with error message when getTopArtists rejects', async () => {
      mockGet.mockRejectedValueOnce(new Error('API key invalid'))
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.testConnection()
      expect(result.success).toBe(false)
      expect(result.message).toMatch(/API key invalid/)
    })

    it('returns ServiceTestResult shape (success, message)', async () => {
      mockGet.mockResolvedValueOnce({ topartists: { artist: [] } })
      const client = createLastFmClient(TEST_USERNAME, TEST_API_KEY)
      const result = await client.testConnection()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })
  })
})
