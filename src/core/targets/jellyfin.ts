import { createJellyfinClient } from '@/core/clients/jellyfin'
import type { DestinationTarget, FavoritesResult, PlaylistItem, PlaylistResult } from './types'

type JellyfinTargetConfig = {
  url: string
  apiKey: string
  userId?: string
  skipTlsVerify?: boolean
}

export function createJellyfinTarget(
  targetId: number,
  config: JellyfinTargetConfig,
): DestinationTarget {
  const client = createJellyfinClient(config.url, config.apiKey, config.userId ?? '', {
    skipTlsVerify: config.skipTlsVerify,
  })

  return {
    id: `jellyfin-${targetId}`,
    name: 'Jellyfin',
    type: 'jellyfin',
    capabilities: ['createPlaylist', 'addToFavorites'],

    async createPlaylist(
      name: string,
      items: PlaylistItem[],
      _options?: { description?: string; public?: boolean; replace?: boolean },
    ): Promise<PlaylistResult> {
      try {
        const trackIds: string[] = []
        for (const item of items) {
          const query = item.trackName ? `${item.artistName} ${item.trackName}` : item.artistName
          const tracks = await client.searchTracks(query, 10)
          // Filter by artist name to avoid fuzzy-match false positives
          const filtered = tracks.filter((t) =>
            t.ArtistItems.some((a) => a.Name.toLowerCase() === item.artistName.toLowerCase()),
          )
          for (const track of filtered) {
            trackIds.push(track.Id)
          }
        }

        const playlist = await client.createPlaylist(name, trackIds)

        return {
          success: true,
          targetType: 'jellyfin',
          targetId,
          playlistId: playlist.Id,
          playlistName: name,
          itemsAdded: trackIds.length,
        }
      } catch (err: unknown) {
        return {
          success: false,
          targetType: 'jellyfin',
          targetId,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    async addToFavorites(artists: Array<{ mbid: string; name: string }>): Promise<FavoritesResult> {
      try {
        for (const artist of artists) {
          const matches = await client.searchArtist(artist.name)
          const match = matches.find((a) => a.Name.toLowerCase() === artist.name.toLowerCase())
          if (match) {
            await client.favoriteArtist(match.Id)
          }
        }
        return { success: true, targetType: 'jellyfin', targetId }
      } catch (err: unknown) {
        return {
          success: false,
          targetType: 'jellyfin',
          targetId,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    async testConnection() {
      return client.testConnection()
    },
  }
}
