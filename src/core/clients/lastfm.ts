import PQueue from 'p-queue'
import type { DiscoveredArtist, ServiceTestResult } from '@/core/types'
import { createHttpClient } from './http'

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/'

export type LastFmPeriod = '7day' | '1month' | '3month' | '6month' | '12month' | 'overall'

export type LastFmTopArtist = {
  name: string
  mbid?: string
  playCount: number
  source: 'lastfm'
}

export type LastFmRecentTrack = {
  artist: { '#text': string }
  name: string
}

export type LastFmArtistInfo = {
  bio: { summary: string }
  image: Array<{ '#text': string; size: string }>
  tags: { tag: Array<{ name: string }> }
}

// Raw Last.fm response shapes
type LfmSimilarArtistsResponse = {
  similarartists: {
    artist: Array<{ name: string; match: string; mbid: string }>
  }
}

type LfmTopArtistsResponse = {
  topartists: {
    artist: Array<{ name: string; mbid: string; playcount: string }>
  }
}

type LfmRecentTracksResponse = {
  recenttracks: {
    track: LastFmRecentTrack[]
  }
}

type LfmArtistInfoResponse = {
  artist: LastFmArtistInfo
}

export function createLastFmClient(username: string, apiKey: string) {
  const http = createHttpClient({ baseUrl: BASE_URL })

  const queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 5 })

  function buildUrl(params: Record<string, string>): string {
    const searchParams = new URLSearchParams({ ...params, api_key: apiKey, format: 'json' })
    return `?${searchParams.toString()}`
  }

  function get<T>(params: Record<string, string>): Promise<T> {
    return queue.add(() => http.get<T>(buildUrl(params))) as Promise<T>
  }

  async function getSimilarArtists(artist: string, mbid?: string): Promise<DiscoveredArtist[]> {
    const params: Record<string, string> = { method: 'artist.getSimilar', artist }
    if (mbid) params.mbid = mbid
    const res = await get<LfmSimilarArtistsResponse>(params)
    return res.similarartists.artist.map((a) => ({
      name: a.name,
      mbid: a.mbid || undefined,
      similarityScore: parseFloat(a.match),
      source: 'lastfm' as const,
    }))
  }

  async function getTopArtists(period: LastFmPeriod): Promise<LastFmTopArtist[]> {
    const res = await get<LfmTopArtistsResponse>({
      method: 'user.getTopArtists',
      user: username,
      period,
    })
    return res.topartists.artist.map((a) => ({
      name: a.name,
      mbid: a.mbid || undefined,
      playCount: parseInt(a.playcount, 10),
      source: 'lastfm' as const,
    }))
  }

  async function getRecentTracks(): Promise<LastFmRecentTrack[]> {
    const res = await get<LfmRecentTracksResponse>({
      method: 'user.getRecentTracks',
      user: username,
      limit: '50',
    })
    return res.recenttracks.track
  }

  async function getArtistInfo(artist: string, mbid?: string): Promise<LastFmArtistInfo> {
    const params: Record<string, string> = { method: 'artist.getInfo', artist }
    if (mbid) params.mbid = mbid
    const res = await get<LfmArtistInfoResponse>(params)
    return res.artist
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const artists = await getTopArtists('7day')
      return {
        success: true,
        message: `Connected to Last.fm -- ${artists.length} top artists for ${username}`,
        details: { artistCount: artists.length },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  return {
    getSimilarArtists,
    getTopArtists,
    getRecentTracks,
    getArtistInfo,
    testConnection,
  }
}
