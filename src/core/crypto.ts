import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const PREFIX = 'enc:v1:'

let derivedKey: Buffer | null = null

/** Initialize encryption with a key string. Call once at startup. */
export function initEncryption(keyInput: string | undefined): void {
  if (!keyInput) {
    derivedKey = null
    return
  }
  derivedKey = createHash('sha256').update(keyInput).digest()
}

export function isEncryptionEnabled(): boolean {
  return derivedKey !== null
}

/** Encrypt a string value. Returns the original if encryption is disabled or value is null. */
export function encryptField(value: string | null | undefined): typeof value {
  if (value == null || !derivedKey) return value
  if (value.startsWith(PREFIX)) return value // already encrypted

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('base64')}.${encrypted.toString('base64')}.${tag.toString('base64')}`
}

/** Decrypt a string value. Returns plaintext as-is if not encrypted. Throws on wrong key. */
export function decryptField(value: string | null | undefined): typeof value {
  if (value == null) return value
  if (!value.startsWith(PREFIX)) return value // plaintext, not yet encrypted
  if (!derivedKey) {
    console.warn('[crypto] Encrypted value found but no encryption key configured')
    return value
  }

  const [ivStr, encStr, tagStr] = value.slice(PREFIX.length).split('.')
  if (!ivStr || !encStr || !tagStr) return value // malformed

  const iv = Buffer.from(ivStr, 'base64')
  const encrypted = Buffer.from(encStr, 'base64')
  const tag = Buffer.from(tagStr, 'base64')

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Encrypt specific string fields in an object. */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): T {
  if (!derivedKey) return obj
  const copy = { ...obj }
  for (const f of fields) {
    if (typeof copy[f] === 'string') {
      ;(copy as Record<string, unknown>)[f] = encryptField(copy[f] as string)
    }
  }
  return copy
}

/** Decrypt specific string fields in an object. */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): T {
  if (!derivedKey) return obj
  const copy = { ...obj }
  for (const f of fields) {
    if (typeof copy[f] === 'string') {
      ;(copy as Record<string, unknown>)[f] = decryptField(copy[f] as string)
    }
  }
  return copy
}

// Sensitive field lists per table
export const SENSITIVE_SETTINGS = ['lidarrApiKey', 'aiApiKey', 'oidcClientSecret'] as const
export const SENSITIVE_OAUTH = ['accessToken', 'refreshToken', 'clientSecret'] as const
export const SENSITIVE_USER_CONNECTIONS = [
  'listenbrainzToken',
  'lastfmApiKey',
  'plexToken',
  'jellyfinApiKey',
  'discogsToken',
] as const
export const SENSITIVE_TARGET_CONFIG = ['apiKey', 'password', 'token', 'secret'] as const
