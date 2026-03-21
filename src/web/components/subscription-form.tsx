import { useState } from 'react'
import { CronPicker } from './cron-picker'

export type SubscriptionFormData = {
  name: string
  sourceType: string
  sourceProvider: string
  sourceConfig: Record<string, unknown>
  cron: string
  enabled: boolean
  maxArtistsPerRun: number
  action: string
  scoreThreshold: number | null
  scoringWeightPreset: string
}

type SubscriptionFormProps = {
  initial?: Partial<SubscriptionFormData>
  onSubmit: (data: SubscriptionFormData) => Promise<void>
  onCancel: () => void
  mode: 'create' | 'edit'
}

const SOURCE_TYPES = [
  { value: 'genre', label: 'Genre', description: 'Discover artists in a specific genre' },
] as const

const SOURCE_PROVIDERS = [
  { value: 'lastfm', label: 'Last.fm' },
  { value: 'discogs', label: 'Discogs' },
] as const

const ACTIONS = [
  { value: 'add_to_recommendations', label: 'Add to recommendations' },
  { value: 'auto_approve', label: 'Auto-approve (above threshold)' },
  { value: 'auto_add_to_target', label: 'Auto-add to target' },
  { value: 'notify_only', label: 'Notify only (webhook)' },
] as const

const WEIGHT_PRESETS = [
  { value: 'default', label: 'Default' },
  { value: 'genre', label: 'Genre-optimized' },
] as const

export function SubscriptionForm({ initial, onSubmit, onCancel, mode }: SubscriptionFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceType] = useState(initial?.sourceType ?? 'genre')
  const [sourceProvider, setSourceProvider] = useState(initial?.sourceProvider ?? 'lastfm')
  const [genre, setGenre] = useState((initial?.sourceConfig?.genre as string) ?? '')
  const [cron, setCron] = useState(initial?.cron ?? '0 8 * * 0')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [maxArtists, setMaxArtists] = useState(initial?.maxArtistsPerRun ?? 20)
  const [action, setAction] = useState(initial?.action ?? 'add_to_recommendations')
  const [scoreThreshold, setScoreThreshold] = useState(initial?.scoreThreshold ?? null)
  const [weightPreset, setWeightPreset] = useState(initial?.scoringWeightPreset ?? 'genre')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!genre.trim()) {
      setError('Genre is required')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        sourceType,
        sourceProvider,
        sourceConfig: { genre: genre.trim() },
        cron,
        enabled,
        maxArtistsPerRun: maxArtists,
        action,
        scoreThreshold: action === 'auto_approve' ? (scoreThreshold ?? 0.7) : null,
        scoringWeightPreset: weightPreset,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create subscription' : 'Edit subscription'}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: modal content panel */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop-propagation prevents backdrop dismiss */}
      <div
        className="bg-bg border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text">
            {mode === 'create' ? 'Create Subscription' : 'Edit Subscription'}
          </h2>

          {error && (
            <div className="text-sm text-reject bg-reject/10 border border-reject/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="sub-name" className="block text-sm font-medium text-text mb-1">
              Name
            </label>
            <input
              id="sub-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Shoegaze Weekly"
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Source type badge */}
          <div>
            <span className="block text-sm font-medium text-text mb-1">Source Type</span>
            <div className="px-3 py-2 bg-surface border border-border rounded text-sm text-muted">
              {SOURCE_TYPES.find((t) => t.value === sourceType)?.label ?? sourceType}
              <span className="text-xs ml-2">
                ({SOURCE_TYPES.find((t) => t.value === sourceType)?.description})
              </span>
            </div>
          </div>

          {/* Genre input */}
          <div>
            <label htmlFor="sub-genre" className="block text-sm font-medium text-text mb-1">
              Genre
            </label>
            <input
              id="sub-genre"
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="shoegaze"
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Source provider */}
          <div>
            <label htmlFor="sub-provider" className="block text-sm font-medium text-text mb-1">
              Source
            </label>
            <select
              id="sub-provider"
              value={sourceProvider}
              onChange={(e) => setSourceProvider(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent focus:outline-none"
            >
              {SOURCE_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule */}
          <div>
            <span className="block text-sm font-medium text-text mb-1">Schedule</span>
            <CronPicker value={cron} onChange={setCron} />
          </div>

          {/* Max artists per run */}
          <div>
            <label htmlFor="sub-max" className="block text-sm font-medium text-text mb-1">
              Max artists per run
            </label>
            <input
              id="sub-max"
              type="number"
              min={1}
              max={100}
              value={maxArtists}
              onChange={(e) => setMaxArtists(Number(e.target.value))}
              className="w-24 px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent focus:outline-none"
            />
          </div>

          {/* Action */}
          <div>
            <label htmlFor="sub-action" className="block text-sm font-medium text-text mb-1">
              Action
            </label>
            <select
              id="sub-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent focus:outline-none"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Score threshold (for auto-approve action) */}
          {action === 'auto_approve' && (
            <div>
              <label htmlFor="sub-threshold" className="block text-sm font-medium text-text mb-1">
                Score threshold (0-1)
              </label>
              <input
                id="sub-threshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={scoreThreshold ?? 0.7}
                onChange={(e) => setScoreThreshold(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent focus:outline-none"
              />
            </div>
          )}

          {/* Weight preset */}
          <div>
            <label htmlFor="sub-preset" className="block text-sm font-medium text-text mb-1">
              Scoring preset
            </label>
            <select
              id="sub-preset"
              value={weightPreset}
              onChange={(e) => setWeightPreset(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent focus:outline-none"
            >
              {WEIGHT_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-border"
              id="sub-enabled"
            />
            <label htmlFor="sub-enabled" className="text-sm text-text">
              Enabled
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-muted hover:text-text border border-border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-accent text-bg rounded font-medium hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
