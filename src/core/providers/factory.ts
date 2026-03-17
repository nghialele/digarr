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
      // biome-ignore lint/style/noNonNullAssertion: caller must supply apiKey for anthropic
      return new AnthropicProvider(apiKey!, model)
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai')
      // biome-ignore lint/style/noNonNullAssertion: caller must supply apiKey for openai
      return new OpenAIProvider(apiKey!, model)
    }
    case 'ollama': {
      const { OllamaProvider } = await import('./ollama')
      // biome-ignore lint/style/noNonNullAssertion: caller must supply baseUrl for ollama
      return new OllamaProvider(model, baseUrl!)
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}
