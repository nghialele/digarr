import type { AdapterConfigField, AdapterResult, SubscriptionAdapter } from '@/core/subscriptions/types'
import { extractArtistsFromPlaylist } from './spotify-shared'

const CHART_PLAYLIST_IDS: Record<string, Record<string, string>> = {
  global: {
    top50: '37i9dQZEVXbMDoHDwVN2tF',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  us: {
    top50: '37i9dQZEVXbLRQDuF5jeBp',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  gb: {
    top50: '37i9dQZEVXbLnolsZ8PSNw',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  de: {
    top50: '37i9dQZEVXbJiZcmkrIHGU',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  fr: {
    top50: '37i9dQZEVXbIPWwFssbupI',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  au: {
    top50: '37i9dQZEVXbJPcfkRz0wJ0',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
  br: {
    top50: '37i9dQZEVXbMXbN3EUUhlg',
    viral50: '37i9dQZEVXbLiRSasKsNU9',
  },
}

const CONFIG_FIELDS: AdapterConfigField[] = [
  {
    key: 'region',
    label: 'Region',
    type: 'select',
    required: true,
    options: [
      { value: 'global', label: 'Global' },
      { value: 'us', label: 'United States' },
      { value: 'gb', label: 'United Kingdom' },
      { value: 'de', label: 'Germany' },
      { value: 'fr', label: 'France' },
      { value: 'au', label: 'Australia' },
      { value: 'br', label: 'Brazil' },
    ],
  },
  {
    key: 'chartType',
    label: 'Chart Type',
    type: 'select',
    required: true,
    options: [
      { value: 'top50', label: 'Top 50' },
      { value: 'viral50', label: 'Viral 50' },
    ],
  },
]

export function createSpotifyChartsAdapter(deps: {
  getToken: () => Promise<string>
  baseUrl?: string
}): SubscriptionAdapter {
  const baseUrl = deps.baseUrl ?? 'https://api.spotify.com/v1'

  return {
    type: 'spotify-charts',
    label: 'Spotify Charts',
    configFields: CONFIG_FIELDS,

    async fetch(
      config: Record<string, unknown>,
      _options?: { limit?: number },
    ): Promise<AdapterResult> {
      const region = String(config.region ?? 'global').toLowerCase()
      const chartType = String(config.chartType ?? 'top50').toLowerCase()

      const regionCharts = CHART_PLAYLIST_IDS[region] ?? CHART_PLAYLIST_IDS.global!
      const playlistId = regionCharts[chartType] ?? regionCharts.top50!

      const token = await deps.getToken()
      const url = `${baseUrl}/playlists/${playlistId}?fields=tracks.items(track(artists(name,id)))`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Spotify charts fetch failed: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const artists = extractArtistsFromPlaylist(
        data,
        `spotify-charts:${region}/${chartType}`,
        `https://open.spotify.com/playlist/${playlistId}`,
      )

      return { artists }
    },
  }
}
