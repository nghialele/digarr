import type { LidarrArtist } from '@/core/clients/lidarr'

export type LibraryArtist = { mbid: string; name: string; genres: string[] }

export async function collect(lidarrClient: {
  getArtists: () => Promise<LidarrArtist[]>
}): Promise<LibraryArtist[]> {
  const artists = await lidarrClient.getArtists()
  return artists.map((a) => ({
    mbid: a.foreignArtistId,
    name: a.artistName,
    genres: a.genres ?? [],
  }))
}
