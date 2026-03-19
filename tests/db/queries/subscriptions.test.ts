import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db'
import type { RunInsert, SubscriptionInsert } from '@/db/queries/subscriptions'
import {
  completeRun,
  createSubscription,
  deleteSubscription,
  getEnabledSubscriptions,
  getRunsForSubscription,
  getSubscription,
  getSubscriptionsByUser,
  insertRun,
  updateSubscription,
} from '@/db/queries/subscriptions'

type SubscriptionRow = {
  id: number
  name: string
  userId: number | null
  enabled: boolean
  sourceType: string
  sourceProvider: string
  sourceConfig: Record<string, unknown>
  maxArtistsPerRun: number
  listenerRange: { min?: number; max?: number } | null
  cron: string
  action: string
  scoreThreshold: number | null
  scoringWeightPreset: string | null
  scoringWeightOverrides: Record<string, number> | null
  lastRunAt: Date | null
  lastResultCount: number | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

type RunRow = {
  id: number
  subscriptionId: number
  startedAt: Date
  completedAt: Date | null
  artistsFound: number | null
  artistsNew: number | null
  error: string | null
  batchId: number | null
}

function makeSubRow(data: SubscriptionInsert, id = 1): SubscriptionRow {
  return {
    id,
    name: data.name,
    userId: data.userId ?? null,
    enabled: data.enabled ?? true,
    sourceType: data.sourceType,
    sourceProvider: data.sourceProvider,
    sourceConfig: data.sourceConfig,
    maxArtistsPerRun: data.maxArtistsPerRun ?? 20,
    listenerRange: data.listenerRange ?? null,
    cron: data.cron,
    action: data.action ?? 'add_to_recommendations',
    scoreThreshold: data.scoreThreshold ?? null,
    scoringWeightPreset: data.scoringWeightPreset ?? 'default',
    scoringWeightOverrides: data.scoringWeightOverrides ?? null,
    lastRunAt: null,
    lastResultCount: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeRunRow(data: RunInsert, id = 1): RunRow {
  return {
    id,
    subscriptionId: data.subscriptionId,
    startedAt: new Date(),
    completedAt: null,
    artistsFound: 0,
    artistsNew: 0,
    error: null,
    batchId: data.batchId ?? null,
  }
}

const baseInsert: SubscriptionInsert = {
  name: 'Test Sub',
  sourceType: 'genre',
  sourceProvider: 'musicbrainz',
  sourceConfig: { genre: 'metal' },
  cron: '0 0 * * 0',
}

describe('createSubscription', () => {
  it('returns the created subscription row', async () => {
    const row = makeSubRow(baseInsert, 42)
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([row]),
    }
    const db = { insert: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await createSubscription(db, baseInsert)

    expect(result.id).toBe(42)
    expect(result.name).toBe('Test Sub')
    expect(result.sourceType).toBe('genre')
  })

  it('throws when no row returned', async () => {
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }
    const db = { insert: vi.fn().mockReturnValue(chain) } as unknown as Database

    await expect(createSubscription(db, baseInsert)).rejects.toThrow(
      'createSubscription: no row returned',
    )
  })
})

describe('getSubscription', () => {
  it('returns the subscription when found', async () => {
    const row = makeSubRow(baseInsert, 5)
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([row]),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getSubscription(db, 5)

    expect(result).not.toBeNull()
    expect(result?.id).toBe(5)
  })

  it('returns null when not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getSubscription(db, 999)
    expect(result).toBeNull()
  })
})

describe('getSubscriptionsByUser', () => {
  it('returns subscriptions for the given user', async () => {
    const rows = [
      makeSubRow({ ...baseInsert, userId: 3 }, 1),
      makeSubRow({ ...baseInsert, userId: 3, name: 'Sub 2' }, 2),
    ]
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getSubscriptionsByUser(db, 3)

    expect(result).toHaveLength(2)
    expect(chain.where).toHaveBeenCalledOnce()
  })

  it('returns empty array when user has no subscriptions', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getSubscriptionsByUser(db, 99)
    expect(result).toHaveLength(0)
  })
})

describe('getEnabledSubscriptions', () => {
  it('returns only enabled subscriptions', async () => {
    const rows = [makeSubRow(baseInsert, 1), makeSubRow(baseInsert, 2)]
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getEnabledSubscriptions(db)

    expect(result).toHaveLength(2)
    expect(chain.where).toHaveBeenCalledOnce()
  })
})

describe('updateSubscription', () => {
  it('calls update with set and where', async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    const db = { update: vi.fn().mockReturnValue(chain) } as unknown as Database

    await updateSubscription(db, 1, { name: 'Updated', enabled: false })

    expect(chain.set).toHaveBeenCalledOnce()
    expect(chain.where).toHaveBeenCalledOnce()
    // updatedAt should be injected
    // biome-ignore lint/style/noNonNullAssertion: mock call args
    const setArg = chain.set.mock.calls[0]![0]
    expect(setArg).toHaveProperty('updatedAt')
    expect(setArg.name).toBe('Updated')
  })
})

describe('deleteSubscription', () => {
  it('calls delete with where', async () => {
    const chain = {
      where: vi.fn().mockResolvedValue(undefined),
    }
    const db = { delete: vi.fn().mockReturnValue(chain) } as unknown as Database

    await deleteSubscription(db, 7)

    expect(chain.where).toHaveBeenCalledOnce()
  })
})

describe('insertRun', () => {
  it('returns the created run row', async () => {
    const run: RunInsert = { subscriptionId: 1 }
    const row = makeRunRow(run, 10)
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([row]),
    }
    const db = { insert: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await insertRun(db, run)

    expect(result.id).toBe(10)
    expect(result.subscriptionId).toBe(1)
  })

  it('throws when no row returned', async () => {
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }
    const db = { insert: vi.fn().mockReturnValue(chain) } as unknown as Database

    await expect(insertRun(db, { subscriptionId: 1 })).rejects.toThrow('insertRun: no row returned')
  })
})

describe('completeRun', () => {
  it('calls update with completed data', async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    const db = { update: vi.fn().mockReturnValue(chain) } as unknown as Database

    const completedAt = new Date()
    await completeRun(db, 5, { completedAt, artistsFound: 10, artistsNew: 3 })

    expect(chain.set).toHaveBeenCalledOnce()
    // biome-ignore lint/style/noNonNullAssertion: mock call args
    const setArg = chain.set.mock.calls[0]![0]
    expect(setArg.completedAt).toBe(completedAt)
    expect(setArg.artistsFound).toBe(10)
    expect(setArg.artistsNew).toBe(3)
    expect(chain.where).toHaveBeenCalledOnce()
  })

  it('defaults artistsFound and artistsNew to 0 when not provided', async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    const db = { update: vi.fn().mockReturnValue(chain) } as unknown as Database

    await completeRun(db, 1, { completedAt: new Date() })

    // biome-ignore lint/style/noNonNullAssertion: mock call args
    const setArg = chain.set.mock.calls[0]![0]
    expect(setArg.artistsFound).toBe(0)
    expect(setArg.artistsNew).toBe(0)
  })
})

describe('getRunsForSubscription', () => {
  it('returns runs ordered by startedAt desc with default limit', async () => {
    const rows: RunRow[] = [
      makeRunRow({ subscriptionId: 2 }, 3),
      makeRunRow({ subscriptionId: 2 }, 2),
    ]
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    const result = await getRunsForSubscription(db, 2)

    expect(result).toHaveLength(2)
    expect(chain.orderBy).toHaveBeenCalledOnce()
    expect(chain.limit).toHaveBeenCalledWith(20)
  })

  it('respects custom limit', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database

    await getRunsForSubscription(db, 1, 5)
    expect(chain.limit).toHaveBeenCalledWith(5)
  })
})
