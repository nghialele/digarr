// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AdapterRegistry } from '@/core/subscriptions/registry'
import type { SubscriptionAdapter } from '@/core/subscriptions/types'

function makeAdapter(overrides: Partial<SubscriptionAdapter> = {}): SubscriptionAdapter {
  return {
    type: 'test',
    label: 'Test Adapter',
    configFields: [],
    fetch: async () => ({ artists: [] }),
    ...overrides,
  }
}

describe('AdapterRegistry', () => {
  it('registers and retrieves an adapter by type', () => {
    const registry = new AdapterRegistry()
    const adapter = makeAdapter({ type: 'listenbrainz' })
    registry.register(adapter)
    expect(registry.get('listenbrainz')).toBe(adapter)
  })

  it('returns undefined for unregistered type', () => {
    const registry = new AdapterRegistry()
    expect(registry.get('nope')).toBeUndefined()
  })

  it('lists all registered adapters', () => {
    const registry = new AdapterRegistry()
    const a = makeAdapter({ type: 'lastfm' })
    const b = makeAdapter({ type: 'spotify' })
    registry.register(a)
    registry.register(b)

    const all = registry.getAll()
    expect(all).toHaveLength(2)
    expect(all).toContain(a)
    expect(all).toContain(b)
  })

  it('lists registered type strings', () => {
    const registry = new AdapterRegistry()
    registry.register(makeAdapter({ type: 'lastfm' }))
    registry.register(makeAdapter({ type: 'spotify' }))

    const types = registry.getTypes()
    expect(types).toHaveLength(2)
    expect(types).toContain('lastfm')
    expect(types).toContain('spotify')
  })

  it('overwrites on duplicate type', () => {
    const registry = new AdapterRegistry()
    registry.register(makeAdapter({ type: 'test', label: 'First' }))
    registry.register(makeAdapter({ type: 'test', label: 'Second' }))

    expect(registry.getAll()).toHaveLength(1)
    expect(registry.get('test')?.label).toBe('Second')
  })

  it('returns empty array when no adapters registered', () => {
    const registry = new AdapterRegistry()
    expect(registry.getAll()).toEqual([])
    expect(registry.getTypes()).toEqual([])
  })
})
