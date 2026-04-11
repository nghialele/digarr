import { createContext, type ReactNode, useContext, useState } from 'react'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/core/i18n/locales'
import { getMessages } from '@/core/i18n/messages'
import type { MessageKey } from '@/core/i18n/messages/types'
import { detectBrowserLocale, getStoredLocale, setStoredLocale } from './locale-storage'

type I18nValue = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    return getStoredLocale() ?? detectBrowserLocale()
  })

  const messages = getMessages(locale)

  const value: I18nValue = {
    locale,
    setLocale: (nextLocale) => {
      setStoredLocale(nextLocale)
      setLocaleState(nextLocale)
    },
    t: (key) => messages[key] ?? getMessages(DEFAULT_LOCALE)[key] ?? key,
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider')
  }

  return value
}
