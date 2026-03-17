import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PipelineProgress } from '../components/pipeline-progress'
import { StatCard } from '../components/stat-card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { getBatches, getRecommendations, updateRecommendation } from '../lib/api'
import { useFetch } from '../lib/hooks'

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
}: {
  recs: Recommendation[]
  total: number
  loading: boolean
  onAction: (id: number, action: 'approved' | 'rejected') => void
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
        <div key={rec.id} className="flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{rec.artist.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted">Score {rec.score.toFixed(2)}</span>
              {rec.artist.genres && rec.artist.genres.length > 0 && (
                <Badge variant="outline">{rec.artist.genres[0]}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-approve border-approve/40 hover:bg-approve/10 hover:text-approve"
              onClick={() => onAction(rec.id, 'approved')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-reject border-reject/40 hover:bg-reject/10 hover:text-reject"
              onClick={() => onAction(rec.id, 'rejected')}
            >
              Reject
            </Button>
          </div>
        </div>
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
  const [actedIds, setActedIds] = useState<Set<number>>(new Set())

  // Pending recommendations (top 5 for latest batch panel)
  const pendingFetcher = useCallback(
    () => getRecommendations({ status: 'pending', sort: 'score_desc', limit: '5' }),
    [],
  )
  const {
    data: pendingData,
    loading: pendingLoading,
    refetch: refetchPending,
  } = useFetch<{
    items: unknown[]
    total: number
  }>(pendingFetcher)

  // All-time stats: approved + added_to_lidarr = "approved", rejected = "rejected"
  const approvedFetcher = useCallback(
    () => getRecommendations({ status: 'added_to_lidarr', limit: '1' }),
    [],
  )
  const { data: approvedData, loading: approvedLoading } = useFetch<{
    items: unknown[]
    total: number
  }>(approvedFetcher)

  const rejectedFetcher = useCallback(
    () => getRecommendations({ status: 'rejected', limit: '1' }),
    [],
  )
  const { data: rejectedData, loading: rejectedLoading } = useFetch<{
    items: unknown[]
    total: number
  }>(rejectedFetcher)

  // Batches for "last scan" and library artist count
  const batchesFetcher = useCallback(() => getBatches(), [])
  const { data: batchesData, loading: batchesLoading } = useFetch<unknown[]>(batchesFetcher)

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

  // Library artists = total added to Lidarr across all batches
  const libraryArtists = approvedCount

  const statsLoading = approvedLoading || rejectedLoading || batchesLoading

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleAction(id: number, action: 'approved' | 'rejected') {
    setActedIds((prev) => new Set([...prev, id]))
    try {
      await updateRecommendation(id, { status: action })
      toast.success(action === 'approved' ? 'Added to Lidarr' : 'Rejected')
      refetchPending()
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
          label="Library Artists"
          value={statsLoading ? '--' : libraryArtists}
          subValue="added to Lidarr"
          loading={statsLoading}
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
      <PipelineProgress />

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
        />
      </div>
    </div>
  )
}
