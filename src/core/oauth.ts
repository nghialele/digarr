import type { Database } from '@/db'
import { getOAuthToken, upsertOAuthToken } from '@/db/queries/oauth-tokens'

export type OAuthRefreshConfig = {
  tokenEndpoint: string
  clientId: string
  clientSecret: string
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

export async function getValidToken(
  db: Database,
  userId: number,
  provider: string,
  refreshConfig: OAuthRefreshConfig,
): Promise<string | null> {
  const token = await getOAuthToken(db, userId, provider)
  if (!token) return null

  const now = new Date()
  const bufferExpiry = new Date(token.expiresAt.getTime() - EXPIRY_BUFFER_MS)

  if (now < bufferExpiry) {
    return token.accessToken
  }

  // Token expired or about to expire -- refresh it
  if (!token.refreshToken) return null

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: refreshConfig.clientId,
    client_secret: refreshConfig.clientSecret,
  })

  const res = await fetch(refreshConfig.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[oauth] Token refresh failed for ${provider}: ${res.status} ${body}`)
    return null
  }

  const data = (await res.json()) as TokenResponse
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  await upsertOAuthToken(db, {
    userId,
    provider,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? token.refreshToken,
    expiresAt,
  })

  return data.access_token
}
