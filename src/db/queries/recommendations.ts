import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { artists, recommendations } from '@/db/schema'

type RecommendationRow = typeof recommendations.$inferSelect
type ArtistRow = typeof artists.$inferSelect

export type RecommendationWithArtist = RecommendationRow & { artist: ArtistRow }

export type ListRecommendationsFilters = {
  status?: string
  batchId?: number
  userId?: number
  sort?: 'score_desc' | 'score_asc' | 'created_desc'
  limit?: number
  offset?: number
}

export type ListRecommendationsResult = {
  items: RecommendationWithArtist[]
  total: number
}

export async function listRecommendations(
  db: Database,
  filters: ListRecommendationsFilters = {},
): Promise<ListRecommendationsResult> {
  const { status, batchId, userId, sort = 'score_desc', limit = 20, offset = 0 } = filters

  const conditions = []
  if (status !== undefined) {
    if (status.includes(',')) {
      conditions.push(inArray(recommendations.status, status.split(',')))
    } else {
      conditions.push(eq(recommendations.status, status))
    }
  }
  if (batchId !== undefined) conditions.push(eq(recommendations.batchId, batchId))
  if (userId !== undefined) conditions.push(eq(recommendations.userId, userId))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const orderBy =
    sort === 'score_asc'
      ? recommendations.score
      : sort === 'created_desc'
        ? desc(recommendations.createdAt)
        : desc(recommendations.score)

  const [rows, countRows] = await Promise.all([
    db
      .select({
        recommendation: recommendations,
        artist: artists,
      })
      .from(recommendations)
      .innerJoin(artists, eq(recommendations.artistId, artists.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(recommendations).where(where),
  ])

  const items = rows.map((r) => ({ ...r.recommendation, artist: r.artist }))
  const total = countRows[0]?.total ?? 0

  return { items, total }
}

export async function getRecommendation(
  db: Database,
  id: number,
): Promise<RecommendationWithArtist | null> {
  const rows = await db
    .select({ recommendation: recommendations, artist: artists })
    .from(recommendations)
    .innerJoin(artists, eq(recommendations.artistId, artists.id))
    .where(eq(recommendations.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return { ...row.recommendation, artist: row.artist }
}

export type StatusUpdateExtra = {
  lidarrArtistId?: number
  lidarrError?: string
}

export async function updateRecommendationStatus(
  db: Database,
  id: number,
  status: string,
  extra: StatusUpdateExtra = {},
): Promise<void> {
  await db
    .update(recommendations)
    .set({ status, actedOnAt: new Date(), ...extra })
    .where(eq(recommendations.id, id))
}

export async function bulkUpdateStatus(db: Database, ids: number[], status: string): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(recommendations)
    .set({ status, actedOnAt: new Date() })
    .where(inArray(recommendations.id, ids))
}

export async function getGenreFeedbackHistory(
  db: Database,
): Promise<Map<string, { approved: number; total: number }>> {
  // Query all acted-upon recommendations joined with artists
  const rows = await db
    .select({
      genres: artists.genres,
      status: recommendations.status,
    })
    .from(recommendations)
    .innerJoin(artists, eq(recommendations.artistId, artists.id))
    .where(sql`${recommendations.actedOnAt} is not null`)

  const genreMap = new Map<string, { approved: number; total: number }>()

  for (const row of rows) {
    if (!row.genres) continue
    for (const genre of row.genres) {
      const entry = genreMap.get(genre) ?? { approved: 0, total: 0 }
      entry.total += 1
      if (row.status === 'approved') entry.approved += 1
      genreMap.set(genre, entry)
    }
  }

  return genreMap
}

export async function getRejectedArtistMbids(
  db: Database,
  cooldownDays: number,
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({ mbid: artists.mbid })
    .from(recommendations)
    .innerJoin(artists, eq(recommendations.artistId, artists.id))
    .where(and(eq(recommendations.status, 'rejected'), gte(recommendations.actedOnAt, cutoff)))

  return new Set(rows.map((r) => r.mbid))
}

export async function insertRecommendation(
  db: Database,
  data: {
    artistId: number
    batchId: number
    score: number
    sources: Record<string, number>
    aiReasoning?: string
    status: string
    userId?: number
    recommendedReleaseGroupId?: string
    recommendedReleaseGroupTitle?: string
  },
): Promise<void> {
  await db.insert(recommendations).values({
    artistId: data.artistId,
    batchId: data.batchId,
    score: data.score,
    sources: data.sources,
    aiReasoning: data.aiReasoning,
    status: data.status,
    userId: data.userId,
    recommendedReleaseGroupId: data.recommendedReleaseGroupId,
    recommendedReleaseGroupTitle: data.recommendedReleaseGroupTitle,
  })
}
