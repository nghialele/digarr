import type { DiscoveredArtist } from '@/core/types'

export function deduplicateByName<T extends { name: string }>(
  entries: T[],
  toArtist: (entry: T) => DiscoveredArtist,
): DiscoveredArtist[] {
  const seen = new Set<string>()
  return entries.flatMap((entry) => {
    const key = entry.name.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [toArtist(entry)]
  })
}

const LISTENER_SCALE = 1_000_000
const DEFAULT_SCORE = 0.5

export function normalizeListenerScore(listeners: number | string | undefined): number {
  const n = typeof listeners === 'string' ? parseInt(listeners, 10) : (listeners ?? 0)
  if (!n || n <= 0) return DEFAULT_SCORE
  return Math.min(n / LISTENER_SCALE, 1.0)
}
