import { useState } from 'react'

type CronPickerProps = {
  value: string
  onChange: (cron: string) => void
}

const PRESETS = [
  { label: 'Daily (midnight)', cron: '0 0 * * *' },
  { label: 'Every Monday', cron: '0 8 * * 1' },
  { label: 'Every Sunday', cron: '0 8 * * 0' },
  { label: 'Twice a week (Mon + Thu)', cron: '0 8 * * 1,4' },
  { label: 'Every 2 weeks (1st + 15th)', cron: '0 8 1,15 * *' },
  { label: 'Monthly (1st)', cron: '0 8 1 * *' },
] as const

export function CronPicker({ value, onChange }: CronPickerProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>(
    PRESETS.some((p) => p.cron === value) ? 'preset' : 'custom',
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('preset')}
          className={`px-3 py-1 rounded text-sm ${
            mode === 'preset'
              ? 'bg-accent text-bg'
              : 'bg-surface border border-border text-muted hover:text-text'
          }`}
        >
          Preset
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`px-3 py-1 rounded text-sm ${
            mode === 'custom'
              ? 'bg-accent text-bg'
              : 'bg-surface border border-border text-muted hover:text-text'
          }`}
        >
          Custom
        </button>
      </div>

      {mode === 'preset' ? (
        <div className="grid gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.cron}
              type="button"
              onClick={() => onChange(preset.cron)}
              className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                value === preset.cron
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-surface border border-border text-text hover:border-accent/40'
              }`}
            >
              <span className="font-medium">{preset.label}</span>
              <span className="text-muted text-xs ml-2">({preset.cron})</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0 8 * * 1"
            className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-muted">
            Standard cron: minute hour day-of-month month day-of-week
          </p>
        </div>
      )}

      <div className="text-xs text-muted">
        Current: <code className="bg-surface px-1 py-0.5 rounded">{value || 'none'}</code>
      </div>
    </div>
  )
}
