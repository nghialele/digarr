import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  lidarrUrl: text('lidarr_url'),
  lidarrApiKey: text('lidarr_api_key'),
  listenbrainzUsername: text('listenbrainz_username'),
  listenbrainzToken: text('listenbrainz_token'),
  lastfmUsername: text('lastfm_username'),
  lastfmApiKey: text('lastfm_api_key'),
  aiProvider: text('ai_provider'),
  aiApiKey: text('ai_api_key'),
  aiModel: text('ai_model'),
  aiBaseUrl: text('ai_base_url'),
  skipTlsVerify: boolean('skip_tls_verify').default(false).notNull(),
  preferences: jsonb('preferences').$type<Preferences>(),
  setupComplete: boolean('setup_complete').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const artists = pgTable('artists', {
  id: serial('id').primaryKey(),
  mbid: uuid('mbid').unique().notNull(),
  name: text('name').notNull(),
  disambiguation: text('disambiguation'),
  tags: text('tags').array(),
  genres: text('genres').array(),
  imageUrl: text('image_url'),
  streamingUrls: jsonb('streaming_urls').$type<Record<string, string>>(),
  cachedAt: timestamp('cached_at', { withTimezone: true }),
})

export const recommendationBatches = pgTable('recommendation_batches', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sourceConfig: jsonb('source_config'),
  stats: jsonb('stats'),
  status: text('status').notNull().default('running'),
})

export const recommendations = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  artistId: integer('artist_id')
    .references(() => artists.id)
    .notNull(),
  batchId: integer('batch_id')
    .references(() => recommendationBatches.id)
    .notNull(),
  score: real('score').notNull(),
  sources: jsonb('sources').$type<Record<string, number>>(),
  aiReasoning: text('ai_reasoning'),
  status: text('status').notNull().default('pending'),
  lidarrArtistId: integer('lidarr_artist_id'),
  lidarrError: text('lidarr_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  actedOnAt: timestamp('acted_on_at', { withTimezone: true }),
})

// Types
export type Preferences = {
  qualityProfileId: number
  metadataProfileId: number
  rootFolderId: number
  scheduleCron: string
  scoreThreshold: number
  scoringWeights: {
    consensus: number
    similarity: number
    genreOverlap: number
    aiConfidence: number
    feedbackBoost: number
  }
  rejectionCooldownDays: number
  topArtistsLimit: number
  librarySeedRatio: number // 0-1: fraction of seed artists from Lidarr library
  webhookUrl?: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  qualityProfileId: 1,
  metadataProfileId: 1,
  rootFolderId: 1,
  scheduleCron: '0 0 * * 0',
  scoreThreshold: 0.5,
  scoringWeights: {
    consensus: 0.3,
    similarity: 0.25,
    genreOverlap: 0.2,
    aiConfidence: 0.15,
    feedbackBoost: 0.1,
  },
  rejectionCooldownDays: 90,
  topArtistsLimit: 30,
  librarySeedRatio: 0.3,
}
