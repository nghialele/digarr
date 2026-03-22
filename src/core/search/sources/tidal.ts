import type { createTidalClient } from '@/core/clients/tidal'
import type { SearchResult, SearchSource } from '@/core/search/multi-source'

export function createTidalSearchSource(
  client: ReturnType<typeof createTidalClient>,
): SearchSource {
  return {
    id: 'tidal',
    name: 'TIDAL',
    available: true,

    async search(query: string, limit: number): Promise<SearchResult[]> {
      const results = await client.searchArtists(query, limit)
      return results.map((item) => ({
        name: item.name,
        images: item.imageUrl ? [{ url: item.imageUrl, source: 'tidal' }] : [],
        genres: [],
        popularity: item.popularity,
        sourceId: 'tidal',
        sourceUrl: item.url,
        externalId: String(item.id),
      }))
    },
  }
}
