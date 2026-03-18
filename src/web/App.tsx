import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { AuthGate } from './components/auth-gate'
import { getSetupStatus, triggerPipeline } from './lib/api'
import { AnalyticsPage } from './pages/analytics'
import { Dashboard } from './pages/dashboard'
import { DiscoverPage } from './pages/discover'
import { SettingsPage } from './pages/settings'
import { SetupWizard } from './pages/setup'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold text-accent">digarr</span>
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? 'text-text' : 'text-muted hover:text-text')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/discover"
            className={({ isActive }) => (isActive ? 'text-text' : 'text-muted hover:text-text')}
          >
            Discover
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) => (isActive ? 'text-text' : 'text-muted hover:text-text')}
          >
            Analytics
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'text-text' : 'text-muted hover:text-text')}
          >
            Settings
          </NavLink>
        </div>
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
          className="px-4 py-1.5 bg-accent text-bg rounded-md text-sm font-medium hover:opacity-90"
        >
          Run Scan
        </button>
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
  )
}
