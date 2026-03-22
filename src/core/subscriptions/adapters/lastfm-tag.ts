import type { AdapterConfigField, AdapterResult, SubscriptionAdapter } from '@/core/subscriptions/types'

const CONFIG_FIELDS: AdapterConfigField[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'text',
    required: true,
    placeholder: 'e.g. metal',
    helpText: 'Last.fm tag to fetch top artists for.',
  },
]

type LastfmArtistEntry = {
  name: string
  mbid?: string
  listeners?: string
}

type LastfmTagResponse = {
  topartists?: {
    artist?: LastfmArtistEntry[]
  }
}

function normalizeScore(listeners: string | undefined): number {
  if (!listeners) return 0.5
  const n = parseInt(listeners, 10)
  if (Number.isNaN(n) || n <= 0) return 0.5
  return Math.min(n / 1_000_000, 1.0)
}

export function createLastfmTagAdapter(deps: { apiKey: string }): SubscriptionAdapter {
  return {
    type: 'lastfm-tag',
    label: 'Last.fm Tag',
    configFields: CONFIG_FIELDS,

    async fetch(
      config: Record<string, unknown>,
      options?: { limit?: number },
    ): Promise<AdapterResult> {
      const tag = String(config.tag ?? '').trim()
      if (!tag) return { artists: [] }

      const limit = options?.limit ?? 50
      const url = `https://ws.audioscrobbler.com/2.0/?method=tag.gettopartists&tag=${encodeURIComponent(tag)}&api_key=${deps.apiKey}&format=json&limit=${limit}`

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Last.fm tag fetch failed: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as LastfmTagResponse
      const entries = data.topartists?.artist ?? []

      const seen = new Set<string>()
      const artists = []

      for (const entry of entries) {
        const key = entry.name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        artists.push({
          name: entry.name,
          mbid: entry.mbid || undefined,
          similarityScore: normalizeScore(entry.listeners),
          source: `lastfm-tag:${tag}`,
        })
      }

      return { artists }
    },
  }
}
