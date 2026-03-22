import type { PlaylistStrategyImpl, StrategyArtist, StrategyDeps } from './types'
import { TRACKS_PER_ARTIST } from './types'

// Simple keyword match: does any genre tag on the artist contain the mood word?
function artistMatchesMood(artist: StrategyArtist, mood: string): boolean {
  if (!artist.genres || artist.genres.length === 0) return false
  const keyword = mood.toLowerCase()
  return artist.genres.some((g) => g.toLowerCase().includes(keyword))
}

export const moodMixStrategy: PlaylistStrategyImpl = {
  async selectArtists(
    deps: StrategyDeps,
    config: { size: number; genre?: string; mood?: string },
  ): Promise<StrategyArtist[]> {
    // Fetch a generous pool so we have enough to filter down from.
    const poolLimit = Math.ceil(config.size / TRACKS_PER_ARTIST) * 5

    const artists = await deps.getApprovedArtists({ limit: poolLimit })

    const artistLimit = Math.ceil(config.size / TRACKS_PER_ARTIST)

    const mood = config.mood
    if (!mood) {
      return artists.sort((a, b) => b.score - a.score).slice(0, artistLimit)
    }

    return artists
      .filter((a) => artistMatchesMood(a, mood))
      .sort((a, b) => b.score - a.score)
      .slice(0, artistLimit)
  },
}
