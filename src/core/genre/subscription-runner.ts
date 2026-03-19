import { filter } from '@/core/pipeline/filter'
import { resolve } from '@/core/pipeline/resolve'
import { score } from '@/core/pipeline/score'
import type { StoreDb } from '@/core/pipeline/store'
import { store } from '@/core/pipeline/store'
import { resolveWeights } from '@/core/pipeline/weight-presets'
import type { DiscoverySource } from '@/core/plugins/types'
import type { DiscoveredArtist } from '@/core/types'
import type { completeRun, insertRun, updateSubscription } from '@/db/queries/subscriptions'

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
  insertRun: (
    ...args: Parameters<typeof insertRun> extends [unknown, ...infer Rest] ? Rest : never
  ) => ReturnType<typeof insertRun>
  completeRun: (
    ...args: Parameters<typeof completeRun> extends [unknown, ...infer Rest] ? Rest : never
  ) => ReturnType<typeof completeRun>
  updateSubscription: (
    ...args: Parameters<typeof updateSubscription> extends [unknown, ...infer Rest] ? Rest : never
  ) => ReturnType<typeof updateSubscription>
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

    if (capableSources.length === 0) {
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

    const discovered: DiscoveredArtist[] = []
    for (const source of capableSources) {
      try {
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        const entries = await source.getGenreArtists!(genre, {
          limit: subscription.maxArtistsPerRun,
        })
        for (const entry of entries) {
          discovered.push({
            name: entry.name,
            mbid: entry.mbid,
            similarityScore: entry.listeners > 0 ? Math.min(entry.listeners / 1_000_000, 1.0) : 0.5,
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
