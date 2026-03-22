import type { AdapterConfigField, AdapterResult, SubscriptionAdapter } from '@/core/subscriptions/types'

const CONFIG_FIELDS: AdapterConfigField[] = [
  {
    key: 'period',
    label: 'Period',
    type: 'select',
    required: false,
    options: [
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' },
    ],
    helpText: 'Time period for the chart. Defaults to this week.',
  },
]

type LastfmArtistEntry = {
  name: string
  mbid?: string
  listeners?: string
  playcount?: string
}

type LastfmChartsResponse = {
  artists?: {
    artist?: LastfmArtistEntry[]
  }
}

function normalizeScore(entry: LastfmArtistEntry): number {
  const raw = entry.listeners ?? entry.playcount
  if (!raw) return 0.5
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n <= 0) return 0.5
  return Math.min(n / 1_000_000, 1.0)
}

export function createLastfmChartsAdapter(deps: { apiKey: string }): SubscriptionAdapter {
  return {
    type: 'lastfm-charts',
    label: 'Last.fm Charts',
    configFields: CONFIG_FIELDS,

    async fetch(
      config: Record<string, unknown>,
      options?: { limit?: number },
    ): Promise<AdapterResult> {
      const period = String(config.period ?? 'week').trim()
      const limit = options?.limit ?? 50

      const url = `https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${deps.apiKey}&format=json&limit=${limit}`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Last.fm charts fetch failed: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as LastfmChartsResponse
      const entries = data.artists?.artist ?? []

      const seen = new Set<string>()
      const artists = []

      for (const entry of entries) {
        const key = entry.name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        artists.push({
          name: entry.name,
          mbid: entry.mbid || undefined,
          similarityScore: normalizeScore(entry),
          source: `lastfm-charts:${period}`,
        })
      }

      return { artists }
    },
  }
}
