import { filter } from '@/core/pipeline/filter'
import { resolve } from '@/core/pipeline/resolve'
import { score } from '@/core/pipeline/score'
import type { StoreDb } from '@/core/pipeline/store'
import { store } from '@/core/pipeline/store'
import { resolveWeights } from '@/core/pipeline/weight-presets'
import type { DiscoverySource } from '@/core/plugins/types'
import type { DiscoveredArtist } from '@/core/types'
import type { RunComplete, RunInsert, SubscriptionUpdate } from '@/db/queries/subscriptions'

type SubscriptionRunRow = {
  id: number
  subscriptionId: number
  startedAt: Date
  completedAt: Date | null
  artistsFound: number | null
  artistsNew: number | null
  error: string | null
  batchId: number | null
}

type MusicBrainzClient = {
  lookupArtist: (mbid: string) => Promise<unknown>
  searchArtist: (query: string) => Promise<unknown>
  extractStreamingUrls: (
    relations: Array<{ type: string; url?: { resource: string } }>,
  ) => Record<string, string>
}

type LidarrLookupClient = {
  lookupArtist: (term: string) => Promise<unknown[]>
}

export type SubscriptionConfig = {
  id: number
  userId: number | null
  sourceConfig: Record<string, unknown>
  maxArtistsPerRun: number
  scoreThreshold: number | null
  scoringWeightPreset: string | null
  scoringWeightOverrides: Record<string, number> | null
}

export type SubscriptionQueries = {
  insertRun: (data: RunInsert) => Promise<SubscriptionRunRow>
  completeRun: (id: number, data: RunComplete) => Promise<void>
  updateSubscription: (id: number, data: SubscriptionUpdate) => Promise<void>
}

export type GenreSubscriptionDeps = {
  subscription: SubscriptionConfig
  sources: DiscoverySource[]
  mbClient: MusicBrainzClient
  lidarrClient: LidarrLookupClient | null
  storeDb: StoreDb
  subscriptionQueries: SubscriptionQueries
  libraryMbids: Set<string>
  libraryGenres: string[]
  rejectedMbids: Set<string>
  feedbackHistory: Map<string, { approved: number; total: number }>
  cooldownDays: number
  defaultScoreThreshold: number
}

export type SimilarSubscriptionDeps = GenreSubscriptionDeps

const LISTENER_SCALE = 1_000_000
const DEFAULT_SIMILARITY = 0.5

export async function runGenreSubscription(
  deps: GenreSubscriptionDeps,
): Promise<{ artistsFound: number; artistsNew: number }> {
  const {
    subscription,
    sources,
    mbClient,
    lidarrClient,
    storeDb,
    subscriptionQueries,
    libraryMbids,
    libraryGenres,
    rejectedMbids,
    feedbackHistory,
    cooldownDays,
    defaultScoreThreshold,
  } = deps

  const genre =
    typeof subscription.sourceConfig.genre === 'string' ? subscription.sourceConfig.genre : ''

  // Log run start
  const run = await subscriptionQueries.insertRun({ subscriptionId: subscription.id })

  try {
    // Fetch genre artists from all sources with genreArtists capability
    const capableSources = sources.filter(
      (s) => s.capabilities.includes('genreArtists') && typeof s.getGenreArtists === 'function',
    )

    // If subscription specifies providers, filter to only those
    const providers = Array.isArray(subscription.sourceConfig.providers)
      ? (subscription.sourceConfig.providers as string[])
      : null
    const filteredSources = providers
      ? capableSources.filter((s) => providers.includes(s.id))
      : capableSources

    if (filteredSources.length === 0) {
      const reason = capableSources.length === 0
        ? `No sources with genreArtists capability (available sources: ${sources.map((s) => s.id).join(', ') || 'none'})`
        : `Provider filter [${providers?.join(', ')}] matched no capable sources (capable: ${capableSources.map((s) => s.id).join(', ')})`
      console.warn(`[subscription] id=${subscription.id}: ${reason}`)
      await subscriptionQueries.completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
        error: reason,
      })
      await subscriptionQueries.updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastResultCount: 0,
        lastError: reason,
      })
      return { artistsFound: 0, artistsNew: 0 }
    }

    const discovered: DiscoveredArtist[] = []
    for (const source of filteredSources) {
      try {
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        const entries = await source.getGenreArtists!(genre, {
          limit: subscription.maxArtistsPerRun,
        })
        for (const entry of entries) {
          discovered.push({
            name: entry.name,
            mbid: entry.mbid,
            similarityScore:
              entry.listeners > 0
                ? Math.min(entry.listeners / LISTENER_SCALE, 1.0)
                : DEFAULT_SIMILARITY,
            source: `genre-subscription:${source.id}`,
          })
        }
      } catch (err: unknown) {
        console.error(
          `[subscription-runner] Source '${source.id}' failed for genre '${genre}':`,
          err,
        )
      }
    }

    const artistsFound = discovered.length

    if (artistsFound === 0) {
      await subscriptionQueries.completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
      })
      await subscriptionQueries.updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastResultCount: 0,
        lastError: null,
      })
      return { artistsFound: 0, artistsNew: 0 }
    }

    // Resolve -> score -> filter -> store
    const resolved = await resolve(
      discovered,
      mbClient as Parameters<typeof resolve>[1],
      undefined,
      lidarrClient as Parameters<typeof resolve>[3],
    )

    const weights = resolveWeights(
      subscription.scoringWeightPreset ?? 'genre',
      subscription.scoringWeightOverrides,
    )

    const scored = score(resolved, libraryGenres, weights, feedbackHistory)

    const threshold = subscription.scoreThreshold ?? defaultScoreThreshold

    const filtered = filter(scored, libraryMbids, rejectedMbids, cooldownDays, threshold)

    let batchId: number | undefined
    if (filtered.length > 0) {
      batchId = await store(filtered, storeDb, { userId: subscription.userId ?? undefined })
    }

    const artistsNew = filtered.length

    await subscriptionQueries.completeRun(run.id, {
      completedAt: new Date(),
      artistsFound,
      artistsNew,
      batchId: batchId ?? null,
    })

    await subscriptionQueries.updateSubscription(subscription.id, {
      lastRunAt: new Date(),
      lastResultCount: artistsNew,
      lastError: null,
    })

    return { artistsFound, artistsNew }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[subscription-runner] Subscription ${subscription.id} failed:`, err)

    await subscriptionQueries
      .completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
        error: errorMessage,
      })
      .catch((e: unknown) =>
        console.error('[subscription-runner] Failed to complete run record:', e),
      )

    await subscriptionQueries
      .updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastError: errorMessage,
      })
      .catch((e: unknown) =>
        console.error('[subscription-runner] Failed to update subscription error:', e),
      )

    throw err
  }
}

export async function runSimilarSubscription(
  deps: SimilarSubscriptionDeps,
): Promise<{ artistsFound: number; artistsNew: number }> {
  const {
    subscription,
    sources,
    mbClient,
    lidarrClient,
    storeDb,
    subscriptionQueries,
    libraryMbids,
    libraryGenres,
    rejectedMbids,
    feedbackHistory,
    cooldownDays,
    defaultScoreThreshold,
  } = deps

  const seedArtists = Array.isArray(subscription.sourceConfig.seedArtists)
    ? (subscription.sourceConfig.seedArtists as Array<{ name: string; mbid?: string }>)
    : []

  const run = await subscriptionQueries.insertRun({ subscriptionId: subscription.id })

  try {
    const capableSources = sources.filter((s) => s.capabilities.includes('similarArtists'))

    // Filter by selected providers if specified
    const providers = Array.isArray(subscription.sourceConfig.providers)
      ? (subscription.sourceConfig.providers as string[])
      : null
    const filteredSources = providers
      ? capableSources.filter((s) => providers.includes(s.id))
      : capableSources

    if (filteredSources.length === 0 || seedArtists.length === 0) {
      await subscriptionQueries.completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
      })
      await subscriptionQueries.updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastResultCount: 0,
        lastError: null,
      })
      return { artistsFound: 0, artistsNew: 0 }
    }

    // Collect similar artists from all sources for all seed artists
    const discovered: DiscoveredArtist[] = []
    const seen = new Set<string>() // dedup by lowercase name

    for (const seed of seedArtists) {
      for (const source of filteredSources) {
        try {
          const entries = await source.getSimilarArtists(seed.name, seed.mbid)
          for (const entry of entries.slice(0, subscription.maxArtistsPerRun)) {
            const key = entry.name.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            discovered.push({
              name: entry.name,
              mbid: entry.mbid,
              similarityScore: entry.similarityScore,
              source: `similar-subscription:${source.id}`,
            })
          }
        } catch (err: unknown) {
          console.error(
            `[subscription-runner] Source '${source.id}' failed for similar '${seed.name}':`,
            err,
          )
        }
      }
    }

    const artistsFound = discovered.length

    if (artistsFound === 0) {
      await subscriptionQueries.completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
      })
      await subscriptionQueries.updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastResultCount: 0,
        lastError: null,
      })
      return { artistsFound: 0, artistsNew: 0 }
    }

    // Resolve -> score -> filter -> store (same as genre subscriptions)
    const resolved = await resolve(
      discovered,
      mbClient as Parameters<typeof resolve>[1],
      undefined,
      lidarrClient as Parameters<typeof resolve>[3],
    )

    const weights = resolveWeights(
      subscription.scoringWeightPreset ?? 'default',
      subscription.scoringWeightOverrides,
    )

    const scored = score(resolved, libraryGenres, weights, feedbackHistory)
    const threshold = subscription.scoreThreshold ?? defaultScoreThreshold
    const filtered = filter(scored, libraryMbids, rejectedMbids, cooldownDays, threshold)

    let batchId: number | undefined
    if (filtered.length > 0) {
      batchId = await store(filtered, storeDb, { userId: subscription.userId ?? undefined })
    }

    const artistsNew = filtered.length

    await subscriptionQueries.completeRun(run.id, {
      completedAt: new Date(),
      artistsFound,
      artistsNew,
      batchId: batchId ?? null,
    })

    await subscriptionQueries.updateSubscription(subscription.id, {
      lastRunAt: new Date(),
      lastResultCount: artistsNew,
      lastError: null,
    })

    return { artistsFound, artistsNew }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[subscription-runner] Similar subscription ${subscription.id} failed:`, err)

    await subscriptionQueries
      .completeRun(run.id, {
        completedAt: new Date(),
        artistsFound: 0,
        artistsNew: 0,
        error: errorMessage,
      })
      .catch((e: unknown) =>
        console.error('[subscription-runner] Failed to complete run record:', e),
      )

    await subscriptionQueries
      .updateSubscription(subscription.id, {
        lastRunAt: new Date(),
        lastError: errorMessage,
      })
      .catch((e: unknown) =>
        console.error('[subscription-runner] Failed to update subscription error:', e),
      )

    throw err
  }
}
