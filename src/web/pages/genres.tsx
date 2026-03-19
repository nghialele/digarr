import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { GenreInfo } from '../../core/genre/types'
import { GenreGrid } from '../components/genre-grid'
import { Input } from '../components/ui/input'
import { getGenres, searchGenres, seedGenres } from '../lib/api'

export function GenresPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [seeding, setSeeding] = useState(false)

  // Debounce search input ~300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const isSearching = debouncedQuery.length >= 2

  const { data: libraryGenres = [], isLoading: libraryLoading } = useQuery<GenreInfo[]>({
    queryKey: ['genres', 'library'],
    queryFn: getGenres,
    enabled: !isSearching,
  })

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<GenreInfo[]>({
    queryKey: ['genres', 'search', debouncedQuery],
    queryFn: () => searchGenres(debouncedQuery),
    enabled: isSearching,
  })

  const genres = isSearching ? searchResults : libraryGenres
  const loading = isSearching ? searchLoading : libraryLoading
  const isEmpty = !loading && libraryGenres.length === 0 && !isSearching

  async function handleSeed() {
    setSeeding(true)
    try {
      const result = await seedGenres()
      toast.success(result.message ?? 'Genre seed started')
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['genres'] })
      }, 3000)
    } catch {
      toast.error('Failed to seed genres')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text">Genres</h1>
          <p className="text-xs text-muted mt-0.5">Browse genres from your library</p>
        </div>
        <Input
          type="search"
          placeholder="Search genres..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:w-64"
        />
      </div>

      {/* Empty state with seed button */}
      {isEmpty ? (
        <div className="py-16 text-center space-y-4">
          <p className="text-muted text-sm">No genres in your library yet.</p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-accent text-bg rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seeding ? 'Seeding...' : 'Seed genres from your library'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {isSearching ? (
            <p className="text-xs text-muted">
              {searchLoading
                ? 'Searching...'
                : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${debouncedQuery}"`}
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
                Your Library Genres
              </h2>
              {!loading && (
                <span className="text-xs text-muted">{libraryGenres.length} genres</span>
              )}
            </div>
          )}
          <GenreGrid genres={genres} loading={loading} />
        </div>
      )}
    </div>
  )
}
