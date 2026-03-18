import { useEffect, useState } from 'react'
import { clearStoredToken, getAuthStatus, getStoredToken, setStoredToken } from '../lib/api'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'

type AuthState = 'loading' | 'not-required' | 'needs-token' | 'authenticated'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAuthStatus()
      .then((s) => {
        if (!s.required) {
          setState('not-required')
          return
        }
        // Auth is required -- check if we already have a valid token
        const stored = getStoredToken()
        if (stored) {
          // Verify the stored token works by hitting a protected endpoint
          fetch('/api/setup/status', {
            headers: { Authorization: `Bearer ${stored}` },
          }).then((res) => {
            setState(res.status === 401 ? 'needs-token' : 'authenticated')
            if (res.status === 401) clearStoredToken()
          })
        } else {
          setState('needs-token')
        }
      })
      .catch(() => {
        // Can't reach the server at all -- just render children and let it fail naturally
        setState('not-required')
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token.trim()) {
      setError('Token is required')
      return
    }

    // Verify the token
    const res = await fetch('/api/setup/status', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    })

    if (res.status === 401) {
      setError('Invalid token')
      return
    }

    setStoredToken(token.trim())
    setState('authenticated')
  }

  if (state === 'loading') return null
  if (state === 'not-required' || state === 'authenticated') return <>{children}</>

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <span className="text-accent">digarr</span>
          </CardTitle>
          <CardDescription>Enter your access token to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-reject">{error}</p>}
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
