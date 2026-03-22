// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistScheduler } from '@/core/playlists/scheduler'

// Mock croner so tests don't run real timers
vi.mock('croner', () => {
  class MockCron {
    private _stopped = false
    private _nextRun: Date | null

    constructor(
      _expression: string,
      private fn: () => Promise<void>,
    ) {
      // Schedule a next run 1 minute from now
      this._nextRun = new Date(Date.now() + 60_000)
    }

    stop() {
      this._stopped = true
      this._nextRun = null
    }

    nextRun(): Date | null {
      return this._nextRun
    }

    // Test helper: manually trigger the cron callback
    async trigger() {
      await this.fn()
    }
  }

  return { Cron: MockCron }
})

describe('PlaylistScheduler', () => {
  let scheduler: PlaylistScheduler

  beforeEach(() => {
    scheduler = new PlaylistScheduler()
  })

  afterEach(() => {
    scheduler.stop()
  })

  it('starts and reports a next run time', () => {
    const runFn = vi.fn(async () => {})
    scheduler.start('0 6 * * 1', runFn)

    const next = scheduler.nextRun()
    expect(next).toBeInstanceOf(Date)
    expect(next!.getTime()).toBeGreaterThan(Date.now())
  })

  it('nextRun returns null before start', () => {
    expect(scheduler.nextRun()).toBeNull()
  })

  it('stop clears the job', () => {
    const runFn = vi.fn(async () => {})
    scheduler.start('0 6 * * 1', runFn)
    expect(scheduler.nextRun()).not.toBeNull()

    scheduler.stop()
    expect(scheduler.nextRun()).toBeNull()
  })

  it('start replaces an existing job', () => {
    const fn1 = vi.fn(async () => {})
    const fn2 = vi.fn(async () => {})

    scheduler.start('0 6 * * 1', fn1)
    const first = scheduler.nextRun()

    scheduler.start('0 7 * * 2', fn2)
    const second = scheduler.nextRun()

    // Both return a Date -- the job was replaced
    expect(first).toBeInstanceOf(Date)
    expect(second).toBeInstanceOf(Date)
  })

  it('swallows errors thrown by the run function', async () => {
    const { Cron } = await import('croner')
    const errorFn = vi.fn(async () => {
      throw new Error('boom')
    })

    scheduler.start('0 6 * * 1', errorFn)

    // Trigger the cron via the mock helper -- should not throw
    const job = (scheduler as unknown as { job: InstanceType<typeof Cron> & { trigger: () => Promise<void> } }).job
    await expect(job.trigger()).resolves.toBeUndefined()
  })
})
