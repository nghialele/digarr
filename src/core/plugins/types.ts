import type { ServiceTestResult } from '@/core/types'

export type TopArtistEntry = {
  name: string
  mbid?: string
  playCount: number
  source: string
}

export type SimilarArtistEntry = {
  name: string
  mbid?: string
  similarityScore: number
  source: string
}

export type ListeningActivityEntry = {
  listen_count: number
  from_ts: number
  to_ts: number
}

export interface ListeningSource {
  /** Unique identifier for this source (e.g. 'listenbrainz', 'lastfm') */
  id: string
  /** Human-readable name */
  name: string
  /** Get the user's top artists for taste profiling */
  getTopArtists(): Promise<TopArtistEntry[]>
  /** Get artists similar to a given artist */
  getSimilarArtists(artistName: string, mbid?: string): Promise<SimilarArtistEntry[]>
  /** Test connection to the source */
  testConnection(): Promise<ServiceTestResult>
  /** Get listening activity data (optional -- only some sources track this) */
  getListeningActivity?(): Promise<ListeningActivityEntry[]>
}
