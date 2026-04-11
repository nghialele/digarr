import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/core/i18n/locales'
import { getMessages } from '@/core/i18n/messages'
import { formatDateTime, formatShortDate } from '@/web/lib/intl'

describe('message catalogs', () => {
  it('every locale has every english key', () => {
    const englishKeys = Object.keys(getMessages('en')).sort()

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(getMessages(locale)).sort()).toEqual(englishKeys)
    }
  })
})

describe('intl helpers', () => {
  const locale: SupportedLocale = 'de'
  const value = '2026-04-11T13:45:00.000Z'

  it('formats short dates with the requested locale', () => {
    expect(formatShortDate(locale, value)).toBe(
      new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(value)),
    )
  })

  it('formats date times with the requested locale', () => {
    expect(formatDateTime(locale, value)).toBe(
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)),
    )
  })
})
