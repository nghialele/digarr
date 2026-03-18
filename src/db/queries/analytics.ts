import { sql } from 'drizzle-orm'
import type { Database } from '@/db'

export type OverviewStats = {
  totalRecs: number
  approvalRate: number
  avgScore: number
  totalBatches: number
}

export type BatchWithCounts = {
  id: number
  createdAt: string
  status: string
  stats: unknown
  total: number
  approved: number
  rejected: number
  pending: number
}

export type GenreStat = {
  genre: string
  count: number
  approved: number
  approvalRate: number
}

export type SourceStat = {
  source: string
  count: number
  avgScore: number
  approved: number
  approvalRate: number
}

export async function getOverviewStats(db: Database): Promise<OverviewStats> {
  const rows = await db.execute(sql`
    SELECT
      COUNT(r.id)::int AS total_recs,
      COALESCE(AVG(r.score), 0)::float AS avg_score,
      COUNT(CASE WHEN r.status IN ('approved', 'added_to_lidarr') THEN 1 END)::int AS approved,
      COUNT(CASE WHEN r.status IN ('approved', 'added_to_lidarr', 'rejected') THEN 1 END)::int AS acted
    FROM recommendations r
  `)
  const row = rows.rows[0] as {
    total_recs: number
    avg_score: number
    approved: number
    acted: number
  }

  const batchRows = await db.execute(sql`SELECT COUNT(*)::int AS total FROM recommendation_batches`)
  const totalBatches = (batchRows.rows[0] as { total: number }).total

  return {
    totalRecs: row.total_recs,
    approvalRate: row.acted > 0 ? row.approved / row.acted : 0,
    avgScore: row.avg_score,
    totalBatches,
  }
}

export async function getBatchesWithCounts(db: Database): Promise<BatchWithCounts[]> {
  const rows = await db.execute(sql`
    SELECT
      b.id,
      b.created_at,
      b.status,
      b.stats,
      COUNT(r.id)::int AS total,
      COUNT(CASE WHEN r.status IN ('approved', 'added_to_lidarr') THEN 1 END)::int AS approved,
      COUNT(CASE WHEN r.status = 'rejected' THEN 1 END)::int AS rejected,
      COUNT(CASE WHEN r.status = 'pending' THEN 1 END)::int AS pending
    FROM recommendation_batches b
    LEFT JOIN recommendations r ON r.batch_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `)

  return rows.rows.map((r) => {
    const row = r as {
      id: number
      created_at: string
      status: string
      stats: unknown
      total: number
      approved: number
      rejected: number
      pending: number
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      stats: row.stats,
      total: row.total,
      approved: row.approved,
      rejected: row.rejected,
      pending: row.pending,
    }
  })
}

export async function getTopGenres(db: Database): Promise<GenreStat[]> {
  const rows = await db.execute(sql`
    SELECT
      unnest(a.genres) AS genre,
      COUNT(*)::int AS count,
      COUNT(CASE WHEN r.status IN ('approved', 'added_to_lidarr') THEN 1 END)::int AS approved
    FROM recommendations r
    JOIN artists a ON a.id = r.artist_id
    WHERE a.genres IS NOT NULL
    GROUP BY genre
    ORDER BY count DESC
    LIMIT 20
  `)

  return rows.rows.map((r) => {
    const row = r as { genre: string; count: number; approved: number }
    return {
      genre: row.genre,
      count: row.count,
      approved: row.approved,
      approvalRate: row.count > 0 ? row.approved / row.count : 0,
    }
  })
}

export async function getSourceEffectiveness(db: Database): Promise<SourceStat[]> {
  // The sources column is JSONB like { "consensus": 0.8, "similarity": 0.6 }
  // We unnest the keys and aggregate
  const rows = await db.execute(sql`
    SELECT
      src.key AS source,
      COUNT(*)::int AS count,
      AVG(r.score)::float AS avg_score,
      COUNT(CASE WHEN r.status IN ('approved', 'added_to_lidarr') THEN 1 END)::int AS approved
    FROM recommendations r,
    LATERAL jsonb_each_text(r.sources::jsonb) AS src
    WHERE r.sources IS NOT NULL
    GROUP BY src.key
    ORDER BY count DESC
  `)

  return rows.rows.map((r) => {
    const row = r as { source: string; count: number; avg_score: number; approved: number }
    return {
      source: row.source,
      count: row.count,
      avgScore: row.avg_score,
      approved: row.approved,
      approvalRate: row.count > 0 ? row.approved / row.count : 0,
    }
  })
}
