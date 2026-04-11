import { en } from './en'
import type { MessageCatalog } from './types'

export const it = {
  ...en,
  'auth.signIn': 'Accedi',
  'auth.signingIn': 'Accesso in corso...',
  'auth.username': 'Nome utente',
  'auth.password': 'Password',
  'nav.dashboard': 'Dashboard',
  'nav.search': 'Cerca',
  'nav.discover': 'Scopri',
  'nav.settings': 'Impostazioni',
  'setup.title': 'Configurazione iniziale',
  'common.language': 'Lingua',
  'common.save': 'Salva',
} satisfies MessageCatalog
