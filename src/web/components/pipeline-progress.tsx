import { useCallback } from 'react'
import { getPipelineStatus } from '../lib/api'
import { useFetch, useSSE } from '../lib/hooks'

type PipelineStatus = {
  running: boolean
  stage?: string
  progress?: { current: number; total: number }
}

type SSEProgress = {
  stage: string
  current?: number
  total?: number
  message?: string
}

const STAGES = ['collect', 'analyze', 'discover', 'resolve', 'score', 'filter', 'store', 'complete']

function stageIndex(stage: string): number {
  const idx = STAGES.indexOf(stage)
  return idx === -1 ? 0 : idx
}

export function PipelineProgress() {
  const fetcher = useCallback(() => getPipelineStatus(), [])
  const { data: status } = useFetch<PipelineStatus>(fetcher)
  const { data: sseData } = useSSE('/api/pipeline/events')

  const progress = sseData as SSEProgress | null
  const isRunning = status?.running ?? false

  if (!isRunning && !progress) return null

  const stage = progress?.stage ?? status?.stage ?? 'collect'
  const stageIdx = stageIndex(stage)
  const pct = Math.round(((stageIdx + 1) / STAGES.length) * 100)

  const isResolve = stage === 'resolve'
  const current = progress?.current ?? status?.progress?.current
  const total = progress?.total ?? status?.progress?.total

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text uppercase tracking-wide">{stage}</span>
        {isResolve && current !== undefined && total !== undefined ? (
          <span className="text-xs text-muted">
            {current}/{total}
          </span>
        ) : (
          <span className="text-xs text-muted">{pct}%</span>
        )}
      </div>
      <div className="w-full bg-bg rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress?.message && <p className="text-xs text-muted">{progress.message}</p>}
    </div>
  )
}
