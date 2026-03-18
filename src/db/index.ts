import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { buildDatabaseUrl } from '@/config/env'
import * as schema from './schema'

const pool = new pg.Pool({
  connectionString: buildDatabaseUrl(),
})

export const db = drizzle(pool, { schema })
export { pool }
export type Database = typeof db
