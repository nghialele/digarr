// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { MBArtist } from '@/core/clients/musicbrainz'
import { resolve } from '@/core/pipeline/resolve'
import type { DiscoveredArtist } from '@/core/types'

function makeMbArtist(overrides: Partial<MBArtist> = {}): MBArtist {
  return {
    id: 'mbid-default',
    name: 'Test Artist',
    disambiguation: undefined,
    tags: [{ name: 'rock', count: 5 }],
    relations: [
      {
        type: 'streaming music',
        url: { resource: 'https://open.spotify.com/artist/abc' },
      },
    ],
    ...overrides,
  }
}

function makeMb(
  lookupResult?: MBArtist,
  searchResult?: { artists: Array<{ id: string; name: string; score: number }> },
) {
  return {
    lookupArtist: vi.fn().mockResolvedValue(lookupResult ?? makeMbArtist()),
    searchArtist: vi
      .fn()
      .mockResolvedValue(
        searchResult ?? { artists: [{ id: 'mbid-found', name: 'Found Artist', score: 90 }] },
      ),
    extractStreamingUrls: vi
      .fn()
      .mockImplementation((relations: Array<{ type: string; url?: { resource: string } }>) => {
        const result: Record<string, string> = {}
        for (const rel of relations) {
          if (rel.url?.resource?.includes('spotify')) {
            result.spotify = rel.url.resource
          }
        }
        return result
      }),
    getReleaseGroups: undefined as
      | ((
          artistMbid: string,
        ) => Promise<Array<{ id: string; title: string; type: string; firstReleaseDate?: string }>>)
      | undefined,
  }
}

describe('resolve()', () => {
  it('passes through artists that already have MBIDs', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'listenbrainz' },
    ]
    const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))

    const result = await resolve(discovered, mb)

    expect(result).toHaveLength(1)
    expect(result[0]?.mbid).toBe('mbid-rh')
    expect(mb.lookupArtist).toHaveBeenCalledWith('mbid-rh')
    expect(mb.searchArtist).not.toHaveBeenCalled()
  })

  it('searches MB for artists without MBIDs', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Burial', similarityScore: 0.85, source: 'lastfm' },
    ]
    const mb = makeMb(makeMbArtist({ id: 'mbid-found', name: 'Burial' }), {
      artists: [{ id: 'mbid-found', name: 'Burial', score: 95 }],
    })

    const result = await resolve(discovered, mb)

    expect(mb.searchArtist).toHaveBeenCalledWith('Burial')
    expect(mb.lookupArtist).toHaveBeenCalledWith('mbid-found')
    expect(result).toHaveLength(1)
    expect(result[0]?.mbid).toBe('mbid-found')
  })

  it('drops artists that cannot be resolved (lookupArtist throws)', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Ghost Artist', mbid: 'mbid-bad', similarityScore: 0.5, source: 'ai' },
    ]
    const mb = makeMb()
    mb.lookupArtist.mockRejectedValue(new Error('Not found'))

    const result = await resolve(discovered, mb)

    expect(result).toHaveLength(0)
  })

  it('drops artists where search returns no results', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Nonexistent Band', similarityScore: 0.4, source: 'lastfm' },
    ]
    const mb = makeMb(undefined, { artists: [] })

    const result = await resolve(discovered, mb)

    expect(result).toHaveLength(0)
  })

  it('extracts streaming URLs from MB relations', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'listenbrainz' },
    ]
    const mb = makeMb(
      makeMbArtist({
        id: 'mbid-rh',
        name: 'Radiohead',
        relations: [
          {
            type: 'streaming music',
            url: { resource: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb' },
          },
        ],
      }),
    )

    const result = await resolve(discovered, mb)

    expect(result[0]?.streamingUrls).toHaveProperty('spotify')
  })

  it('deduplicates artists with the same MBID from multiple discoveries', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'listenbrainz' },
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.8, source: 'lastfm' },
    ]
    const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))

    const result = await resolve(discovered, mb)

    // Both discoveries should be attached to one result
    expect(result).toHaveLength(1)
    expect(result[0]?.discoveries).toHaveLength(2)
  })

  it('emits progress events via callback', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'listenbrainz' },
    ]
    const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
    const onProgress = vi.fn()

    await resolve(discovered, mb, onProgress)

    expect(onProgress).toHaveBeenCalled()
    // Should have received at least one progress event with stage 'resolve'
    expect(onProgress.mock.calls.some((call) => call[0].stage === 'resolve')).toBe(true)
  })

  it('builds tags and genres from MB tags', async () => {
    const discovered: DiscoveredArtist[] = [
      { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'listenbrainz' },
    ]
    const mb = makeMb(
      makeMbArtist({
        id: 'mbid-rh',
        name: 'Radiohead',
        tags: [
          { name: 'alternative rock', count: 10 },
          { name: 'art rock', count: 8 },
        ],
      }),
    )

    const result = await resolve(discovered, mb)

    expect(result[0]?.tags).toContain('alternative rock')
    expect(result[0]?.genres).toContain('art rock')
  })

  describe('suggestedAlbum resolution', () => {
    it('exact album title match -> gets releaseGroupId', async () => {
      const discovered: DiscoveredArtist[] = [
        {
          name: 'Radiohead',
          mbid: 'mbid-rh',
          similarityScore: 0.9,
          source: 'ai',
          suggestedAlbum: 'OK Computer',
        },
      ]
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
      mb.getReleaseGroups = vi.fn().mockResolvedValue([
        { id: 'rg-okc', title: 'OK Computer', type: 'Album', firstReleaseDate: '1997-06-16' },
        { id: 'rg-kid', title: 'Kid A', type: 'Album', firstReleaseDate: '2000-10-02' },
      ])

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toEqual({
        releaseGroupId: 'rg-okc',
        title: 'OK Computer',
        type: 'Album',
      })
    })

    it('normalized match strips parenthetical suffix -> gets releaseGroupId', async () => {
      const discovered: DiscoveredArtist[] = [
        {
          name: 'Radiohead',
          mbid: 'mbid-rh',
          similarityScore: 0.9,
          source: 'ai',
          suggestedAlbum: 'OK Computer',
        },
      ]
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
      mb.getReleaseGroups = vi.fn().mockResolvedValue([
        {
          id: 'rg-okc-deluxe',
          title: 'OK Computer (Deluxe Edition)',
          type: 'Album',
          firstReleaseDate: '1997-06-16',
        },
      ])

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toEqual({
        releaseGroupId: 'rg-okc-deluxe',
        title: 'OK Computer (Deluxe Edition)',
        type: 'Album',
      })
    })

    it('unmatched album -> stored as free text without releaseGroupId', async () => {
      const discovered: DiscoveredArtist[] = [
        {
          name: 'Radiohead',
          mbid: 'mbid-rh',
          similarityScore: 0.9,
          source: 'ai',
          suggestedAlbum: 'Nonexistent Album',
        },
      ]
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
      mb.getReleaseGroups = vi
        .fn()
        .mockResolvedValue([{ id: 'rg-okc', title: 'OK Computer', type: 'Album' }])

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toEqual({ title: 'Nonexistent Album' })
      expect(result[0]?.suggestedAlbum?.releaseGroupId).toBeUndefined()
    })

    it('no suggestedAlbum -> result has no suggestedAlbum', async () => {
      const discovered: DiscoveredArtist[] = [
        { name: 'Radiohead', mbid: 'mbid-rh', similarityScore: 0.9, source: 'ai' },
      ]
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
      mb.getReleaseGroups = vi.fn()

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toBeUndefined()
      expect(mb.getReleaseGroups).not.toHaveBeenCalled()
    })

    it('getReleaseGroups not available -> falls back to free text', async () => {
      const discovered: DiscoveredArtist[] = [
        {
          name: 'Radiohead',
          mbid: 'mbid-rh',
          similarityScore: 0.9,
          source: 'ai',
          suggestedAlbum: 'OK Computer',
        },
      ]
      // makeMb() does not include getReleaseGroups by default
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toEqual({ title: 'OK Computer' })
    })

    it('getReleaseGroups throws -> falls back to free text', async () => {
      const discovered: DiscoveredArtist[] = [
        {
          name: 'Radiohead',
          mbid: 'mbid-rh',
          similarityScore: 0.9,
          source: 'ai',
          suggestedAlbum: 'OK Computer',
        },
      ]
      const mb = makeMb(makeMbArtist({ id: 'mbid-rh', name: 'Radiohead' }))
      mb.getReleaseGroups = vi.fn().mockRejectedValue(new Error('MB rate limited'))

      const result = await resolve(discovered, mb)

      expect(result[0]?.suggestedAlbum).toEqual({ title: 'OK Computer' })
    })
  })
})
