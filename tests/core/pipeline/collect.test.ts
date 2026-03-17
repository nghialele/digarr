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
  },
  {
    id: 2,
    artistName: 'Portishead',
    foreignArtistId: '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0a11',
    qualityProfileId: 1,
    rootFolderPath: '/music',
    monitored: true,
    status: 'continuing',
  },
]

describe('collect()', () => {
  it('maps Lidarr artists to { mbid, name }', async () => {
    const client = { getArtists: vi.fn().mockResolvedValue(mockArtists) }
    const result = await collect(client)

    expect(result).toEqual([
      { mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711', name: 'Radiohead' },
      { mbid: '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0a11', name: 'Portishead' },
    ])
  })

  it('returns empty array for empty library', async () => {
    const client = { getArtists: vi.fn().mockResolvedValue([]) }
    const result = await collect(client)
    expect(result).toEqual([])
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
