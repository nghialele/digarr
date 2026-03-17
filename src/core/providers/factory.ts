import type { RecommendationProvider } from './types'

export async function createProvider(
  provider: string,
  apiKey: string | null,
  model: string,
  baseUrl?: string | null,
): Promise<RecommendationProvider> {
  switch (provider) {
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic')
      return new AnthropicProvider(apiKey!, model)
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai')
      return new OpenAIProvider(apiKey!, model)
    }
    case 'ollama': {
      const { OllamaProvider } = await import('./ollama')
      return new OllamaProvider(model, baseUrl!)
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}
