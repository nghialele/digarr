import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Compass,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Music,
  RefreshCw,
  Settings,
  Sun,
  User,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { VERSION } from '@/version'
import { AuthGate } from './components/auth-gate'
import { BottomNav } from './components/bottom-nav'
import { KeyboardShortcuts } from './components/keyboard-shortcuts'
import { PreviewPlayer } from './components/preview-player'
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { usePreview } from './hooks/use-preview'
import {
  AUTH_EXPIRED_EVENT,
  clearStoredToken,
  getCurrentUser,
  getPipelineStatus,
  getSetupStatus,
  logoutUser,
  triggerPipeline,
} from './lib/api'
import { PreviewContext } from './lib/preview-context'
import { queryClient } from './lib/query-client'
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from './lib/theme'
import { AnalyticsPage } from './pages/analytics'
import { Dashboard } from './pages/dashboard'
import { DiscoverPage } from './pages/discover'
import { GenreDetailPage } from './pages/genre-detail'
import { GenresPage } from './pages/genres'
import { LibraryHealthPage } from './pages/library-health'
import { SettingsPage } from './pages/settings'
import { SetupWizard } from './pages/setup'
import { UserManagementPage } from './pages/user-management'

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// ---------------------------------------------------------------------------
// Mobile nav toggle
// ---------------------------------------------------------------------------

function MobileMenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="w-6 h-6 text-text"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      role="img"
      aria-label={open ? 'Close menu' : 'Open menu'}
    >
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']
const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const
const THEME_LABELS = { dark: 'Dark', light: 'Light', system: 'System' } as const

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const Icon = THEME_ICONS[theme]
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length] ?? 'dark'
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className="p-1.5 text-muted hover:text-text transition-colors"
      aria-label={`Theme: ${THEME_LABELS[theme]}. Click for ${THEME_LABELS[next]}`}
      title={`${THEME_LABELS[theme]} theme`}
    >
      <Icon size={18} />
    </button>
  )
}

function UserMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleLogout() {
    try {
      await logoutUser()
    } catch {
      // Session might already be invalid
    }
    clearStoredToken()
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 p-1.5 text-muted hover:text-text transition-colors"
        title={username}
      >
        <User size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-text truncate">{username}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigate('/settings')
              setOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-text hover:bg-bg transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-text hover:bg-bg transition-colors"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const preview = usePreview()
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })
  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipelineStatus'],
    queryFn: getPipelineStatus,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : 15000),
  })
  const pipelineRunning = pipelineStatus?.running ?? false

  useKeyboardShortcuts({ '?': () => setShortcutsOpen((v) => !v) })

  function handleThemeChange(t: Theme) {
    setThemeState(t)
    setStoredTheme(t)
    applyTheme(t)
  }

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'text-text' : 'text-muted hover:text-text'

  return (
    <PreviewContext.Provider
      value={{
        play: preview.play,
        stop: preview.stop,
        hasPreview: preview.hasPreview,
        currentMbid: preview.state.artistMbid,
        playing: preview.state.playing,
      }}
    >
      <div className="min-h-screen bg-bg">
        <nav className="border-b border-border px-4 sm:px-6 py-3" aria-label="Main navigation">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="text-xl font-bold text-accent hover:opacity-90">
                digarr
              </NavLink>
              {/* Desktop nav links */}
              <div className="hidden sm:flex items-center gap-6">
                <NavLink to="/" end className={navLinkClass}>
                  <span className="flex items-center gap-1">
                    <LayoutDashboard size={14} aria-hidden="true" />
                    Dashboard
                  </span>
                </NavLink>
                <NavLink to="/discover" className={navLinkClass}>
                  <span className="flex items-center gap-1">
                    <Compass size={14} aria-hidden="true" />
                    Discover
                  </span>
                </NavLink>
                <NavLink to="/genres" className={navLinkClass}>
                  <span className="flex items-center gap-1">
                    <Music size={14} aria-hidden="true" />
                    Genres
                  </span>
                </NavLink>
                {currentUser?.isAdmin && (
                  <NavLink to="/library/health" className={navLinkClass}>
                    <span className="flex items-center gap-1">
                      <HeartPulse size={14} aria-hidden="true" />
                      Library
                    </span>
                  </NavLink>
                )}
                {currentUser?.isAdmin && (
                  <NavLink to="/analytics" className={navLinkClass}>
                    <span className="flex items-center gap-1">
                      <BarChart3 size={14} aria-hidden="true" />
                      Analytics
                    </span>
                  </NavLink>
                )}
                <NavLink to="/settings" className={navLinkClass}>
                  <span className="flex items-center gap-1">
                    <Settings size={14} aria-hidden="true" />
                    Settings
                  </span>
                </NavLink>
                {currentUser?.isAdmin && (
                  <NavLink to="/users" className={navLinkClass}>
                    <span className="flex items-center gap-1">
                      <Users size={14} aria-hidden="true" />
                      Users
                    </span>
                  </NavLink>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onChange={handleThemeChange} />
              {currentUser && <UserMenu username={currentUser.username} />}
              <button
                type="button"
                disabled={!!pipelineRunning}
                onClick={() =>
                  triggerPipeline()
                    .then(() => toast.success('Scan started -- check Dashboard for progress'))
                    .catch((err) => {
                      const msg = err instanceof Error ? err.message : 'Failed to start scan'
                      toast.error(msg.includes('409') ? 'Scan already running' : msg)
                    })
                }
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-accent text-bg rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {pipelineRunning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="hidden sm:inline">Scanning...</span>
                    <span className="sm:hidden">Scan</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Run Scan</span>
                    <span className="sm:hidden">Scan</span>
                  </>
                )}
              </button>
              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="sm:hidden p-1"
                aria-label="Toggle menu"
              >
                <MobileMenuIcon open={menuOpen} />
              </button>
            </div>
          </div>
          {/* Mobile nav dropdown */}
          {menuOpen && (
            <div className="sm:hidden flex flex-col gap-3 pt-3 pb-1">
              <NavLink to="/" end className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard size={14} aria-hidden="true" />
                  Dashboard
                </span>
              </NavLink>
              <NavLink to="/discover" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <span className="flex items-center gap-1.5">
                  <Compass size={14} aria-hidden="true" />
                  Discover
                </span>
              </NavLink>
              <NavLink to="/genres" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <span className="flex items-center gap-1.5">
                  <Music size={14} aria-hidden="true" />
                  Genres
                </span>
              </NavLink>
              {currentUser?.isAdmin && (
                <NavLink
                  to="/library/health"
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="flex items-center gap-1.5">
                    <HeartPulse size={14} aria-hidden="true" />
                    Library
                  </span>
                </NavLink>
              )}
              {currentUser?.isAdmin && (
                <NavLink
                  to="/analytics"
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="flex items-center gap-1.5">
                    <BarChart3 size={14} aria-hidden="true" />
                    Analytics
                  </span>
                </NavLink>
              )}
              <NavLink to="/settings" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <span className="flex items-center gap-1.5">
                  <Settings size={14} aria-hidden="true" />
                  Settings
                </span>
              </NavLink>
              {currentUser?.isAdmin && (
                <NavLink to="/users" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                  <span className="flex items-center gap-1.5">
                    <Users size={14} aria-hidden="true" />
                    Users
                  </span>
                </NavLink>
              )}
            </div>
          )}
        </nav>
        {/* Main content -- add pb-16 on mobile so bottom nav doesn't overlap */}
        <main className="pb-16 md:pb-0">{children}</main>
        <BottomNav />
        <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <PreviewPlayer
          playing={preview.state.playing}
          artistName={preview.state.artistName}
          source={preview.state.source}
          loading={preview.state.loading}
          onStop={preview.stop}
        />
        <footer className="hidden md:block fixed bottom-2 right-3 text-[10px] text-muted select-none pointer-events-none z-10">
          v{VERSION}
        </footer>
      </div>
    </PreviewContext.Provider>
  )
}

// Inner app -- only mounts after AuthGate has resolved auth
function InnerApp() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)

  useEffect(() => {
    getSetupStatus()
      .then((s) => setSetupComplete(s.setupComplete))
      .catch(() => setSetupComplete(false))
  }, [])

  if (setupComplete === null) return null

  if (!setupComplete) {
    return (
      <>
        <SetupWizard onComplete={() => setSetupComplete(true)} />
        <Toaster theme="system" />
      </>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/genres" element={<GenresPage />} />
            <Route path="/genres/:slug" element={<GenreDetailPage />} />
            <Route path="/library/health" element={<LibraryHealthPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AppShell>
        <Toaster theme="system" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export function App() {
  // Apply theme immediately on mount (before first render flicker)
  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  return (
    <AuthGate>
      <InnerApp />
    </AuthGate>
  )
}
