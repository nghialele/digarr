import Anthropic from '@anthropic-ai/sdk'
import type { TasteProfile, AiRecommendation } from '@/core/types'
import type { RecommendationProvider } from './types'
import { buildRecommendationPrompt, parseRecommendationResponse } from './prompt'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export class AnthropicProvider implements RecommendationProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async getRecommendations(profile: TasteProfile): Promise<AiRecommendation[]> {
    const prompt = buildRecommendationPrompt(profile)

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const firstContent = response.content[0]
    if (!firstContent || firstContent.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic API')
    }

    return parseRecommendationResponse(firstContent.text)
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })

      const firstContent = response.content[0]
      if (firstContent && firstContent.type === 'text') {
        return { success: true, message: `Connected to Anthropic (${this.model})` }
      }

      return { success: true, message: `Connected to Anthropic (${this.model})` }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  }
}
