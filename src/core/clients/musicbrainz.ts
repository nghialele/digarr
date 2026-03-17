import PQueue from 'p-queue'

const BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'Digarr/0.1.0 (https://github.com/digarr/digarr)'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MBArtist = {
  id: string
  name: string
  disambiguation?: string
  tags?: Array<{ name: string; count: number }>
  relations?: MBRelation[]
}

export type MBRelation = {
  type: string
  url?: { resource: string }
}

export type MBSearchResult = {
  artists: Array<{
    id: string
    name: string
    disambiguation?: string
    tags?: Array<{ name: string; count: number }>
    score: number
  }>
}

export type StreamingUrls = {
  spotify?: string
  youtube?: string
  appleMusic?: string
  deezer?: string
  tidal?: string
  soundcloud?: string
  bandcamp?: string
}

// ---------------------------------------------------------------------------
// URL pattern -> streaming key map
// ---------------------------------------------------------------------------

const STREAMING_PATTERNS: Array<[RegExp, keyof StreamingUrls]> = [
  [/spotify\.com/i, 'spotify'],
  [/music\.youtube\.com/i, 'youtube'],
  [/youtube\.com/i, 'youtube'],
  [/music\.apple\.com/i, 'appleMusic'],
  [/deezer\.com/i, 'deezer'],
  [/tidal\.com/i, 'tidal'],
  [/soundcloud\.com/i, 'soundcloud'],
  [/bandcamp\.com/i, 'bandcamp'],
]

const STREAMING_TYPES = new Set(['streaming music', 'free streaming'])

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createMusicBrainzClient() {
  const queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 })

  async function request<T>(path: string): Promise<T> {
    return queue.add(async () => {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
      })

      if (!res.ok) {
        throw new Error(`MusicBrainz HTTP ${res.status} for ${path}`)
      }

      return res.json() as Promise<T>
    }) as Promise<T>
  }

  function lookupArtist(mbid: string): Promise<MBArtist> {
    const params = new URLSearchParams({ inc: 'tags+url-rels', fmt: 'json' })
    return request<MBArtist>(`/artist/${mbid}?${params}`)
  }

  function searchArtist(query: string): Promise<MBSearchResult> {
    const params = new URLSearchParams({ query, fmt: 'json' })
    return request<MBSearchResult>(`/artist/?${params}`)
  }

  function extractStreamingUrls(relations: MBRelation[]): StreamingUrls {
    const result: StreamingUrls = {}

    for (const rel of relations) {
      if (!rel.url?.resource) continue
      if (!STREAMING_TYPES.has(rel.type)) continue

      const resource = rel.url.resource

      for (const [pattern, key] of STREAMING_PATTERNS) {
        if (pattern.test(resource) && result[key] === undefined) {
          result[key] = resource
          break
        }
      }
    }

    return result
  }

  function extractImageUrl(relations: MBRelation[]): string | undefined {
    for (const rel of relations) {
      if (!rel.url?.resource) continue
      const url = rel.url.resource
      // Direct image relation
      if (rel.type === 'image' || rel.type === 'picture') {
        return url
      }
      // Wikimedia commons images
      if (url.includes('commons.wikimedia.org')) {
        return url
      }
    }
    return undefined
  }

  return {
    lookupArtist,
    searchArtist,
    extractStreamingUrls,
    extractImageUrl,
  }
}
