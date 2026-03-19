import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { HealthCheckCard } from '../components/health-check-card'
import { LibraryStatsDisplay } from '../components/library-stats'
import { Skeleton } from '../components/ui/skeleton'
import {
  fixHealthCheck,
  getLibraryHealth,
  getLibraryStats,
  type HealthCheckResult,
  type LibraryStats,
  scanLibraryHealth,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function ChecksSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-5 w-8 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// LibraryHealthPage
// ---------------------------------------------------------------------------

export function LibraryHealthPage() {
  const queryClient = useQueryClient()

  const healthQuery = useQuery({
    queryKey: ['library', 'health'],
    queryFn: getLibraryHealth,
  })

  const statsQuery = useQuery({
    queryKey: ['library', 'stats'],
    queryFn: getLibraryStats,
  })

  const rescanMutation = useMutation({
    mutationFn: scanLibraryHealth,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'health'] }),
  })

  const fixMutation = useMutation({
    mutationFn: (checkId: string) => fixHealthCheck(checkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'health'] }),
  })

  const checks: HealthCheckResult[] = healthQuery.data?.checks ?? []
  const stats: LibraryStats | undefined = statsQuery.data

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Page title */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Library Health</h1>
        <button
          type="button"
          onClick={() => rescanMutation.mutate()}
          disabled={rescanMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-bg rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <RefreshCw size={14} className={rescanMutation.isPending ? 'animate-spin' : undefined} />
          {rescanMutation.isPending ? 'Scanning...' : 'Re-scan'}
        </button>
      </div>

      {/* Health checks */}
      <div className="space-y-3">
        {healthQuery.isLoading ? (
          <ChecksSkeleton />
        ) : checks.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted-foreground text-sm">
            No health checks available. Run a scan to inspect your library.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {checks.map((check) => (
              <HealthCheckCard
                key={check.id}
                check={check}
                onFix={(checkId) => fixMutation.mutate(checkId)}
                fixing={fixMutation.isPending && fixMutation.variables === check.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* Library stats */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Library Statistics
        </h2>
        {statsQuery.isLoading ? (
          <StatsSkeleton />
        ) : stats ? (
          <LibraryStatsDisplay stats={stats} />
        ) : (
          <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted-foreground text-sm">
            Library statistics unavailable. Check your Lidarr connection in Settings.
          </div>
        )}
      </div>
    </div>
  )
}
