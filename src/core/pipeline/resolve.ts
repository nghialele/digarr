import type { MBArtist, MBSearchResult } from '@/core/clients/musicbrainz'
import type { DiscoveredArtist, PipelineProgress, ResolvedArtist } from '@/core/types'

interface MusicBrainzClient {
  lookupArtist: (mbid: string) => Promise<MBArtist>
  searchArtist: (query: string) => Promise<MBSearchResult>
  extractStreamingUrls: (
    relations: Array<{ type: string; url?: { resource: string } }>,
  ) => Record<string, string>
}

interface LidarrLookupClient {
  lookupArtist: (term: string) => Promise<unknown[]>
}

export async function resolve(
  discovered: DiscoveredArtist[],
  mb: MusicBrainzClient,
  onProgress?: (progress: PipelineProgress) => void,
  lidarr?: LidarrLookupClient | null,
): Promise<ResolvedArtist[]> {
  // Group by MBID (if known) then by name, to deduplicate
  const byMbid = new Map<string, DiscoveredArtist[]>()
  const byName = new Map<string, DiscoveredArtist[]>()

  for (const artist of discovered) {
    if (artist.mbid) {
      const key = artist.mbid
      const existing = byMbid.get(key) ?? []
      existing.push(artist)
      byMbid.set(key, existing)
    } else {
      const key = artist.name.toLowerCase()
      const existing = byName.get(key) ?? []
      existing.push(artist)
      byName.set(key, existing)
    }
  }

  const total = byMbid.size + byName.size
  let current = 0
  const resolved: ResolvedArtist[] = []

  onProgress?.({ stage: 'resolve', current: 0, total, message: 'Starting resolution' })

  // Resolve artists that already have MBIDs
  for (const [mbid, discoveries] of byMbid) {
    current++
    const artistName = discoveries[0]?.name ?? mbid
    onProgress?.({ stage: 'resolve', current, total, message: `Resolving ${artistName}...` })

    try {
      const mbArtist = await mb.lookupArtist(mbid)
      resolved.push(await buildResolvedArtist(mbArtist, discoveries, mb, lidarr))
    } catch {
      // Drop unresolvable
    }
  }

  // Search MB for artists without MBIDs
  for (const [_nameLower, discoveries] of byName) {
    current++
    const firstName = discoveries[0]?.name ?? ''
    onProgress?.({ stage: 'resolve', current, total, message: `Searching ${firstName}...` })
    if (!firstName) continue

    try {
      const searchResult = await mb.searchArtist(firstName)
      const topHit = searchResult.artists[0]
      if (!topHit) continue

      // Check if this MBID was already resolved
      if (byMbid.has(topHit.id)) continue

      const mbArtist = await mb.lookupArtist(topHit.id)
      resolved.push(await buildResolvedArtist(mbArtist, discoveries, mb, lidarr))

      // Mark as resolved so we don't add duplicate later
      byMbid.set(topHit.id, discoveries)
    } catch {
      // Drop unresolvable
    }
  }

  onProgress?.({ stage: 'resolve', current: total, total, message: 'Resolution complete' })

  // Final dedup by MBID in case search returned same MBID twice
  const seenMbids = new Set<string>()
  return resolved.filter((a) => {
    if (seenMbids.has(a.mbid)) return false
    seenMbids.add(a.mbid)
    return true
  })
}

async function buildResolvedArtist(
  mbArtist: MBArtist,
  discoveries: DiscoveredArtist[],
  mb: MusicBrainzClient,
  lidarr?: LidarrLookupClient | null,
): Promise<ResolvedArtist> {
  const tags = (mbArtist.tags ?? []).map((t) => t.name)
  const streamingUrls = mb.extractStreamingUrls(mbArtist.relations ?? [])

  // Get artist image from Lidarr's metadata (fanart.tv)
  const imageUrl = await fetchLidarrImage(mbArtist.id, lidarr)

  return {
    mbid: mbArtist.id,
    name: mbArtist.name,
    disambiguation: mbArtist.disambiguation,
    tags,
    genres: tags,
    imageUrl,
    streamingUrls,
    discoveries,
  }
}

async function fetchLidarrImage(
  mbid: string,
  lidarr?: LidarrLookupClient | null,
): Promise<string | undefined> {
  if (!lidarr) return undefined

  try {
    const results = await lidarr.lookupArtist(`lidarr:${mbid}`)
    const artist = results[0] as
      | { images?: Array<{ coverType: string; remoteUrl?: string }> }
      | undefined
    if (!artist?.images) return undefined

    // Prefer poster/artistthumb, then fanart
    for (const type of ['poster', 'fanart', 'banner']) {
      const img = artist.images.find((i) => i.coverType === type && i.remoteUrl)
      if (img?.remoteUrl) return img.remoteUrl
    }
    // Fall back to any image with a remoteUrl
    const any = artist.images.find((i) => i.remoteUrl)
    return any?.remoteUrl
  } catch {
    return undefined
  }
}
