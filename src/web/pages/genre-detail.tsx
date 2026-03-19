import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GenreInfo } from '../../core/genre/types'
import { Skeleton } from '../components/ui/skeleton'
import { getGenre } from '../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenreDetail = GenreInfo & { subGenres: GenreInfo[] }

type DetailTab = 'library' | 'recommended' | 'trending' | 'deep_cuts'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'library', label: 'In Your Library' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'trending', label: 'Trending' },
  { id: 'deep_cuts', label: 'Deep Cuts' },
]

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Genre detail page
// ---------------------------------------------------------------------------

export function GenreDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DetailTab>('library')

  const { data, isLoading, error } = useQuery<GenreDetail>({
    queryKey: ['genres', 'detail', slug],
    queryFn: () => getGenre(slug ?? ''),
    enabled: Boolean(slug),
  })

  if (isLoading) return <DetailSkeleton />

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/genres')}
          className="text-sm text-muted hover:text-text transition-colors"
        >
          &larr; Back to Genres
        </button>
        <div className="py-16 text-center">
          <p className="text-muted text-sm">Genre not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => navigate('/genres')}
        className="text-sm text-muted hover:text-text transition-colors"
      >
        &larr; Back to Genres
      </button>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-text">{data.name}</h1>
        <p className="text-sm text-muted mt-1">
          {data.artistCount} artist{data.artistCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Sub-genres */}
      {data.subGenres.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wide font-semibold">Sub-genres</p>
          <div className="flex flex-wrap gap-2">
            {data.subGenres.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => navigate(`/genres/${sub.slug}`)}
                className="px-3 py-1 bg-surface border border-border rounded-full text-sm text-muted hover:text-text hover:border-accent/60 transition-colors"
              >
                {sub.name}
                {sub.artistCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">{sub.artistCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-accent text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content -- placeholder for all tabs */}
        <div className="py-12 text-center bg-surface border border-border rounded-lg">
          <p className="text-muted text-sm">Coming soon</p>
        </div>
      </div>

      {/* Create subscription */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => alert(`Subscriptions for "${data.name}" coming soon`)}
          className="px-4 py-2 bg-surface border border-border rounded-md text-sm text-muted hover:text-text hover:border-accent/60 transition-colors"
        >
          Create Subscription
        </button>
      </div>
    </div>
  )
}
