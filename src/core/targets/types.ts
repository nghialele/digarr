import type { ServiceTestResult } from '@/core/types'

export type TargetCapability = 'addArtist' | 'addAlbum' | 'createPlaylist' | 'addToFavorites'

export const TARGET_TYPES = ['lidarr', 'navidrome', 'jellyfin', 'export'] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export type TargetAddOptions = {
  monitorOption?: 'all' | 'new' | 'none' | 'selected'
  selectedAlbumIds?: string[]
  qualityProfileId?: number
  metadataProfileId?: number
  rootFolderId?: number
}

export type TargetResult = {
  success: boolean
  targetType: string
  targetId: number
  externalId?: number | string
  error?: string
}

export interface DestinationTarget {
  id: string
  name: string
  type: TargetType
  capabilities: TargetCapability[]

  addArtist(
    artist: { mbid: string; name: string },
    options?: TargetAddOptions,
  ): Promise<TargetResult>

  testConnection(): Promise<ServiceTestResult>
}

export type ExportableRecommendation = {
  artistName: string
  artistMbid: string
  genres: string[]
  score: number
  status: string
  aiReasoning?: string
  imageUrl?: string
  streamingUrls: Record<string, string>
  createdAt: string
  suggestedAlbum?: string
}
