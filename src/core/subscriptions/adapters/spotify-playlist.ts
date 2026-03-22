import type { AdapterConfigField, AdapterResult, SubscriptionAdapter } from '@/core/subscriptions/types'

const CONFIG_FIELDS: AdapterConfigField[] = [
  {
    key: 'playlistId',
    label: 'Playlist ID or URL',
    type: 'text',
    required: true,
    placeholder: 'e.g. 37i9dQZEVXbMDoHDwVN2tF or open.spotify.com/playlist/...',
    helpText: 'Spotify playlist URL, URI, or bare ID.',
  },
]

/** Extract the bare playlist ID from a URL, URI, or raw ID. */
function extractPlaylistId(raw: string): string {
  // spotify:playlist:ID
  const uriMatch = raw.match(/spotify:playlist:([A-Za-z0-9]+)/)
  if (uriMatch) return uriMatch[1]!

  // https://open.spotify.com/playlist/ID or open.spotify.com/playlist/ID
  const urlMatch = raw.match(/\/playlist\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]!

  // bare ID
  return raw.trim()
}

type SpotifyTrackItem = {
  track?: {
    artists?: Array<{ name: string; id: string }>
  } | null
}

type SpotifyPlaylistResponse = {
  tracks?: {
    items?: SpotifyTrackItem[]
  }
}

export function createSpotifyPlaylistAdapter(deps: {
  getToken: () => Promise<string>
  baseUrl?: string
}): SubscriptionAdapter {
  const baseUrl = deps.baseUrl ?? 'https://api.spotify.com/v1'

  return {
    type: 'spotify-playlist',
    label: 'Spotify Playlist',
    configFields: CONFIG_FIELDS,

    async fetch(
      config: Record<string, unknown>,
      _options?: { limit?: number },
    ): Promise<AdapterResult> {
      const rawId = String(config.playlistId ?? '').trim()
      if (!rawId) return { artists: [] }

      const playlistId = extractPlaylistId(rawId)
      const token = await deps.getToken()

      const url = `${baseUrl}/playlists/${playlistId}?fields=tracks.items(track(artists(name,id)))`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Spotify playlist fetch failed: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as SpotifyPlaylistResponse
      const items = data.tracks?.items ?? []

      const seen = new Set<string>()
      const artists = []

      for (const item of items) {
        const trackArtists = item.track?.artists ?? []
        for (const artist of trackArtists) {
          const key = artist.name.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          artists.push({
            name: artist.name,
            similarityScore: 0.7,
            source: `spotify-playlist:${playlistId}`,
            sourceUrl: `https://open.spotify.com/playlist/${playlistId}`,
          })
        }
      }

      return { artists }
    },
  }
}
