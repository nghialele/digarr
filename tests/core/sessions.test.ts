import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAllSessions,
  clearUserSessions,
  createSession,
  deleteSession,
  getSession,
} from '@/core/sessions'

afterEach(async () => {
  await clearAllSessions()
})

describe('session store', () => {
  it('stores and retrieves a session', async () => {
    await createSession(42, 'token-abc')
    const session = await getSession('token-abc')
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(42)
  })

  it('returns null for unknown token', async () => {
    expect(await getSession('nonexistent')).toBeNull()
  })

  it('deletes a session', async () => {
    await createSession(1, 'token-del')
    await deleteSession('token-del')
    expect(await getSession('token-del')).toBeNull()
  })

  it('clears all sessions for a user', async () => {
    await createSession(1, 'token-a')
    await createSession(1, 'token-b')
    await createSession(2, 'token-c')

    await clearUserSessions(1)

    expect(await getSession('token-a')).toBeNull()
    expect(await getSession('token-b')).toBeNull()
    expect(await getSession('token-c')).not.toBeNull()
  })

  it('clearAllSessions removes everything', async () => {
    await createSession(1, 'token-1')
    await createSession(2, 'token-2')

    await clearAllSessions()

    expect(await getSession('token-1')).toBeNull()
    expect(await getSession('token-2')).toBeNull()
  })
})
