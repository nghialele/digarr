import { describe, test, expect, vi } from 'vitest'

// Mock the provider modules to avoid real SDK instantiation
vi.mock('@/core/providers/anthropic', () => ({
  AnthropicProvider: vi.fn(function (this: Record<string, unknown>) {
    this['_type'] = 'anthropic'
  }),
}))

vi.mock('@/core/providers/openai', () => ({
  OpenAIProvider: vi.fn(function (this: Record<string, unknown>) {
    this['_type'] = 'openai'
  }),
}))

vi.mock('@/core/providers/ollama', () => ({
  OllamaProvider: vi.fn(function (this: Record<string, unknown>) {
    this['_type'] = 'ollama'
  }),
}))

const { createProvider } = await import('@/core/providers/factory')
const { AnthropicProvider } = await import('@/core/providers/anthropic')
const { OpenAIProvider } = await import('@/core/providers/openai')
const { OllamaProvider } = await import('@/core/providers/ollama')

describe('createProvider', () => {
  test('returns AnthropicProvider for "anthropic"', async () => {
    const provider = await createProvider('anthropic', 'sk-ant-key', 'claude-3-5-sonnet-20241022')
    expect(AnthropicProvider).toHaveBeenCalledWith('sk-ant-key', 'claude-3-5-sonnet-20241022')
    expect(provider).toBeDefined()
  })

  test('returns OpenAIProvider for "openai"', async () => {
    const provider = await createProvider('openai', 'sk-openai-key', 'gpt-4o')
    expect(OpenAIProvider).toHaveBeenCalledWith('sk-openai-key', 'gpt-4o')
    expect(provider).toBeDefined()
  })

  test('returns OllamaProvider for "ollama"', async () => {
    const provider = await createProvider(
      'ollama',
      null,
      'llama3',
      'http://localhost:11434',
    )
    expect(OllamaProvider).toHaveBeenCalledWith('llama3', 'http://localhost:11434')
    expect(provider).toBeDefined()
  })

  test('throws on unknown provider string', async () => {
    await expect(createProvider('unknown-ai', null, 'some-model')).rejects.toThrow(
      'Unknown AI provider: unknown-ai',
    )
  })

  test('throws on empty provider string', async () => {
    await expect(createProvider('', null, 'model')).rejects.toThrow('Unknown AI provider:')
  })
})
