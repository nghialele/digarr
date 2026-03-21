import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArtistThumb } from '../components/artist-thumb'
import { MoodPromptBar } from '../components/mood-prompt-bar'
import { PipelineProgress } from '../components/pipeline-progress'
import { RecentlyApproved } from '../components/recently-approved'
import { TodaysPick } from '../components/todays-pick'
import { Skeleton } from '../components/ui/skeleton'
import {
  type ActivityEntry,
  getDashboardActivity,
  getDashboardTaste,
  getRecentListens,
  getRecommendations,
  getSchedulerInfo,
  getSubscriptions,
  type SchedulerJob,
  type Subscription,
  type TasteGenre,
  triggerPipeline,
  updateRecommendation,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Local types
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
    imageUrl?: string | null
    streamingUrls?: Record<string, string> | null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | Date): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  linkText,
  linkTo,
}: {
  title: string
  linkText?: string
  linkTo?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-text uppercase tracking-wide">{title}</h2>
      {linkText && linkTo && (
        <Link to={linkTo} className="text-xs text-accent hover:underline">
          {linkText}
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubscriptionPulse
// ---------------------------------------------------------------------------

function SubscriptionPulse({
  subs,
  scheduler,
}: {
  subs: Subscription[] | undefined
  scheduler: { jobs: SchedulerJob[] } | undefined
}) {
  if (!subs || subs.length === 0) {
    return (
      <div>
        <SectionHeader title="Subscriptions" linkText="Manage" linkTo="/subscriptions" />
        <div className="bg-surface border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted">No subscriptions yet</p>
          <Link
            to="/subscriptions"
            className="text-xs text-accent hover:underline mt-1 inline-block"
          >
            Create one
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Subscriptions" linkText="Manage" linkTo="/subscriptions" />
      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {subs.slice(0, 5).map((sub) => {
          const job = scheduler?.jobs.find((j) => j.name === `subscription-${sub.id}`)
          const nextRun = job?.nextRun ? relativeTime(job.nextRun) : null
          return (
            <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${sub.enabled ? 'bg-approve' : 'bg-muted/40'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text truncate">{sub.name}</p>
                <p className="text-xs text-muted">
                  {sub.lastResultCount != null
                    ? `${sub.lastResultCount} found last run`
                    : 'No runs yet'}
                  {nextRun && ` \u00b7 next ${nextRun}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ListeningActivity
// ---------------------------------------------------------------------------

function ListeningActivity({
  data,
  range,
  onRangeChange,
}: {
  data:
    | {
        tracks: Array<{
          artist: string
          track: string
          source: string
          imageUrl?: string
          mbid?: string
        }>
      }
    | undefined
  range: 'week' | 'month'
  onRangeChange: (r: 'week' | 'month') => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wide">Listening</h2>
        <div className="flex gap-1">
          {(['week', 'month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`text-xs px-2 py-0.5 rounded ${range === r ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {!data || data.tracks.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted">Connect a listening source in Settings</p>
          <Link to="/settings" className="text-xs text-accent hover:underline mt-1 inline-block">
            Settings
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg divide-y divide-border">
          {data.tracks.map((t) => (
            <div
              key={`${t.source}-${t.artist}-${t.track}`}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <ArtistThumb name={t.artist} imageUrl={t.imageUrl} size={8} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text truncate">{t.artist}</p>
                <p className="text-xs text-muted truncate">{t.track}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TasteProfile
// ---------------------------------------------------------------------------

function TasteProfile({ genres, loading }: { genres: TasteGenre[] | undefined; loading: boolean }) {
  return (
    <div>
      <SectionHeader title="Your Taste" />
      <div className="bg-surface border border-border rounded-lg p-4">
        {loading ? (
          <div className="space-y-3">
            {['t1', 't2', 't3', 't4', 't5'].map((k) => (
              <Skeleton key={k} className="h-4 w-full" />
            ))}
          </div>
        ) : !genres || genres.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            Approve some recommendations to build your taste profile
          </p>
        ) : (
          <div className="space-y-2.5">
            {genres.map((g, i) => (
              <div key={g.genre}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text truncate">{g.genre}</span>
                  <span className="text-muted shrink-0 ml-2">{g.percentage}%</span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${g.percentage}%`, opacity: 1 - i * 0.15 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityFeed
// ---------------------------------------------------------------------------

function ActivityFeed({
  entries,
  loading,
}: {
  entries: ActivityEntry[] | undefined
  loading: boolean
}) {
  return (
    <div>
      <SectionHeader title="Recent Activity" />
      <div className="bg-surface border border-border rounded-lg">
        {loading ? (
          <div className="p-4 space-y-3">
            {['a1', 'a2', 'a3', 'a4', 'a5'].map((k) => (
              <Skeleton key={k} className="h-4 w-full" />
            ))}
          </div>
        ) : !entries || entries.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No recent activity</p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div
                key={`${entry.type}-${entry.timestamp}-${entry.data.artistName ?? entry.data.subscriptionName ?? ''}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="text-xs shrink-0">
                  {entry.type === 'approved'
                    ? '\u2713'
                    : entry.type === 'rejected'
                      ? '\u2717'
                      : entry.type === 'subscription_run'
                        ? '\u21BB'
                        : '\u25C9'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text truncate">
                    {entry.data.username && (
                      <span className="text-muted">{entry.data.username}: </span>
                    )}
                    {entry.type === 'approved' && `Approved ${entry.data.artistName}`}
                    {entry.type === 'rejected' && `Rejected ${entry.data.artistName}`}
                    {entry.type === 'subscription_run' &&
                      `${entry.data.subscriptionName}: ${entry.data.artistsNew} new`}
                    {entry.type === 'scan_completed' && `Scan: ${entry.data.discovered} discovered`}
                  </p>
                </div>
                <span className="text-xs text-muted shrink-0">{relativeTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const queryClient = useQueryClient()
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set())
  const [actedIds, setActedIds] = useState<Set<number>>(new Set())
  const [listenRange, setListenRange] = useState<'week' | 'month'>('month')

  // Pending pick -- fetch 10 so skip has runway
  const { data: pickData, isLoading: pickLoading } = useQuery({
    queryKey: ['dashboard-pick'],
    queryFn: () => getRecommendations({ status: 'pending', sort: 'score_desc', limit: '10' }),
    staleTime: 30_000,
  })

  // Recently approved
  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    queryKey: ['dashboard-approved'],
    queryFn: () =>
      getRecommendations({
        status: 'added_to_lidarr,approved',
        sort: 'acted_on_desc',
        limit: '6',
      }),
    staleTime: 30_000,
  })

  // Subscriptions
  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
    staleTime: 30_000,
  })

  // Scheduler
  const { data: schedulerData } = useQuery({
    queryKey: ['scheduler-info'],
    queryFn: getSchedulerInfo,
    staleTime: 30_000,
  })

  // Listening
  const { data: listensData } = useQuery({
    queryKey: ['dashboard-listens', listenRange],
    queryFn: () => getRecentListens(listenRange, 3),
    staleTime: 30_000,
  })

  // Taste
  const { data: tasteData, isLoading: tasteLoading } = useQuery({
    queryKey: ['dashboard-taste'],
    queryFn: getDashboardTaste,
    staleTime: 30_000,
  })

  // Activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => getDashboardActivity(5),
    staleTime: 30_000,
  })

  // ---------------------------------------------------------------------------
  // Pick selection
  // ---------------------------------------------------------------------------

  const allPending = (pickData?.items ?? []) as Recommendation[]
  const currentPick = allPending.find((r) => !skippedIds.has(r.id) && !actedIds.has(r.id)) ?? null

  // Existing artist names for mood prompt dedup
  const existingArtistNames = new Set(allPending.map((r) => r.artist.name.toLowerCase()))

  // Recently approved recs for the gallery
  const approvedRecs = (approvedData?.items ?? []) as Recommendation[]

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleApprove(id: number) {
    setActedIds((prev) => new Set([...prev, id]))
    try {
      await updateRecommendation(id, { status: 'approved' })
      toast.success('Approved')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pick'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-approved'] })
    } catch {
      toast.error('Failed')
      setActedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function handleSkip(id: number) {
    setSkippedIds((prev) => new Set([...prev, id]))
  }

  async function handleReject(id: number) {
    setActedIds((prev) => new Set([...prev, id]))
    try {
      await updateRecommendation(id, { status: 'rejected' })
      toast.success('Rejected')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pick'] })
    } catch {
      toast.error('Failed')
      setActedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* MoodPromptBar (full width) */}
      <MoodPromptBar
        existingArtistNames={existingArtistNames}
        onQueued={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-pick'] })
        }}
      />

      {/* Pipeline progress (self-hides) */}
      <PipelineProgress
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-pick'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-approved'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] })
        }}
      />

      {/* Today's Pick + Recently Approved */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TodaysPick
          rec={currentPick}
          loading={pickLoading}
          onApprove={handleApprove}
          onReject={handleReject}
          onSkip={handleSkip}
          onRunScan={() => {
            triggerPipeline()
            toast.success('Scan started')
          }}
        />
        <div>
          <SectionHeader title="Recently Approved" linkText="View all" linkTo="/discover" />
          <RecentlyApproved recs={approvedRecs} loading={approvedLoading} />
        </div>
      </div>

      {/* Subscription Pulse + Listening Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SubscriptionPulse subs={subsData} scheduler={schedulerData} />
        <ListeningActivity data={listensData} range={listenRange} onRangeChange={setListenRange} />
      </div>

      {/* Taste Profile + Activity Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TasteProfile genres={tasteData} loading={tasteLoading} />
        <ActivityFeed entries={activityData} loading={activityLoading} />
      </div>
    </div>
  )
}
