import type { createDeezerClient } from '@/core/clients/deezer'
import type { SearchResult, SearchSource } from '@/core/search/multi-source'

export function createDeezerSearchSource(
  client: ReturnType<typeof createDeezerClient>,
): SearchSource {
  return {
    id: 'deezer',
    name: 'Deezer',
    available: true,

    async search(query: string, limit: number): Promise<SearchResult[]> {
      const results = await client.searchArtists(query, limit)
      return results.map((item) => ({
        name: item.name,
        images: item.imageUrl ? [{ url: item.imageUrl, source: 'deezer' }] : [],
        genres: [],
        listeners: item.fans,
        sourceId: 'deezer',
        sourceUrl: item.url,
        externalId: String(item.id),
      }))
    },
  }
}
