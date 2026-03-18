import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAllSessions,
  clearUserSessions,
  createSession,
  deleteSession,
  getSession,
} from '@/core/sessions'

afterEach(() => {
  clearAllSessions()
})

describe('session store', () => {
  it('stores and retrieves a session', () => {
    createSession(42, 'token-abc')
    const session = getSession('token-abc')
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(42)
  })

  it('returns null for unknown token', () => {
    expect(getSession('nonexistent')).toBeNull()
  })

  it('deletes a session', () => {
    createSession(1, 'token-del')
    deleteSession('token-del')
    expect(getSession('token-del')).toBeNull()
  })

  it('clears all sessions for a user', () => {
    createSession(1, 'token-a')
    createSession(1, 'token-b')
    createSession(2, 'token-c')

    clearUserSessions(1)

    expect(getSession('token-a')).toBeNull()
    expect(getSession('token-b')).toBeNull()
    expect(getSession('token-c')).not.toBeNull()
  })

  it('clearAllSessions removes everything', () => {
    createSession(1, 'token-1')
    createSession(2, 'token-2')

    clearAllSessions()

    expect(getSession('token-1')).toBeNull()
    expect(getSession('token-2')).toBeNull()
  })
})
