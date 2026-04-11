import type { SupportedLocale } from '@/core/i18n/locales'

const CYRILLIC_RE = /\p{Script=Cyrillic}/u
const LATIN_RE = /\p{Script=Latin}/u
const RU_DISTINCTIVE_RE = /[ёыэъ]/iu
const UK_DISTINCTIVE_RE = /[іїєґ]/iu
const ES_STRONG_SIGNALS = [
  /\bnocturno\b/iu,
  /\bmañana\b/iu,
  /\bcorazón\b/iu,
  /\bespañol(?:a|as|es)?\b/iu,
] as const
const ES_WEAK_SIGNALS = [/\bpara\b/iu, /\bcon\b/iu, /\buna?\b/iu, /\by\b/iu] as const

export function detectPromptLocale(input?: string | null): SupportedLocale | null {
  const value = input?.trim()
  if (!value) return null

  if (CYRILLIC_RE.test(value)) {
    if (UK_DISTINCTIVE_RE.test(value)) return 'uk'
    if (RU_DISTINCTIVE_RE.test(value)) return 'ru'
    return null
  }

  if (!LATIN_RE.test(value)) return null

  const latinTokens = value.split(/\s+/u).filter(Boolean)
  if (latinTokens.length < 2) return null

  if (ES_STRONG_SIGNALS.some((pattern) => pattern.test(value))) return 'es'

  const weakSignalCount = ES_WEAK_SIGNALS.reduce((count, pattern) => {
    return count + (pattern.test(value) ? 1 : 0)
  }, 0)

  return weakSignalCount >= 3 ? 'es' : null
}
