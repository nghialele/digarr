import { Hono } from 'hono'
import { generateSessionToken, hashPassword, verifyPassword } from '@/core/auth'
import { createSession, deleteSession } from '@/core/sessions'
import type { AppDependencies } from '@/server'

export function authRoutes(deps: AppDependencies) {
  const router = new Hono()

  // Register a new user. First user becomes admin.
  router.post('/api/auth/register', async (c) => {
    const body = await c.req.json()
    const { username, password } = body as { username?: string; password?: string }

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }
    if (username.length < 2 || username.length > 50) {
      return c.json({ error: 'Username must be 2-50 characters' }, 400)
    }
    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const existingUser = await deps.getUserByUsername(username)
    if (existingUser) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    const userCount = await deps.getUserCount()
    const isAdmin = userCount === 0

    const passwordHash = hashPassword(password)
    const user = await deps.createUser({ username, passwordHash, isAdmin })

    const token = generateSessionToken()
    createSession(user.id, token)

    return c.json({ user, token }, 201)
  })

  // Login with username + password
  router.post('/api/auth/login', async (c) => {
    const body = await c.req.json()
    const { username, password } = body as { username?: string; password?: string }

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const user = await deps.getUserByUsername(username)
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = generateSessionToken()
    createSession(user.id, token)

    const { passwordHash: _, ...publicUser } = user
    return c.json({ user: publicUser, token })
  })

  // Logout (invalidate session token)
  router.post('/api/auth/logout', (c) => {
    const header = c.req.header('Authorization')
    if (header?.startsWith('Bearer ')) {
      deleteSession(header.slice(7))
    }
    return c.json({ ok: true })
  })

  // Get current user from session token
  router.get('/api/auth/me', async (c) => {
    // The user is set on the context by the auth middleware
    const userId = c.get('userId' as never) as number | undefined
    if (!userId) {
      return c.json({ error: 'Not authenticated' }, 401)
    }
    const user = await deps.getUserById(userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    return c.json(user)
  })

  return router
}
