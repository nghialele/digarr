import type { AiRecommendation, TasteProfile } from '@/core/types'
import { buildRecommendationPrompt, parseRecommendationResponse } from './prompt'
import type { RecommendationProvider } from './types'

const DEFAULT_MODEL = 'gemini-2.0-flash'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiProvider implements RecommendationProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey
    this.model = model
  }

  async getRecommendations(profile: TasteProfile): Promise<AiRecommendation[]> {
    const prompt = buildRecommendationPrompt(profile)

    const res = await fetch(`${API_BASE}/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gemini API error: ${res.status} ${res.statusText} ${body}`)
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')

    return parseRecommendationResponse(text)
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/${this.model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })

      if (res.ok) {
        return { success: true, message: `Connected to Gemini (${this.model})` }
      }
      const body = await res.text().catch(() => '')
      return { success: false, message: body || `HTTP ${res.status}` }
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
