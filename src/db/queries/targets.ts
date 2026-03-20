import { eq } from 'drizzle-orm'
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

export type TargetRow = {
  id: number
  type: string
  name: string
  config: Record<string, unknown>
  userId: number | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export async function createTarget(db: Database, data: TargetInsert): Promise<{ id: number }> {
  const [row] = await db
    .insert(targets)
    .values({
      type: data.type,
      name: data.name,
      config: data.config,
      userId: data.userId ?? null,
      enabled: data.enabled ?? true,
    })
    .returning({ id: targets.id })
  if (!row) throw new Error('createTarget: no row returned')
  return { id: row.id }
}

export async function getTarget(db: Database, id: number): Promise<TargetRow | null> {
  const [row] = await db.select().from(targets).where(eq(targets.id, id))
  return (row as TargetRow) ?? null
}

export async function getTargetsByUser(db: Database, userId: number): Promise<TargetRow[]> {
  const rows = await db.select().from(targets).where(eq(targets.userId, userId))
  return rows as TargetRow[]
}

export async function getTargetsByType(db: Database, type: string): Promise<TargetRow[]> {
  const rows = await db.select().from(targets).where(eq(targets.type, type))
  return rows as TargetRow[]
}

export async function updateTarget(db: Database, id: number, data: TargetUpdate): Promise<void> {
  await db
    .update(targets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(targets.id, id))
}

export async function deleteTarget(db: Database, id: number): Promise<void> {
  await db.delete(targets).where(eq(targets.id, id))
}
