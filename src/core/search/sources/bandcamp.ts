import type { createBandcampClient } from '@/core/clients/bandcamp'
import type { SearchResult, SearchSource } from '@/core/search/multi-source'

export function createBandcampSearchSource(
  client: ReturnType<typeof createBandcampClient>,
): SearchSource {
  return {
    id: 'bandcamp',
    name: 'Bandcamp',
    available: true,

    async search(query: string, limit: number): Promise<SearchResult[]> {
      const results = await client.searchArtists(query, limit)
      return results.map((item) => ({
        name: item.name,
        images: item.imageUrl ? [{ url: item.imageUrl, source: 'bandcamp' }] : [],
        genres: item.genre ? [item.genre] : [],
        sourceId: 'bandcamp',
        sourceUrl: item.url,
      }))
    },
  }
}
