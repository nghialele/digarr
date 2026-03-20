import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { artists, genres } from '@/db/schema'

type ArtistRow = typeof artists.$inferSelect

export type ArtistInsert = {
  mbid: string
  name: string
  disambiguation?: string | null
  tags?: string[] | null
  genres?: string[] | null
  imageUrl?: string | null
  streamingUrls?: Record<string, string> | null
}

export async function upsertArtist(db: Database, artist: ArtistInsert): Promise<ArtistRow> {
  const rows = await db
    .insert(artists)
    .values({ ...artist, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: artists.mbid,
      set: {
        name: artist.name,
        disambiguation: sql`COALESCE(excluded.disambiguation, ${artists.disambiguation})`,
        tags: sql`COALESCE(excluded.tags, ${artists.tags})`,
        genres: sql`COALESCE(excluded.genres, ${artists.genres})`,
        imageUrl: sql`COALESCE(excluded.image_url, ${artists.imageUrl})`,
        streamingUrls: sql`COALESCE(excluded.streaming_urls, ${artists.streamingUrls})`,
        cachedAt: new Date(),
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`upsertArtist: no row returned for mbid=${artist.mbid}`)
  return row
}

export async function getArtistById(db: Database, id: number): Promise<ArtistRow | null> {
  const rows = await db.select().from(artists).where(eq(artists.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * Returns a map of genre name -> example artist names (up to `limit` per genre).
 * Single query using lateral join -- avoids N+1.
 */
export async function getExampleArtistsByGenre(
  db: Database,
  limit = 3,
): Promise<Map<string, string[]>> {
  const rows = await db.execute<{ genre_name: string; artist_name: string }>(
    sql`SELECT g.name AS genre_name, a.name AS artist_name
        FROM ${genres} g
        CROSS JOIN LATERAL (
          SELECT ${artists.name}
          FROM ${artists}
          WHERE EXISTS (
            SELECT 1 FROM unnest(${artists.genres}) ag WHERE lower(ag) = lower(g.name)
          )
          ORDER BY ${artists.name}
          LIMIT ${limit}
        ) a
        WHERE g.source = 'library'`,
  )

  const result = new Map<string, string[]>()
  for (const row of rows.rows) {
    const r = row as { genre_name: string; artist_name: string }
    const existing = result.get(r.genre_name) ?? []
    existing.push(r.artist_name)
    result.set(r.genre_name, existing)
  }
  return result
}

export async function getArtistsByGenre(
  db: Database,
  genreName: string,
  limit = 100,
): Promise<ArtistRow[]> {
  // Case-insensitive match: check whether any element in the genres array matches
  return db
    .select()
    .from(artists)
    .where(
      sql`EXISTS (SELECT 1 FROM unnest(${artists.genres}) g WHERE lower(g) = lower(${genreName}))`,
    )
    .limit(limit)
    .orderBy(artists.name)
}
