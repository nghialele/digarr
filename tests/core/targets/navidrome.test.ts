// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/core/clients/navidrome', () => ({
  createNavidromeClient: vi.fn(),
}))

const { createNavidromeClient } = await import('@/core/clients/navidrome')
const { createNavidromeTarget } = await import('@/core/targets/navidrome')

function mockClient() {
  const client = {
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    searchArtist: vi.fn().mockResolvedValue([
      { id: 'ar-1', name: 'Radiohead', albumCount: 9 },
    ]),
    searchTracks: vi.fn().mockResolvedValue([
      { id: 'tr-1', title: 'Creep', artist: 'Radiohead' },
      { id: 'tr-2', title: 'Karma Police', artist: 'Radiohead' },
    ]),
    getPlaylists: vi.fn().mockResolvedValue([
      { id: 'pl-1', name: 'Digarr Discoveries', songCount: 5 },
    ]),
    createPlaylist: vi.fn().mockResolvedValue({ id: 'pl-new', name: 'Test', songCount: 0 }),
    addSongsToPlaylist: vi.fn().mockResolvedValue(undefined),
    starArtist: vi.fn().mockResolvedValue(undefined),
  }
  vi.mocked(createNavidromeClient).mockReturnValue(client as never)
  return client
}

describe('createNavidromeTarget()', () => {
  it('has correct type and capabilities', () => {
    mockClient()
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })
    expect(target.type).toBe('navidrome')
    expect(target.capabilities).toContain('createPlaylist')
    expect(target.capabilities).toContain('addToFavorites')
    expect(target.capabilities).not.toContain('addArtist')
  })

  it('createPlaylist searches for artist tracks and creates playlist', async () => {
    const client = mockClient()
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })

    const result = await target.createPlaylist!(
      'Digarr: Test',
      [{ artistName: 'Radiohead', artistMbid: 'mbid-rh' }],
    )

    expect(result.success).toBe(true)
    expect(result.playlistName).toBe('Digarr: Test')
    expect(client.searchTracks).toHaveBeenCalledWith('Radiohead', expect.any(Number))
  })

  it('createPlaylist with replace reuses existing playlist', async () => {
    const client = mockClient()
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })

    client.getPlaylists.mockResolvedValue([
      { id: 'pl-existing', name: 'Digarr Discoveries', songCount: 3 },
    ])

    const result = await target.createPlaylist!(
      'Digarr Discoveries',
      [{ artistName: 'Radiohead', artistMbid: 'mbid-rh' }],
      { replace: true },
    )

    expect(result.success).toBe(true)
    expect(client.addSongsToPlaylist).toHaveBeenCalledWith(
      'pl-existing',
      expect.any(Array),
    )
  })

  it('addToFavorites stars matching artists', async () => {
    const client = mockClient()
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })

    const result = await target.addToFavorites!([
      { mbid: 'mbid-rh', name: 'Radiohead' },
    ])

    expect(result.success).toBe(true)
    expect(client.searchArtist).toHaveBeenCalledWith('Radiohead')
    expect(client.starArtist).toHaveBeenCalledWith('ar-1')
  })

  it('addToFavorites returns success even when artist not found in library', async () => {
    const client = mockClient()
    client.searchArtist.mockResolvedValue([])
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })

    const result = await target.addToFavorites!([
      { mbid: 'mbid-unknown', name: 'Unknown Artist' },
    ])

    expect(result.success).toBe(true)
    expect(client.starArtist).not.toHaveBeenCalled()
  })

  it('testConnection delegates to client', async () => {
    mockClient()
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })
    const result = await target.testConnection()
    expect(result.success).toBe(true)
  })

  it('createPlaylist returns failure on error', async () => {
    const client = mockClient()
    client.searchTracks.mockRejectedValue(new Error('Connection refused'))
    const target = createNavidromeTarget(1, {
      url: 'http://navidrome:4533',
      username: 'user',
      password: 'pass',
    })

    const result = await target.createPlaylist!(
      'Test',
      [{ artistName: 'Radiohead', artistMbid: 'mbid-rh' }],
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Connection refused')
  })
})
