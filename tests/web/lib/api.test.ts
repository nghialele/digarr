import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBackup, exportPlaylistApi, exportRecommendations } from '@/web/lib/api'

describe('api locale headers', () => {
  beforeEach(() => {
    const storage = new Map<string, string>([
      ['digarr-auth-token', 'test-token'],
      ['digarr-locale', 'fr'],
    ])

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => {
        storage.clear()
      }),
    })

    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['de-DE'],
    })
  })

  it('adds locale header to export recommendations requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'fail',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(exportRecommendations('json')).rejects.toThrow('Export failed')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exports/json',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Digarr-Locale': 'fr',
        }),
      }),
    )
  })

  it('adds locale header to export playlist requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'fail',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(exportPlaylistApi(42, 'csv')).rejects.toThrow('Playlist export failed')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/playlists/42/export/csv',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Digarr-Locale': 'fr',
        }),
      }),
    )
  })

  it('adds locale header to download backup requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(downloadBackup()).rejects.toThrow('API Error 500')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/backup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Digarr-Locale': 'fr',
        }),
      }),
    )
  })
})
