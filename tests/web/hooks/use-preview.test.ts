import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePreviewSource } from '@/web/hooks/use-preview'

// Mock fetch globally so Deezer API calls don't hit the network.
// In browsers, Deezer returns CORS errors; here we simulate that failure
// so tests are deterministic and don't depend on external services.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error (CORS)')))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolvePreviewSource', () => {
  it('returns null for null streamingUrls', async () => {
    const result = await resolvePreviewSource(null, 'Radiohead')
    expect(result).toBeNull()
  })

  it('returns null for empty streamingUrls', async () => {
    const result = await resolvePreviewSource({}, 'Radiohead')
    expect(result).toBeNull()
  })

  it('resolves Spotify embed URL with autoPlay', async () => {
    const result = await resolvePreviewSource(
      { spotify: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb' },
      'Radiohead',
    )
    expect(result).not.toBeNull()
    expect(result?.type).toBe('spotify-embed')
    expect(result?.embedUrl).toContain('autoPlay=true')
  })

  it('resolves Spotify album embed URL with autoPlay', async () => {
    const result = await resolvePreviewSource(
      { spotify: 'https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE' },
      'Radiohead',
    )
    expect(result).not.toBeNull()
    expect(result?.type).toBe('spotify-embed')
    expect(result?.embedUrl).toContain('autoPlay=true')
    expect(result?.embedUrl).toContain('/embed/album/')
  })

  it('resolves YouTube embed URL with autoplay when Deezer fails', async () => {
    const result = await resolvePreviewSource(
      { youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      'Rick Astley',
    )
    expect(result).not.toBeNull()
    expect(result?.type).toBe('youtube-embed')
    expect(result?.embedUrl).toContain('autoplay=1')
  })

  it('returns null for invalid Spotify URL with no fallbacks', async () => {
    const result = await resolvePreviewSource(
      { spotify: 'https://open.spotify.com/invalid' },
      'Radiohead',
    )
    expect(result).toBeNull()
  })
})
