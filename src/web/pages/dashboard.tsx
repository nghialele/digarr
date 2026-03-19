import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PipelineProgress } from '../components/pipeline-progress'
import { StatCard } from '../components/stat-card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import {
  getBatches,
  getLidarrStats,
  getRecentListens,
  getRecommendations,
  quickDiscover,
  updateRecommendation,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Local types (API returns unknown[], we narrow here)
// ---------------------------------------------------------------------------

type Recommendation = {
  id: number
  score: number
  status: string
  aiReasoning?: string | null
  artist: {
    id: number
    name: string
    genres?: string[] | null
    tags?: string[] | null
    imageUrl?: string | null
    streamingUrls?: Record<string, string> | null
  }
}

type Batch = {
  id: number
  status: string
  createdAt: string
  stats?: {
    discovered: number
    filtered: number
    scored: number
    added: number
    failed: number
  } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ArtistThumb({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <img src={imageUrl} alt={name} className="w-10 h-10 rounded-md object-cover bg-bg shrink-0" />
    )
  }
  // Gradient placeholder based on name hash
  const hue = Math.abs([...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360)
  return (
    <div
      className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center text-xs font-bold text-bg"
      style={{ background: `hsl(${hue}, 40%, 45%)` }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function relativeTime(dateStr: string | Date): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs === 1 ? '1 hour' : `${hrs} hours`} ago`
  const days = Math.floor(hrs / 24)
  return `${days === 1 ? '1 day' : `${days} days`} ago`
}

// ---------------------------------------------------------------------------
// Latest batch panel
// ---------------------------------------------------------------------------

function LatestBatchPanel({
  recs,
  total,
  loading,
  onAction,
  onClickRec,
}: {
  recs: Recommendation[]
  total: number
  loading: boolean
  onAction: (id: number, action: 'approved' | 'rejected') => void
  onClickRec?: () => void
}) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {(['a', 'b', 'c'] as const).map((k) => (
          <div key={k} className="flex items-center justify-between px-4 py-3 gap-4">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
        No pending recommendations. Run a scan to discover new artists.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg divide-y divide-border">
      {recs.map((rec) => (
        <button
          type="button"
          key={rec.id}
          className="flex items-center justify-between px-4 py-3 gap-4 cursor-pointer hover:bg-bg/50 transition-colors w-full text-left"
          onClick={onClickRec}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ArtistThumb name={rec.artist.name} imageUrl={rec.artist.imageUrl} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">{rec.artist.name}</p>
              <div className="flex items-center gap-2 mt-0.5 overflow-hidden">
                <span className="text-xs text-accent font-medium shrink-0">
                  {Math.round((rec.score ?? 0) * 100)}%
                </span>
                {rec.artist.genres?.slice(0, 3).map((g, i) => (
                  <Badge key={g} variant="outline" className={i > 0 ? 'hidden sm:inline-flex' : ''}>
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-approve border-approve/40 hover:bg-approve/10 hover:text-approve"
              onClick={(e) => {
                e.stopPropagation()
                onAction(rec.id, 'approved')
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-reject border-reject/40 hover:bg-reject/10 hover:text-reject"
              onClick={(e) => {
                e.stopPropagation()
                onAction(rec.id, 'rejected')
              }}
            >
              Reject
            </Button>
          </div>
        </button>
      ))}
      {total > recs.length && (
        <div className="px-4 py-3">
          <Link to="/discover" className="text-sm text-accent hover:underline">
            View all {total} recommendations
          </Link>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actedIds, setActedIds] = useState<Set<number>>(new Set())
  const [listenRange, setListenRange] = useState<'week' | 'month' | 'year'>('month')
  const [listenLimit, setListenLimit] = useState(5)

  // Pending recommendations (top 5 for latest batch panel)
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['recommendations', { status: 'pending', sort: 'score_desc', limit: '5' }],
    queryFn: () => getRecommendations({ status: 'pending', sort: 'score_desc', limit: '5' }),
  })

  // All-time stats: approved + added_to_lidarr = "approved", rejected = "rejected"
  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    queryKey: ['recommendations', { status: 'added_to_lidarr', limit: '1' }],
    queryFn: () => getRecommendations({ status: 'added_to_lidarr', limit: '1' }),
  })

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    queryKey: ['recommendations', { status: 'rejected', limit: '1' }],
    queryFn: () => getRecommendations({ status: 'rejected', limit: '1' }),
  })

  // Batches for "last scan"
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: getBatches,
  })

  // Recent listens
  const { data: listensData } = useQuery({
    queryKey: ['recentListens', listenRange, listenLimit],
    queryFn: () => getRecentListens(listenRange, listenLimit),
  })

  // Lidarr library stats
  const { data: lidarrStats, isLoading: lidarrLoading } = useQuery({
    queryKey: ['lidarrStats'],
    queryFn: getLidarrStats,
  })

  // ---------------------------------------------------------------------------
  // Derive stats
  // ---------------------------------------------------------------------------

  const pendingRecs = (pendingData?.items ?? []) as Recommendation[]
  const pendingTotal = pendingData?.total ?? 0

  const approvedCount = approvedData?.total ?? 0
  const rejectedCount = rejectedData?.total ?? 0
  const actedTotal = approvedCount + rejectedCount
  const approvalRate = actedTotal > 0 ? `${Math.round((approvedCount / actedTotal) * 100)}%` : '--'

  const batches = (batchesData ?? []) as Batch[]
  const lastBatch = batches[0] ?? null
  const lastScan = lastBatch?.createdAt ? relativeTime(lastBatch.createdAt) : 'Never'

  const statsLoading = approvedLoading || rejectedLoading || batchesLoading

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleAction(id: number, action: 'approved' | 'rejected') {
    setActedIds((prev) => new Set([...prev, id]))
    try {
      await updateRecommendation(id, { status: action })
      toast.success(action === 'approved' ? 'Added to Lidarr' : 'Rejected')
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
    } catch {
      toast.error('Action failed -- please try again')
      setActedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const visibleRecs = pendingRecs.filter((r) => !actedIds.has(r.id))

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Lidarr Library"
          value={lidarrLoading ? '--' : (lidarrStats?.artists ?? 0)}
          subValue={lidarrLoading ? undefined : `${lidarrStats?.monitored ?? 0} monitored`}
          loading={lidarrLoading}
        />
        <StatCard
          label="Pending Recs"
          value={pendingLoading ? '--' : pendingTotal}
          loading={pendingLoading}
        />
        <StatCard
          label="Approval Rate"
          value={statsLoading ? '--' : approvalRate}
          subValue={actedTotal > 0 ? `${actedTotal} acted on` : undefined}
          loading={statsLoading}
        />
        <StatCard
          label="Last Scan"
          value={batchesLoading ? '--' : lastScan}
          subValue={lastBatch?.status}
          loading={batchesLoading}
        />
      </div>

      {/* Pipeline progress (self-hides when not running) */}
      <PipelineProgress
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['recommendations'] })
          queryClient.invalidateQueries({ queryKey: ['batches'] })
        }}
      />

      {/* Latest batch panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
            Latest Recommendations
          </h2>
          {pendingTotal > 0 && (
            <Link to="/discover" className="text-xs text-accent hover:underline">
              View all {pendingTotal}
            </Link>
          )}
        </div>
        <LatestBatchPanel
          recs={visibleRecs}
          total={pendingTotal}
          loading={pendingLoading}
          onAction={handleAction}
          onClickRec={() => navigate('/discover')}
        />
      </div>

      {/* Recent listens */}
      {listensData && listensData.tracks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
              Listening Activity
            </h2>
            <div className="flex items-center gap-2">
              {(['week', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setListenRange(r)}
                  className={`text-xs px-2 py-0.5 rounded ${listenRange === r ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text'}`}
                >
                  {r}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={50}
                value={listenLimit}
                onChange={(e) => setListenLimit(Math.max(1, Number(e.target.value) || 5))}
                className="w-14 h-6 text-xs text-center px-1"
              />
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {listensData.tracks.map((t) => (
              <div
                key={`${t.source}-${t.artist}-${t.track}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <ArtistThumb name={t.artist} imageUrl={t.imageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text truncate">{t.artist}</p>
                  <p className="text-xs text-muted truncate">{t.track}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs text-accent border-accent/40 hover:bg-accent/10"
                  onClick={() => {
                    toast.promise(quickDiscover(t.artist), {
                      loading: `Finding artists similar to ${t.artist}...`,
                      success: (r) => r.message,
                      error: 'Discovery failed',
                    })
                  }}
                >
                  Find Similar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
