// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { discover } from '@/core/pipeline/discover'
import type { ListeningSource } from '@/core/plugins/types'
import type { TasteProfile } from '@/core/types'

const profile: TasteProfile = {
  topArtists: [
    { name: 'Radiohead', mbid: 'mbid-rh', playCount: 500, source: 'listenbrainz' },
    { name: 'Portishead', mbid: 'mbid-ph', playCount: 300, source: 'listenbrainz' },
  ],
  topGenres: [{ name: 'trip-hop', weight: 0.8 }],
  listeningPatterns: { totalListens: 1000, recentTrend: 'stable' },
}

function makeLb(): ListeningSource {
  return {
    id: 'listenbrainz',
    name: 'ListenBrainz',
    getTopArtists: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([
      { name: 'Thom Yorke', similarityScore: 0.9, source: 'listenbrainz' },
      { name: 'Massive Attack', similarityScore: 0.7, source: 'listenbrainz' },
    ]),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  }
}

function makeLfm(): ListeningSource {
  return {
    id: 'lastfm',
    name: 'Last.fm',
    getTopArtists: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([
      { name: 'Bjork', mbid: 'mbid-bj', similarityScore: 0.85, source: 'lastfm' },
      { name: 'Tricky', mbid: 'mbid-tr', similarityScore: 0.75, source: 'lastfm' },
    ]),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  }
}

function makeAi() {
  return {
    getRecommendations: vi.fn().mockResolvedValue([
      {
        artistName: 'Burial',
        reasoning: 'Similar dark electronic sound',
        confidence: 0.88,
        genres: ['electronic'],
      },
      {
        artistName: 'Four Tet',
        reasoning: 'Experimental electronic',
        confidence: 0.72,
        genres: ['electronic'],
      },
    ]),
  }
}

describe('discover()', () => {
  it('collects similar artists from LB source', async () => {
    const lb = makeLb()
    const results = await discover(profile, { listeningSources: [lb] }, 10)

    const names = results.map((r) => r.name)
    expect(names).toContain('Thom Yorke')
    expect(names).toContain('Massive Attack')
  })

  it('collects similar artists from Last.fm source', async () => {
    const lfm = makeLfm()
    const results = await discover(profile, { listeningSources: [lfm] }, 10)

    const names = results.map((r) => r.name)
    expect(names).toContain('Bjork')
    expect(names).toContain('Tricky')
  })

  it('includes AI recommendations', async () => {
    const ai = makeAi()
    const results = await discover(profile, { ai }, 10)

    const names = results.map((r) => r.name)
    expect(names).toContain('Burial')
    expect(names).toContain('Four Tet')
  })

  it('tags results with correct source', async () => {
    const lb = makeLb()
    const lfm = makeLfm()
    const ai = makeAi()
    const results = await discover(profile, { listeningSources: [lb, lfm], ai }, 10)

    const lbResults = results.filter((r) => r.source === 'listenbrainz')
    const lfmResults = results.filter((r) => r.source === 'lastfm')
    const aiResults = results.filter((r) => r.source === 'ai')

    expect(lbResults.length).toBeGreaterThan(0)
    expect(lfmResults.length).toBeGreaterThan(0)
    expect(aiResults.length).toBeGreaterThan(0)
  })

  it('isolates LB source failure -- other sources still return results', async () => {
    const lb: ListeningSource = {
      id: 'listenbrainz',
      name: 'ListenBrainz',
      getTopArtists: vi.fn().mockResolvedValue([]),
      getSimilarArtists: vi.fn().mockRejectedValue(new Error('LB down')),
      testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    }
    const lfm = makeLfm()
    const ai = makeAi()

    const results = await discover(profile, { listeningSources: [lb, lfm], ai }, 10)

    // Should still get Last.fm and AI results
    expect(results.filter((r) => r.source === 'lastfm').length).toBeGreaterThan(0)
    expect(results.filter((r) => r.source === 'ai').length).toBeGreaterThan(0)
    // But no LB results
    expect(results.filter((r) => r.source === 'listenbrainz').length).toBe(0)
  })

  it('isolates AI source failure -- other sources still return results', async () => {
    const lb = makeLb()
    const ai = { getRecommendations: vi.fn().mockRejectedValue(new Error('AI down')) }

    const results = await discover(profile, { listeningSources: [lb], ai }, 10)

    expect(results.filter((r) => r.source === 'listenbrainz').length).toBeGreaterThan(0)
    expect(results.filter((r) => r.source === 'ai').length).toBe(0)
  })

  it('respects topArtistsLimit -- skips artists beyond the limit', async () => {
    const lb = makeLb()
    // Limit to 1 artist, so only Radiohead's similar artists should be fetched
    await discover(profile, { listeningSources: [lb] }, 1)

    // getSimilarArtists should only be called once (for Radiohead)
    expect(lb.getSimilarArtists).toHaveBeenCalledTimes(1)
    expect(lb.getSimilarArtists).toHaveBeenCalledWith('Radiohead', 'mbid-rh')
  })

  it('skips LB similar artists for artists without MBID', async () => {
    const profileNoMbid: TasteProfile = {
      ...profile,
      topArtists: [{ name: 'Unknown Artist', playCount: 100, source: 'listenbrainz' }],
    }
    // LB source returns empty when no MBID is provided (the plugin handles this)
    const lb: ListeningSource = {
      id: 'listenbrainz',
      name: 'ListenBrainz',
      getTopArtists: vi.fn().mockResolvedValue([]),
      getSimilarArtists: vi.fn().mockResolvedValue([]),
      testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    }
    const results = await discover(profileNoMbid, { listeningSources: [lb] }, 10)

    // The source's getSimilarArtists is still called (it decides what to do with no MBID)
    expect(lb.getSimilarArtists).toHaveBeenCalledWith('Unknown Artist', undefined)
    expect(results).toEqual([])
  })

  it('returns empty array with no sources configured', async () => {
    const results = await discover(profile, {}, 10)
    expect(results).toEqual([])
  })

  it('makes exactly one AI call regardless of artist count', async () => {
    const ai = makeAi()
    await discover(profile, { ai }, 10)
    expect(ai.getRecommendations).toHaveBeenCalledTimes(1)
  })
})
