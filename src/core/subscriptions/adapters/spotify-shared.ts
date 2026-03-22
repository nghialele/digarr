import type { DiscoveredArtist } from '@/core/types'
import { deduplicateByName } from '../dedup'

export type SpotifyTrackItem = {
  track?: {
    artists?: Array<{ name: string; id: string; genres?: string[] }>
  } | null
}

export type SpotifyPlaylistResponse = {
  tracks?: {
    items?: SpotifyTrackItem[]
  }
}

type ArtistEntry = { name: string; genres?: string[] }

export function extractArtistsFromPlaylist(
  data: SpotifyPlaylistResponse,
  source: string,
  sourceUrl?: string,
  limit?: number,
): DiscoveredArtist[] {
  const entries: ArtistEntry[] = (data.tracks?.items ?? []).flatMap((item) =>
    (item.track?.artists ?? []).map((a) => ({ name: a.name, genres: a.genres })),
  )
  const artists = deduplicateByName(entries, (e) => ({
    name: e.name,
    similarityScore: 0.7,
    genres: e.genres,
    source,
    sourceUrl,
  }))
  return limit ? artists.slice(0, limit) : artists
}
