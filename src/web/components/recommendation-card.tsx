import { useState } from 'react'
import { cn } from '../lib/utils'
import { StreamingLinks } from './streaming-links'
import { Button } from './ui/button'

// ---------------------------------------------------------------------------
// Artist thumbnail
// ---------------------------------------------------------------------------

function ArtistThumb({
  name,
  imageUrl,
  size = 10,
}: {
  name: string
  imageUrl?: string | null
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const px = size * 4
  const hue = Math.abs([...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-md shrink-0 object-cover bg-bg"
        style={{ width: `${px}px`, height: `${px}px` }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="rounded-md shrink-0 flex items-center justify-center font-bold text-bg"
      style={{
        width: `${px}px`,
        height: `${px}px`,
        background: `hsl(${hue}, 40%, 45%)`,
        fontSize: `${Math.max(size * 1.5, 12)}px`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Recommendation = {
  id: number
  score: number
  status: string
  aiReasoning: string | null
  sources: Record<string, number> | null
  lidarrError: string | null
  artist: {
    id: number
    name: string
    mbid: string
    disambiguation: string | null
    genres: string[] | null
    tags: string[] | null
    imageUrl: string | null
    streamingUrls: Record<string, string> | null
  }
}

type RecommendationCardProps = {
  recommendation: Recommendation
  onApprove: (id: number) => void
  onReject: (id: number) => void
  onClick?: (id: number) => void
  isSelected?: boolean
  expanded?: boolean
  onRetry?: (id: number) => void
}

// ---------------------------------------------------------------------------
// Source dot config
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, { label: string; color: string }> = {
  listenbrainz: { label: 'LB', color: '#7a9cb8' },
  lastfm: { label: 'LFM', color: '#c47a7a' },
  musicbrainz: { label: 'MB', color: '#d4a574' },
  ai: { label: 'AI', color: '#9b7ab8' },
}

const GENRE_COLORS = [
  'bg-accent/10 text-accent',
  'bg-info/10 text-info',
  'bg-approve/10 text-approve',
  'bg-reject/10 text-reject',
]

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  lidarrError,
  onRetry,
  id,
}: {
  status: string
  lidarrError: string | null
  onRetry?: (id: number) => void
  id: number
}) {
  if (status === 'added_to_lidarr') {
    return <span className="text-xs text-approve font-medium">Added to Lidarr</span>
  }
  if (status === 'rejected') {
    return <span className="text-xs text-reject font-medium">Rejected</span>
  }
  if (status === 'add_failed') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-reject font-medium">Add Failed</span>
        {lidarrError && (
          <span className="text-xs text-muted truncate max-w-[200px]" title={lidarrError}>
            {lidarrError}
          </span>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry(id)}
            className="text-xs text-accent hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Genre pills
// ---------------------------------------------------------------------------

function GenrePills({ genres, max = 4 }: { genres: string[] | null; max?: number }) {
  if (!genres || genres.length === 0) return null
  const shown = genres.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((g, i) => (
        <span
          key={g}
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full',
            GENRE_COLORS[i % GENRE_COLORS.length],
          )}
        >
          {g}
        </span>
      ))}
      {genres.length > max && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted">
          +{genres.length - max}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function RecommendationCard({
  recommendation: rec,
  onApprove,
  onReject,
  onClick,
  isSelected = false,
  expanded = false,
  onRetry,
}: RecommendationCardProps) {
  const pct = `${Math.round(rec.score * 100)}%`
  const isPending = rec.status === 'pending' || rec.status === 'approved'
  const isActed = rec.status !== 'pending'

  return (
    <button
      type="button"
      className={cn(
        'bg-surface border rounded-lg transition-all cursor-pointer w-full text-left flex flex-col',
        isSelected ? 'border-accent' : 'border-border hover:border-border/80',
        expanded ? 'col-span-full' : '',
      )}
      onClick={() => onClick?.(rec.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(rec.id)
        }
      }}
    >
      {/* Compact layout (always shown) */}
      <div className="p-4 space-y-3 flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <ArtistThumb
            name={rec.artist.name}
            imageUrl={rec.artist.imageUrl}
            size={expanded ? 14 : 10}
          />
          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-text leading-tight">{rec.artist.name}</h3>
              {rec.artist.disambiguation && (
                <p className="text-xs text-muted mt-0.5">{rec.artist.disambiguation}</p>
              )}
            </div>
            <span className="shrink-0 bg-accent/20 text-accent text-xs font-semibold px-2 py-0.5 rounded">
              {pct}
            </span>
          </div>
        </div>

        {/* Genre tags (single line, overflow hidden) */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <GenrePills genres={rec.artist.genres} max={expanded ? 8 : 3} />
        </div>

        {/* Streaming links (compact) */}
        {!expanded && (
          <StreamingLinks
            streamingUrls={rec.artist.streamingUrls}
            artistName={rec.artist.name}
            compact
          />
        )}

        {/* Status for acted-on recs */}
        {isActed && (
          <StatusBadge
            status={rec.status}
            lidarrError={rec.lidarrError}
            onRetry={onRetry}
            id={rec.id}
          />
        )}

        {/* Action buttons */}
        {isPending && (
          // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper, not interactive itself
          <div
            className="flex gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button
              size="sm"
              variant="outline"
              className="text-approve border-approve/40 hover:bg-approve/10 hover:text-approve"
              onClick={() => onApprove(rec.id)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-reject border-reject/40 hover:bg-reject/10 hover:text-reject"
              onClick={() => onReject(rec.id)}
            >
              Reject
            </Button>
          </div>
        )}
        {rec.status === 'rejected' && (
          // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper, not interactive itself
          <div
            className="flex gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <Button
              size="sm"
              variant="outline"
              className="text-muted border-border/60 hover:bg-surface hover:text-text"
              onClick={() => onApprove(rec.id)}
            >
              Restore
            </Button>
          </div>
        )}
      </div>

      {/* Expanded-only section */}
      {expanded && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper, not interactive itself
        <div
          className="border-t border-border px-4 pb-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {/* MusicBrainz link */}
          <div className="mt-4 flex items-center gap-2">
            <a
              href={`https://musicbrainz.org/artist/${rec.artist.mbid}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              View on MusicBrainz
            </a>
          </div>

          {/* AI reasoning */}
          {rec.aiReasoning && (
            <div className="border-l-2 border-accent bg-surface/50 px-3 py-2 rounded-r">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">AI Reasoning</p>
              <p className="text-sm text-text italic">{rec.aiReasoning}</p>
            </div>
          )}

          {/* Per-source scores */}
          {rec.sources && Object.keys(rec.sources).length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-2">Source Scores</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(rec.sources).map(([key, score]) => {
                  const cfg = SOURCE_COLORS[key] ?? {
                    label: key.toUpperCase(),
                    color: '#6b7084',
                  }
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: cfg.color }}
                        className="w-2 h-2 rounded-full inline-block"
                      />
                      <span className="text-xs text-muted">{cfg.label}</span>
                      <span className="text-xs text-text font-medium">
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full streaming links with optional Spotify embed */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-2">Streaming</p>
            <StreamingLinks
              streamingUrls={rec.artist.streamingUrls}
              artistName={rec.artist.name}
              compact={false}
            />
          </div>

          {/* Status for acted-on recs */}
          {isActed && (
            <StatusBadge
              status={rec.status}
              lidarrError={rec.lidarrError}
              onRetry={onRetry}
              id={rec.id}
            />
          )}

          {/* Action buttons (re-shown in expanded too for non-acted) */}
          {isPending && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-approve border-approve/40 hover:bg-approve/10 hover:text-approve"
                onClick={() => onApprove(rec.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-reject border-reject/40 hover:bg-reject/10 hover:text-reject"
                onClick={() => onReject(rec.id)}
              >
                Reject
              </Button>
            </div>
          )}
          {rec.status === 'rejected' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-muted border-border/60 hover:bg-surface hover:text-text"
                onClick={() => onApprove(rec.id)}
              >
                Restore
              </Button>
            </div>
          )}
        </div>
      )}
    </button>
  )
}
