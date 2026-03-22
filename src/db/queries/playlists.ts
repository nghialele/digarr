import { and, eq, isNull, lt, or } from 'drizzle-orm'
import type { Database } from '@/db'
import type { PlaylistConfig, PlaylistStrategy } from '@/db/schema'
import { playlists, playlistTracks } from '@/db/schema'

export type PlaylistInsert = {
  userId?: number | null
  name: string
  strategy: PlaylistStrategy
  targetIds?: number[]
  schedule?: string | null
  config?: PlaylistConfig | null
  enabled?: boolean
}

export type PlaylistUpdate = Partial<
  Pick<PlaylistInsert, 'name' | 'strategy' | 'targetIds' | 'schedule' | 'config' | 'enabled'> & {
    lastGeneratedAt: Date | null
    trackCount: number
  }
>

export type PlaylistRow = {
  id: number
  userId: number | null
  name: string
  strategy: string
  targetIds: number[]
  schedule: string | null
  config: PlaylistConfig | null
  lastGeneratedAt: Date | null
  trackCount: number | null
  enabled: boolean
  createdAt: Date
}

export type PlaylistTrackInsert = {
  playlistId: number
  artistName: string
  trackName?: string | null
  mbid?: string | null
  spotifyUri?: string | null
  deezerId?: string | null
  localPath?: string | null
  position: number
}

export type PlaylistTrackRow = {
  id: number
  playlistId: number
  artistName: string
  trackName: string | null
  mbid: string | null
  spotifyUri: string | null
  deezerId: string | null
  localPath: string | null
  position: number
}

export async function createPlaylist(db: Database, data: PlaylistInsert): Promise<{ id: number }> {
  const [row] = await db
    .insert(playlists)
    .values({
      userId: data.userId ?? null,
      name: data.name,
      strategy: data.strategy,
      targetIds: data.targetIds ?? [],
      schedule: data.schedule ?? null,
      config: data.config ?? null,
      enabled: data.enabled ?? true,
    })
    .returning({ id: playlists.id })
  if (!row) throw new Error('createPlaylist: no row returned')
  return { id: row.id }
}

export async function getPlaylistsByUser(db: Database, userId: number): Promise<PlaylistRow[]> {
  const rows = await db.select().from(playlists).where(eq(playlists.userId, userId))
  return rows as PlaylistRow[]
}

export async function getPlaylistWithTracks(
  db: Database,
  playlistId: number,
): Promise<{ playlist: PlaylistRow; tracks: PlaylistTrackRow[] } | null> {
  const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId))
  if (!playlist) return null

  const tracks = await db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))

  return {
    playlist: playlist as PlaylistRow,
    tracks: tracks as PlaylistTrackRow[],
  }
}

export async function updatePlaylist(
  db: Database,
  id: number,
  data: PlaylistUpdate,
): Promise<void> {
  await db.update(playlists).set(data).where(eq(playlists.id, id))
}

export async function deletePlaylist(db: Database, id: number): Promise<void> {
  await db.delete(playlists).where(eq(playlists.id, id))
}

export async function replacePlaylistTracks(
  db: Database,
  playlistId: number,
  tracks: PlaylistTrackInsert[],
): Promise<void> {
  await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId))
  if (tracks.length > 0) {
    await db.insert(playlistTracks).values(
      tracks.map((t) => ({
        playlistId: t.playlistId,
        artistName: t.artistName,
        trackName: t.trackName ?? null,
        mbid: t.mbid ?? null,
        spotifyUri: t.spotifyUri ?? null,
        deezerId: t.deezerId ?? null,
        localPath: t.localPath ?? null,
        position: t.position,
      })),
    )
  }
}

// Returns enabled playlists that have never been generated or whose last
// generation was more than 7 days ago. The scheduler does finer cron
// evaluation on top of this.
export async function getPlaylistsDueForGeneration(db: Database): Promise<PlaylistRow[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const rows = await db
    .select()
    .from(playlists)
    .where(
      and(
        eq(playlists.enabled, true),
        or(isNull(playlists.lastGeneratedAt), lt(playlists.lastGeneratedAt, sevenDaysAgo)),
      ),
    )
  return rows as PlaylistRow[]
}
