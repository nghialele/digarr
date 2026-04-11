import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/core/i18n/locales'

const LOCALE_KEY = 'digarr-locale'

export function getStoredLocale(): SupportedLocale | null {
  return normalizeLocale(localStorage.getItem(LOCALE_KEY))
}

export function setStoredLocale(locale: SupportedLocale): void {
  localStorage.setItem(LOCALE_KEY, locale)
}

export function detectBrowserLocale(): SupportedLocale {
  const candidates = [...(navigator.languages ?? []), navigator.language]

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate)
    if (normalized) return normalized
  }

  return DEFAULT_LOCALE
}

export function getRequestLocale(): SupportedLocale {
  return getStoredLocale() ?? detectBrowserLocale()
}
