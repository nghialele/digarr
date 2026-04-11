// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/web/lib/i18n'

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nProvider>,
  )
}

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/web/lib/api', () => ({
  createUserApi: vi.fn(),
  deleteUserApi: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 1,
    username: 'admin',
    isAdmin: true,
  }),
  getUserPreferences: vi.fn().mockResolvedValue({ dismissedHints: [] }),
  listUsers: vi.fn().mockResolvedValue([]),
  updateUserAdmin: vi.fn(),
}))

import { UserManagementPage } from '@/web/pages/user-management'

describe('UserManagementPage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
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
      },
    })
  })

  it('renders translated user management copy in French', async () => {
    localStorage.setItem('digarr-locale', 'fr')
    renderWithQuery(<UserManagementPage />)

    expect(await screen.findByText('Gestion des utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('Ajouter un utilisateur')).toBeInTheDocument()
  })
})
