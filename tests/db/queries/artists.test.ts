import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db'
import type { ArtistInsert } from '@/db/queries/artists'
import { bulkUpsertArtists, upsertArtist } from '@/db/queries/artists'

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

const sampleArtists: ArtistInsert[] = [
  { mbid: 'mbid-a', name: 'Artist A', genres: ['rock'] },
  { mbid: 'mbid-b', name: 'Artist B', genres: ['jazz'] },
  { mbid: 'mbid-c', name: 'Artist C', genres: ['pop'] },
]

describe('bulkUpsertArtists', () => {
  it('calls upsert for each artist in the array', async () => {
    let callCount = 0
    const mockRows = sampleArtists.map((a, i) => makeArtistRow(a, i + 1))

    // Each call to insert() should return a fresh chain that returns the next row
    const db = {
      insert: vi.fn().mockImplementation(() => {
        const row = mockRows[callCount++]
        return {
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([row]),
        }
      }),
    } as unknown as Database

    const results = await bulkUpsertArtists(db, sampleArtists)

    expect(db.insert).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(3)
    expect(results[0]?.mbid).toBe('mbid-a')
    expect(results[1]?.mbid).toBe('mbid-b')
    expect(results[2]?.mbid).toBe('mbid-c')
  })

  it('returns empty array for empty input', async () => {
    const db = {
      insert: vi.fn(),
    } as unknown as Database

    const results = await bulkUpsertArtists(db, [])

    expect(db.insert).not.toHaveBeenCalled()
    expect(results).toEqual([])
  })

  it('preserves order of results matching input order', async () => {
    let callCount = 0
    const mockRows = sampleArtists.map((a, i) => makeArtistRow(a, i + 10))

    const db = {
      insert: vi.fn().mockImplementation(() => {
        const row = mockRows[callCount++]
        return {
          values: vi.fn().mockReturnThis(),
          onConflictDoUpdate: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([row]),
        }
      }),
    } as unknown as Database

    const results = await bulkUpsertArtists(db, sampleArtists)

    for (let i = 0; i < sampleArtists.length; i++) {
      expect(results[i]?.mbid).toBe(sampleArtists[i]?.mbid)
    }
  })
})

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
