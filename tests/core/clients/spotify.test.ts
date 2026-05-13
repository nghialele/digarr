// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpotifyClient } from '@/core/clients/spotify'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createSpotifyClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches artist albums and sorts full album metadata by popularity', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input))
      if (url.pathname === '/artists/sp-artist/albums') {
        return jsonResponse({
          items: [
            { id: 'album-low', name: 'Low', release_date: '1994-01-01', album_type: 'album' },
            { id: 'album-high', name: 'High', release_date: '1997-01-01', album_type: 'album' },
            { id: 'album-mid', name: 'Mid', release_date: '2008-01-01', album_type: 'album' },
          ],
          next: null,
        })
      }
      if (url.pathname === '/albums') {
        expect(url.searchParams.get('ids')).toBe('album-low,album-high,album-mid')
        return jsonResponse({
          albums: [
            { id: 'album-low', name: 'Low', release_date: '1994-01-01', popularity: 40 },
            { id: 'album-high', name: 'High', release_date: '1997-01-01', popularity: 90 },
            { id: 'album-mid', name: 'Mid', release_date: '2008-01-01', popularity: 70 },
          ],
        })
      }
      throw new Error(`unexpected url: ${url}`)
    })

    const client = createSpotifyClient('token', { baseUrl: 'https://spotify.test' })
    const albums = await client.getPopularAlbumsForArtist('sp-artist', 3)

    expect(albums.map((album) => album.id)).toEqual(['album-high', 'album-mid', 'album-low'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://spotify.test/artists/sp-artist/albums?include_groups=album&limit=10&offset=0',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    )
  })

  it('finds the single exact Spotify artist match by name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        artists: {
          items: [
            { id: 'wrong', name: 'Portishead Experience', genres: [], popularity: 10 },
            { id: 'right', name: 'Portishead', genres: ['trip-hop'], popularity: 70 },
          ],
        },
      }),
    )

    const client = createSpotifyClient('token', { baseUrl: 'https://spotify.test' })
    await expect(client.findExactArtistByName('Portishead')).resolves.toMatchObject({
      id: 'right',
      name: 'Portishead',
    })
  })
})
