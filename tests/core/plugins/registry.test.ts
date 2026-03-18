// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { SourceRegistry } from '@/core/plugins/registry'
import type { ListeningSource } from '@/core/plugins/types'

function makeFakeSource(id: string, name: string): ListeningSource {
  return {
    id,
    name,
    getTopArtists: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  }
}

describe('SourceRegistry', () => {
  it('registers and retrieves a source by id', () => {
    const registry = new SourceRegistry()
    const source = makeFakeSource('test', 'Test Source')
    registry.register(source)

    expect(registry.get('test')).toBe(source)
  })

  it('returns undefined for unregistered id', () => {
    const registry = new SourceRegistry()
    expect(registry.get('nope')).toBeUndefined()
  })

  it('returns all registered sources', () => {
    const registry = new SourceRegistry()
    const a = makeFakeSource('a', 'Source A')
    const b = makeFakeSource('b', 'Source B')
    registry.register(a)
    registry.register(b)

    const all = registry.all()
    expect(all).toHaveLength(2)
    expect(all).toContain(a)
    expect(all).toContain(b)
  })

  it('overwrites existing source with same id', () => {
    const registry = new SourceRegistry()
    const v1 = makeFakeSource('x', 'Version 1')
    const v2 = makeFakeSource('x', 'Version 2')
    registry.register(v1)
    registry.register(v2)

    expect(registry.get('x')).toBe(v2)
    expect(registry.all()).toHaveLength(1)
  })

  it('clear() removes all sources', () => {
    const registry = new SourceRegistry()
    registry.register(makeFakeSource('a', 'A'))
    registry.register(makeFakeSource('b', 'B'))
    registry.clear()

    expect(registry.all()).toHaveLength(0)
    expect(registry.get('a')).toBeUndefined()
  })

  it('returns empty array when no sources registered', () => {
    const registry = new SourceRegistry()
    expect(registry.all()).toEqual([])
  })
})
