// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock API and hooks
// ---------------------------------------------------------------------------

vi.mock('@/web/lib/api', () => ({
  getPipelineStatus: vi.fn(),
  getStoredToken: vi.fn(() => null),
}))

// Mock useSSE to avoid real EventSource in jsdom
vi.mock('@/web/lib/hooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/web/lib/hooks')>()
  return {
    ...original,
    useSSE: vi.fn(() => ({ data: null, connected: false })),
  }
})

import { PipelineProgress } from '@/web/components/pipeline-progress'
import { getPipelineStatus } from '@/web/lib/api'
import { useSSE } from '@/web/lib/hooks'

const mockGetPipelineStatus = vi.mocked(getPipelineStatus)
const mockUseSSE = vi.mocked(useSSE)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when pipeline is not running and no SSE data', async () => {
    mockGetPipelineStatus.mockResolvedValue({ running: false })
    mockUseSSE.mockReturnValue({ data: null, connected: false })

    const { container } = render(<PipelineProgress />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders stage label and percentage when pipeline is running', async () => {
    mockGetPipelineStatus.mockResolvedValue({ running: true, stage: 'analyze' })
    mockUseSSE.mockReturnValue({ data: null, connected: false })

    render(<PipelineProgress />)

    await waitFor(() => {
      expect(screen.getByText('Analyzing Taste')).toBeInTheDocument()
      // analyze is index 1, so (1+1)/8 = 25%
      expect(screen.getByText('25%')).toBeInTheDocument()
    })
  })

  it('renders SSE progress data with current/total counts', async () => {
    mockGetPipelineStatus.mockResolvedValue({ running: true, stage: 'collect' })
    mockUseSSE.mockReturnValue({
      data: { stage: 'resolve', current: 5, total: 20, message: 'Looking up artists...' },
      connected: true,
    })

    render(<PipelineProgress />)

    await waitFor(() => {
      expect(screen.getByText('Resolving via MusicBrainz')).toBeInTheDocument()
      expect(screen.getByText('5/20')).toBeInTheDocument()
      expect(screen.getByText('Looking up artists...')).toBeInTheDocument()
    })
  })

  it('shows complete stage label', async () => {
    mockGetPipelineStatus.mockResolvedValue({ running: true, stage: 'store' })
    mockUseSSE.mockReturnValue({
      data: { stage: 'complete' },
      connected: true,
    })

    render(<PipelineProgress />)

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  it('fires onComplete exactly once when stage reaches complete', async () => {
    const onComplete = vi.fn()
    mockGetPipelineStatus.mockResolvedValue({ running: true, stage: 'store' })
    mockUseSSE.mockReturnValue({
      data: { stage: 'complete' },
      connected: true,
    })

    const { rerender } = render(<PipelineProgress onComplete={onComplete} />)

    // The component uses setTimeout(onComplete, 500) -- advance timers
    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeInTheDocument()
    })
    vi.advanceTimersByTime(600)
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Re-render should NOT fire again
    rerender(<PipelineProgress onComplete={onComplete} />)
    vi.advanceTimersByTime(600)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

// Need afterEach import
import { afterEach } from 'vitest'
