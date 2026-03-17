import type { TasteProfile } from '@/core/types'

type TopArtistEntry = {
  name: string
  mbid?: string
  playCount: number
  source: 'listenbrainz' | 'lastfm'
}

type ListeningActivityEntry = {
  listen_count: number
  from_ts: number
  to_ts: number
}

// Minimal interfaces -- only what we actually need from the clients
interface ListenBrainzSource {
  getTopArtists: (range: 'month') => Promise<TopArtistEntry[]>
  getListeningActivity: () => Promise<ListeningActivityEntry[]>
}

interface LastFmSource {
  getTopArtists: (period: '1month') => Promise<TopArtistEntry[]>
}

export async function analyze(
  listenbrainz: ListenBrainzSource | null,
  lastfm: LastFmSource | null,
): Promise<TasteProfile> {
  const allArtists: TopArtistEntry[] = []
  let activityData: ListeningActivityEntry[] = []

  if (listenbrainz !== null) {
    const [lbArtists, activity] = await Promise.all([
      listenbrainz.getTopArtists('month'),
      listenbrainz.getListeningActivity(),
    ])
    allArtists.push(...lbArtists)
    activityData = activity
  }

  if (lastfm !== null) {
    const lfmArtists = await lastfm.getTopArtists('1month')
    // Cast source -- LastFm returns 'lastfm' but our interface uses generic TopArtistEntry
    allArtists.push(...(lfmArtists as TopArtistEntry[]))
  }

  // Deduplicate by name (case-insensitive), keep highest play count
  const byName = new Map<string, TopArtistEntry>()
  for (const artist of allArtists) {
    const key = artist.name.toLowerCase()
    const existing = byName.get(key)
    if (existing === undefined || artist.playCount > existing.playCount) {
      byName.set(key, artist)
    }
  }

  const topArtists = Array.from(byName.values()).sort((a, b) => b.playCount - a.playCount)

  // Compute genre weights from artist names used as proxy tags.
  // Real genre extraction would require MB lookups; for now we use empty genres.
  // The weight aggregation below is a hook for when tags are injected.
  const genreWeightMap = new Map<string, number>()
  const totalArtists = topArtists.length || 1

  for (const [index, _artist] of topArtists.entries()) {
    // Rank-weighted contribution -- top artist contributes most
    const rankWeight = (totalArtists - index) / totalArtists
    // Tags would be enumerated here if available; skip for now
    void rankWeight
  }

  const topGenres = Array.from(genreWeightMap.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight)

  // Determine recentTrend from listening activity
  const recentTrend = computeRecentTrend(activityData)

  const totalListens = activityData.reduce((sum, e) => sum + e.listen_count, 0)

  return {
    topArtists: topArtists.map((a) => ({
      name: a.name,
      mbid: a.mbid,
      playCount: a.playCount,
      source: a.source,
    })),
    topGenres,
    listeningPatterns: {
      totalListens,
      recentTrend,
    },
  }
}

function computeRecentTrend(
  activity: ListeningActivityEntry[],
): 'increasing' | 'stable' | 'decreasing' {
  if (activity.length < 2) return 'stable'

  // Compare last two periods
  const sorted = [...activity].sort((a, b) => a.from_ts - b.from_ts)
  const prev = sorted[sorted.length - 2]
  const last = sorted[sorted.length - 1]

  if (prev === undefined || last === undefined) return 'stable'

  const ratio = prev.listen_count > 0 ? last.listen_count / prev.listen_count : 1

  if (ratio > 1.1) return 'increasing'
  if (ratio < 0.9) return 'decreasing'
  return 'stable'
}
