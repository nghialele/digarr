// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { type AutoApproveDeps, autoApprove } from '@/core/pipeline/auto-approve'

function makeDeps(overrides: Partial<AutoApproveDeps> = {}): AutoApproveDeps {
  return {
    getRecommendationsByBatch: vi.fn().mockResolvedValue([
      { id: 1, score: 0.9, status: 'pending', artist: { mbid: 'mbid-1', name: 'Artist A' } },
      { id: 2, score: 0.6, status: 'pending', artist: { mbid: 'mbid-2', name: 'Artist B' } },
      { id: 3, score: 0.4, status: 'pending', artist: { mbid: 'mbid-3', name: 'Artist C' } },
    ]),
    getEnabledTargets: vi.fn().mockResolvedValue([
      {
        id: 'lidarr-1',
        name: 'Lidarr',
        type: 'lidarr',
        capabilities: ['addArtist'],
        addArtist: vi.fn().mockResolvedValue({
          success: true,
          targetType: 'lidarr',
          targetId: 1,
          externalId: 99,
        }),
        testConnection: vi.fn(),
      },
    ]),
    updateRecommendationStatus: vi.fn(),
    warmArtist: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('autoApprove()', () => {
  it('approves recommendations above threshold via targets', async () => {
    const deps = makeDeps()
    const result = await autoApprove(
      1,
      {
        threshold: 0.7,
        monitorOption: 'all',
        qualityProfileId: 1,
        metadataProfileId: 1,
        rootFolderId: 1,
      },
      deps,
    )

    expect(result.approved).toBe(1) // only score 0.9 is above 0.7
    const targets = await deps.getEnabledTargets()
    const target = targets[0]
    if (!target) throw new Error('expected at least one target')
    expect(target.addArtist).toHaveBeenCalledTimes(1)
    expect(target.addArtist).toHaveBeenCalledWith(
      { mbid: 'mbid-1', name: 'Artist A' },
      expect.objectContaining({ monitorOption: 'all', qualityProfileId: 1 }),
    )
  })

  it('skips non-pending recommendations', async () => {
    const deps = makeDeps({
      getRecommendationsByBatch: vi
        .fn()
        .mockResolvedValue([
          { id: 1, score: 0.9, status: 'rejected', artist: { mbid: 'mbid-1', name: 'A' } },
        ]),
    })
    const result = await autoApprove(
      1,
      {
        threshold: 0.5,
        monitorOption: 'all',
        qualityProfileId: 1,
        metadataProfileId: 1,
        rootFolderId: 1,
      },
      deps,
    )
    expect(result.approved).toBe(0)
  })

  it('handles no targets gracefully', async () => {
    const deps = makeDeps({
      getEnabledTargets: vi.fn().mockResolvedValue([]),
    })
    const result = await autoApprove(
      1,
      {
        threshold: 0.5,
        monitorOption: 'all',
        qualityProfileId: 1,
        metadataProfileId: 1,
        rootFolderId: 1,
      },
      deps,
    )
    // With no targets, marks as 'approved' (discovery-only mode)
    expect(result.approved).toBe(2)
    expect(deps.updateRecommendationStatus).toHaveBeenCalledWith(
      1,
      'approved',
      expect.objectContaining({ targetActions: {} }),
    )
  })

  it('continues on individual target failure', async () => {
    const failTarget = {
      id: 'lidarr-1',
      name: 'Lidarr',
      type: 'lidarr' as const,
      capabilities: ['addArtist' as const],
      addArtist: vi
        .fn()
        .mockResolvedValueOnce({ success: true, targetType: 'lidarr', targetId: 1, externalId: 10 })
        .mockResolvedValueOnce({
          success: false,
          targetType: 'lidarr',
          targetId: 1,
          error: 'Already exists',
        }),
      testConnection: vi.fn(),
    }
    const deps = makeDeps({
      getEnabledTargets: vi.fn().mockResolvedValue([failTarget]),
      getRecommendationsByBatch: vi.fn().mockResolvedValue([
        { id: 1, score: 0.9, status: 'pending', artist: { mbid: 'mbid-1', name: 'A' } },
        { id: 2, score: 0.8, status: 'pending', artist: { mbid: 'mbid-2', name: 'B' } },
      ]),
    })
    const result = await autoApprove(
      1,
      {
        threshold: 0.5,
        monitorOption: 'all',
        qualityProfileId: 1,
        metadataProfileId: 1,
        rootFolderId: 1,
      },
      deps,
    )
    expect(result.approved).toBe(1)
    expect(result.failed).toBe(1)
  })
})
