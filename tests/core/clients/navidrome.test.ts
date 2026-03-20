// @vitest-environment node
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let server: http.Server
let baseUrl: string

// Mock Subsonic API responses
const ROUTES: Record<string, unknown> = {
  '/rest/ping.view': {
    'subsonic-response': { status: 'ok', version: '1.16.1' },
  },
  '/rest/search3.view': {
    'subsonic-response': {
      status: 'ok',
      searchResult3: {
        artist: [{ id: 'ar-1', name: 'Radiohead', albumCount: 9 }],
        song: [
          {
            id: 'tr-1',
            title: 'Creep',
            artist: 'Radiohead',
            artistId: 'ar-1',
            albumId: 'al-1',
          },
          {
            id: 'tr-2',
            title: 'Karma Police',
            artist: 'Radiohead',
            artistId: 'ar-1',
            albumId: 'al-2',
          },
        ],
      },
    },
  },
  '/rest/createPlaylist.view': {
    'subsonic-response': {
      status: 'ok',
      playlist: { id: 'pl-1', name: 'Digarr Discoveries', songCount: 0 },
    },
  },
  '/rest/updatePlaylist.view': {
    'subsonic-response': { status: 'ok' },
  },
  '/rest/star.view': {
    'subsonic-response': { status: 'ok' },
  },
  '/rest/getPlaylists.view': {
    'subsonic-response': {
      status: 'ok',
      playlists: {
        playlist: [
          { id: 'pl-1', name: 'Digarr Discoveries', songCount: 5 },
          { id: 'pl-2', name: 'Other Playlist', songCount: 3 },
        ],
      },
    },
  },
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost`)
    const path = url.pathname
    const data = ROUTES[path]
    if (data) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const addr = server.address() as { port: number }
  baseUrl = `http://127.0.0.1:${addr.port}`
})

afterAll(() => {
  server.close()
})

// Lazy import so the mock server is up first
let createNavidromeClient: typeof import('@/core/clients/navidrome').createNavidromeClient

beforeAll(async () => {
  const mod = await import('@/core/clients/navidrome')
  createNavidromeClient = mod.createNavidromeClient
})

describe('createNavidromeClient()', () => {
  it('testConnection pings the server', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    const result = await client.testConnection()
    expect(result.success).toBe(true)
  })

  it('searchArtist returns matching artists', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    const artists = await client.searchArtist('Radiohead')
    expect(artists).toHaveLength(1)
    expect(artists[0]!.name).toBe('Radiohead')
  })

  it('searchTracks returns songs for an artist', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    const tracks = await client.searchTracks('Radiohead')
    expect(tracks.length).toBeGreaterThanOrEqual(1)
    expect(tracks[0]!.title).toBe('Creep')
  })

  it('createPlaylist returns playlist id', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    const result = await client.createPlaylist('Test', [])
    expect(result.id).toBe('pl-1')
  })

  it('getPlaylists returns existing playlists', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    const playlists = await client.getPlaylists()
    expect(playlists).toHaveLength(2)
    expect(playlists[0]!.name).toBe('Digarr Discoveries')
  })

  it('starArtist does not throw', async () => {
    const client = createNavidromeClient(baseUrl, 'user', 'pass')
    await expect(client.starArtist('ar-1')).resolves.not.toThrow()
  })
})
