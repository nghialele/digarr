import { createListenBrainzClient } from '@/core/clients/listenbrainz'
import type { ListeningSource } from './types'

export function createListenBrainzSource(username: string, token: string): ListeningSource {
  const client = createListenBrainzClient(username, token)

  return {
    id: 'listenbrainz',
    name: 'ListenBrainz',

    async getTopArtists() {
      const artists = await client.getTopArtists('month')
      return artists.map((a) => ({
        name: a.name,
        mbid: a.mbid,
        playCount: a.playCount,
        source: 'listenbrainz',
      }))
    },

    async getSimilarArtists(_artistName, mbid) {
      if (!mbid) return []
      const similar = await client.getSimilarArtists(mbid)
      return similar.map((s) => ({
        name: s.name,
        similarityScore: s.score,
        source: 'listenbrainz',
      }))
    },

    async testConnection() {
      return client.testConnection()
    },

    async getListeningActivity() {
      return client.getListeningActivity()
    },
  }
}
