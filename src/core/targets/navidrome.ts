import { createNavidromeClient } from '@/core/clients/navidrome'
import type {
  DestinationTarget,
  FavoritesResult,
  PlaylistItem,
  PlaylistResult,
} from './types'

export type NavidromeTargetConfig = {
  url: string
  username: string
  password: string
  skipTlsVerify?: boolean
}

export function createNavidromeTarget(
  targetId: number,
  config: NavidromeTargetConfig,
): DestinationTarget {
  const client = createNavidromeClient(config.url, config.username, config.password, {
    skipTlsVerify: config.skipTlsVerify,
  })

  return {
    id: `navidrome-${targetId}`,
    name: 'Navidrome',
    type: 'navidrome',
    capabilities: ['createPlaylist', 'addToFavorites'],

    async createPlaylist(
      name: string,
      items: PlaylistItem[],
      options?: { description?: string; public?: boolean; replace?: boolean },
    ): Promise<PlaylistResult> {
      try {
        // Collect track IDs by searching for each artist's tracks
        // Filter results by artist name to avoid fuzzy-match false positives
        const trackIds: string[] = []
        for (const item of items) {
          const query = item.trackName
            ? `${item.artistName} ${item.trackName}`
            : item.artistName
          const tracks = await client.searchTracks(query, 20)
          const filtered = tracks.filter(
            (t) => t.artist.toLowerCase() === item.artistName.toLowerCase(),
          )
          for (const track of filtered.slice(0, 10)) {
            trackIds.push(track.id)
          }
        }

        // If replace mode, look for existing playlist with the same name
        if (options?.replace) {
          const existing = await client.getPlaylists()
          const match = existing.find(
            (p) => p.name.toLowerCase() === name.toLowerCase(),
          )
          if (match) {
            if (trackIds.length > 0) {
              await client.addSongsToPlaylist(match.id, trackIds)
            }
            return {
              success: true,
              targetType: 'navidrome',
              targetId,
              playlistId: match.id,
              playlistName: name,
              itemsAdded: trackIds.length,
            }
          }
        }

        // Create new playlist
        const playlist = await client.createPlaylist(name, trackIds)

        return {
          success: true,
          targetType: 'navidrome',
          targetId,
          playlistId: playlist.id,
          playlistName: name,
          itemsAdded: trackIds.length,
        }
      } catch (err: unknown) {
        return {
          success: false,
          targetType: 'navidrome',
          targetId,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    async addToFavorites(
      artists: Array<{ mbid: string; name: string }>,
    ): Promise<FavoritesResult> {
      try {
        for (const artist of artists) {
          const matches = await client.searchArtist(artist.name)
          const match = matches.find(
            (a) => a.name.toLowerCase() === artist.name.toLowerCase(),
          )
          if (match) {
            await client.starArtist(match.id)
          }
        }
        return { success: true, targetType: 'navidrome', targetId }
      } catch (err: unknown) {
        return {
          success: false,
          targetType: 'navidrome',
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
