import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { TasteProfile } from '@/core/types'

const mockChatCreate = vi.fn()

vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this['chat'] = { completions: { create: mockChatCreate } }
  })
  return { default: MockOpenAI }
})

const { OpenAIProvider } = await import('@/core/providers/openai')

const sampleProfile: TasteProfile = {
  topArtists: [
    { name: 'Four Tet', mbid: 'aaa', playCount: 300, source: 'listenbrainz' },
    { name: 'Floating Points', mbid: 'bbb', playCount: 250, source: 'lastfm' },
  ],
  topGenres: [
    { name: 'electronic', weight: 0.9 },
    { name: 'jazz', weight: 0.5 },
  ],
  listeningPatterns: {
    totalListens: 8000,
    recentTrend: 'stable',
  },
}

const sampleRecommendations = [
  {
    artistName: 'Jon Hopkins',
    reasoning: 'Electronic introspection',
    confidence: 0.9,
    genres: ['electronic', 'ambient'],
  },
  {
    artistName: 'Nils Frahm',
    reasoning: 'Piano meets electronic',
    confidence: 0.82,
    genres: ['modern classical', 'electronic'],
  },
]

describe('OpenAIProvider', () => {
  let provider: InstanceType<typeof OpenAIProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenAIProvider('test-api-key', 'gpt-4o')
  })

  describe('getRecommendations', () => {
    test('returns parsed AiRecommendation[] from direct JSON array response', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleRecommendations),
            },
          },
        ],
      })

      const result = await provider.getRecommendations(sampleProfile)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        artistName: 'Jon Hopkins',
        confidence: 0.9,
        genres: ['electronic', 'ambient'],
      })
    })

    test('returns parsed AiRecommendation[] from wrapped JSON object response', async () => {
      // OpenAI json_object mode wraps array in an object
      mockChatCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({ recommendations: sampleRecommendations }),
            },
          },
        ],
      })

      const result = await provider.getRecommendations(sampleProfile)

      expect(result).toHaveLength(2)
      expect(result[0]?.artistName).toBe('Jon Hopkins')
    })

    test('sends prompt that includes top artists from profile', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(sampleRecommendations) } }],
      })

      await provider.getRecommendations(sampleProfile)

      expect(mockChatCreate).toHaveBeenCalledOnce()
      const callArgs = mockChatCreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>
      }
      const userMsg = callArgs.messages.find((m) => m.role === 'user')
      expect(userMsg?.content).toContain('Four Tet')
      expect(userMsg?.content).toContain('Floating Points')
    })

    test('sends prompt that includes top genres from profile', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(sampleRecommendations) } }],
      })

      await provider.getRecommendations(sampleProfile)

      const callArgs = mockChatCreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>
      }
      const userMsg = callArgs.messages.find((m) => m.role === 'user')
      expect(userMsg?.content).toContain('electronic')
      expect(userMsg?.content).toContain('jazz')
    })

    test('throws on empty response', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      })

      await expect(provider.getRecommendations(sampleProfile)).rejects.toThrow(
        'Empty response from OpenAI API',
      )
    })
  })

  describe('testConnection', () => {
    test('returns success when API call succeeds', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'pong' } }],
      })

      const result = await provider.testConnection()

      expect(result.success).toBe(true)
      expect(result.message).toContain('OpenAI')
    })

    test('returns failure when API call throws', async () => {
      mockChatCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const result = await provider.testConnection()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Rate limit exceeded')
    })
  })
})
