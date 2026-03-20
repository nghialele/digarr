import type { ExportableRecommendation } from './types'

export function exportToM3u(recommendations: ExportableRecommendation[]): string {
  const lines = ['#EXTM3U']

  for (const rec of recommendations) {
    lines.push(`#EXTINF:-1,${rec.artistName}`)
    // Prefer streaming URLs, fall back to MusicBrainz
    const url =
      rec.streamingUrls.spotify ??
      rec.streamingUrls.youtube ??
      rec.streamingUrls.deezer ??
      `https://musicbrainz.org/artist/${rec.artistMbid}`
    lines.push(url)
  }

  return lines.join('\n')
}
