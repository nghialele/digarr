import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db'
import type { ArtistInsert } from '@/db/queries/artists'
import { upsertArtist } from '@/db/queries/artists'

type ArtistRow = {
  id: number
  mbid: string
  name: string
  disambiguation: string | null
  tags: string[] | null
  genres: string[] | null
  imageUrl: string | null
  streamingUrls: Record<string, string> | null
  cachedAt: Date | null
}

function makeArtistRow(data: ArtistInsert, id = 1): ArtistRow {
  return {
    id,
    mbid: data.mbid,
    name: data.name,
    disambiguation: data.disambiguation ?? null,
    tags: data.tags ?? null,
    genres: data.genres ?? null,
    imageUrl: data.imageUrl ?? null,
    streamingUrls: data.streamingUrls ?? null,
    cachedAt: new Date(),
  }
}

function makeMockDb(returnRow: ArtistRow): Database {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([returnRow]),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([returnRow]),
  }
  return {
    insert: vi.fn().mockReturnValue(chain),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  } as unknown as Database
}

describe('upsertArtist', () => {
  it('returns the inserted/updated artist row', async () => {
    const artist: ArtistInsert = { mbid: 'mbid-x', name: 'Artist X', genres: ['electronic'] }
    const row = makeArtistRow(artist, 42)
    const db = makeMockDb(row)

    const result = await upsertArtist(db, artist)

    expect(result.mbid).toBe('mbid-x')
    expect(result.name).toBe('Artist X')
    expect(result.id).toBe(42)
  })

  it('calls insert with onConflictDoUpdate', async () => {
    const artist: ArtistInsert = { mbid: 'mbid-y', name: 'Artist Y' }
    const row = makeArtistRow(artist)
    const chain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([row]),
    }
    const db = {
      insert: vi.fn().mockReturnValue(chain),
    } as unknown as Database

    await upsertArtist(db, artist)

    expect(chain.onConflictDoUpdate).toHaveBeenCalledOnce()
    expect(chain.returning).toHaveBeenCalledOnce()
  })
})
