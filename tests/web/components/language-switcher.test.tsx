// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from '@/web/components/auth-gate'
import { App } from '@/web/App'
import { I18nProvider } from '@/web/lib/i18n'

vi.mock('@/web/lib/locale-storage', () => ({
  detectBrowserLocale: vi.fn(() => 'en'),
  getRequestLocale: vi.fn(() => 'en'),
  getStoredLocale: vi.fn(() => 'en'),
  setStoredLocale: vi.fn(),
}))

vi.mock('@/web/lib/api', () => ({
  AUTH_EXPIRED_EVENT: 'digarr:auth-expired',
  clearStoredToken: vi.fn(),
  getAuthStatus: vi.fn(),
  getCurrentUser: vi.fn(),
  getPipelineStatus: vi.fn(),
  getSetupStatus: vi.fn(),
  getStoredToken: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
  setStoredToken: vi.fn(),
  triggerPipeline: vi.fn(),
  updatePreferredLocale: vi.fn(),
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/web/components/bottom-nav', () => ({
  BottomNav: () => null,
}))

vi.mock('@/web/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/web/components/keyboard-shortcuts', () => ({
  KeyboardShortcuts: () => null,
}))

vi.mock('@/web/components/preview-player', () => ({
  PreviewPlayer: () => null,
}))

vi.mock('@/web/hooks/use-click-outside', () => ({
  useClickOutside: vi.fn(),
}))

vi.mock('@/web/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

vi.mock('@/web/hooks/use-preview', () => ({
  usePreview: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    hasPreview: false,
    state: {
      artistMbid: null,
      playing: false,
      artistName: '',
      source: '',
      loading: false,
    },
    globalPlayId: null,
  }),
}))

vi.mock('@/web/pages/analytics', () => ({ AnalyticsPage: () => <div>analytics</div> }))
vi.mock('@/web/pages/dashboard', () => ({ Dashboard: () => <div>dashboard</div> }))
vi.mock('@/web/pages/discover', () => ({ DiscoverPage: () => <div>discover</div> }))
vi.mock('@/web/pages/genre-detail', () => ({ GenreDetailPage: () => <div>genre detail</div> }))
vi.mock('@/web/pages/genres', () => ({ GenresPage: () => <div>genres</div> }))
vi.mock('@/web/pages/job-history', () => ({ default: () => <div>jobs</div> }))
vi.mock('@/web/pages/library-health', () => ({
  LibraryHealthPage: () => <div>library health</div>,
}))
vi.mock('@/web/pages/library-reconciliation', () => ({
  LibraryReconciliationPage: () => <div>library reconciliation</div>,
}))
vi.mock('@/web/pages/playlist-detail', () => ({
  PlaylistDetailPage: () => <div>playlist detail</div>,
}))
vi.mock('@/web/pages/playlists', () => ({ PlaylistsPage: () => <div>playlists</div> }))
vi.mock('@/web/pages/search', () => ({ SearchPage: () => <div>search</div> }))
vi.mock('@/web/pages/settings', () => ({ SettingsPage: () => <div>settings</div> }))
vi.mock('@/web/pages/setup', () => ({ SetupWizard: () => <div>setup</div> }))
vi.mock('@/web/pages/subscriptions', () => ({ default: () => <div>subscriptions</div> }))
vi.mock('@/web/pages/user-management', () => ({
  UserManagementPage: () => <div>users</div>,
}))

import {
  getAuthStatus,
  getCurrentUser,
  getPipelineStatus,
  getSetupStatus,
  getStoredToken,
} from '@/web/lib/api'

const mockGetAuthStatus = getAuthStatus as ReturnType<typeof vi.fn>
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>
const mockGetPipelineStatus = getPipelineStatus as ReturnType<typeof vi.fn>
const mockGetSetupStatus = getSetupStatus as ReturnType<typeof vi.fn>
const mockGetStoredToken = getStoredToken as ReturnType<typeof vi.fn>

function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nProvider>,
  )
}

function renderWithAppShell() {
  return renderWithProviders(<App />)
}

describe('language switcher surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    mockGetStoredToken.mockReturnValue(null)
    mockGetAuthStatus.mockResolvedValue({
      required: true,
      hasUsers: true,
      oidcEnabled: false,
    })
    mockGetCurrentUser.mockResolvedValue({
      id: 1,
      username: 'admin',
      isAdmin: true,
      preferredLocale: 'en',
    })
    mockGetPipelineStatus.mockResolvedValue({ running: false })
    mockGetSetupStatus.mockResolvedValue({ setupComplete: true })
  })

  it('renders a language switcher under the login form', async () => {
    renderWithProviders(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    )

    expect(await screen.findByLabelText('Language')).toBeInTheDocument()
  })

  it('renders a language switcher in the top bar for authenticated users', async () => {
    renderWithAppShell()

    expect(await screen.findByLabelText('Language')).toBeInTheDocument()
  })
})
