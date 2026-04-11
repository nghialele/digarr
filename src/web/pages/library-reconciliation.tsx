import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { LibraryUnreconciledAlbumRowComponent } from '../components/library-unreconciled-album-row'
import { LibraryUnreconciledRowComponent } from '../components/library-unreconciled-row'
import { getLibraryUnreconciled, getLibraryUnreconciledAlbums } from '../lib/api'
import { useI18n } from '../lib/i18n'

const ALBUMS_PER_PAGE = 20

export function LibraryReconciliationPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [albumPage, setAlbumPage] = useState(1)
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ['library', 'unreconciled'],
    queryFn: getLibraryUnreconciled,
  })
  const {
    data: albumData,
    error: albumError,
    isError: isAlbumError,
    isLoading: isAlbumLoading,
  } = useQuery({
    queryKey: ['library', 'unreconciled-albums'],
    queryFn: getLibraryUnreconciledAlbums,
  })

  const items = data?.items ?? []
  const albumItems = albumData?.items ?? []
  const albumTotal = albumItems.length
  const albumPageCount = Math.max(1, Math.ceil(albumTotal / ALBUMS_PER_PAGE))

  useEffect(() => {
    if (albumPage > albumPageCount) setAlbumPage(albumPageCount)
  }, [albumPage, albumPageCount])

  const albumPageStart = (albumPage - 1) * ALBUMS_PER_PAGE
  const albumPageItems = albumItems.slice(albumPageStart, albumPageStart + ALBUMS_PER_PAGE)
  const grouped = new Map<string, typeof items>()

  for (const row of items) {
    const list = grouped.get(row.source) ?? []
    list.push(row)
    grouped.set(row.source, list)
  }

  function handleResolved() {
    queryClient.invalidateQueries({ queryKey: ['library', 'unreconciled'] })
    queryClient.invalidateQueries({ queryKey: ['library', 'unreconciled-albums'] })
    queryClient.invalidateQueries({ queryKey: ['library', 'sources'] })
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-text">{t('libraryReconciliation.title')}</h1>
        <p className="text-sm text-muted">
          {isLoading
            ? t('libraryReconciliation.loadingArtists')
            : `${items.length} ${t('libraryReconciliation.artistsCouldNotBeMatched')}`}
        </p>
      </div>

      {isLoading && (
        <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
          {t('libraryReconciliation.loadingArtists')}
        </div>
      )}

      {isError && (
        <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center space-y-2">
          <div className="text-sm text-text">{t('libraryReconciliation.couldNotLoadArtists')}</div>
          <div className="text-sm text-muted">
            {error instanceof Error ? error.message : t('common.unknownError')}
          </div>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
          {t('libraryReconciliation.noArtists')}
        </div>
      )}

      {!isError &&
        [...grouped.entries()].map(([source, rows]) => (
          <section key={source} className="space-y-3">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
              {source} ({rows.length})
            </h2>
            <div className="space-y-2">
              {rows.map((row) => (
                <LibraryUnreconciledRowComponent
                  key={row.id}
                  row={row}
                  onResolved={handleResolved}
                />
              ))}
            </div>
          </section>
        ))}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text">{t('libraryReconciliation.albumsTitle')}</h2>
          <p className="text-sm text-muted">
            {isAlbumLoading
              ? t('libraryReconciliation.loadingAlbums')
              : `${albumTotal} ${t('libraryReconciliation.albumsCouldNotBeMatched')}`}
          </p>
        </div>

        {isAlbumLoading && (
          <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
            {t('libraryReconciliation.loadingAlbums')}
          </div>
        )}

        {isAlbumError && (
          <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center space-y-2">
            <div className="text-sm text-text">{t('libraryReconciliation.couldNotLoadAlbums')}</div>
            <div className="text-sm text-muted">
              {albumError instanceof Error ? albumError.message : t('common.unknownError')}
            </div>
          </div>
        )}

        {!isAlbumLoading && !isAlbumError && albumItems.length === 0 && (
          <div className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted text-sm">
            {t('libraryReconciliation.noAlbums')}
          </div>
        )}

        {!isAlbumError && albumTotal > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              {albumPageItems.map((row) => (
                <LibraryUnreconciledAlbumRowComponent
                  key={row.id}
                  row={row}
                  onResolved={handleResolved}
                />
              ))}
            </div>

            {albumPageCount > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted">
                  {t('libraryReconciliation.showing')} {albumPageStart + 1}-
                  {Math.min(albumPageStart + ALBUMS_PER_PAGE, albumTotal)}{' '}
                  {t('libraryReconciliation.of')} {albumTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAlbumPage((p) => Math.max(1, p - 1))}
                    disabled={albumPage === 1}
                    className="px-2.5 py-1 text-xs font-medium text-text border border-border rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {t('common.previous')}
                  </button>
                  <span className="text-xs text-muted tabular-nums">
                    {t('libraryReconciliation.page')} {albumPage} / {albumPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlbumPage((p) => Math.min(albumPageCount, p + 1))}
                    disabled={albumPage === albumPageCount}
                    className="px-2.5 py-1 text-xs font-medium text-text border border-border rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
