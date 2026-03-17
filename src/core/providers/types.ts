import type { TasteProfile, AiRecommendation } from '@/core/types'

export interface RecommendationProvider {
  getRecommendations(profile: TasteProfile): Promise<AiRecommendation[]>
  testConnection(): Promise<{ success: boolean; message: string }>
}
