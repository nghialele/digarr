import { useState } from 'react'
import { StreamingLinks } from './streaming-links'
import { Skeleton } from './ui/skeleton'

// TodaysPick

export type Recommendation = {
  id: number
  score: number
  status: string
  aiReasoning?: string | null
  artist: {
    id: number
    name: string
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

export function TodaysPick({
  rec,
  loading,
  onApprove,
  onReject,
  onSkip,
  onRunScan,
}: TodaysPickProps) {
  const [imgError, setImgError] = useState(false)

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    )
  }

  if (!rec) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
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
  const hasImage = !!artist.imageUrl && !imgError

  const bannerStyle = hasImage
    ? {
        backgroundImage: `url(${artist.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: `hsl(${hue}, 40%, 35%)` }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Banner */}
      <div className="relative h-48" style={bannerStyle}>
        {hasImage && (
          <img
            src={artist.imageUrl ?? ''}
            alt={artist.name}
            className="sr-only"
            onError={() => setImgError(true)}
          />
        )}
        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Score badge */}
        <span
          role="img"
          className="absolute top-3 right-3 bg-accent text-accent-fg text-xs font-bold px-2 py-1 rounded"
          aria-label={`Match score: ${Math.round(rec.score * 100)}%`}
        >
          {Math.round(rec.score * 100)}
        </span>

        {/* Artist name */}
        <span className="absolute bottom-3 left-4 text-white font-semibold text-lg leading-tight drop-shadow">
          {artist.name}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Genre pills */}
        {artist.genres && artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {artist.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded text-muted"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* AI reasoning */}
        {rec.aiReasoning && (
          <p className="text-xs text-muted line-clamp-3 mt-2">{rec.aiReasoning}</p>
        )}

        <div className="mt-3">
          <StreamingLinks streamingUrls={artist.streamingUrls ?? null} artistName={artist.name} />
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-border flex">
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
