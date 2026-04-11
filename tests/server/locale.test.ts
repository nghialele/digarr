import { describe, expect, it } from 'vitest'
import { resolveRequestLocale } from '@/server/locale'

describe('resolveRequestLocale', () => {
  it('prefers the user locale over request headers', () => {
    expect(
      resolveRequestLocale({
        userPreferredLocale: 'de',
        requestLocale: 'fr',
        acceptLanguage: 'es-ES,es;q=0.9',
      }),
    ).toBe('de')
  })

  it('falls back to Accept-Language when explicit request locale is absent', () => {
    expect(
      resolveRequestLocale({
        userPreferredLocale: null,
        requestLocale: null,
        acceptLanguage: 'fr-CA,es;q=0.9,en;q=0.8',
      }),
    ).toBe('fr')
  })

  it('falls back to english when no locale input resolves', () => {
    expect(
      resolveRequestLocale({
        userPreferredLocale: null,
        requestLocale: null,
        acceptLanguage: 'xx-YY;q=0.9,*;q=0.1',
      }),
    ).toBe('en')
  })
})
