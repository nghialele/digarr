import type { PlaylistStrategyImpl, StrategyArtist, StrategyDeps } from './types'
import { TRACKS_PER_ARTIST } from './types'

const OLDER_THAN_DAYS = 30

export const rediscoverStrategy: PlaylistStrategyImpl = {
  async selectArtists(
    deps: StrategyDeps,
    config: { size: number; genre?: string; mood?: string },
  ): Promise<StrategyArtist[]> {
    const olderThan = new Date()
    olderThan.setDate(olderThan.getDate() - OLDER_THAN_DAYS)

    const artistLimit = Math.ceil(config.size / TRACKS_PER_ARTIST)

    const artists = await deps.getOlderApprovedArtists({ olderThan, limit: artistLimit })

    return artists.sort((a, b) => b.score - a.score).slice(0, artistLimit)
  },
}
