// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { LidarrArtist } from '@/core/clients/lidarr'
import { collect } from '@/core/pipeline/collect'

const mockArtists: LidarrArtist[] = [
  {
    id: 1,
    artistName: 'Radiohead',
    foreignArtistId: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
    qualityProfileId: 1,
    rootFolderPath: '/music',
    monitored: true,
    status: 'ended',
    genres: ['alternative rock', 'art rock', 'electronic'],
  },
  {
    id: 2,
    artistName: 'Portishead',
    foreignArtistId: '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0a11',
    qualityProfileId: 1,
    rootFolderPath: '/music',
    monitored: true,
    status: 'continuing',
    genres: ['trip hop', 'electronic'],
  },
]

describe('collect()', () => {
  it('maps Lidarr artists to { mbid, name, genres }', async () => {
    const client = { getArtists: vi.fn().mockResolvedValue(mockArtists) }
    const result = await collect(client)

    expect(result).toEqual([
      {
        mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
        name: 'Radiohead',
        genres: ['alternative rock', 'art rock', 'electronic'],
      },
      {
        mbid: '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0a11',
        name: 'Portishead',
        genres: ['trip hop', 'electronic'],
      },
    ])
  })

  it('returns empty array for empty library', async () => {
    const client = { getArtists: vi.fn().mockResolvedValue([]) }
    const result = await collect(client)
    expect(result).toEqual([])
  })

  it('defaults genres to empty array when missing from Lidarr response', async () => {
    const artistNoGenres: LidarrArtist[] = [
      {
        id: 3,
        artistName: 'Unknown',
        foreignArtistId: 'mbid-unknown',
        qualityProfileId: 1,
        rootFolderPath: '/music',
        monitored: true,
        status: 'continuing',
      },
    ]
    const client = { getArtists: vi.fn().mockResolvedValue(artistNoGenres) }
    const result = await collect(client)
    expect(result[0]?.genres).toEqual([])
  })

  it('propagates Lidarr errors', async () => {
    const client = {
      getArtists: vi.fn().mockRejectedValue(new Error('Lidarr connection refused')),
    }
    await expect(collect(client)).rejects.toThrow('Lidarr connection refused')
  })

  it('uses foreignArtistId as mbid', async () => {
    const client = { getArtists: vi.fn().mockResolvedValue([mockArtists[0]]) }
    const result = await collect(client)
    expect(result[0]?.mbid).toBe('a74b1b7f-71a5-4011-9441-d0b5e4122711')
  })
})
