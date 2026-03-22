import { filter } from '@/core/pipeline/filter'
import { resolve } from '@/core/pipeline/resolve'
import { score } from '@/core/pipeline/score'
import type { StoreDb } from '@/core/pipeline/store'
import { store } from '@/core/pipeline/store'
import { resolveWeights } from '@/core/pipeline/weight-presets'
import type { DiscoverySource } from '@/core/plugins/types'
import type { DiscoveredArtist } from '@/core/types'
import { errMsg } from '@/core/validation'
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

type RunResult = { artistsFound: number; artistsNew: number }

// --- Shared pipeline + lifecycle helpers ---

async function executePipeline(
  deps: GenreSubscriptionDeps,
  discovered: DiscoveredArtist[],
  run: SubscriptionRunRow,
  weightPreset: string,
): Promise<RunResult> {
  const { subscription, mbClient, lidarrClient, storeDb, subscriptionQueries } = deps
  const artistsFound = discovered.length

  if (artistsFound === 0) {
    await completeEmpty(subscriptionQueries, subscription.id, run.id)
    return { artistsFound: 0, artistsNew: 0 }
  }

  const resolved = await resolve(
    discovered,
    mbClient as Parameters<typeof resolve>[1],
    undefined,
    lidarrClient as Parameters<typeof resolve>[3],
  )

  const weights = resolveWeights(weightPreset, subscription.scoringWeightOverrides)
  const scored = score(resolved, deps.libraryGenres, weights, deps.feedbackHistory)
  const threshold = subscription.scoreThreshold ?? deps.defaultScoreThreshold
  const filtered = filter(
    scored,
    deps.libraryMbids,
    deps.rejectedMbids,
    deps.cooldownDays,
    threshold,
  )

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
}

async function completeEmpty(
  queries: SubscriptionQueries,
  subscriptionId: number,
  runId: number,
  error?: string,
): Promise<void> {
  await queries.completeRun(runId, {
    completedAt: new Date(),
    artistsFound: 0,
    artistsNew: 0,
    error,
  })
  await queries.updateSubscription(subscriptionId, {
    lastRunAt: new Date(),
    lastResultCount: 0,
    lastError: error ?? null,
  })
}

async function handleRunError(
  err: unknown,
  queries: SubscriptionQueries,
  subscriptionId: number,
  runId: number,
): Promise<never> {
  const errorMessage = errMsg(err)
  console.error(`[subscription-runner] Subscription ${subscriptionId} failed:`, err)

  await queries
    .completeRun(runId, {
      completedAt: new Date(),
      artistsFound: 0,
      artistsNew: 0,
      error: errorMessage,
    })
    .catch((e: unknown) => console.error('[subscription-runner] Failed to complete run record:', e))

  await queries
    .updateSubscription(subscriptionId, {
      lastRunAt: new Date(),
      lastError: errorMessage,
    })
    .catch((e: unknown) =>
      console.error('[subscription-runner] Failed to update subscription error:', e),
    )

  throw err
}

function filterProviders(
  sources: DiscoverySource[],
  providers: string[] | null,
): DiscoverySource[] {
  return providers ? sources.filter((s) => providers.includes(s.id)) : sources
}

function parseProviders(sourceConfig: Record<string, unknown>): string[] | null {
  return Array.isArray(sourceConfig.providers) ? (sourceConfig.providers as string[]) : null
}

// --- Public API ---

export async function runGenreSubscription(deps: GenreSubscriptionDeps): Promise<RunResult> {
  const { subscription, sources, subscriptionQueries } = deps
  const genre =
    typeof subscription.sourceConfig.genre === 'string' ? subscription.sourceConfig.genre : ''

  const run = await subscriptionQueries.insertRun({ subscriptionId: subscription.id })

  try {
    const capableSources = sources.filter(
      (s) => s.capabilities.includes('genreArtists') && typeof s.getGenreArtists === 'function',
    )
    const filteredSources = filterProviders(
      capableSources,
      parseProviders(subscription.sourceConfig),
    )

    if (filteredSources.length === 0) {
      const providers = parseProviders(subscription.sourceConfig)
      const reason =
        capableSources.length === 0
          ? `No sources with genreArtists capability (available sources: ${sources.map((s) => s.id).join(', ') || 'none'})`
          : `Provider filter [${providers?.join(', ')}] matched no capable sources (capable: ${capableSources.map((s) => s.id).join(', ')})`
      console.warn(`[subscription] id=${subscription.id}: ${reason}`)
      await completeEmpty(subscriptionQueries, subscription.id, run.id, reason)
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

    return executePipeline(deps, discovered, run, subscription.scoringWeightPreset ?? 'genre')
  } catch (err: unknown) {
    return handleRunError(err, subscriptionQueries, subscription.id, run.id)
  }
}

export async function runSimilarSubscription(deps: SimilarSubscriptionDeps): Promise<RunResult> {
  const { subscription, sources, subscriptionQueries } = deps
  const seedArtists = Array.isArray(subscription.sourceConfig.seedArtists)
    ? (subscription.sourceConfig.seedArtists as Array<{ name: string; mbid?: string }>)
    : []

  const run = await subscriptionQueries.insertRun({ subscriptionId: subscription.id })

  try {
    const capableSources = sources.filter((s) => s.capabilities.includes('similarArtists'))
    const filteredSources = filterProviders(
      capableSources,
      parseProviders(subscription.sourceConfig),
    )

    if (filteredSources.length === 0 || seedArtists.length === 0) {
      await completeEmpty(subscriptionQueries, subscription.id, run.id)
      return { artistsFound: 0, artistsNew: 0 }
    }

    const discovered: DiscoveredArtist[] = []
    const seen = new Set<string>()

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

    return executePipeline(deps, discovered, run, subscription.scoringWeightPreset ?? 'default')
  } catch (err: unknown) {
    return handleRunError(err, subscriptionQueries, subscription.id, run.id)
  }
}
