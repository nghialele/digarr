import { QueryClientProvider } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { AuthGate } from './components/auth-gate'
import { getSetupStatus, triggerPipeline } from './lib/api'
import { queryClient } from './lib/query-client'
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from './lib/theme'
import { AnalyticsPage } from './pages/analytics'
import { Dashboard } from './pages/dashboard'
import { DiscoverPage } from './pages/discover'
import { SettingsPage } from './pages/settings'
import { SetupWizard } from './pages/setup'

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

function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

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
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-xl font-bold text-accent hover:opacity-90">
              digarr
            </NavLink>
            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-6">
              <NavLink to="/" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/discover" className={navLinkClass}>
                Discover
              </NavLink>
              <NavLink to="/analytics" className={navLinkClass}>
                Analytics
              </NavLink>
              <NavLink to="/settings" className={navLinkClass}>
                Settings
              </NavLink>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onChange={handleThemeChange} />
            <button
              type="button"
              onClick={() =>
                triggerPipeline()
                  .then(() => toast.success('Scan started -- check Dashboard for progress'))
                  .catch((err) => {
                    const msg = err instanceof Error ? err.message : 'Failed to start scan'
                    toast.error(msg.includes('409') ? 'Scan already running' : msg)
                  })
              }
              className="px-3 sm:px-4 py-1.5 bg-accent text-bg rounded-md text-sm font-medium hover:opacity-90"
            >
              <span className="hidden sm:inline">Run Scan</span>
              <span className="sm:hidden">Scan</span>
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
            <NavLink to="/" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Dashboard
            </NavLink>
            <NavLink to="/discover" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Discover
            </NavLink>
            <NavLink to="/analytics" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Analytics
            </NavLink>
            <NavLink to="/settings" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Settings
            </NavLink>
          </div>
        )}
      </nav>
      <main>{children}</main>
    </div>
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
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
