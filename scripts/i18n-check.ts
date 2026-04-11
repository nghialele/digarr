#!/usr/bin/env bun

/**
 * Validate that every supported locale exports a complete message catalog.
 *
 * Usage: bun scripts/i18n-check.ts
 */

import { SUPPORTED_LOCALES } from '../src/core/i18n/locales'
import { getMessages } from '../src/core/i18n/messages'

const referenceLocale = 'en'
const referenceMessages = getMessages(referenceLocale)
const expectedKeys = Object.keys(referenceMessages)

let failed = false

for (const locale of SUPPORTED_LOCALES) {
  const messages = getMessages(locale)
  const keys = Object.keys(messages)
  const missing = expectedKeys.filter((key) => !(key in messages))
  const extra = keys.filter((key) => !expectedKeys.includes(key))
  const empty = expectedKeys.filter((key) => messages[key]?.trim() === '')

  if (missing.length === 0 && extra.length === 0 && empty.length === 0) {
    continue
  }

  failed = true
  console.error(`Locale ${locale} has catalog issues:`)
  if (missing.length > 0) console.error(`  missing: ${missing.join(', ')}`)
  if (extra.length > 0) console.error(`  extra: ${extra.join(', ')}`)
  if (empty.length > 0) console.error(`  empty: ${empty.join(', ')}`)
}

if (failed) {
  process.exit(1)
}

console.log(`Validated ${SUPPORTED_LOCALES.length} locales against ${referenceLocale}`)
