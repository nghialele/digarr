import type { SupportedLocale } from '@/core/i18n/locales'

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value
}

export function formatDate(
  locale: SupportedLocale,
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(toDate(value))
}

export function formatShortDate(locale: SupportedLocale, value: string | Date): string {
  return formatDate(locale, value, { month: 'short', day: 'numeric' })
}

export function formatShortDateTime(locale: SupportedLocale, value: string | Date): string {
  return formatDate(locale, value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(locale: SupportedLocale, value: string | Date): string {
  return formatDate(locale, value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
