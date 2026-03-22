import { Cron } from 'croner'

export class PlaylistScheduler {
  private job: Cron | null = null

  start(cronExpression: string, runFn: () => Promise<void>): void {
    this.stop()
    this.job = new Cron(cronExpression, async () => {
      try {
        await runFn()
      } catch (e: unknown) {
        console.error('[playlist-scheduler] error:', e)
      }
    })
    console.log(`[playlist-scheduler] started, next run: ${this.job.nextRun()?.toISOString()}`)
  }

  stop(): void {
    if (this.job) {
      this.job.stop()
      this.job = null
    }
  }

  nextRun(): Date | null {
    return this.job?.nextRun() ?? null
  }
}
