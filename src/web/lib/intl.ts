import type { SupportedLocale } from '@/core/i18n/locales'

export function formatShortDate(locale: SupportedLocale, value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
}

export function formatDateTime(locale: SupportedLocale, value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
