export type HonoEnv = {
  Variables: {
    userId?: number
    proxyAuth?: boolean
    sessionToken?: string
    /** True when auth middleware determined no auth is configured (no users, no legacy token). */
    authSkipped?: boolean
  }
}
