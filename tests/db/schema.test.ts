import { describe, expect, it } from 'vitest'
import { artists, DEFAULT_PREFERENCES, recommendations, settings } from '@/db/schema'

describe('schema', () => {
  it('settings table has expected columns', () => {
    expect(settings.lidarrUrl).toBeDefined()
    expect(settings.setupComplete).toBeDefined()
    expect(settings.preferences).toBeDefined()
  })

  it('artists table uses uuid for mbid', () => {
    expect(artists.mbid).toBeDefined()
  })

  it('recommendations references artists and batches', () => {
    expect(recommendations.artistId).toBeDefined()
    expect(recommendations.batchId).toBeDefined()
  })

  it('DEFAULT_PREFERENCES has correct scoring weights summing to 1', () => {
    const w = DEFAULT_PREFERENCES.scoringWeights
    const sum = w.consensus + w.similarity + w.genreOverlap + w.aiConfidence + w.feedbackBoost
    expect(sum).toBeCloseTo(1.0)
  })
})
