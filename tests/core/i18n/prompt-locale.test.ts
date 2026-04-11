import { describe, expect, it } from 'vitest'
import { detectPromptLocale } from '@/core/i18n/prompt-locale'

describe('detectPromptLocale', () => {
  it('detects russian prompts with distinctive cyrillic characters', () => {
    expect(detectPromptLocale('мрачный пост-панк на вечер')).toBe('ru')
  })

  it('detects ukrainian prompts with distinctive cyrillic characters', () => {
    expect(detectPromptLocale('сумний дрім-поп для нічної поїздки')).toBe('uk')
  })

  it('detects unambiguous spanish prompts in latin script', () => {
    expect(detectPromptLocale('jazz nocturno')).toBe('es')
  })

  it('returns null for ambiguous latin-script prompts', () => {
    expect(detectPromptLocale('sad jazz for rain')).toBeNull()
  })
})
