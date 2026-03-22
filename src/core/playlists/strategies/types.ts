export type StrategyArtist = {
  name: string
  mbid?: string
  score: number
  genres?: string[]
}

export type StrategyDeps = {
  getApprovedArtists: (opts: {
    since?: Date
    genre?: string
    limit?: number
  }) => Promise<StrategyArtist[]>
  getOlderApprovedArtists: (opts: { olderThan: Date; limit: number }) => Promise<StrategyArtist[]>
}

export interface PlaylistStrategyImpl {
  selectArtists(
    deps: StrategyDeps,
    config: { size: number; genre?: string; mood?: string },
  ): Promise<StrategyArtist[]>
}
