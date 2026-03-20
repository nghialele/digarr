import { createHash, randomBytes } from 'node:crypto'
import type { ServiceTestResult } from '@/core/types'

type SubsonicResponse<T> = {
  'subsonic-response': {
    status: 'ok' | 'failed'
    error?: { code: number; message: string }
  } & T
}

export type NavidromeArtist = {
  id: string
  name: string
  albumCount?: number
}

export type NavidromeTrack = {
  id: string
  title: string
  artist: string
  artistId?: string
  albumId?: string
  duration?: number
}

export type NavidromePlaylist = {
  id: string
  name: string
  songCount: number
}

export function createNavidromeClient(
  baseUrl: string,
  username: string,
  password: string,
  options?: { skipTlsVerify?: boolean },
) {
  const clientName = 'digarr'
  const apiVersion = '1.16.1'

  function authParams(): URLSearchParams {
    const salt = randomBytes(8).toString('hex')
    const token = createHash('md5')
      .update(password + salt)
      .digest('hex')
    return new URLSearchParams({
      u: username,
      t: token,
      s: salt,
      v: apiVersion,
      c: clientName,
      f: 'json',
    })
  }

  const fetchOptions: RequestInit = {
    ...(options?.skipTlsVerify ? { tls: { rejectUnauthorized: false } } : {}),
  } as RequestInit

  async function request<T>(path: string, extra?: Record<string, string>): Promise<T> {
    const params = authParams()
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        params.append(k, v)
      }
    }
    const url = `${baseUrl}${path}?${params}`
    const res = await fetch(url, fetchOptions)

    if (!res.ok) {
      throw new Error(`Navidrome HTTP ${res.status}: ${await res.text()}`)
    }

    const json = (await res.json()) as SubsonicResponse<T>
    const sr = json['subsonic-response']
    if (sr.status === 'failed') {
      throw new Error(`Subsonic error ${sr.error?.code}: ${sr.error?.message}`)
    }
    return sr as T
  }

  return {
    async testConnection(): Promise<ServiceTestResult> {
      try {
        await request('/rest/ping.view')
        return { success: true, message: 'Connected to Navidrome' }
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    },

    async searchArtist(query: string): Promise<NavidromeArtist[]> {
      const data = await request<{
        searchResult3: { artist?: NavidromeArtist[] }
      }>('/rest/search3.view', { query, artistCount: '20', albumCount: '0', songCount: '0' })
      return data.searchResult3?.artist ?? []
    },

    async searchTracks(query: string, limit = 50): Promise<NavidromeTrack[]> {
      const data = await request<{
        searchResult3: { song?: NavidromeTrack[] }
      }>('/rest/search3.view', {
        query,
        artistCount: '0',
        albumCount: '0',
        songCount: String(limit),
      })
      return data.searchResult3?.song ?? []
    },

    async getPlaylists(): Promise<NavidromePlaylist[]> {
      const data = await request<{
        playlists: { playlist?: NavidromePlaylist[] }
      }>('/rest/getPlaylists.view')
      return data.playlists?.playlist ?? []
    },

    async createPlaylist(name: string, songIds: string[]): Promise<NavidromePlaylist> {
      const params: Record<string, string> = { name }
      const data = await request<{
        playlist: NavidromePlaylist
      }>('/rest/createPlaylist.view', params)
      if (songIds.length > 0) {
        await this.addSongsToPlaylist(data.playlist.id, songIds)
      }
      return data.playlist
    },

    async addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<void> {
      // Can't use request() helper because Subsonic expects repeated songIdToAdd params
      const params = authParams()
      params.set('playlistId', playlistId)
      for (const songId of songIds) {
        params.append('songIdToAdd', songId)
      }
      const url = `${baseUrl}/rest/updatePlaylist.view?${params}`
      const res = await fetch(url, fetchOptions)
      if (!res.ok) {
        throw new Error(`Navidrome HTTP ${res.status}: ${await res.text()}`)
      }
      const json = (await res.json()) as SubsonicResponse<Record<string, never>>
      if (json['subsonic-response'].status === 'failed') {
        const e = json['subsonic-response'].error
        throw new Error(`Subsonic error ${e?.code}: ${e?.message}`)
      }
    },

    async starArtist(artistId: string): Promise<void> {
      await request('/rest/star.view', { artistId })
    },
  }
}

export type NavidromeClient = ReturnType<typeof createNavidromeClient>
