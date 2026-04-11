import { en } from './en'
import type { MessageCatalog } from './types'

export const tr = {
  ...en,
  'auth.signIn': 'Giriş yap',
  'auth.signingIn': 'Giriş yapılıyor...',
  'auth.username': 'Kullanıcı adı',
  'auth.password': 'Şifre',
  'nav.dashboard': 'Panel',
  'nav.search': 'Ara',
  'nav.discover': 'Keşfet',
  'nav.settings': 'Ayarlar',
  'setup.title': 'İlk kurulum',
  'common.language': 'Dil',
  'common.save': 'Kaydet',
} satisfies MessageCatalog
