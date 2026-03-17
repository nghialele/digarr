import type { AiRecommendation, TasteProfile } from '@/core/types'

export interface RecommendationProvider {
  getRecommendations(profile: TasteProfile): Promise<AiRecommendation[]>
  testConnection(): Promise<{ success: boolean; message: string }>
}
