import type { ListeningSource } from './types'

export class SourceRegistry {
  private sources = new Map<string, ListeningSource>()

  register(source: ListeningSource): void {
    this.sources.set(source.id, source)
  }

  get(id: string): ListeningSource | undefined {
    return this.sources.get(id)
  }

  all(): ListeningSource[] {
    return Array.from(this.sources.values())
  }

  clear(): void {
    this.sources.clear()
  }
}
