type Session = {
  userId: number
  createdAt: number
}

// In-memory session store. Acceptable for a home/household app.
// Sessions are lost on restart (users just re-login).
const sessions = new Map<string, Session>()

// Default session TTL: 30 days
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function createSession(userId: number, token: string): void {
  sessions.set(token, { userId, createdAt: Date.now() })
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token)
  if (!session) return null
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token)
    return null
  }
  return session
}

export function deleteSession(token: string): void {
  sessions.delete(token)
}

export function clearUserSessions(userId: number): void {
  for (const [token, session] of sessions) {
    if (session.userId === userId) sessions.delete(token)
  }
}

/** Visible for testing. */
export function clearAllSessions(): void {
  sessions.clear()
}
