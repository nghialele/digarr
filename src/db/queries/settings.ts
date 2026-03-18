import { eq } from 'drizzle-orm'
import { envSettingsOverrides } from '@/config/env'
import type { Database } from '@/db'
import type { Preferences } from '@/db/schema'
import { settings } from '@/db/schema'

type SettingsRow = typeof settings.$inferSelect
type SettingsPartial = Partial<Omit<SettingsRow, 'id' | 'createdAt' | 'updatedAt'>>

export type SetupConfig = {
  lidarrUrl: string
  lidarrApiKey: string
  skipTlsVerify?: boolean
  listenbrainzUsername?: string
  listenbrainzToken?: string
  lastfmUsername?: string
  lastfmApiKey?: string
  aiProvider?: string
  aiApiKey?: string
  aiModel?: string
  aiBaseUrl?: string
  preferences?: Preferences
}

export async function getSettings(db: Database): Promise<SettingsRow | null> {
  const rows = await db.select().from(settings).limit(1)
  const row = rows[0]
  if (!row) return null

  // Merge env var fallbacks for null fields
  const overrides = envSettingsOverrides()
  const merged = { ...row }
  for (const [key, value] of Object.entries(overrides)) {
    if ((merged as Record<string, unknown>)[key] == null) {
      ;(merged as Record<string, unknown>)[key] = value
    }
  }
  return merged
}

export async function updateSettings(db: Database, partial: SettingsPartial): Promise<void> {
  await db
    .update(settings)
    .set({ ...partial, updatedAt: new Date() })
    .where(eq(settings.id, 1))
}

export async function completeSetup(db: Database, config: SetupConfig): Promise<SettingsRow> {
  const rows = await db
    .insert(settings)
    .values({ ...config, setupComplete: true, id: 1 })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...config, setupComplete: true, updatedAt: new Date() },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('completeSetup: no row returned')
  return row
}

export async function isSetupComplete(db: Database): Promise<boolean> {
  const rows = await db.select({ setupComplete: settings.setupComplete }).from(settings).limit(1)
  return rows[0]?.setupComplete ?? false
}
