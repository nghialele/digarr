import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { SearchResultCard } from '../components/search-result-card'
import { searchArtists } from '../lib/api'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// Source filter config
// ---------------------------------------------------------------------------

const SOURCES = [
  { id: 'spotify', label: 'Spotify', active: 'bg-green-500/20 text-green-400 border-green-500/40' },
  { id: 'deezer', label: 'Deezer', active: 'bg-pink-500/20 text-pink-400 border-pink-500/40' },
  {
    id: 'musicbrainz',
    label: 'MusicBrainz',
    active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  },
  { id: 'tidal', label: 'TIDAL', active: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  {
    id: 'bandcamp',
    label: 'Bandcamp',
    active: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  },
]

// ---------------------------------------------------------------------------
// SearchPage
// ---------------------------------------------------------------------------

export function SearchPage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [activeSources, setActiveSources] = useState<string[]>([])

  function toggleSource(id: string) {
    setActiveSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', deferredQuery, activeSources],
    queryFn: () => searchArtists(deferredQuery, activeSources.length ? activeSources : undefined),
    enabled: deferredQuery.length >= 2,
    staleTime: 30_000,
  })

  const results = data?.results ?? []
  const showResults = deferredQuery.length >= 2
  const isPending = query !== deferredQuery || isLoading

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text mb-1">Search</h1>
        <p className="text-sm text-muted">Find artists across music platforms</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <SearchIcon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="search"
          placeholder="Search artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-lg text-text placeholder:text-muted text-sm focus:outline-none focus:border-accent transition-colors"
          autoFocus
        />
      </div>

      {/* Source filter toggles */}
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => {
          const isActive = activeSources.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSource(s.id)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                isActive
                  ? s.active
                  : 'bg-surface border-border text-muted hover:text-text hover:border-accent/40',
              )}
            >
              {s.label}
            </button>
          )
        })}
        {activeSources.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveSources([])}
            className="text-xs px-2.5 py-1 rounded-full border border-border text-muted hover:text-text transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results area */}
      {!showResults && (
        <p className="text-sm text-muted text-center pt-8">Type at least 2 characters to search</p>
      )}

      {showResults && isPending && (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <div
              key={i}
              className="bg-surface border border-border rounded-lg p-3 h-20 animate-pulse"
            />
          ))}
        </div>
      )}

      {showResults && !isPending && isError && (
        <p className="text-sm text-reject text-center pt-8">Search failed -- try again</p>
      )}

      {showResults && !isPending && !isError && results.length === 0 && (
        <p className="text-sm text-muted text-center pt-8">
          No artists found for &ldquo;{deferredQuery}&rdquo;
        </p>
      )}

      {showResults && !isPending && results.length > 0 && (
        <div className="grid gap-2">
          {results.map((result) => (
            <SearchResultCard key={result.mbid ?? result.name} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
