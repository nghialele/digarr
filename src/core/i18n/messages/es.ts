import { en } from './en'
import type { MessageCatalog } from './types'

export const es = {
  ...en,
  'auth.signIn': 'Iniciar sesión',
  'auth.signingIn': 'Iniciando sesión...',
  'auth.username': 'Usuario',
  'auth.password': 'Contraseña',
  'nav.dashboard': 'Panel',
  'nav.search': 'Buscar',
  'nav.discover': 'Descubrir',
  'nav.settings': 'Configuración',
  'setup.title': 'Configuración inicial',
  'common.language': 'Idioma',
  'common.save': 'Guardar',
} satisfies MessageCatalog
