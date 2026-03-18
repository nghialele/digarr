import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { AuthGate } from './components/auth-gate'
import { getSetupStatus, triggerPipeline } from './lib/api'
import { queryClient } from './lib/query-client'
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

function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'text-text' : 'text-muted hover:text-text'

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold text-accent">digarr</span>
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

export function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)

  useEffect(() => {
    getSetupStatus()
      .then((s) => setSetupComplete(s.setupComplete))
      .catch(() => setSetupComplete(false))
  }, [])

  if (setupComplete === null) return null

  if (!setupComplete) {
    return (
      <AuthGate>
        <SetupWizard onComplete={() => setSetupComplete(true)} />
        <Toaster theme="dark" />
      </AuthGate>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
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
          <Toaster theme="dark" />
        </BrowserRouter>
      </AuthGate>
    </QueryClientProvider>
  )
}
