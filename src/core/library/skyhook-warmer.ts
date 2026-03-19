import PQueue from 'p-queue'

type WarmStatus = 'warm' | 'warming' | 'unknown'

type SkyHookWarmerDeps = {
  lookupArtist: (term: string) => Promise<unknown[]>
}

export class SkyHookWarmer {
  private deps: SkyHookWarmerDeps
  private status = new Map<string, WarmStatus>()
  private queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 })

  constructor(deps: SkyHookWarmerDeps) {
    this.deps = deps
  }

  getStatus(mbid: string): WarmStatus {
    return this.status.get(mbid) ?? 'unknown'
  }

  isWarm(mbid: string): boolean {
    return this.status.get(mbid) === 'warm'
  }

  async warm(mbid: string): Promise<void> {
    if (this.status.get(mbid) === 'warm') return
    if (this.status.get(mbid) === 'warming') return

    this.status.set(mbid, 'warming')
    try {
      await this.queue.add(async () => {
        await this.deps.lookupArtist(`lidarr:${mbid}`)
      })
      this.status.set(mbid, 'warm')
    } catch {
      this.status.set(mbid, 'unknown')
    }
  }

  async warmBatch(mbids: string[]): Promise<void> {
    const unwarmed = mbids.filter((mbid) => this.status.get(mbid) !== 'warm')
    await Promise.all(unwarmed.map((mbid) => this.warm(mbid)))
  }

  warmInBackground(mbid: string): void {
    this.warm(mbid).catch(() => {})
  }
}
