import type { PlaylistStrategyImpl, StrategyArtist, StrategyDeps } from './types'
import { TRACKS_PER_ARTIST } from './types'

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
