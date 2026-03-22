import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PlaylistCard } from '../components/playlist-card'
import { PlaylistForm } from '../components/playlist-form'
import { Skeleton } from '../components/ui/skeleton'
import {
  createPlaylistApi,
  getPlaylistScheduler,
  getPlaylists,
  type PlaylistInsert,
  type PlaylistRow,
  updatePlaylistApi,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNextRun(nextRun: string | null): string {
  if (!nextRun) return 'No schedule configured'
  const date = new Date(nextRun)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs < 0) return 'Overdue'
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `Next run in ${days}d`
  }
  if (hours > 0) return `Next run in ${hours}h ${minutes}m`
  return `Next run in ${minutes}m`
}

// ---------------------------------------------------------------------------
// Skeleton grid
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <Skeleton className="h-7 w-24 rounded" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlaylistsPage
// ---------------------------------------------------------------------------

export function PlaylistsPage() {
  const queryClient = useQueryClient()
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistRow | null>(null)

  const { data: playlists = [], isLoading } = useQuery<PlaylistRow[]>({
    queryKey: ['playlists'],
    queryFn: getPlaylists,
  })

  const { data: schedulerInfo } = useQuery<{ nextRun: string | null }>({
    queryKey: ['playlists', 'scheduler'],
    queryFn: getPlaylistScheduler,
  })

  function openCreate() {
    setEditingPlaylist(null)
    setFormMode('create')
  }

  function openEdit(playlist: PlaylistRow) {
    setEditingPlaylist(playlist)
    setFormMode('edit')
  }

  function closeForm() {
    setFormMode(null)
    setEditingPlaylist(null)
  }

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['playlists'] })
  }

  async function handleSave(data: PlaylistInsert) {
    try {
      if (formMode === 'edit' && editingPlaylist) {
        await updatePlaylistApi(editingPlaylist.id, data)
        toast.success('Playlist updated')
      } else {
        await createPlaylistApi(data)
        toast.success('Playlist created')
      }
      closeForm()
      refetch()
    } catch {
      toast.error(formMode === 'edit' ? 'Failed to update playlist' : 'Failed to create playlist')
    }
  }

  const isEmpty = !isLoading && playlists.length === 0

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text">Playlists</h1>
          <p className="text-xs text-muted mt-0.5">
            {schedulerInfo
              ? formatNextRun(schedulerInfo.nextRun)
              : 'Automatic music digest generation'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus size={15} aria-hidden="true" />
          Create Playlist
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonGrid />
      ) : isEmpty ? (
        <div className="py-20 text-center space-y-4">
          <p className="text-muted text-sm max-w-sm mx-auto">
            No playlists yet. Create your first playlist to automatically receive curated music
            digests.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} aria-hidden="true" />
            Create Playlist
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onEdit={() => openEdit(playlist)}
                onRefetch={refetch}
              />
            ))}
          </div>
        </>
      )}

      {/* Create / Edit modal */}
      {formMode && (
        <PlaylistForm
          playlist={editingPlaylist ?? undefined}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}
    </div>
  )
}
