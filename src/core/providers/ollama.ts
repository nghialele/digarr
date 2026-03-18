import type { AiRecommendation, TasteProfile } from '@/core/types'
import { buildRecommendationPrompt, parseRecommendationResponse } from './prompt'
import type { RecommendationProvider } from './types'

const DEFAULT_BASE_URL = 'http://localhost:11434'

type OllamaChatResponse = {
  message: {
    role: string
    content: string
  }
}

type OllamaTagsResponse = {
  models: Array<{ name: string }>
}

export class OllamaProvider implements RecommendationProvider {
  private model: string
  private baseUrl: string

  constructor(model: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.model = model
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async getRecommendations(profile: TasteProfile): Promise<AiRecommendation[]> {
    const prompt = buildRecommendationPrompt(profile)

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OllamaChatResponse
    const content = data.message?.content

    if (!content) {
      throw new Error('Empty response from Ollama API')
    }

    return parseRecommendationResponse(content)
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)

      if (!response.ok) {
        return {
          success: false,
          message: `Ollama returned ${response.status} ${response.statusText}`,
        }
      }

      const data = (await response.json()) as OllamaTagsResponse
      const modelCount = data.models?.length ?? 0

      return {
        success: true,
        message: `Connected to Ollama -- ${modelCount} model(s) available`,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }
}
