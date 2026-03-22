// @vitest-environment node
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLastfmChartsAdapter } from '@/core/subscriptions/adapters/lastfm-charts'

let server: http.Server
let baseUrl: string

const fixtureResponse = {
  artists: {
    artist: [
      { name: 'Top Artist A', mbid: 'mbid-a', listeners: '5000000' },
      { name: 'Top Artist B', mbid: 'mbid-b', listeners: '800000' },
      { name: 'Top Artist C', mbid: '', listeners: '0' },
      { name: 'top artist a', mbid: 'mbid-a', listeners: '5000000' }, // duplicate
    ],
  },
}

const originalFetch = global.fetch

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`)
    if (url.searchParams.get('method') === 'chart.gettopartists') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(fixtureResponse))
      return
    }
    res.writeHead(404)
    res.end('{}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${addr.port}`

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('ws.audioscrobbler.com')) {
      const parsed = new URL(url)
      const mockUrl = `${baseUrl}${parsed.pathname}${parsed.search}`
      return originalFetch(mockUrl, init)
    }
    return originalFetch(input, init)
  }) as typeof fetch
})

afterAll(() => {
  server.close()
  global.fetch = originalFetch
})

describe('createLastfmChartsAdapter', () => {
  it('has correct type and label', () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    expect(adapter.type).toBe('lastfm-charts')
    expect(adapter.label).toBeTruthy()
  })

  it('has period configField as select', () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const periodField = adapter.configFields.find((f) => f.key === 'period')!
    expect(periodField).toBeTruthy()
    expect(periodField.type).toBe('select')
    expect(periodField.options?.length).toBeGreaterThan(0)
  })

  it('fetches artists and deduplicates by lowercase name', async () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const result = await adapter.fetch({ period: 'week' })

    // A, B, C -- lowercase dupe of A filtered
    expect(result.artists).toHaveLength(3)
    const names = result.artists.map((a) => a.name)
    expect(names).toContain('Top Artist A')
    expect(names).toContain('Top Artist B')
    expect(names).toContain('Top Artist C')
  })

  it('sets correct source tag with period', async () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })

    const weekResult = await adapter.fetch({ period: 'week' })
    expect(weekResult.artists[0]!.source).toBe('lastfm-charts:week')

    const monthResult = await adapter.fetch({ period: 'month' })
    expect(monthResult.artists[0]!.source).toBe('lastfm-charts:month')
  })

  it('defaults to week when period is not provided', async () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const result = await adapter.fetch({})
    expect(result.artists[0]!.source).toBe('lastfm-charts:week')
  })

  it('normalizes listener count to similarityScore', async () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const result = await adapter.fetch({ period: 'week' })

    // 5_000_000 / 1_000_000 = 5.0 capped at 1.0
    expect(result.artists.find((a) => a.name === 'Top Artist A')!.similarityScore).toBe(1.0)
    // 800_000 / 1_000_000 = 0.8
    expect(result.artists.find((a) => a.name === 'Top Artist B')!.similarityScore).toBeCloseTo(0.8)
    // 0 listeners -> 0.5 default
    expect(result.artists.find((a) => a.name === 'Top Artist C')!.similarityScore).toBe(0.5)
  })

  it('sets mbid when present', async () => {
    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const result = await adapter.fetch({ period: 'week' })

    const artistA = result.artists.find((a) => a.name === 'Top Artist A')!
    expect(artistA.mbid).toBe('mbid-a')

    const artistC = result.artists.find((a) => a.name === 'Top Artist C')!
    expect(artistC.mbid).toBeUndefined()
  })

  it('handles empty chart response', async () => {
    const emptyServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ artists: { artist: [] } }))
    })
    await new Promise<void>((r) => emptyServer.listen(0, '127.0.0.1', r))
    const emptyAddr = emptyServer.address() as AddressInfo
    const emptyBase = `http://127.0.0.1:${emptyAddr.port}`

    const savedFetch = global.fetch
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('ws.audioscrobbler.com')) {
        const parsed = new URL(url)
        return originalFetch(`${emptyBase}${parsed.pathname}${parsed.search}`, init)
      }
      return originalFetch(input, init)
    }) as typeof fetch

    const adapter = createLastfmChartsAdapter({ apiKey: 'testkey' })
    const result = await adapter.fetch({ period: 'week' })
    expect(result.artists).toHaveLength(0)

    global.fetch = savedFetch
    emptyServer.close()
  })
})
