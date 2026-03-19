// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock pipeline stages
// ---------------------------------------------------------------------------

vi.mock('@/core/pipeline/resolve', () => ({ resolve: vi.fn() }))
vi.mock('@/core/pipeline/score', () => ({ score: vi.fn() }))
vi.mock('@/core/pipeline/filter', () => ({ filter: vi.fn() }))
vi.mock('@/core/pipeline/store', () => ({ store: vi.fn() }))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { runGenreSubscription } = await import('@/core/genre/subscription-runner')
const { resolve } = await import('@/core/pipeline/resolve')
const { score } = await import('@/core/pipeline/score')
const { filter } = await import('@/core/pipeline/filter')
const { store } = await import('@/core/pipeline/store')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 42,
    sourceConfig: { genre: 'metal' },
    maxArtistsPerRun: 20,
    scoreThreshold: 0.5,
    scoringWeightPreset: 'genre',
    scoringWeightOverrides: null,
    ...overrides,
  }
}

function makeSource(id: string, hasGenreCapability = true) {
  return {
    id,
    name: id,
    capabilities: (hasGenreCapability
      ? ['topArtists', 'genreArtists']
      : ['topArtists']) as import('@/core/plugins/types').SourceCapability[],
    getTopArtists: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    getGenreArtists: hasGenreCapability
      ? vi.fn().mockResolvedValue([
          { name: 'Band A', mbid: 'mbid-a', listeners: 500_000, source: id },
          { name: 'Band B', mbid: 'mbid-b', listeners: 250_000, source: id },
        ])
      : undefined,
  }
}

function makeMbClient() {
  return {
    lookupArtist: vi.fn().mockResolvedValue({
      id: 'mbid-a',
      name: 'Band A',
      tags: [{ name: 'metal', count: 10 }],
      relations: [],
    }),
    searchArtist: vi.fn().mockResolvedValue({ artists: [] }),
    extractStreamingUrls: vi.fn().mockReturnValue({}),
  }
}

function makeDb() {
  return {
    getExistingRecommendationMbids: vi.fn().mockResolvedValue(new Set()),
    insertBatch: vi.fn().mockResolvedValue({ id: 99 }),
    completeBatch: vi.fn().mockResolvedValue(undefined),
    upsertArtist: vi.fn().mockResolvedValue({ id: 1 }),
    insertRecommendation: vi.fn().mockResolvedValue(undefined),
    getRejectedMbids: vi.fn().mockResolvedValue(new Set()),
    getFeedbackHistory: vi.fn().mockResolvedValue(new Map()),
  }
}

function makeSubscriptionQueries() {
  return {
    insertRun: vi.fn().mockResolvedValue({ id: 10, subscriptionId: 1 }),
    completeRun: vi.fn().mockResolvedValue(undefined),
    updateSubscription: vi.fn().mockResolvedValue(undefined),
  }
}

function makeResolvedArtist(mbid: string) {
  return {
    mbid,
    name: `Artist ${mbid}`,
    tags: ['metal'],
    genres: ['metal'],
    streamingUrls: {},
    discoveries: [
      { name: `Artist ${mbid}`, similarityScore: 0.5, source: 'genre-subscription:lastfm' },
    ],
  }
}

function makeScoredArtist(mbid: string) {
  return {
    ...makeResolvedArtist(mbid),
    score: 0.7,
    sourceScores: {
      consensus: 0.4,
      similarity: 0.35,
      genreOverlap: 0.05,
      aiConfidence: 0.1,
      feedbackBoost: 0.1,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runGenreSubscription()', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: pipeline stages return sensible values
    vi.mocked(resolve).mockResolvedValue([
      makeResolvedArtist('mbid-a'),
      makeResolvedArtist('mbid-b'),
    ])
    vi.mocked(score).mockReturnValue([makeScoredArtist('mbid-a'), makeScoredArtist('mbid-b')])
    vi.mocked(filter).mockReturnValue([makeScoredArtist('mbid-a')])
    vi.mocked(store).mockResolvedValue(99)
  })

  it('returns 0/0 when no sources have genreArtists capability', async () => {
    const queries = makeSubscriptionQueries()
    const result = await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [makeSource('lastfm', false)],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(result).toEqual({ artistsFound: 0, artistsNew: 0 })
    expect(resolve).not.toHaveBeenCalled()
    expect(store).not.toHaveBeenCalled()
  })

  it('logs run start via insertRun and completes via completeRun', async () => {
    const queries = makeSubscriptionQueries()
    const source = makeSource('lastfm')

    await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [source],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(queries.insertRun).toHaveBeenCalledOnce()
    expect(queries.insertRun).toHaveBeenCalledWith({ subscriptionId: 1 })
    expect(queries.completeRun).toHaveBeenCalledOnce()
    expect(queries.completeRun).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ artistsFound: 2, artistsNew: 1 }),
    )
  })

  it('fetches genre artists from capable sources with correct genre and limit', async () => {
    const queries = makeSubscriptionQueries()
    const source = makeSource('lastfm')

    await runGenreSubscription({
      subscription: makeSubscription({ sourceConfig: { genre: 'jazz' }, maxArtistsPerRun: 15 }),
      sources: [source],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(source.getGenreArtists).toHaveBeenCalledOnce()
    expect(source.getGenreArtists).toHaveBeenCalledWith('jazz', { limit: 15 })
  })

  it('uses the genre weight preset for scoring', async () => {
    const queries = makeSubscriptionQueries()
    const source = makeSource('lastfm')

    await runGenreSubscription({
      subscription: makeSubscription({ scoringWeightPreset: 'genre' }),
      sources: [source],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(score).toHaveBeenCalledOnce()
    const scoreCall = vi.mocked(score).mock.calls[0]
    // Second arg is libraryGenres, third is weights
    const weights = scoreCall?.[2]
    // Genre preset: consensus=0.4, similarity=0.35
    expect(weights).toMatchObject({ consensus: 0.4, similarity: 0.35 })
  })

  it('calls store only when filtered artists remain and returns correct counts', async () => {
    const queries = makeSubscriptionQueries()
    vi.mocked(filter).mockReturnValue([makeScoredArtist('mbid-a'), makeScoredArtist('mbid-b')])

    const result = await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [makeSource('lastfm')],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(store).toHaveBeenCalledOnce()
    expect(result).toEqual({ artistsFound: 2, artistsNew: 2 })
  })

  it('skips store when all artists are filtered out', async () => {
    const queries = makeSubscriptionQueries()
    vi.mocked(filter).mockReturnValue([])

    const result = await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [makeSource('lastfm')],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(store).not.toHaveBeenCalled()
    expect(result).toEqual({ artistsFound: 2, artistsNew: 0 })
  })

  it('updates subscription lastRunAt and lastResultCount after success', async () => {
    const queries = makeSubscriptionQueries()

    await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [makeSource('lastfm')],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(queries.updateSubscription).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastRunAt: expect.any(Date), lastResultCount: 1, lastError: null }),
    )
  })

  it('logs error to run record and subscription on failure, then re-throws', async () => {
    const queries = makeSubscriptionQueries()
    const boom = new Error('MB exploded')
    vi.mocked(resolve).mockRejectedValue(boom)

    await expect(
      runGenreSubscription({
        subscription: makeSubscription(),
        sources: [makeSource('lastfm')],
        mbClient: makeMbClient(),
        lidarrClient: null,
        storeDb: makeDb(),
        subscriptionQueries: queries,
        libraryMbids: new Set(),
        libraryGenres: [],
        rejectedMbids: new Set(),
        feedbackHistory: new Map(),
        cooldownDays: 90,
        defaultScoreThreshold: 0.5,
      }),
    ).rejects.toThrow('MB exploded')

    expect(queries.completeRun).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ error: 'MB exploded', artistsFound: 0, artistsNew: 0 }),
    )
    expect(queries.updateSubscription).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastError: 'MB exploded' }),
    )
  })

  it('aggregates artists from multiple capable sources', async () => {
    const queries = makeSubscriptionQueries()
    const source1 = makeSource('lastfm')
    const source2 = makeSource('listenbrainz')

    // source2 returns different artists
    source2.getGenreArtists?.mockResolvedValue([
      { name: 'Band C', mbid: 'mbid-c', listeners: 100_000, source: 'listenbrainz' },
    ])

    await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [source1, source2],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    // resolve should receive 3 discovered artists total (2 from lastfm + 1 from listenbrainz)
    expect(resolve).toHaveBeenCalledOnce()
    const passedDiscovered = vi.mocked(resolve).mock.calls[0]?.[0]
    expect(passedDiscovered).toHaveLength(3)
  })

  it('returns 0/0 when no artists have the genreArtists capability AND no query returns', async () => {
    const queries = makeSubscriptionQueries()
    const source = makeSource('lastfm')
    source.getGenreArtists?.mockResolvedValue([])

    const result = await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [source],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(result).toEqual({ artistsFound: 0, artistsNew: 0 })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('uses defaultScoreThreshold when subscription scoreThreshold is null', async () => {
    const queries = makeSubscriptionQueries()

    await runGenreSubscription({
      subscription: makeSubscription({ scoreThreshold: null }),
      sources: [makeSource('lastfm')],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.65,
    })

    expect(filter).toHaveBeenCalledOnce()
    const filterCall = vi.mocked(filter).mock.calls[0]
    // 5th arg (index 4) is scoreThreshold
    expect(filterCall?.[4]).toBe(0.65)
  })

  it('passes batchId from store to completeRun', async () => {
    const queries = makeSubscriptionQueries()
    vi.mocked(store).mockResolvedValue(77)
    vi.mocked(filter).mockReturnValue([makeScoredArtist('mbid-a')])

    await runGenreSubscription({
      subscription: makeSubscription(),
      sources: [makeSource('lastfm')],
      mbClient: makeMbClient(),
      lidarrClient: null,
      storeDb: makeDb(),
      subscriptionQueries: queries,
      libraryMbids: new Set(),
      libraryGenres: [],
      rejectedMbids: new Set(),
      feedbackHistory: new Map(),
      cooldownDays: 90,
      defaultScoreThreshold: 0.5,
    })

    expect(queries.completeRun).toHaveBeenCalledWith(10, expect.objectContaining({ batchId: 77 }))
  })
})
