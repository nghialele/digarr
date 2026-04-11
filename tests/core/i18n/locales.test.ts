import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  getLocaleLabel,
  normalizeLocale,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from '@/core/i18n/locales'

describe('locales', () => {
  it('normalizes aliases to supported locales', () => {
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('es-MX')).toBe('es')
    expect(normalizeLocale('pt')).toBe('pt-BR')
    expect(normalizeLocale('zh')).toBe('zh-CN')
  })

  it('falls back to english for unsupported values', () => {
    expect(resolveSupportedLocale('xx-YY')).toBe(DEFAULT_LOCALE)
    expect(resolveSupportedLocale('')).toBe(DEFAULT_LOCALE)
  })

  it('exposes native labels for the switcher', () => {
    expect(getLocaleLabel('fr')).toBe('Français')
    expect(getLocaleLabel('ro')).toBe('Română')
    expect(SUPPORTED_LOCALES).toContain('ja')
  })
})
