import type { AiRecommendation, TasteProfile } from '@/core/types'

export function buildRecommendationPrompt(profile: TasteProfile): string {
  const topArtistNames = profile.topArtists
    .slice(0, 20)
    .map((a) => `${a.name} (${a.playCount} plays)`)
    .join(', ')

  const topGenres = profile.topGenres
    .slice(0, 10)
    .map((g) => `${g.name} (weight: ${g.weight.toFixed(2)})`)
    .join(', ')

  const trend = profile.listeningPatterns.recentTrend
  const totalListens = profile.listeningPatterns.totalListens

  return `You are a music discovery expert. Based on the following listening profile, recommend 15-20 artists the listener has NOT heard yet but would likely enjoy.

## Listening Profile

**Top Artists:** ${topArtistNames || 'none recorded'}

**Top Genres:** ${topGenres || 'none recorded'}

**Listening Patterns:**
- Total listens: ${totalListens}
- Recent trend: ${trend}

## Instructions

Return ONLY a JSON array with no additional text. Each element must have these fields:
- artistName: string (the artist's name)
- reasoning: string (brief explanation of why they match this listener's taste)
- confidence: number (0.0 to 1.0, how confident you are in this recommendation)
- genres: string[] (list of genres this artist represents)

Example:
[
  {
    "artistName": "Grouper",
    "reasoning": "Fans of ambient and drone music with introspective themes often connect deeply with Grouper's hazy, lo-fi aesthetic.",
    "confidence": 0.87,
    "genres": ["ambient", "drone", "indie folk"]
  }
]

Provide 15-20 diverse recommendations. Prioritize lesser-known artists alongside some well-known ones. Do not include artists already in the listener's top artists list.`
}

export function parseRecommendationResponse(text: string): AiRecommendation[] {
  // Strip markdown code fences if present
  let cleaned = text.trim()

  const codeFenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeFenceMatch) {
    cleaned = codeFenceMatch[1]?.trim() ?? cleaned
  }

  // Find the JSON array - look for the first '[' and match to its closing ']'
  const arrayStart = cleaned.indexOf('[')
  if (arrayStart === -1) {
    throw new Error('No JSON array found in AI response')
  }

  // Extract from array start; handle trailing text after the array
  let depth = 0
  let arrayEnd = -1
  for (let i = arrayStart; i < cleaned.length; i++) {
    if (cleaned[i] === '[') depth++
    else if (cleaned[i] === ']') {
      depth--
      if (depth === 0) {
        arrayEnd = i
        break
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('Malformed JSON array in AI response')
  }

  const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1)
  const parsed: unknown = JSON.parse(jsonStr)

  if (!Array.isArray(parsed)) {
    throw new Error('AI response did not contain an array')
  }

  return parsed
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .filter(
      (item) =>
        typeof item.artistName === 'string' &&
        typeof item.reasoning === 'string' &&
        typeof item.confidence === 'number' &&
        Array.isArray(item.genres),
    )
    .map((item) => ({
      artistName: item.artistName as string,
      reasoning: item.reasoning as string,
      confidence: item.confidence as number,
      genres: (item.genres as unknown[]).filter((g): g is string => typeof g === 'string'),
    }))
}
