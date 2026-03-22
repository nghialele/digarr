import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getAlbums, type ReleaseGroup } from '../lib/api'
import { StreamingLinks } from './streaming-links'
import { Skeleton } from './ui/skeleton'

export type Recommendation = {
  id: number
  score: number
  status: string
  aiReasoning?: string | null
  artist: {
    id: number
    name: string
    mbid?: string
    genres?: string[] | null
    imageUrl?: string | null
    streamingUrls?: Record<string, string> | null
  }
}

type TodaysPickProps = {
  rec: Recommendation | null
  loading: boolean
  onApprove: (id: number) => void
  onReject: (id: number) => void
  onSkip: (id: number) => void
  onRunScan: () => void
}

function AlbumList({ albums }: { albums: ReleaseGroup[] }) {
  if (albums.length === 0) return null
  const shown = albums.filter((a) => a.type === 'Album').slice(0, 5)
  if (shown.length === 0) return null

  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Discography</p>
      <div className="space-y-1">
        {shown.map((album) => (
          <div key={album.id} className="flex items-center gap-2 text-xs">
            <span className="text-muted shrink-0 w-8 text-right tabular-nums">
              {album.firstReleaseDate?.slice(0, 4) ?? '----'}
            </span>
            <span className="text-text truncate">{album.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TodaysPick({
  rec,
  loading,
  onApprove,
  onReject,
  onSkip,
  onRunScan,
}: TodaysPickProps) {
  const [imgError, setImgError] = useState(false)
  const [coverError, setCoverError] = useState(false)

  const { data: albumData } = useQuery({
    queryKey: ['todays-pick-albums', rec?.artist.mbid],
    queryFn: () => getAlbums(rec!.artist.mbid!),
    enabled: !!rec?.artist.mbid,
    staleTime: 60_000,
  })

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden h-full">
        <Skeleton className="h-32 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    )
  }

  if (!rec) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center min-h-[300px] h-full">
        <p className="text-muted text-sm mb-3">No pending recommendations</p>
        <button
          type="button"
          onClick={onRunScan}
          className="px-4 py-2 bg-accent text-accent-fg rounded text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Run Scan
        </button>
      </div>
    )
  }

  const { artist } = rec
  const hue = Math.abs([...artist.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)

  // Fallback chain: artist image -> first album cover (Cover Art Archive) -> gradient
  const firstAlbumId = albumData?.find((a) => a.type === 'Album')?.id
  const coverFallback = firstAlbumId
    ? `https://coverartarchive.org/release-group/${firstAlbumId}/front-500`
    : null
  const bannerUrl = (!imgError && artist.imageUrl) || coverFallback
  const hasImage = !!bannerUrl && !coverError

  const bannerStyle = hasImage
    ? {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: `hsl(${hue}, 40%, 35%)` }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-full">
      {/* Banner */}
      <div className="relative h-32 shrink-0" style={bannerStyle}>
        {hasImage && (
          <img
            src={bannerUrl}
            alt={artist.name}
            className="sr-only"
            onError={() => {
              if (bannerUrl === artist.imageUrl) setImgError(true)
              else setCoverError(true)
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        <span
          role="img"
          className="absolute top-3 right-3 bg-accent text-accent-fg text-xs font-bold px-2 py-1 rounded"
          aria-label={`Match score: ${Math.round(rec.score * 100)}%`}
        >
          {Math.round(rec.score * 100)}
        </span>

        <span className="absolute bottom-3 left-4 text-white font-semibold text-lg leading-tight drop-shadow">
          {artist.name}
        </span>
      </div>

      {/* Content -- flex-1 fills available space */}
      <div className="p-4 flex-1">
        {artist.genres && artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {artist.genres.slice(0, 5).map((genre) => (
              <span
                key={genre}
                className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded text-muted"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {rec.aiReasoning && <p className="text-xs text-muted mt-2">{rec.aiReasoning}</p>}

        <div className="mt-3">
          <StreamingLinks streamingUrls={artist.streamingUrls ?? null} artistName={artist.name} />
        </div>

        {albumData && <AlbumList albums={albumData} />}
      </div>

      {/* Action bar -- pinned to bottom */}
      <div className="border-t border-border flex mt-auto shrink-0">
        <button
          type="button"
          onClick={() => onReject(rec.id)}
          className="flex-1 py-3 text-sm font-medium text-center transition-colors text-reject hover:bg-reject/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-reject"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => onSkip(rec.id)}
          className="flex-1 py-3 text-sm font-medium text-center transition-colors text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => onApprove(rec.id)}
          className="flex-1 py-3 text-sm font-medium text-center transition-colors text-approve hover:bg-approve/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-approve"
        >
          Approve
        </button>
      </div>
    </div>
  )
}
