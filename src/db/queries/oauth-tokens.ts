import { and, eq, like } from 'drizzle-orm'
import type { Database } from '@/db'
import { oauthTokens } from '@/db/schema'

type OAuthTokenRow = typeof oauthTokens.$inferSelect
type OAuthTokenInsert = typeof oauthTokens.$inferInsert

export type { OAuthTokenInsert, OAuthTokenRow }

export async function getOAuthToken(
  db: Database,
  userId: number,
  provider: string,
): Promise<OAuthTokenRow | null> {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1)
  return row ?? null
}

export async function upsertOAuthToken(
  db: Database,
  data: OAuthTokenInsert,
): Promise<OAuthTokenRow> {
  const [row] = await db
    .insert(oauthTokens)
    .values(data)
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.provider],
      set: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertOAuthToken: no row returned')
  return row
}

/** Find a pending OAuth token by provider and opaque state (stored as `pending:{userId}:{state}`). */
export async function findPendingOAuthByState(
  db: Database,
  provider: string,
  state: string,
): Promise<OAuthTokenRow | null> {
  // Use SQL suffix match to avoid loading all pending tokens into memory.
  // The accessToken format is `pending:{userId}:{state}`.
  const rows = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.provider, provider), like(oauthTokens.accessToken, `%:${state}`)))
  // Verify the match is actually a pending token (not a coincidental suffix)
  const match = rows.find(
    (r) => r.accessToken.startsWith('pending:') && r.accessToken.endsWith(`:${state}`),
  )
  return match ?? null
}

export async function deleteOAuthToken(
  db: Database,
  userId: number,
  provider: string,
): Promise<void> {
  await db
    .delete(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
}
