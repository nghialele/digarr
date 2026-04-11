import { en } from './en'
import type { MessageCatalog } from './types'

export const ru = {
  ...en,
  'auth.signIn': 'Войти',
  'auth.signingIn': 'Вход...',
  'auth.username': 'Имя пользователя',
  'auth.password': 'Пароль',
  'nav.dashboard': 'Панель',
  'nav.search': 'Поиск',
  'nav.discover': 'Открыть',
  'nav.settings': 'Настройки',
  'setup.title': 'Начальная настройка',
  'common.language': 'Язык',
  'common.save': 'Сохранить',
} satisfies MessageCatalog
