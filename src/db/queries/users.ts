import { count, eq } from 'drizzle-orm'
import type { Database } from '@/db'
import type { Preferences } from '@/db/schema'
import { users } from '@/db/schema'

type UserRow = typeof users.$inferSelect

export type UserPublic = Omit<UserRow, 'passwordHash'>

function toPublic(row: UserRow): UserPublic {
  const { passwordHash: _, ...rest } = row
  return rest
}

export async function createUser(
  db: Database,
  data: {
    username: string
    passwordHash: string
    isAdmin?: boolean
    email?: string
    oidcSubject?: string
    authProvider?: string
  },
): Promise<UserPublic> {
  const rows = await db
    .insert(users)
    .values({
      username: data.username,
      passwordHash: data.passwordHash,
      isAdmin: data.isAdmin ?? false,
      email: data.email,
      oidcSubject: data.oidcSubject,
      authProvider: data.authProvider ?? 'local',
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('createUser: no row returned')
  return toPublic(row)
}

export async function getUserByUsername(db: Database, username: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
  return rows[0] ?? null
}

export async function getUserById(db: Database, id: number): Promise<UserPublic | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  const row = rows[0]
  return row ? toPublic(row) : null
}

export async function getUserCount(db: Database): Promise<number> {
  const rows = await db.select({ total: count() }).from(users)
  return rows[0]?.total ?? 0
}

export async function updateUserPreferences(
  db: Database,
  userId: number,
  preferences: Preferences,
): Promise<void> {
  await db.update(users).set({ preferences }).where(eq(users.id, userId))
}

export async function listUsers(db: Database): Promise<UserPublic[]> {
  const rows = await db.select().from(users)
  return rows.map(toPublic)
}

export async function updatePassword(
  db: Database,
  id: number,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id))
}

export async function deleteUser(db: Database, id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

export async function getUserByOidcSubject(db: Database, subject: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.oidcSubject, subject)).limit(1)
  return rows[0] ?? null
}

export async function getUserByEmail(db: Database, email: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return rows[0] ?? null
}

export async function updateUser(
  db: Database,
  id: number,
  data: { isAdmin?: boolean; email?: string; oidcSubject?: string; authProvider?: string },
): Promise<void> {
  await db.update(users).set(data).where(eq(users.id, id))
}
