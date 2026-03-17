import type { ScoredArtist } from '@/core/types'

export function filter(
  artists: ScoredArtist[],
  libraryMbids: Set<string>,
  rejectedMbids: Map<string, Date>,
  cooldownDays: number,
  scoreThreshold: number,
): ScoredArtist[] {
  const now = new Date()
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000

  return artists.filter((artist) => {
    // Remove artists already in library
    if (libraryMbids.has(artist.mbid)) return false

    // Remove artists rejected within the cooldown window
    const rejectedAt = rejectedMbids.get(artist.mbid)
    if (rejectedAt !== undefined) {
      const elapsed = now.getTime() - rejectedAt.getTime()
      if (elapsed < cooldownMs) return false
    }

    // Remove artists below score threshold
    if (artist.score < scoreThreshold) return false

    return true
  })
}
