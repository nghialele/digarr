import { Cron } from 'croner'

export class PipelineScheduler {
  private cron: Cron | null = null

  start(cronExpression: string, runFn: () => Promise<void>): void {
    this.stop()
    this.cron = new Cron(cronExpression, async () => {
      try {
        await runFn()
      } catch (err) {
        console.error('Scheduled pipeline run failed:', err)
      }
    })
  }

  stop(): void {
    this.cron?.stop()
    this.cron = null
  }

  get nextRun(): Date | null {
    return this.cron?.nextRun() ?? null
  }
}
