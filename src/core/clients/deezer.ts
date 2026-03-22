import type { ServiceTestResult } from '@/core/types'
import { errMsg } from '@/core/validation'

const DEFAULT_BASE_URL = 'https://api.deezer.com'

export type DeezerSearchResult = {
  id: number
  name: string
  fans: number
  imageUrl?: string
  url: string
}

// Raw Deezer API response shapes
type DeezerArtistItem = {
  id: number
  name: string
  nb_fan: number
  picture_medium?: string
  link: string
}

type DeezerSearchResponse = {
  data: DeezerArtistItem[]
  total?: number
  error?: { type: string; message: string; code: number }
}

export function createDeezerClient(config?: { baseUrl?: string }) {
  const baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL

  async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`)
    }
    return res.json() as Promise<T>
  }

  async function searchArtists(query: string, limit = 25): Promise<DeezerSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    const url = `${baseUrl}/search/artist?${params.toString()}`
    const res = await fetchJson<DeezerSearchResponse>(url)
    if (res.error) {
      throw new Error(`Deezer API error: ${res.error.message}`)
    }
    return (res.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      fans: item.nb_fan,
      imageUrl: item.picture_medium || undefined,
      url: item.link,
    }))
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const results = await searchArtists('test', 1)
      return {
        success: true,
        message: `Connected to Deezer -- API responding`,
        details: { resultCount: results.length },
      }
    } catch (err: unknown) {
      return { success: false, message: errMsg(err) }
    }
  }

  return {
    searchArtists,
    testConnection,
  }
}
