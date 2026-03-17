import type { AiRecommendation, DiscoveredArtist, TasteProfile } from '@/core/types'

interface ListenBrainzSimilarSource {
  getSimilarArtists: (mbid: string) => Promise<Array<{ name: string; score: number }>>
}

interface LastFmSimilarSource {
  getSimilarArtists: (
    artist: string,
    mbid?: string,
  ) => Promise<Array<{ name: string; mbid?: string; similarityScore: number; source: string }>>
}

interface MusicBrainzSimilarSource {
  searchArtist: (
    query: string,
  ) => Promise<{ artists: Array<{ id: string; name: string; score: number }> }>
}

interface AiSource {
  getRecommendations: (profile: TasteProfile) => Promise<AiRecommendation[]>
}

export interface DiscoverSources {
  listenbrainz?: ListenBrainzSimilarSource | null
  lastfm?: LastFmSimilarSource | null
  musicbrainz?: MusicBrainzSimilarSource | null
  ai?: AiSource | null
}

export async function discover(
  profile: TasteProfile,
  sources: DiscoverSources,
  topArtistsLimit: number,
): Promise<DiscoveredArtist[]> {
  const topArtists = profile.topArtists.slice(0, topArtistsLimit)
  const results: DiscoveredArtist[] = []

  // For each top artist, query each configured source for similar artists
  await Promise.all(
    topArtists.map(async (artist) => {
      // ListenBrainz similar artists (needs MBID)
      if (sources.listenbrainz != null && artist.mbid) {
        try {
          const similar = await sources.listenbrainz.getSimilarArtists(artist.mbid)
          for (const s of similar) {
            results.push({
              name: s.name,
              similarityScore: s.score,
              source: 'listenbrainz',
            })
          }
        } catch {
          // Isolate source failure
        }
      }

      // Last.fm similar artists
      if (sources.lastfm != null) {
        try {
          const similar = await sources.lastfm.getSimilarArtists(artist.name, artist.mbid)
          for (const s of similar) {
            results.push({
              name: s.name,
              mbid: s.mbid,
              similarityScore: s.similarityScore,
              source: 'lastfm',
            })
          }
        } catch {
          // Isolate source failure
        }
      }
    }),
  )

  // One AI call with the full profile
  if (sources.ai != null) {
    try {
      const aiRecs = await sources.ai.getRecommendations(profile)
      for (const rec of aiRecs) {
        results.push({
          name: rec.artistName,
          similarityScore: rec.confidence,
          source: 'ai',
        })
      }
    } catch {
      // Isolate source failure
    }
  }

  return results
}
