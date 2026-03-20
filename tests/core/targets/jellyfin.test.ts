// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/core/clients/jellyfin', () => ({
  createJellyfinClient: vi.fn(),
}))

const { createJellyfinClient } = await import('@/core/clients/jellyfin')
const { createJellyfinTarget } = await import('@/core/targets/jellyfin')

function mockClient() {
  const client = {
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    searchArtist: vi.fn().mockResolvedValue([
      { Id: 'jf-ar-1', Name: 'Radiohead' },
    ]),
    searchTracks: vi.fn().mockResolvedValue([
      { Id: 'jf-tr-1', Name: 'Creep', ArtistItems: [{ Id: 'jf-ar-1', Name: 'Radiohead' }] },
      { Id: 'jf-tr-2', Name: 'Karma Police', ArtistItems: [{ Id: 'jf-ar-1', Name: 'Radiohead' }] },
    ]),
    createPlaylist: vi.fn().mockResolvedValue({ Id: 'jf-pl-1' }),
    addToPlaylist: vi.fn().mockResolvedValue(undefined),
    favoriteArtist: vi.fn().mockResolvedValue(undefined),
    // Existing 5b methods (not used by target but part of client interface)
    getTopArtists: vi.fn(),
    getRecentlyPlayed: vi.fn(),
    getFavoriteArtists: vi.fn(),
  }
  vi.mocked(createJellyfinClient).mockReturnValue(client as never)
  return client
}

describe('createJellyfinTarget()', () => {
  it('has correct type and capabilities', () => {
    mockClient()
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })
    expect(target.type).toBe('jellyfin')
    expect(target.capabilities).toContain('createPlaylist')
    expect(target.capabilities).toContain('addToFavorites')
    expect(target.capabilities).not.toContain('addArtist')
  })

  it('createPlaylist searches tracks and creates Jellyfin playlist', async () => {
    const client = mockClient()
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })

    const result = await target.createPlaylist!(
      'Digarr: March 2026 Discoveries',
      [{ artistName: 'Radiohead', artistMbid: 'mbid-rh' }],
    )

    expect(result.success).toBe(true)
    expect(result.playlistId).toBe('jf-pl-1')
    expect(client.searchTracks).toHaveBeenCalledWith('Radiohead', expect.any(Number))
    expect(client.createPlaylist).toHaveBeenCalledWith(
      'Digarr: March 2026 Discoveries',
      ['jf-tr-1', 'jf-tr-2'],
    )
  })

  it('addToFavorites stars matching artists', async () => {
    const client = mockClient()
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })

    const result = await target.addToFavorites!([
      { mbid: 'mbid-rh', name: 'Radiohead' },
    ])

    expect(result.success).toBe(true)
    expect(client.searchArtist).toHaveBeenCalledWith('Radiohead')
    expect(client.favoriteArtist).toHaveBeenCalledWith('jf-ar-1')
  })

  it('addToFavorites handles artist not in library gracefully', async () => {
    const client = mockClient()
    client.searchArtist.mockResolvedValue([])
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })

    const result = await target.addToFavorites!([
      { mbid: 'mbid-unknown', name: 'Unknown' },
    ])

    expect(result.success).toBe(true)
    expect(client.favoriteArtist).not.toHaveBeenCalled()
  })

  it('testConnection delegates to client', async () => {
    mockClient()
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })
    const result = await target.testConnection()
    expect(result.success).toBe(true)
  })

  it('createPlaylist returns failure on error', async () => {
    const client = mockClient()
    client.searchTracks.mockRejectedValue(new Error('Timeout'))
    const target = createJellyfinTarget(2, {
      url: 'http://jellyfin:8096',
      apiKey: 'abc',
      userId: 'test-user',
    })

    const result = await target.createPlaylist!(
      'Test',
      [{ artistName: 'Radiohead', artistMbid: 'mbid-rh' }],
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Timeout')
  })
})
