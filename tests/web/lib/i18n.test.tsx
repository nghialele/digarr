import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, useI18n } from '@/web/lib/i18n'

function Probe() {
  const { locale, t } = useI18n()

  return (
    <>
      <span>{locale}</span>
      <span>{t('auth.signIn')}</span>
    </>
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => {
        storage.clear()
      }),
    })

    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['de-DE'],
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('uses stored locale before browser detection', () => {
    localStorage.setItem('digarr-locale', 'fr')

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByText('fr')).toBeInTheDocument()
  })
})
