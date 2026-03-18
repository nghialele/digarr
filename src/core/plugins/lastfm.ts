import { createLastFmClient } from '@/core/clients/lastfm'
import type { ListeningSource } from './types'

export function createLastFmSource(username: string, apiKey: string): ListeningSource {
  const client = createLastFmClient(username, apiKey)

  return {
    id: 'lastfm',
    name: 'Last.fm',

    async getTopArtists() {
      const artists = await client.getTopArtists('1month')
      return artists.map((a) => ({
        name: a.name,
        mbid: a.mbid,
        playCount: a.playCount,
        source: 'lastfm',
      }))
    },

    async getSimilarArtists(artistName, mbid) {
      const similar = await client.getSimilarArtists(artistName, mbid)
      return similar.map((s) => ({
        name: s.name,
        mbid: s.mbid,
        similarityScore: s.similarityScore,
        source: 'lastfm',
      }))
    },

    async testConnection() {
      return client.testConnection()
    },
  }
}
