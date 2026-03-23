import { eq } from 'drizzle-orm'
import { decryptFields, encryptFields, SENSITIVE_TARGET_CONFIG } from '@/core/crypto'
import type { Database } from '@/db'
import { targets } from '@/db/schema'

export type TargetInsert = {
  type: string
  name: string
  config: Record<string, unknown>
  userId?: number | null
  enabled?: boolean
}

export type TargetUpdate = Partial<Pick<TargetInsert, 'name' | 'config' | 'enabled'>>

export type TargetRow = typeof targets.$inferSelect

function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  return encryptFields(config, SENSITIVE_TARGET_CONFIG)
}

function decryptConfig<T extends { config: Record<string, unknown> | unknown }>(row: T): T {
  if (row.config && typeof row.config === 'object') {
    return {
      ...row,
      config: decryptFields(row.config as Record<string, unknown>, SENSITIVE_TARGET_CONFIG),
    }
  }
  return row
}

export async function createTarget(db: Database, data: TargetInsert): Promise<{ id: number }> {
  const [row] = await db
    .insert(targets)
    .values({
      type: data.type,
      name: data.name,
      config: encryptConfig(data.config),
      userId: data.userId ?? null,
      enabled: data.enabled ?? true,
    })
    .returning({ id: targets.id })
  if (!row) throw new Error('createTarget: no row returned')
  return { id: row.id }
}

export async function getTarget(db: Database, id: number): Promise<TargetRow | null> {
  const [row] = await db.select().from(targets).where(eq(targets.id, id))
  return row ? decryptConfig(row) : null
}

export async function getTargetsByUser(db: Database, userId: number): Promise<TargetRow[]> {
  const rows = await db.select().from(targets).where(eq(targets.userId, userId))
  return rows.map(decryptConfig)
}

export async function getAllTargets(db: Database): Promise<TargetRow[]> {
  const rows = await db.select().from(targets)
  return rows.map(decryptConfig)
}

export async function getTargetsByType(db: Database, type: string): Promise<TargetRow[]> {
  const rows = await db.select().from(targets).where(eq(targets.type, type))
  return rows.map(decryptConfig)
}

export async function updateTarget(db: Database, id: number, data: TargetUpdate): Promise<void> {
  const encrypted = data.config ? { ...data, config: encryptConfig(data.config) } : data
  await db
    .update(targets)
    .set({ ...encrypted, updatedAt: new Date() })
    .where(eq(targets.id, id))
}

export async function deleteTarget(db: Database, id: number): Promise<void> {
  await db.delete(targets).where(eq(targets.id, id))
}
