import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StatCard } from '../components/stat-card'
import { Skeleton } from '../components/ui/skeleton'
import {
  type AnalyticsBatch,
  type AnalyticsGenre,
  type AnalyticsSource,
  getAnalyticsBatches,
  getAnalyticsGenres,
  getAnalyticsOverview,
  getAnalyticsSources,
} from '../lib/api'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: 'text-approve',
    running: 'text-accent',
    failed: 'text-reject',
  }
  return <span className={`text-xs font-medium ${colors[status] ?? 'text-muted'}`}>{status}</span>
}

const PAGE_SIZE = 10

function BatchHistoryTable({
  batches,
  loading,
}: {
  batches: AnalyticsBatch[] | null
  loading: boolean
}) {
  const [page, setPage] = useState(0)

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
        No batches yet. Run a scan to generate recommendations.
      </div>
    )
  }

  const totalPages = Math.ceil(batches.length / PAGE_SIZE)
  const visible = batches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-2">
      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
              <th className="text-right px-4 py-2.5 font-medium">Approved</th>
              <th className="text-right px-4 py-2.5 font-medium">Rejected</th>
              <th className="text-right px-4 py-2.5 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((b) => (
              <tr key={b.id} className="hover:bg-bg/50 transition-colors">
                <td className="px-4 py-2.5 text-text">{formatDate(b.createdAt)}</td>
                <td className="px-4 py-2.5">{statusBadge(b.status)}</td>
                <td className="px-4 py-2.5 text-right text-text">{b.total}</td>
                <td className="px-4 py-2.5 text-right text-approve">{b.approved}</td>
                <td className="px-4 py-2.5 text-right text-reject">{b.rejected}</td>
                <td className="px-4 py-2.5 text-right text-muted">{b.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, batches.length)} of{' '}
            {batches.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 rounded bg-surface border border-border hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded bg-surface border border-border hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DiscoveryChart({ batches }: { batches: AnalyticsBatch[] }) {
  // Show last 20 batches as a mini bar chart, newest on right
  const recent = batches.slice(0, 20).reverse()
  const maxTotal = Math.max(...recent.map((b) => b.total), 1)

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-end gap-1 h-24">
        {recent.map((b) => {
          const h = Math.max((b.total / maxTotal) * 100, 4)
          const approvedH = b.total > 0 ? (b.approved / b.total) * h : 0
          return (
            <div
              key={b.id}
              className="flex-1 flex flex-col justify-end group relative"
              title={`${formatDate(b.createdAt)}: ${b.total} recs (${b.approved} approved)`}
            >
              <div
                className="w-full rounded-t bg-accent/30"
                style={{ height: `${h - approvedH}%` }}
              />
              <div className="w-full rounded-b bg-approve" style={{ height: `${approvedH}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted">
        <span>{recent.length > 0 ? formatDate(recent[0]!.createdAt).split(',')[0] : ''}</span>
        <span>
          {recent.length > 1 ? formatDate(recent[recent.length - 1]!.createdAt).split(',')[0] : ''}
        </span>
      </div>
    </div>
  )
}

function GenreBreakdown({
  genres,
  loading,
}: {
  genres: AnalyticsGenre[] | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (!genres || genres.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
        No genre data available yet.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
      {genres.map((g) => (
        <div key={g.genre} className="flex items-center gap-3">
          <span className="w-28 text-sm text-text truncate shrink-0" title={g.genre}>
            {g.genre}
          </span>
          <div className="flex-1 h-4 bg-bg rounded overflow-hidden">
            <div
              className="h-full bg-approve rounded transition-all"
              style={{ width: `${Math.round(g.approvalRate * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted w-20 text-right shrink-0">
            {pct(g.approvalRate)} of {g.count}
          </span>
        </div>
      ))}
    </div>
  )
}

function SourceScores({
  sources,
  loading,
}: {
  sources: AnalyticsSource[] | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
        No source data available yet.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
      {sources.map((s) => (
        <div key={s.source} className="flex items-center gap-3">
          <span className="w-28 text-sm text-text truncate shrink-0" title={s.source}>
            {s.source}
          </span>
          <div className="flex-1 h-4 bg-bg rounded overflow-hidden">
            <div
              className="h-full bg-accent rounded transition-all"
              style={{ width: `${Math.round(s.approvalRate * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted w-28 text-right shrink-0">
            {pct(s.approvalRate)} / avg {Math.round(s.avgScore * 100)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: getAnalyticsOverview,
  })
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['analytics', 'batches'],
    queryFn: getAnalyticsBatches,
  })
  const { data: genres, isLoading: genresLoading } = useQuery({
    queryKey: ['analytics', 'genres'],
    queryFn: getAnalyticsGenres,
  })
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['analytics', 'sources'],
    queryFn: getAnalyticsSources,
  })

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Recs"
          value={overviewLoading ? '--' : (overview?.totalRecs ?? 0)}
          loading={overviewLoading}
        />
        <StatCard
          label="Approval Rate"
          value={overviewLoading ? '--' : pct(overview?.approvalRate ?? 0)}
          loading={overviewLoading}
        />
        <StatCard
          label="Avg Score"
          value={overviewLoading ? '--' : Math.round((overview?.avgScore ?? 0) * 100)}
          subValue="out of 100"
          loading={overviewLoading}
        />
        <StatCard
          label="Total Batches"
          value={overviewLoading ? '--' : (overview?.totalBatches ?? 0)}
          loading={overviewLoading}
        />
      </div>

      {/* Discovery over time chart */}
      {batches && batches.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
            Discovery Over Time
          </h2>
          <p className="text-xs text-muted -mt-2">Recommendations per batch (green = approved)</p>
          <DiscoveryChart batches={batches} />
        </div>
      )}

      {/* Batch history */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wide">Batch History</h2>
        <BatchHistoryTable batches={batches ?? null} loading={batchesLoading} />
      </div>

      {/* Genre breakdown + Source scores side by side on large screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
            Top Genres by Approval Rate
          </h2>
          <GenreBreakdown genres={genres ?? null} loading={genresLoading} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
            Source Effectiveness
          </h2>
          <SourceScores sources={sources ?? null} loading={sourcesLoading} />
        </div>
      </div>
    </div>
  )
}
