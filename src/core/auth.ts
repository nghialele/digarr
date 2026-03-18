import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEYLEN = 64

/**
 * Hash a password using scrypt (works in both Bun and Node.js).
 * Returns `salt:hash` format.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored `salt:hash` string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const computed = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(hash, 'hex')
  if (computed.byteLength !== expected.byteLength) return false
  return timingSafeEqual(computed, expected)
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}
