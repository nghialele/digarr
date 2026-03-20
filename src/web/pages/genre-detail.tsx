import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GenreInfo } from '../../core/genre/types'
import { ArtistThumb } from '../components/artist-thumb'
import { Skeleton } from '../components/ui/skeleton'
import type { LibraryArtist } from '../lib/api'
import { getGenre, warmArtists } from '../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenreDetail = GenreInfo & { subGenres: GenreInfo[]; libraryArtists: LibraryArtist[] }

type DetailTab = 'library' | 'recommended' | 'trending' | 'deep_cuts'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'library', label: 'In Your Library' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'trending', label: 'Trending' },
  { id: 'deep_cuts', label: 'Deep Cuts' },
]

// ---------------------------------------------------------------------------
// Library artist card
// ---------------------------------------------------------------------------

function LibraryArtistCard({ artist }: { artist: LibraryArtist }) {
  const genres = artist.genres ?? []
  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
      <ArtistThumb name={artist.name} imageUrl={artist.imageUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{artist.name}</p>
        {artist.disambiguation && (
          <p className="text-xs text-muted truncate">{artist.disambiguation}</p>
        )}
        {genres.length > 0 && (
          <p className="text-[10px] text-muted truncate mt-0.5">{genres.slice(0, 3).join(', ')}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
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

  const artists = data?.libraryArtists

  useEffect(() => {
    if (artists && artists.length > 0) {
      const mbids = artists.filter((a) => a.mbid).map((a) => a.mbid)
      if (mbids.length > 0) {
        warmArtists(mbids).catch(() => {}) // Fire-and-forget
      }
    }
  }, [artists])

  if (isLoading) return <DetailSkeleton />

  if (error || !data) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
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
          {data.libraryArtists.length} artist{data.libraryArtists.length !== 1 ? 's' : ''} in your
          library
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

        {/* Tab content */}
        {activeTab === 'library' ? (
          data.libraryArtists.length === 0 ? (
            <div className="py-12 text-center bg-surface border border-border rounded-lg">
              <p className="text-muted text-sm">No artists in your library for this genre.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                {data.libraryArtists.length} artist{data.libraryArtists.length !== 1 ? 's' : ''} in
                your library
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.libraryArtists.map((artist) => (
                  <LibraryArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="py-12 text-center bg-surface border border-border rounded-lg">
            <p className="text-muted text-sm">Coming soon</p>
          </div>
        )}
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
