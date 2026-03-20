import PQueue from 'p-queue'
import type { ServiceTestResult } from '@/core/types'
import { createHttpClient } from './http'

export type JellyfinArtist = {
  name: string
  id: string
  playCount: number
  isFavorite: boolean
}

export type JellyfinRecentTrack = {
  artistName: string
  trackName: string
  datePlayed: string
}

type JellyfinItemsResponse = {
  Items: Array<Record<string, unknown>>
  TotalRecordCount: number
}

type JellyfinSystemInfo = {
  ServerName: string
  Version: string
}

export function createJellyfinClient(
  url: string,
  apiKey: string,
  userId: string,
  options?: { baseUrl?: string },
) {
  const baseUrl = options?.baseUrl ?? url

  const http = createHttpClient({
    baseUrl,
    headers: {
      Authorization: `MediaBrowser Token="${apiKey}"`,
    },
  })

  const queue = new PQueue({ concurrency: 3, interval: 1000, intervalCap: 10 })

  function get<T>(path: string): Promise<T> {
    return queue.add(() => http.get<T>(path)) as Promise<T>
  }

  async function getTopArtists(limit = 50): Promise<JellyfinArtist[]> {
    const params = new URLSearchParams({
      SortBy: 'PlayCount',
      SortOrder: 'Descending',
      IncludeItemTypes: 'MusicArtist',
      Recursive: 'true',
      Fields: 'UserData',
      Limit: String(limit),
    })

    const res = await get<JellyfinItemsResponse>(`/Users/${userId}/Items?${params.toString()}`)

    return res.Items.filter((item) => {
      const userData = item.UserData as { PlayCount?: number } | undefined
      return (userData?.PlayCount ?? 0) > 0
    }).map((item) => {
      const userData = item.UserData as {
        PlayCount?: number
        IsFavorite?: boolean
      }
      return {
        name: item.Name as string,
        id: item.Id as string,
        playCount: userData?.PlayCount ?? 0,
        isFavorite: userData?.IsFavorite ?? false,
      }
    })
  }

  async function getRecentlyPlayed(limit = 50): Promise<JellyfinRecentTrack[]> {
    const params = new URLSearchParams({
      SortBy: 'DatePlayed',
      SortOrder: 'Descending',
      IncludeItemTypes: 'Audio',
      Recursive: 'true',
      IsPlayed: 'true',
      Fields: 'UserData',
      Limit: String(limit),
    })

    const res = await get<JellyfinItemsResponse>(`/Users/${userId}/Items?${params.toString()}`)

    return res.Items.map((item) => {
      const artistName =
        (item.AlbumArtist as string) ||
        ((item.Artists as string[] | undefined)?.[0] ?? 'Unknown Artist')
      const userData = item.UserData as { LastPlayedDate?: string } | undefined
      return {
        artistName,
        trackName: item.Name as string,
        datePlayed: userData?.LastPlayedDate ?? new Date().toISOString(),
      }
    })
  }

  async function getFavoriteArtists(limit = 50): Promise<JellyfinArtist[]> {
    const params = new URLSearchParams({
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      IncludeItemTypes: 'MusicArtist',
      Recursive: 'true',
      IsFavorite: 'true',
      Fields: 'UserData',
      Limit: String(limit),
    })

    const res = await get<JellyfinItemsResponse>(`/Users/${userId}/Items?${params.toString()}`)

    return res.Items.map((item) => {
      const userData = item.UserData as {
        PlayCount?: number
        IsFavorite?: boolean
      }
      return {
        name: item.Name as string,
        id: item.Id as string,
        playCount: userData?.PlayCount ?? 0,
        isFavorite: userData?.IsFavorite ?? true,
      }
    })
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const info = await get<JellyfinSystemInfo>('/System/Info')
      const artists = await getTopArtists(5)
      return {
        success: true,
        message: `Connected to Jellyfin "${info.ServerName}" v${info.Version} -- ${artists.length} top artist(s)`,
        details: {
          serverName: info.ServerName,
          version: info.Version,
          artistCount: artists.length,
        },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  return {
    getTopArtists,
    getRecentlyPlayed,
    getFavoriteArtists,
    testConnection,
  }
}
