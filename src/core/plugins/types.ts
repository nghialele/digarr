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

export type GenreArtistEntry = {
  name: string
  mbid?: string
  listeners: number
  source: string
}

export type SourceCapability =
  | 'topArtists'
  | 'similarArtists'
  | 'genreArtists'
  | 'recentListening'
  | 'listeningActivity'

export interface DiscoverySource {
  /** Unique identifier for this source (e.g. 'listenbrainz', 'lastfm') */
  id: string
  /** Human-readable name */
  name: string
  /** Declared capabilities of this source */
  capabilities: SourceCapability[]
  /** Get the user's top artists for taste profiling */
  getTopArtists(limit?: number): Promise<TopArtistEntry[]>
  /** Get artists similar to a given artist */
  getSimilarArtists(artistName: string, mbid?: string): Promise<SimilarArtistEntry[]>
  /** Test connection to the source */
  testConnection(): Promise<ServiceTestResult>
  /** Get listening activity data (optional -- only some sources track this) */
  getListeningActivity?(): Promise<ListeningActivityEntry[]>
  /** Get top artists for a genre/tag (optional -- only sources with genreArtists capability) */
  getGenreArtists?(genre: string, options?: { limit?: number }): Promise<GenreArtistEntry[]>
  /** Get recently listened tracks/artists (optional -- only sources with recentListening capability) */
  getRecentListening?(limit?: number): Promise<{ name: string; track?: string; playedAt: Date }[]>
}
