import type { PlaylistStrategyImpl, StrategyArtist, StrategyDeps } from './types'
import { TRACKS_PER_ARTIST } from './types'

export const genreFocusStrategy: PlaylistStrategyImpl = {
  async selectArtists(
    deps: StrategyDeps,
    config: { size: number; genre?: string; mood?: string },
  ): Promise<StrategyArtist[]> {
    const artistLimit = Math.ceil(config.size / TRACKS_PER_ARTIST)

    const artists = await deps.getApprovedArtists({ genre: config.genre, limit: artistLimit })

    return artists.sort((a, b) => b.score - a.score).slice(0, artistLimit)
  },
}
