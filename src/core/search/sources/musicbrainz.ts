import type { SearchResult, SearchSource } from '@/core/search/multi-source'

type MBSearchResult = {
  artists: Array<{
    id: string
    name: string
    disambiguation?: string
    tags?: Array<{ name: string; count: number }>
    score: number
  }>
}

export function createMusicBrainzSearchSource(mbClient: {
  searchArtist(query: string): Promise<unknown>
}): SearchSource {
  return {
    id: 'musicbrainz',
    name: 'MusicBrainz',
    available: true,

    async search(query: string, limit: number): Promise<SearchResult[]> {
      const raw = await mbClient.searchArtist(query)
      const data = raw as MBSearchResult
      const artists = data.artists ?? []
      return artists.slice(0, limit).map((artist) => ({
        name: artist.name,
        mbid: artist.id,
        images: [],
        genres: (artist.tags ?? []).map((t) => t.name),
        sourceId: 'musicbrainz',
        sourceUrl: `https://musicbrainz.org/artist/${artist.id}`,
        externalId: artist.id,
      }))
    },
  }
}
