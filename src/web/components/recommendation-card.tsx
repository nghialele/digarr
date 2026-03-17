import { cn } from '../lib/utils'
import { StreamingLinks } from './streaming-links'
import { Button } from './ui/button'

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
// Source dots
// ---------------------------------------------------------------------------

function SourceDots({ sources }: { sources: Record<string, number> | null }) {
  if (!sources) return null
  const keys = Object.keys(sources)
  if (keys.length === 0) return null
  return (
    <div className="flex items-center gap-1" title="Sources">
      {keys.map((key) => {
        const cfg = SOURCE_COLORS[key] ?? { label: key.slice(0, 2).toUpperCase(), color: '#6b7084' }
        return (
          <span
            key={key}
            title={`${cfg.label}: ${((sources[key] ?? 0) * 100).toFixed(0)}%`}
            style={{ backgroundColor: cfg.color }}
            className="w-2 h-2 rounded-full inline-block"
          />
        )
      })}
    </div>
  )
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
        <span key={g} className={cn('text-[10px] px-1.5 py-0.5 rounded-full', GENRE_COLORS[i % GENRE_COLORS.length])}>
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
    <div
      className={cn(
        'bg-surface border rounded-lg transition-all cursor-pointer',
        isSelected ? 'border-accent' : 'border-border hover:border-border/80',
        expanded ? 'col-span-full' : '',
      )}
      onClick={() => onClick?.(rec.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(rec.id)
        }
      }}
    >
      {/* Compact layout (always shown) */}
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-text leading-tight">{rec.artist.name}</h3>
          <span className="shrink-0 bg-accent/20 text-accent text-xs font-semibold px-2 py-0.5 rounded">
            {pct}
          </span>
        </div>

        {/* Genre + source row */}
        <div className="flex items-center gap-2 flex-wrap">
          <GenrePills genres={rec.artist.genres} max={expanded ? 8 : 3} />
          <SourceDots sources={rec.sources} />
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
      </div>

      {/* Expanded-only section */}
      {expanded && (
        <div
          className="border-t border-border px-4 pb-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {/* AI reasoning */}
          {rec.aiReasoning && (
            <div className="mt-4 border-l-2 border-accent bg-surface/50 px-3 py-2 rounded-r">
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
        </div>
      )}
    </div>
  )
}
