import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlbumPicker } from '../components/album-picker'
import { CardStack } from '../components/card-stack'
import { MonitoringOptions, type MonitorOption } from '../components/monitoring-options'
import { type Recommendation, RecommendationCard } from '../components/recommendation-card'
import { SwipeCard } from '../components/swipe-card'
import { Skeleton } from '../components/ui/skeleton'
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts'
import { usePullToRefresh } from '../hooks/use-pull-to-refresh'
import {
  approveRecommendation,
  approveToTarget,
  bulkAction,
  exportRecommendations,
  getRecommendations,
  getWarmStatuses,
  listTargets,
  rescanArtists,
  triggerPipeline,
  updateRecommendation,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'
type ViewMode = 'grid' | 'list' | 'stack'

const VIEW_MODE_KEY = 'digarr:discover-view'

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY)
    if (v === 'grid' || v === 'list' || v === 'stack') return v
  } catch {
    // ignore
  }
  return 'grid'
}

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
// View mode icons (inline SVG)
// ---------------------------------------------------------------------------

function GridIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function StackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Export dropdown
// ---------------------------------------------------------------------------

function ExportDropdown({ filter }: { filter?: string }) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  async function handleExport(format: 'json' | 'csv' | 'm3u') {
    setExporting(format)
    try {
      await exportRecommendations(format, filter ? { status: filter } : undefined)
      toast.success(`${format.toUpperCase()} exported`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 bg-surface border border-border rounded text-sm text-muted hover:text-text transition-colors"
      >
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
            {(['json', 'csv', 'm3u'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleExport(fmt)}
                disabled={exporting === fmt}
                className="w-full text-left px-3 py-1.5 text-sm text-text hover:bg-bg transition-colors disabled:opacity-50"
              >
                {exporting === fmt ? 'Exporting...' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Discover page
// ---------------------------------------------------------------------------

export function DiscoverPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [approveThreshold, setApproveThreshold] = useState(70)
  const [actingIds, setActingIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [bulkMode, setBulkMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [bulkActing, setBulkActing] = useState(false)
  const [albumPickerRecId, setAlbumPickerRecId] = useState<number | null>(null)

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['recommendations'] })
  }, [queryClient])

  const {
    pullY,
    pullThreshold: PULL_THRESHOLD,
    handlers: pullHandlers,
  } = usePullToRefresh(() => {
    refetch()
    toast.info('Refreshing...')
  })

  function handleSetViewMode(mode: ViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      // ignore
    }
    // Stack mode exits bulk mode (incompatible)
    if (mode === 'stack' && bulkMode) {
      setBulkMode(false)
      setCheckedIds(new Set())
    }
  }

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

  // ---------------------------------------------------------------------------
  // Warm status
  // ---------------------------------------------------------------------------

  const mbids = items
    .map((r) => r.artist.mbid)
    .filter(Boolean)
    .join(',')

  const { data: warmData } = useQuery({
    queryKey: ['warm-status', mbids],
    queryFn: () => getWarmStatuses(mbids),
    enabled: !!mbids,
    refetchInterval: 5000,
    staleTime: 2000,
  })

  const warmStatuses = warmData?.statuses ?? {}

  // ---------------------------------------------------------------------------
  // Targets (for multi-target approve dropdown)
  // ---------------------------------------------------------------------------

  const { data: targetsData } = useQuery({
    queryKey: ['targets'],
    queryFn: listTargets,
    staleTime: 60_000,
  })

  const targets = targetsData ?? []
  const hasMultipleTargets = targets.length > 1

  const handleApproveToTarget = useCallback(
    async (recId: number, targetId: string) => {
      setActingIds((prev) => new Set([...prev, recId]))
      try {
        await approveToTarget(recId, targetId)
        refetch()
        toast.success('Sent to target')
      } catch {
        toast.error('Failed to approve')
      } finally {
        setActingIds((prev) => {
          const next = new Set(prev)
          next.delete(recId)
          return next
        })
      }
    },
    [refetch],
  )

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

  const handleApproveWithOptions = useCallback(
    async (
      id: number,
      option: MonitorOption,
      selectedAlbumIds?: string[],
      prevStatus = 'pending',
    ) => {
      setActingIds((prev) => new Set([...prev, id]))
      try {
        await approveRecommendation(id, {
          monitorOption: option,
          selectedAlbumIds: option === 'selected' ? selectedAlbumIds : undefined,
        })
        showUndo({ id, prevStatus })
        refetch()
      } catch {
        toast.error('Failed to approve')
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

  function handleToggleBulkMode() {
    setBulkMode((prev) => {
      if (prev) setCheckedIds(new Set())
      return !prev
    })
  }

  function handleToggleSelect(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleSelectAll() {
    setCheckedIds(new Set(items.map((r) => r.id)))
  }

  function handleDeselectAll() {
    setCheckedIds(new Set())
  }

  async function handleBulkApprove() {
    if (checkedIds.size === 0) return
    setBulkActing(true)
    try {
      await bulkAction([...checkedIds], 'approve')
      toast.success(`Approved ${checkedIds.size} recommendations`)
      setCheckedIds(new Set())
      refetch()
    } catch {
      toast.error('Bulk approve failed')
    } finally {
      setBulkActing(false)
    }
  }

  async function handleBulkReject() {
    if (checkedIds.size === 0) return
    setBulkActing(true)
    try {
      await bulkAction([...checkedIds], 'reject')
      toast.success(`Rejected ${checkedIds.size} recommendations`)
      setCheckedIds(new Set())
      refetch()
    } catch {
      toast.error('Bulk reject failed')
    } finally {
      setBulkActing(false)
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

  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  useKeyboardShortcuts(
    {
      j: () => {
        const current = itemsRef.current
        if (current.length === 0) return
        const currentIndex =
          selectedIdRef.current != null
            ? current.findIndex((r) => r.id === selectedIdRef.current)
            : -1
        const nextIndex = currentIndex < current.length - 1 ? currentIndex + 1 : 0
        const nextItem = current[nextIndex]
        if (nextItem) setSelectedId(nextItem.id)
      },
      k: () => {
        const current = itemsRef.current
        if (current.length === 0) return
        const currentIndex =
          selectedIdRef.current != null
            ? current.findIndex((r) => r.id === selectedIdRef.current)
            : -1
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : current.length - 1
        const prevItem = current[prevIndex]
        if (prevItem) setSelectedId(prevItem.id)
      },
      a: () => {
        if (selectedIdRef.current != null) handleApprove(selectedIdRef.current)
      },
      r: () => {
        if (selectedIdRef.current != null) handleReject(selectedIdRef.current)
      },
      d: () => {
        if (selectedIdRef.current != null) handleCardClick(selectedIdRef.current)
      },
      Enter: () => {
        if (selectedIdRef.current != null) handleCardClick(selectedIdRef.current)
      },
    },
    viewMode !== 'stack',
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pendingAboveThreshold = items.filter(
    (r) => r.score * 100 >= approveThreshold && r.status === 'pending',
  ).length

  return (
    <div
      className={`space-y-6 max-w-6xl mx-auto${bulkMode ? ' pb-24' : ' pb-6'} md:pb-6`}
      {...pullHandlers}
    >
      {/* Pull-to-refresh indicator */}
      {pullY > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted transition-all"
          style={{ height: `${Math.min(pullY, PULL_THRESHOLD + 20)}px` }}
          aria-hidden="true"
        >
          {pullY >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {/* Sticky filter + toolbar bar */}
      <div className="sticky top-0 z-10 bg-bg border-b border-border px-6 pt-4 pb-3 -mx-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                  setCheckedIds(new Set())
                }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filter === tab ? 'bg-accent text-bg' : 'text-muted hover:text-text'
                }`}
              >
                {FILTER_LABELS[tab]}
                {tab !== 'all' && counts[tab] > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${filter === tab ? 'opacity-70' : 'text-muted'}`}
                  >
                    {counts[tab]}
                  </span>
                )}
                {tab === 'all' && counts.all > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${filter === tab ? 'opacity-70' : 'text-muted'}`}
                  >
                    {counts.all}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode switcher */}
            <div className="flex items-center gap-0.5 bg-surface border border-border rounded-lg p-1">
              {(
                [
                  { mode: 'grid' as ViewMode, Icon: GridIcon, label: 'Grid view' },
                  { mode: 'list' as ViewMode, Icon: ListIcon, label: 'List view' },
                  { mode: 'stack' as ViewMode, Icon: StackIcon, label: 'Stack view' },
                ] as const
              ).map(({ mode, Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSetViewMode(mode)}
                  aria-label={label}
                  title={label}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === mode ? 'bg-accent text-bg' : 'text-muted hover:text-text'
                  }`}
                >
                  <Icon />
                </button>
              ))}
            </div>

            {/* Approve All Above + Select -- hidden in stack mode */}
            {viewMode !== 'stack' && (
              <>
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
                <ExportDropdown filter={statusParam} />
                <button
                  type="button"
                  onClick={handleToggleBulkMode}
                  className={`px-3 py-1.5 border rounded text-sm font-medium transition-colors ${
                    bulkMode
                      ? 'bg-accent text-bg border-accent'
                      : 'bg-surface border-border text-muted hover:text-text'
                  }`}
                >
                  {bulkMode ? 'Cancel' : 'Select'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-6">
        {/* Keyboard hint (hidden on small screens, swipe hint shown instead) */}
        {!bulkMode && viewMode !== 'stack' && (
          <>
            <p className="text-xs text-muted hidden sm:block mb-4">
              Shortcuts: <kbd className="px-1 bg-surface border border-border rounded">j/k</kbd>{' '}
              navigate <kbd className="px-1 bg-surface border border-border rounded">a</kbd> approve{' '}
              <kbd className="px-1 bg-surface border border-border rounded">r</kbd> reject{' '}
              <kbd className="px-1 bg-surface border border-border rounded">d</kbd> expand{' '}
              <kbd className="px-1 bg-surface border border-border rounded">?</kbd> shortcuts
            </p>
            <p className="text-xs text-muted sm:hidden mb-4">
              Swipe right to approve, left to reject
            </p>
          </>
        )}

        {/* Stack view */}
        {viewMode === 'stack' &&
          (loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <CardStack
              recommendations={items}
              onApprove={handleApprove}
              onReject={handleReject}
              onDetail={(id) => {
                setExpandedId(expandedId === id ? null : id)
                setSelectedId(id)
                handleSetViewMode('grid')
              }}
            />
          ))}

        {/* Grid view */}
        {viewMode === 'grid' &&
          (loading ? (
            <SkeletonGrid />
          ) : items.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((rec) => {
                const isExpanded = expandedId === rec.id
                const isActing = actingIds.has(rec.id)
                const isPending = rec.status === 'pending'
                const swipeEnabled = !bulkMode && isPending && !isActing
                return (
                  <div
                    key={rec.id}
                    className={isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}
                  >
                    <SwipeCard
                      enabled={swipeEnabled}
                      onSwipeRight={
                        swipeEnabled ? () => handleApprove(rec.id, rec.status) : undefined
                      }
                      onSwipeLeft={
                        swipeEnabled ? () => handleReject(rec.id, rec.status) : undefined
                      }
                    >
                      <RecommendationCard
                        recommendation={rec}
                        onApprove={isActing ? () => {} : handleApprove}
                        onReject={isActing ? () => {} : handleReject}
                        onClick={bulkMode ? undefined : handleCardClick}
                        isSelected={!bulkMode && selectedId === rec.id}
                        expanded={!bulkMode && isExpanded}
                        onRetry={handleRetry}
                        bulkMode={bulkMode}
                        isChecked={checkedIds.has(rec.id)}
                        onToggleSelect={handleToggleSelect}
                        warmStatus={
                          warmStatuses[rec.artist.mbid] as
                            | 'warm'
                            | 'warming'
                            | 'unknown'
                            | undefined
                        }
                        targets={hasMultipleTargets ? targets : undefined}
                        onApproveToTarget={hasMultipleTargets ? handleApproveToTarget : undefined}
                        approveNode={
                          !isActing && !bulkMode && !hasMultipleTargets ? (
                            <MonitoringOptions
                              loading={isActing}
                              onApprove={(option) =>
                                handleApproveWithOptions(rec.id, option, undefined, rec.status)
                              }
                              onOpenAlbumPicker={() => setAlbumPickerRecId(rec.id)}
                            />
                          ) : undefined
                        }
                      />
                    </SwipeCard>
                  </div>
                )
              })}
            </div>
          ))}

        {/* List view */}
        {viewMode === 'list' &&
          (loading ? (
            <SkeletonGrid />
          ) : items.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((rec) => {
                const isActing = actingIds.has(rec.id)
                const isPending = rec.status === 'pending'
                const swipeEnabled = !bulkMode && isPending && !isActing
                return (
                  <SwipeCard
                    key={rec.id}
                    enabled={swipeEnabled}
                    onSwipeRight={
                      swipeEnabled ? () => handleApprove(rec.id, rec.status) : undefined
                    }
                    onSwipeLeft={swipeEnabled ? () => handleReject(rec.id, rec.status) : undefined}
                  >
                    <RecommendationCard
                      recommendation={rec}
                      onApprove={isActing ? () => {} : handleApprove}
                      onReject={isActing ? () => {} : handleReject}
                      onClick={bulkMode ? undefined : handleCardClick}
                      isSelected={!bulkMode && selectedId === rec.id}
                      expanded={!bulkMode && expandedId === rec.id}
                      onRetry={handleRetry}
                      bulkMode={bulkMode}
                      isChecked={checkedIds.has(rec.id)}
                      onToggleSelect={handleToggleSelect}
                      warmStatus={
                        warmStatuses[rec.artist.mbid] as 'warm' | 'warming' | 'unknown' | undefined
                      }
                      targets={hasMultipleTargets ? targets : undefined}
                      onApproveToTarget={hasMultipleTargets ? handleApproveToTarget : undefined}
                      approveNode={
                        !isActing && !bulkMode && !hasMultipleTargets ? (
                          <MonitoringOptions
                            loading={isActing}
                            onApprove={(option) =>
                              handleApproveWithOptions(rec.id, option, undefined, rec.status)
                            }
                            onOpenAlbumPicker={() => setAlbumPickerRecId(rec.id)}
                          />
                        ) : undefined
                      }
                    />
                  </SwipeCard>
                )
              })}
            </div>
          ))}
      </div>

      {/* Bulk action toolbar */}
      {bulkMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-surface border border-border rounded-lg shadow-lg text-sm">
          <span className="text-muted tabular-nums">{checkedIds.size} selected</span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-accent hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="text-xs text-muted hover:text-text"
          >
            None
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={checkedIds.size === 0 || bulkActing}
            className="px-3 py-1 bg-approve/20 text-approve border border-approve/40 rounded text-sm font-medium hover:bg-approve/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Approve{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
          </button>
          <button
            type="button"
            onClick={handleBulkReject}
            disabled={checkedIds.size === 0 || bulkActing}
            className="px-3 py-1 bg-reject/20 text-reject border border-reject/40 rounded text-sm font-medium hover:bg-reject/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reject{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
          </button>
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
      {viewMode !== 'stack' && total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-4 px-6">
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

      {/* FAB: Run Scan -- mobile only, above bottom nav */}
      {!bulkMode && (
        <button
          type="button"
          onClick={() =>
            triggerPipeline()
              .then(() => toast.success('Scan started -- check Dashboard for progress'))
              .catch((err) => {
                const msg = err instanceof Error ? err.message : 'Failed to start scan'
                toast.error(msg.includes('409') ? 'Scan already running' : msg)
              })
          }
          aria-label="Run Scan"
          className="md:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-accent text-bg shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}

      {/* Album picker modal */}
      {albumPickerRecId != null &&
        (() => {
          const pickerRec = items.find((r) => r.id === albumPickerRecId)
          if (!pickerRec) return null
          return (
            <AlbumPicker
              artistMbid={pickerRec.artist.mbid}
              artistName={pickerRec.artist.name}
              artistImageUrl={pickerRec.artist.imageUrl}
              suggestedAlbumId={pickerRec.recommendedReleaseGroupId}
              onConfirm={(selectedAlbumIds) => {
                setAlbumPickerRecId(null)
                handleApproveWithOptions(
                  albumPickerRecId,
                  'selected',
                  selectedAlbumIds,
                  pickerRec.status,
                )
              }}
              onCancel={() => setAlbumPickerRecId(null)}
            />
          )
        })()}
    </div>
  )
}
