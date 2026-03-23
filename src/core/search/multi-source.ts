import PQueue from 'p-queue'

export type SearchSource = {
  id: string
  name: string
  available: boolean
  search(query: string, limit: number): Promise<SearchResult[]>
}

export type SearchResult = {
  name: string
  mbid?: string
  images: { url: string; source: string }[]
  genres: string[]
  popularity?: number
  listeners?: number
  sourceId: string
  sourceUrl?: string
  externalId?: string
}

export type MergedSearchResult = {
  name: string
  mbid?: string
  images: { url: string; source: string }[]
  genres: string[]
  popularity?: number
  listeners?: number
  sources: { id: string; url?: string; externalId?: string }[]
  inLibrary: boolean
  inRecommendations: boolean
}

type SearchOptions = {
  limit?: number
  libraryMbids?: Set<string>
  recMbids?: Set<string>
}

const SOURCE_TIMEOUT_MS = 5000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Search source timed out after ${ms}ms`)), ms),
    ),
  ])
}

export async function multiSourceSearch(
  query: string,
  sources: SearchSource[],
  opts?: SearchOptions,
): Promise<MergedSearchResult[]> {
  const limit = opts?.limit ?? 20
  const libraryMbids = opts?.libraryMbids ?? new Set<string>()
  const recMbids = opts?.recMbids ?? new Set<string>()

  const availableSources = sources.filter((s) => s.available)
  if (availableSources.length === 0) return []

  const queue = new PQueue({ concurrency: 3 })

  const allResults: SearchResult[] = []

  await Promise.all(
    availableSources.map((source) =>
      queue.add(async () => {
        try {
          const results = await withTimeout(source.search(query, limit), SOURCE_TIMEOUT_MS)
          allResults.push(...results)
        } catch (err: unknown) {
          console.warn(
            `[search] source "${source.id}" failed:`,
            err instanceof Error ? err.message : String(err),
          )
        }
      }),
    ),
  )

  // Merge results: key by MBID when available, lowercase-trimmed name as fallback
  const byKey = new Map<string, MergedSearchResult>()

  for (const result of allResults) {
    const key = result.mbid ?? `name:${result.name.toLowerCase().trim()}`

    const existing = byKey.get(key)
    if (existing) {
      // Merge images (deduplicate by url)
      const existingUrls = new Set(existing.images.map((i) => i.url))
      for (const img of result.images) {
        if (!existingUrls.has(img.url)) {
          existing.images.push(img)
          existingUrls.add(img.url)
        }
      }
      // Merge genres (deduplicate)
      const existingGenres = new Set(existing.genres)
      for (const g of result.genres) {
        if (!existingGenres.has(g)) {
          existing.genres.push(g)
          existingGenres.add(g)
        }
      }
      // Take highest popularity/listeners
      if (result.popularity !== undefined) {
        existing.popularity =
          existing.popularity === undefined
            ? result.popularity
            : Math.max(existing.popularity, result.popularity)
      }
      if (result.listeners !== undefined) {
        existing.listeners =
          existing.listeners === undefined
            ? result.listeners
            : Math.max(existing.listeners, result.listeners)
      }
      // Add source entry if not already present
      if (!existing.sources.some((s) => s.id === result.sourceId)) {
        existing.sources.push({
          id: result.sourceId,
          url: result.sourceUrl,
          externalId: result.externalId,
        })
      }
    } else {
      const merged: MergedSearchResult = {
        name: result.name,
        mbid: result.mbid,
        images: [...result.images],
        genres: [...result.genres],
        popularity: result.popularity,
        listeners: result.listeners,
        sources: [
          {
            id: result.sourceId,
            url: result.sourceUrl,
            externalId: result.externalId,
          },
        ],
        inLibrary: result.mbid ? libraryMbids.has(result.mbid) : false,
        inRecommendations: result.mbid ? recMbids.has(result.mbid) : false,
      }
      byKey.set(key, merged)
    }
  }

  const merged = Array.from(byKey.values())

  // Sort by source count descending (more sources = higher confidence)
  merged.sort((a, b) => b.sources.length - a.sources.length)

  return merged.slice(0, limit)
}
