import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { getSetupStatus, triggerPipeline } from './lib/api'
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
            to="/settings"
            className={({ isActive }) => (isActive ? 'text-text' : 'text-muted hover:text-text')}
          >
            Settings
          </NavLink>
        </div>
        <button
          type="button"
          onClick={() => triggerPipeline().catch(console.error)}
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
      <>
        <SetupWizard onComplete={() => setSetupComplete(true)} />
        <Toaster theme="dark" />
      </>
    )
  }

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppShell>
      <Toaster theme="dark" />
    </BrowserRouter>
  )
}
