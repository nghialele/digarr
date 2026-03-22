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
    logoUrl?: string | null
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
    // biome-ignore lint/style/noNonNullAssertion: guarded by enabled
    queryFn: () => getAlbums(rec!.artist.mbid!),
    enabled: !!rec?.artist.mbid,
    staleTime: 60_000,
  })

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden h-full">
        <Skeleton className="h-1/3 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
    )
  }

  if (!rec) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center h-full">
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
  const scorePercent = Math.round(rec.score * 100)

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
    <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Banner -- fills ~40% of card height */}
      <div className="relative shrink-0 basis-2/5 min-h-[120px]" style={bannerStyle}>
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Score badge */}
        <div
          className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-baseline gap-0.5"
          role="img"
          aria-label={`Match score: ${scorePercent}%`}
        >
          <span className="text-accent text-xl font-bold leading-none">{scorePercent}</span>
          <span className="text-accent/70 text-xs font-semibold">%</span>
          <span className="text-white/50 text-[9px] ml-1 uppercase tracking-wider">match</span>
        </div>

        {/* Artist name / logo */}
        <div className="absolute bottom-3 left-4 right-4">
          {artist.logoUrl ? (
            <img
              src={artist.logoUrl}
              alt={artist.name}
              className="h-10 max-w-[70%] object-contain object-left drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const sibling = e.currentTarget.nextElementSibling
                if (sibling) sibling.classList.remove('hidden')
              }}
            />
          ) : null}
          <h3
            className={`text-white font-bold text-xl leading-tight drop-shadow-lg truncate${artist.logoUrl ? ' hidden' : ''}`}
          >
            {artist.name}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto min-h-0">
        {artist.genres && artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {artist.genres.slice(0, 6).map((genre) => (
              <span
                key={genre}
                className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded text-muted"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {rec.aiReasoning && (
          <p className="text-xs text-muted mt-2 line-clamp-3">
            {rec.aiReasoning.split(new RegExp(`(${artist.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
              part.toLowerCase() === artist.name.toLowerCase()
                ? <span key={i} className="text-text font-semibold">{part}</span>
                : part
            )}
          </p>
        )}

        <div className="mt-3">
          <StreamingLinks streamingUrls={artist.streamingUrls ?? null} artistName={artist.name} />
        </div>
      </div>

      {/* Action bar -- pinned to bottom */}
      <div className="border-t border-border flex shrink-0">
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
