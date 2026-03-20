import type { ExportableRecommendation } from './types'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportToCsv(recommendations: ExportableRecommendation[]): string {
  const header = 'artist,mbid,genres,score,status,date'
  const rows = recommendations.map((r) =>
    [
      escapeCsv(r.artistName),
      r.artistMbid,
      escapeCsv(r.genres.join(';')),
      r.score.toFixed(2),
      r.status,
      r.createdAt,
    ].join(','),
  )
  return [header, ...rows].join('\n')
}
