import { en } from './en'
import type { MessageCatalog } from './types'

export const pl = {
  ...en,
  'auth.signIn': 'Zaloguj się',
  'auth.signingIn': 'Logowanie...',
  'auth.username': 'Nazwa użytkownika',
  'auth.password': 'Hasło',
  'nav.dashboard': 'Pulpit',
  'nav.search': 'Szukaj',
  'nav.discover': 'Odkrywaj',
  'nav.settings': 'Ustawienia',
  'setup.title': 'Konfiguracja początkowa',
  'common.language': 'Język',
  'common.save': 'Zapisz',
} satisfies MessageCatalog
