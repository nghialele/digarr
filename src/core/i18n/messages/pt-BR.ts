import { en } from './en'
import type { MessageCatalog } from './types'

export const ptBR = {
  ...en,
  'auth.signIn': 'Entrar',
  'auth.signingIn': 'Entrando...',
  'auth.username': 'Nome de usuário',
  'auth.password': 'Senha',
  'nav.dashboard': 'Painel',
  'nav.search': 'Buscar',
  'nav.discover': 'Descobrir',
  'nav.settings': 'Configurações',
  'setup.title': 'Configuração inicial',
  'common.language': 'Idioma',
  'common.save': 'Salvar',
} satisfies MessageCatalog
