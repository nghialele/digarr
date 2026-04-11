import type { SupportedLocale } from '@/core/i18n/locales'
import type { MessageCatalog } from '@/core/i18n/messages/types'

const DEFAULT_MESSAGES = {
  'auth.signIn': 'Sign in',
} satisfies Record<'auth.signIn', string>

const LOCALE_MESSAGES: Record<SupportedLocale, MessageCatalog> = {
  en: DEFAULT_MESSAGES,
  es: {},
  fr: {},
  de: {},
  'pt-BR': {},
  it: {},
  nl: {},
  ro: {},
  pl: {},
  tr: {},
  uk: {},
  ru: {},
  ja: {},
  ko: {},
  'zh-CN': {},
}

export function getMessages(locale: SupportedLocale): MessageCatalog {
  return { ...DEFAULT_MESSAGES, ...LOCALE_MESSAGES[locale] }
}
