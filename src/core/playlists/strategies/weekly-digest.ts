import type { PlaylistStrategyImpl, StrategyArtist, StrategyDeps } from './types'

// Assume ~3 tracks per artist to figure out how many artists we need.
const TRACKS_PER_ARTIST = 3

export const weeklyDigestStrategy: PlaylistStrategyImpl = {
  async selectArtists(
    deps: StrategyDeps,
    config: { size: number; genre?: string; mood?: string },
  ): Promise<StrategyArtist[]> {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const artistLimit = Math.ceil(config.size / TRACKS_PER_ARTIST)

    const artists = await deps.getApprovedArtists({ since, limit: artistLimit })

    // Sort descending by score and cap to the artist limit.
    return artists.sort((a, b) => b.score - a.score).slice(0, artistLimit)
  },
}
