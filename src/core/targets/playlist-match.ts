type TrackSearchCandidate = {
  id: string
  title: string
  artists: string[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function pickBestTrackMatch(
  items: TrackSearchCandidate[],
  artistName: string,
  trackName: string,
): string | null {
  if (items.length === 0) return null

  const normalizedArtist = normalize(artistName)
  const normalizedTrack = normalize(trackName)

  const exact = items.find((item) => {
    const titleMatch = normalize(item.title) === normalizedTrack
    const artistMatch = item.artists.some((artist) => normalize(artist) === normalizedArtist)
    return titleMatch && artistMatch
  })

  return (exact ?? items[0])?.id ?? null
}
