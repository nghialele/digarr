import type { ScoredArtist } from '@/core/types'

// Minimal database interface -- only what store() needs
export interface StoreDb {
  getExistingRecommendationMbids: () => Promise<Set<string>>

  insertBatch: (data: { status: string; stats: Record<string, unknown> }) => Promise<{ id: number }>

  completeBatch: (
    id: number,
    stats: { discovered: number; added: number; failed: number },
  ) => Promise<void>

  upsertArtist: (data: {
    mbid: string
    name: string
    disambiguation?: string
    tags: string[]
    genres: string[]
    imageUrl?: string
    imageFailed?: boolean
    streamingUrls: Record<string, string>
  }) => Promise<{ id: number }>

  insertRecommendation: (data: {
    artistId: number
    batchId: number
    score: number
    sources: Record<string, number>
    aiReasoning?: string
    status: string
    userId?: number
    recommendedReleaseGroupId?: string
    recommendedReleaseGroupTitle?: string
  }) => Promise<void>

  getRejectedMbids: (cooldownDays: number) => Promise<Set<string>>

  getFeedbackHistory: () => Promise<Map<string, { approved: number; total: number }>>

  lookupArtistMetadata?: (name: string) => Promise<{
    spotifyGenres: string[] | null
    spotifyPopularity: number | null
  } | null>

  getPopularityMap?: () => Promise<Map<string, number>>
}

export type StoreOptions = {
  userId?: number
}

export async function store(
  artists: ScoredArtist[],
  db: StoreDb,
  options: StoreOptions = {},
): Promise<number> {
  // Create the batch row in running state
  const batch = await db.insertBatch({
    status: 'running',
    stats: {
      total: artists.length,
      createdAt: new Date().toISOString(),
    },
  })

  const batchId = batch.id

  // Upsert each artist and create a recommendation row
  let added = 0
  let failed = 0

  for (const artist of artists) {
    try {
      const upserted = await db.upsertArtist({
        mbid: artist.mbid,
        name: artist.name,
        disambiguation: artist.disambiguation,
        tags: artist.tags,
        genres: artist.genres,
        imageUrl: artist.imageUrl,
        imageFailed: artist.imageFailed,
        streamingUrls: artist.streamingUrls,
      })

      await db.insertRecommendation({
        artistId: upserted.id,
        batchId,
        score: artist.score,
        sources: artist.sourceScores,
        aiReasoning: artist.aiReasoning,
        status: 'pending',
        userId: options.userId,
        recommendedReleaseGroupId: artist.suggestedAlbum?.releaseGroupId,
        recommendedReleaseGroupTitle: artist.suggestedAlbum?.title,
      })

      added++
    } catch (err: unknown) {
      failed++
      console.error(`Failed to store artist ${artist.mbid}:`, err)
    }
  }

  // Mark batch as completed with real stats
  await db.completeBatch(batchId, {
    discovered: artists.length,
    added,
    failed,
  })

  return batchId
}
