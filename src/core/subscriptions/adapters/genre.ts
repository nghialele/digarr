import type { DiscoverySource } from '@/core/plugins/types'
import type { AdapterConfigField, AdapterResult, SubscriptionAdapter } from '@/core/subscriptions/types'

const CONFIG_FIELDS: AdapterConfigField[] = [
  {
    key: 'genre',
    label: 'Genre / Tag',
    type: 'text',
    required: true,
    placeholder: 'e.g. post-rock',
    helpText: 'Genre or tag name to fetch artists for.',
  },
  {
    key: 'providers',
    label: 'Providers',
    type: 'text',
    required: false,
    placeholder: 'e.g. lastfm,musicbrainz (leave blank for all)',
    helpText: 'Comma-separated source IDs to use. Leave blank to use all capable sources.',
  },
]

function normalizeScore(listeners: number): number {
  if (listeners <= 0) return 0.5
  return Math.min(listeners / 1_000_000, 1.0)
}

export function createGenreAdapter(sources: DiscoverySource[]): SubscriptionAdapter {
  return {
    type: 'genre',
    label: 'Genre / Tag',
    configFields: CONFIG_FIELDS,

    async fetch(
      config: Record<string, unknown>,
      options?: { limit?: number },
    ): Promise<AdapterResult> {
      const genre = String(config.genre ?? '')
      if (!genre) return { artists: [] }

      // Filter to capable sources, then optionally narrow by providers list
      let capable = sources.filter(
        (s) => s.capabilities.includes('genreArtists') && typeof s.getGenreArtists === 'function',
      )

      const providersRaw = config.providers
      if (providersRaw) {
        const allowed = Array.isArray(providersRaw)
          ? (providersRaw as string[])
          : String(providersRaw)
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
        capable = capable.filter((s) => allowed.includes(s.id))
      }

      if (capable.length === 0) return { artists: [] }

      const all = await Promise.all(
        capable.map((s) => s.getGenreArtists!(genre, options?.limit !== undefined ? { limit: options.limit } : undefined)),
      )

      const artists = all.flat().map((entry) => ({
        name: entry.name,
        mbid: entry.mbid,
        similarityScore: normalizeScore(entry.listeners),
        source: `genre-subscription:${entry.source}`,
      }))

      return { artists }
    },
  }
}
