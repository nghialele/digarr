import type { DiscoveredArtist } from '@/core/types'
import type { StoreDb } from '@/core/pipeline/store'

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

/** What an adapter returns from fetch(). */
export type AdapterResult = {
  artists: DiscoveredArtist[]
}

/** Describes one field of an adapter's sourceConfig for the UI form. */
export type AdapterConfigField = {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'select'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  helpText?: string
}

/** Pluggable adapter that knows how to fetch artists for a subscription. */
export interface SubscriptionAdapter {
  /** Unique identifier matching subscriptions.sourceType values (e.g. 'lastfm', 'genre'). */
  type: string
  /** Human-readable name shown in the subscription form. */
  label: string
  /** Describes which config fields the adapter needs. */
  configFields: AdapterConfigField[]
  /** Fetch artists based on the subscription config. */
  fetch(config: Record<string, unknown>, options?: { limit?: number }): Promise<AdapterResult>
}

// ---------------------------------------------------------------------------
// Runner types
// ---------------------------------------------------------------------------

/** Subscription row data the runner needs -- a subset of the full DB row. */
export type SubscriptionConfig = {
  id: number
  userId: number | null
  sourceType: string
  sourceConfig: Record<string, unknown>
  maxArtistsPerRun: number | null
  scoreThreshold: number | null
  scoringWeightPreset: string | null
  scoringWeightOverrides: Record<string, number> | null
}

/** Run record shape returned from insertRun (mirrors subscriptionRuns.$inferSelect). */
export type SubscriptionRunRow = {
  id: number
  subscriptionId: number
  startedAt: Date
  completedAt: Date | null
  artistsFound: number | null
  artistsNew: number | null
  error: string | null
  batchId: number | null
}

/** Data needed to create a run record. */
export type RunInsert = {
  subscriptionId: number
  batchId?: number | null
}

/** Data needed to complete a run record. */
export type RunComplete = {
  completedAt: Date
  artistsFound?: number
  artistsNew?: number
  error?: string | null
  batchId?: number | null
}

/** Data for updating subscription metadata after a run. */
export type SubscriptionUpdate = {
  lastRunAt?: Date | null
  lastResultCount?: number | null
  lastError?: string | null
}

/** Minimal MusicBrainz client interface used by the runner. */
export interface MusicBrainzClient {
  searchArtist(name: string): Promise<Array<{ id: string; name: string; disambiguation?: string; tags?: Array<{ name: string }> }>>
  getArtist(mbid: string): Promise<{ id: string; name: string; disambiguation?: string; tags?: Array<{ name: string }> } | null>
}

/** Minimal Lidarr lookup interface used by the runner. */
export interface LidarrLookupClient {
  lookupArtist(term: string): Promise<Array<{ foreignArtistId: string; artistName: string; images?: Array<{ url: string; coverType: string }> }>>
}

/** All dependencies the generic subscription runner needs. */
export type SubscriptionRunDeps = {
  db: StoreDb
  queries: SubscriptionQueries
  mbClient: MusicBrainzClient
  lidarr?: LidarrLookupClient
  userId?: number
}

/** DB query interface for the subscription runner. */
export interface SubscriptionQueries {
  insertRun(data: RunInsert): Promise<SubscriptionRunRow>
  completeRun(id: number, data: RunComplete): Promise<void>
  updateSubscription(id: number, data: SubscriptionUpdate): Promise<void>
}

/** Return type from a completed runSubscription call. */
export type RunResult = {
  runId: number
  batchId: number | null
  artistsFound: number
  artistsNew: number
  error?: string
}
