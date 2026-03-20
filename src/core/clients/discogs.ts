import PQueue from 'p-queue'
import type { ServiceTestResult } from '@/core/types'
import { createHttpClient } from './http'

const DEFAULT_BASE_URL = 'https://api.discogs.com'

type DiscogsArtistRef = {
  name: string
  id: number
}

type DiscogsPagination = {
  pages: number
  page: number
  items: number
}

type DiscogsCollectionResponse = {
  releases: Array<{
    basic_information: {
      artists: DiscogsArtistRef[]
      genres: string[]
      styles: string[]
    }
  }>
  pagination: DiscogsPagination
}

type DiscogsWantlistResponse = {
  wants: Array<{
    basic_information: {
      artists: DiscogsArtistRef[]
    }
  }>
  pagination: DiscogsPagination
}

type DiscogsSearchResponse = {
  results: Array<{
    title: string
    id: number
  }>
}

type DiscogsIdentityResponse = {
  username: string
  id: number
}

export type DiscogsArtistCount = {
  name: string
  id: number
  count: number
}

export function createDiscogsClient(
  token: string,
  username: string,
  options?: { baseUrl?: string },
) {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL

  const http = createHttpClient({
    baseUrl,
    headers: {
      Authorization: `Discogs token=${token}`,
      'User-Agent': 'Digarr/1.0',
    },
  })

  // Discogs rate limit: 60 req/min for authenticated requests
  const queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 })

  function get<T>(path: string): Promise<T> {
    return queue.add(() => http.get<T>(path)) as Promise<T>
  }

  function countArtists(
    items: Array<{ artists: DiscogsArtistRef[] }>,
    counts: Map<string, DiscogsArtistCount>,
  ): void {
    for (const item of items) {
      for (const artist of item.artists) {
        if (artist.name === 'Various' || artist.id === 0) continue
        const key = artist.name.toLowerCase()
        const existing = counts.get(key)
        if (existing) {
          existing.count++
        } else {
          counts.set(key, { name: artist.name, id: artist.id, count: 1 })
        }
      }
    }
  }

  async function getCollectionArtists(limit = 100): Promise<DiscogsArtistCount[]> {
    const counts = new Map<string, DiscogsArtistCount>()
    const perPage = 100

    for (let page = 1; page <= 3; page++) {
      const res = await get<DiscogsCollectionResponse>(
        `/users/${username}/collection/folders/0/releases?page=${page}&per_page=${perPage}`,
      )
      countArtists(
        res.releases.map((r) => r.basic_information),
        counts,
      )
      if (page >= res.pagination.pages) break
    }

    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit)
  }

  async function getWantlistArtists(limit = 100): Promise<DiscogsArtistCount[]> {
    const counts = new Map<string, DiscogsArtistCount>()
    const perPage = 100

    for (let page = 1; page <= 3; page++) {
      const res = await get<DiscogsWantlistResponse>(
        `/users/${username}/wants?page=${page}&per_page=${perPage}`,
      )
      countArtists(
        res.wants.map((w) => w.basic_information),
        counts,
      )
      if (page >= res.pagination.pages) break
    }

    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit)
  }

  async function searchByGenre(
    genre: string,
    limit = 20,
  ): Promise<Array<{ name: string; id: number }>> {
    const params = new URLSearchParams({
      type: 'artist',
      style: genre,
      per_page: String(limit),
    })
    const res = await get<DiscogsSearchResponse>(`/database/search?${params.toString()}`)
    return res.results.map((r) => ({ name: r.title, id: r.id }))
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const identity = await get<DiscogsIdentityResponse>('/oauth/identity')
      if (identity.username !== username) {
        return {
          success: false,
          message: `Token belongs to "${identity.username}", expected "${username}"`,
        }
      }
      return {
        success: true,
        message: `Connected to Discogs as ${identity.username}`,
        details: { username: identity.username, id: identity.id },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  return {
    getCollectionArtists,
    getWantlistArtists,
    searchByGenre,
    testConnection,
  }
}
