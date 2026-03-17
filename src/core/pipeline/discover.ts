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
  libraryArtists?: Array<{ mbid: string; name: string }>,
  librarySeedRatio = 0.3,
): Promise<DiscoveredArtist[]> {
  const topArtists = profile.topArtists.slice(0, topArtistsLimit)
  const results: DiscoveredArtist[] = []

  // Mix in library artists based on librarySeedRatio (0 = none, 1 = all library)
  let seedArtists = topArtists
  if (libraryArtists && libraryArtists.length > 0 && librarySeedRatio > 0) {
    const librarySlots = Math.max(1, Math.round(topArtistsLimit * librarySeedRatio))
    const listeningSlots = topArtistsLimit - librarySlots

    // Shuffle library artists so we don't always seed the same ones
    const shuffled = [...libraryArtists].sort(() => Math.random() - 0.5)
    // Exclude artists already in topArtists
    const topMbids = new Set(topArtists.map((a) => a.mbid).filter(Boolean))
    const librarySeeds = shuffled
      .filter((a) => !topMbids.has(a.mbid))
      .slice(0, librarySlots)
      .map((a) => ({
        name: a.name,
        mbid: a.mbid,
        playCount: 0,
        source: 'listenbrainz' as const,
      }))

    seedArtists = [...topArtists.slice(0, listeningSlots), ...librarySeeds]
  }

  // For each seed artist, query each configured source for similar artists
  await Promise.all(
    seedArtists.map(async (artist) => {
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
          aiReasoning: rec.reasoning,
          source: 'ai',
        })
      }
    } catch {
      // Isolate source failure
    }
  }

  return results
}
