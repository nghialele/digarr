import { Cron } from 'croner'

type ScheduledJob = { name: string; cron: Cron; expression: string }

export class SubscriptionScheduler {
  private jobs = new Map<string, ScheduledJob>()

  schedule(name: string, cronExpression: string, fn: () => Promise<void>): void {
    this.remove(name)
    const cron = new Cron(cronExpression, async () => {
      try {
        await fn()
      } catch (err: unknown) {
        console.error(`[scheduler] Job '${name}' failed:`, err)
      }
    })
    this.jobs.set(name, { name, cron, expression: cronExpression })
  }

  remove(name: string): void {
    const job = this.jobs.get(name)
    if (job) {
      job.cron.stop()
      this.jobs.delete(name)
    }
  }

  has(name: string): boolean {
    return this.jobs.has(name)
  }

  listJobs(): Array<{ name: string; expression: string; nextRun: Date | null }> {
    return [...this.jobs.values()].map((j) => ({
      name: j.name,
      expression: j.expression,
      nextRun: j.cron.nextRun() ?? null,
    }))
  }

  nextRun(name: string): Date | null {
    return this.jobs.get(name)?.cron.nextRun() ?? null
  }

  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.cron.stop()
    }
    this.jobs.clear()
  }
}
