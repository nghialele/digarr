import type { DiscoverySource, SourceCapability } from './types'

export class SourceRegistry {
  private sources = new Map<string, DiscoverySource>()

  register(source: DiscoverySource): void {
    this.sources.set(source.id, source)
  }

  get(id: string): DiscoverySource | undefined {
    return this.sources.get(id)
  }

  all(): DiscoverySource[] {
    return Array.from(this.sources.values())
  }

  withCapability(capability: SourceCapability): DiscoverySource[] {
    return Array.from(this.sources.values()).filter((s) => s.capabilities.includes(capability))
  }

  clear(): void {
    this.sources.clear()
  }
}
