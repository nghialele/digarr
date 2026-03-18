// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
  },
}))

vi.mock('@/web/lib/api', () => ({
  getRecommendations: vi.fn(),
  updateRecommendation: vi.fn(),
  getBatches: vi.fn(),
  getRecentListens: vi.fn(),
  getLidarrStats: vi.fn(),
  quickDiscover: vi.fn(),
  getPipelineStatus: vi.fn(),
  getStoredToken: vi.fn(() => null),
}))

// Mock useSSE to avoid EventSource in jsdom
vi.mock('@/web/lib/hooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/web/lib/hooks')>()
  return {
    ...original,
    useSSE: vi.fn(() => ({ data: null, connected: false })),
  }
})

import {
  getBatches,
  getLidarrStats,
  getPipelineStatus,
  getRecentListens,
  getRecommendations,
} from '@/web/lib/api'
import { Dashboard } from '@/web/pages/dashboard'

const mockGetRecommendations = vi.mocked(getRecommendations)
const mockGetBatches = vi.mocked(getBatches)
const mockGetRecentListens = vi.mocked(getRecentListens)
const mockGetLidarrStats = vi.mocked(getLidarrStats)
const mockGetPipelineStatus = vi.mocked(getPipelineStatus)

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const pendingRec = {
  id: 1,
  score: 0.85,
  status: 'pending',
  artist: {
    id: 10,
    name: 'Sigur Ros',
    genres: ['post-rock', 'ambient'],
    tags: null,
    imageUrl: null,
    streamingUrls: null,
  },
}

function setupMocks() {
  // Pending recommendations (first call is pending, rest are for counts)
  mockGetRecommendations.mockImplementation((params) => {
    const p = params as Record<string, string> | undefined
    if (p?.status === 'pending') {
      return Promise.resolve({ items: [pendingRec], total: 1 })
    }
    return Promise.resolve({ items: [], total: 0 })
  })

  mockGetBatches.mockResolvedValue([
    { id: 1, status: 'completed', createdAt: new Date().toISOString() },
  ] as unknown[])

  mockGetRecentListens.mockResolvedValue({
    tracks: [
      { artist: 'Bon Iver', track: 'Holocene', source: 'listenbrainz' },
      { artist: 'Fleet Foxes', track: 'White Winter Hymnal', source: 'lastfm' },
    ],
  })

  mockGetLidarrStats.mockResolvedValue({ artists: 247, monitored: 200 })

  mockGetPipelineStatus.mockResolvedValue({ running: false })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders stat cards with library stats', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Lidarr Library')).toBeInTheDocument()
      expect(screen.getByText('247')).toBeInTheDocument()
      expect(screen.getByText('200 monitored')).toBeInTheDocument()
    })
  })

  it('renders pending count', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Pending Recs')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('renders recommendation with artist name and score', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Sigur Ros')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })

  it('renders recent listening activity', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Recent Listening Activity')).toBeInTheDocument()
      expect(screen.getByText('Bon Iver')).toBeInTheDocument()
      expect(screen.getByText('Holocene')).toBeInTheDocument()
      expect(screen.getByText('Fleet Foxes')).toBeInTheDocument()
    })
  })

  it('shows Find Similar buttons for recent listens', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      const buttons = screen.getAllByText('Find Similar')
      expect(buttons).toHaveLength(2)
    })
  })

  it('shows empty state when no pending recommendations', async () => {
    mockGetRecommendations.mockResolvedValue({ items: [], total: 0 })
    mockGetBatches.mockResolvedValue([])
    mockGetRecentListens.mockResolvedValue({ tracks: [] })
    mockGetLidarrStats.mockResolvedValue({ artists: 0, monitored: 0 })
    mockGetPipelineStatus.mockResolvedValue({ running: false })

    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/No pending recommendations/i)).toBeInTheDocument()
    })
  })

  it('renders last scan time', async () => {
    setupMocks()
    renderWithQuery(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Last Scan')).toBeInTheDocument()
      // "just now" since we set createdAt to now
      expect(screen.getByText('just now')).toBeInTheDocument()
    })
  })
})
