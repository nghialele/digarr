import PQueue from 'p-queue'
import type { ServiceTestResult } from '@/core/types'
import { createHttpClient } from './http'

export type PlexTopArtist = {
  name: string
  viewCount: number
  ratingKey: string
}

export type PlexRecentTrack = {
  artistName: string
  trackName: string
  viewedAt: number
}

// Raw Plex API response shapes
type PlexSectionsResponse = {
  MediaContainer: {
    Directory: Array<{ key: string; type: string; title: string }>
  }
}

type PlexArtistsResponse = {
  MediaContainer: {
    Metadata: Array<{ title: string; viewCount?: number; ratingKey: string }>
  }
}

type PlexHistoryResponse = {
  MediaContainer: {
    Metadata?: Array<{
      type: string
      grandparentTitle: string
      title: string
      viewedAt: number
    }>
  }
}

export function createPlexClient(url: string, token: string, options?: { baseUrl?: string }) {
  const baseUrl = options?.baseUrl ?? url.replace(/\/+$/, '')

  const http = createHttpClient({
    baseUrl,
    headers: {
      'X-Plex-Token': token,
      Accept: 'application/json',
    },
  })

  const queue = new PQueue({ concurrency: 3, interval: 1000, intervalCap: 10 })

  function get<T>(path: string): Promise<T> {
    return queue.add(() => http.get<T>(path)) as Promise<T>
  }

  async function getMusicSectionId(): Promise<string> {
    const res = await get<PlexSectionsResponse>('/library/sections')
    const section = res.MediaContainer.Directory.find((d) => d.type === 'artist')
    if (!section) {
      throw new Error('No music library section found in Plex')
    }
    return section.key
  }

  async function getTopArtists(limit = 50): Promise<PlexTopArtist[]> {
    const sectionId = await getMusicSectionId()
    const res = await get<PlexArtistsResponse>(
      `/library/sections/${sectionId}/all?type=8&sort=viewCount:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}`,
    )
    const metadata = res.MediaContainer.Metadata ?? []
    return metadata.map((m) => ({
      name: m.title,
      viewCount: m.viewCount ?? 0,
      ratingKey: m.ratingKey,
    }))
  }

  async function getRecentlyPlayed(limit = 50): Promise<PlexRecentTrack[]> {
    const res = await get<PlexHistoryResponse>(
      `/status/sessions/history/all?sort=viewedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}`,
    )
    const metadata = res.MediaContainer.Metadata ?? []
    return metadata
      .filter((m) => m.type === 'track')
      .map((m) => ({
        artistName: m.grandparentTitle,
        trackName: m.title,
        viewedAt: m.viewedAt * 1000,
      }))
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const sectionId = await getMusicSectionId()
      return {
        success: true,
        message: `Connected to Plex -- music library section ${sectionId}`,
        details: { sectionId },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  return {
    getMusicSectionId,
    getTopArtists,
    getRecentlyPlayed,
    testConnection,
  }
}
