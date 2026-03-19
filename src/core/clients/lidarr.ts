import type { ServiceTestResult } from '@/core/types'
import { createHttpClient } from './http'

export type LidarrArtist = {
  id: number
  artistName: string
  foreignArtistId: string // This is the MBID
  qualityProfileId: number
  rootFolderPath: string
  monitored: boolean
  status: string
  genres?: string[]
}

export type QualityProfile = {
  id: number
  name: string
}

export type MetadataProfile = {
  id: number
  name: string
}

export type RootFolder = {
  id: number
  path: string
  freeSpace: number
}

export type LidarrAlbum = {
  id: number
  title: string
  artistId: number
  foreignAlbumId: string // MBID
  monitored: boolean
  albumType: string
  statistics?: {
    trackCount: number
    trackFileCount: number
    percentOfTracks: number
  }
}

export type LidarrCommand = {
  id: number
  name: string
  status: string
}

export function createLidarrClient(url: string, apiKey: string, skipTlsVerify = false) {
  const http = createHttpClient({
    baseUrl: url,
    headers: { 'X-Api-Key': apiKey },
    skipTlsVerify,
  })

  // Cache for root folders to avoid repeated API calls within a client instance.
  let rootFolderCache: RootFolder[] | null = null

  function getArtists(): Promise<LidarrArtist[]> {
    return http.get<LidarrArtist[]>('/api/v1/artist')
  }

  function lookupArtist(term: string): Promise<LidarrArtist[]> {
    const encoded = new URLSearchParams({ term }).toString()
    return http.get<LidarrArtist[]>(`/api/v1/artist/lookup?${encoded}`)
  }

  function getQualityProfiles(): Promise<QualityProfile[]> {
    return http.get<QualityProfile[]>('/api/v1/qualityprofile')
  }

  function getMetadataProfiles(): Promise<MetadataProfile[]> {
    return http.get<MetadataProfile[]>('/api/v1/metadataprofile')
  }

  async function getRootFolders(): Promise<RootFolder[]> {
    if (rootFolderCache !== null) return rootFolderCache
    const folders = await http.get<RootFolder[]>('/api/v1/rootfolder')
    rootFolderCache = folders
    return folders
  }

  async function addArtist(
    foreignArtistId: string,
    artistName: string,
    qualityProfileId: number,
    metadataProfileId: number,
    rootFolderId: number,
  ): Promise<LidarrArtist> {
    const folders = await getRootFolders()
    const folder = folders.find((f) => f.id === rootFolderId)
    if (!folder) {
      throw new Error(`Root folder with id ${rootFolderId} not found`)
    }

    return http.post<LidarrArtist>('/api/v1/artist', {
      foreignArtistId,
      artistName,
      qualityProfileId,
      metadataProfileId,
      rootFolderPath: folder.path,
      monitored: true,
      addOptions: {
        monitor: 'all',
        searchForMissingAlbums: true,
      },
    })
  }

  function getAlbums(artistId: number): Promise<LidarrAlbum[]> {
    return http.get<LidarrAlbum[]>(`/api/v1/album?artistIds=${artistId}`)
  }

  function updateArtist(id: number, data: Partial<LidarrArtist>): Promise<LidarrArtist> {
    return http.put<LidarrArtist>(`/api/v1/artist/${id}`, data)
  }

  function triggerCommand(name: string, body?: Record<string, unknown>): Promise<LidarrCommand> {
    return http.post<LidarrCommand>('/api/v1/command', { name, ...body })
  }

  async function testConnection(): Promise<ServiceTestResult> {
    try {
      const profiles = await http.get<QualityProfile[]>('/api/v1/qualityprofile')
      return {
        success: true,
        message: `Connected to Lidarr -- ${profiles.length} quality profile(s) found`,
        details: { profileCount: profiles.length },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }

  return {
    getArtists,
    lookupArtist,
    addArtist,
    getAlbums,
    updateArtist,
    triggerCommand,
    getQualityProfiles,
    getMetadataProfiles,
    getRootFolders,
    testConnection,
  }
}
