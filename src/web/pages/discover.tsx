import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type Recommendation, RecommendationCard } from '../components/recommendation-card'
import { SwipeCard } from '../components/swipe-card'
import { Skeleton } from '../components/ui/skeleton'
import { bulkAction, getRecommendations, rescanArtists, updateRecommendation } from '../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_PARAM: Record<FilterTab, string | undefined> = {
  all: undefined,
  pending: 'pending',
  approved: 'added_to_lidarr,add_failed,approved',
  rejected: 'rejected',
}

const APPROVE_THRESHOLD_OPTIONS = [50, 60, 70, 80, 90]

const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Skeleton grid
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-12 rounded" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-8 rounded" />
            <Skeleton className="h-5 w-8 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-16 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, string> = {
    all: 'No recommendations yet. Run a scan to discover new artists.',
    pending: "No pending recommendations. You're all caught up.",
    approved: 'No approved recommendations yet.',
    rejected: 'No rejected recommendations.',
  }
  return (
    <div className="py-16 text-center">
      <p className="text-muted text-sm">{messages[filter]}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Discover page
// ---------------------------------------------------------------------------

export function DiscoverPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [approveThreshold, setApproveThreshold] = useState(70)
  const [actingIds, setActingIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)

  const queryParams: Record<string, string> = {
    sort: 'score_desc',
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  }
  const statusParam = STATUS_PARAM[filter]
  if (statusParam) queryParams.status = statusParam

  const { data, isLoading: loading } = useQuery({
    queryKey: ['recommendations', { filter, page }],
    queryFn: () => getRecommendations(queryParams),
  })

  const items = (data?.items ?? []) as Recommendation[]
  const total = data?.total ?? 0

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['recommendations'] })
  }, [queryClient])

  // ---------------------------------------------------------------------------
  // Undo toast
  // ---------------------------------------------------------------------------

  type UndoEntry = { id: number; prevStatus: string }
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showUndo = useCallback((entry: UndoEntry) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoEntry(entry)
    undoTimerRef.current = setTimeout(() => setUndoEntry(null), 5000)
  }, [])

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    const entry = undoEntry
    setUndoEntry(null)
    try {
      await updateRecommendation(entry.id, { status: entry.prevStatus })
      toast.success('Undone')
      refetch()
    } catch {
      toast.error('Undo failed')
    }
  }, [undoEntry, refetch])

  // Count per filter for tab badges -- fetch all counts independently
  const { data: allCountData } = useQuery({
    queryKey: ['recommendations', 'count', 'all'],
    queryFn: () => getRecommendations({ limit: '1' }),
  })
  const { data: pendingCountData } = useQuery({
    queryKey: ['recommendations', 'count', 'pending'],
    queryFn: () => getRecommendations({ status: 'pending', limit: '1' }),
  })
  const { data: approvedCountData } = useQuery({
    queryKey: ['recommendations', 'count', 'approved'],
    queryFn: () =>
      getRecommendations({ status: 'added_to_lidarr,add_failed,approved', limit: '1' }),
  })
  const { data: rejectedCountData } = useQuery({
    queryKey: ['recommendations', 'count', 'rejected'],
    queryFn: () => getRecommendations({ status: 'rejected', limit: '1' }),
  })

  const counts: Record<FilterTab, number> = {
    all: allCountData?.total ?? 0,
    pending: pendingCountData?.total ?? 0,
    approved: approvedCountData?.total ?? 0,
    rejected: rejectedCountData?.total ?? 0,
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleApprove = useCallback(
    async (id: number, prevStatus = 'pending') => {
      setActingIds((prev) => new Set([...prev, id]))
      const newStatus = filter === 'rejected' ? 'pending' : 'approved'
      try {
        await updateRecommendation(id, { status: newStatus })
        if (filter !== 'rejected') {
          showUndo({ id, prevStatus })
        } else {
          toast.success('Restored to pending')
        }
        refetch()
      } catch {
        toast.error(filter === 'rejected' ? 'Failed to restore' : 'Failed to approve')
      } finally {
        setActingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [refetch, filter, showUndo],
  )

  const handleReject = useCallback(
    async (id: number, prevStatus = 'pending') => {
      setActingIds((prev) => new Set([...prev, id]))
      try {
        await updateRecommendation(id, { status: 'rejected' })
        showUndo({ id, prevStatus })
        refetch()
      } catch {
        toast.error('Failed to reject')
      } finally {
        setActingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [refetch, showUndo],
  )

  async function handleRetry(id: number) {
    setActingIds((prev) => new Set([...prev, id]))
    try {
      await updateRecommendation(id, { status: 'approved' })
      toast.success('Queued for retry')
      refetch()
    } catch {
      toast.error('Retry failed')
    } finally {
      setActingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleApproveAbove() {
    const eligible = items.filter(
      (r) => r.score * 100 >= approveThreshold && r.status === 'pending',
    )
    if (eligible.length === 0) {
      toast.info(`No pending recommendations above ${approveThreshold}%`)
      return
    }
    try {
      await bulkAction(
        eligible.map((r) => r.id),
        'approve',
      )
      toast.success(`Approved ${eligible.length} recommendations`)
      refetch()
    } catch {
      toast.error('Bulk approve failed')
    }
  }

  const handleCardClick = useCallback(
    (id: number) => {
      if (expandedId === id) {
        setExpandedId(null)
      } else {
        setExpandedId(id)
        setSelectedId(id)
      }
    },
    [expandedId],
  )

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if an input/textarea/select is focused
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const current = itemsRef.current
      if (current.length === 0) return

      const currentIndex = selectedId != null ? current.findIndex((r) => r.id === selectedId) : -1

      if (e.key === 'j') {
        e.preventDefault()
        const nextIndex = currentIndex < current.length - 1 ? currentIndex + 1 : 0
        const nextItem = current[nextIndex]
        if (nextItem) setSelectedId(nextItem.id)
      } else if (e.key === 'k') {
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : current.length - 1
        const prevItem = current[prevIndex]
        if (prevItem) setSelectedId(prevItem.id)
      } else if (e.key === 'a' && selectedId != null) {
        e.preventDefault()
        handleApprove(selectedId)
      } else if (e.key === 'r' && selectedId != null) {
        e.preventDefault()
        handleReject(selectedId)
      } else if (e.key === 'Enter' && selectedId != null) {
        e.preventDefault()
        handleCardClick(selectedId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, handleApprove, handleCardClick, handleReject])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pendingAboveThreshold = items.filter(
    (r) => r.score * 100 >= approveThreshold && r.status === 'pending',
  ).length

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFilter(tab)
                setExpandedId(null)
                setSelectedId(null)
                setPage(0)
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === tab ? 'bg-accent text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {FILTER_LABELS[tab]}
              {tab !== 'all' && counts[tab] > 0 && (
                <span className={`ml-1.5 text-xs ${filter === tab ? 'opacity-70' : 'text-muted'}`}>
                  {counts[tab]}
                </span>
              )}
              {tab === 'all' && counts.all > 0 && (
                <span className={`ml-1.5 text-xs ${filter === tab ? 'opacity-70' : 'text-muted'}`}>
                  {counts.all}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Approve All Above */}
        <div className="flex items-center gap-2">
          <select
            value={approveThreshold}
            onChange={(e) => setApproveThreshold(Number(e.target.value))}
            className="bg-surface border border-border rounded text-sm text-text px-2 py-1.5"
            aria-label="Threshold percentage"
          >
            {APPROVE_THRESHOLD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}%
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApproveAbove}
            disabled={pendingAboveThreshold === 0}
            className="px-3 py-1.5 bg-approve/20 text-approve border border-approve/40 rounded text-sm font-medium hover:bg-approve/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Approve All Above
            {pendingAboveThreshold > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({pendingAboveThreshold})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              toast.promise(rescanArtists(), {
                loading: 'Refreshing artist data...',
                success: (r) => `Updated ${r.updated} of ${r.total} artists`,
                error: 'Rescan failed',
              })
              setTimeout(refetch, 3000)
            }}
            className="px-3 py-1.5 bg-surface border border-border rounded text-sm text-muted hover:text-text transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Keyboard hint (hidden on small screens, swipe hint shown instead) */}
      <p className="text-xs text-muted hidden sm:block">
        Shortcuts: <kbd className="px-1 bg-surface border border-border rounded">j/k</kbd> navigate{' '}
        <kbd className="px-1 bg-surface border border-border rounded">a</kbd> approve{' '}
        <kbd className="px-1 bg-surface border border-border rounded">r</kbd> reject{' '}
        <kbd className="px-1 bg-surface border border-border rounded">enter</kbd> expand
      </p>
      <p className="text-xs text-muted sm:hidden">Swipe right to approve, left to reject</p>

      {/* Card grid */}
      {loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((rec) => {
            const isExpanded = expandedId === rec.id
            const isActing = actingIds.has(rec.id)
            const isPending = rec.status === 'pending'
            return (
              <div
                key={rec.id}
                className={isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}
              >
                <SwipeCard
                  enabled={isPending && !isActing}
                  onSwipeRight={
                    isPending && !isActing ? () => handleApprove(rec.id, rec.status) : undefined
                  }
                  onSwipeLeft={
                    isPending && !isActing ? () => handleReject(rec.id, rec.status) : undefined
                  }
                >
                  <RecommendationCard
                    recommendation={rec}
                    onApprove={isActing ? () => {} : handleApprove}
                    onReject={isActing ? () => {} : handleReject}
                    onClick={handleCardClick}
                    isSelected={selectedId === rec.id}
                    expanded={isExpanded}
                    onRetry={handleRetry}
                  />
                </SwipeCard>
              </div>
            )
          })}
        </div>
      )}

      {/* Undo toast */}
      {undoEntry && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-surface border border-border rounded-lg shadow-lg text-sm text-text">
          <span>Action applied.</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-accent font-medium hover:underline"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
              setUndoEntry(null)
            }}
            className="text-muted hover:text-text ml-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted tabular-nums">
            {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
