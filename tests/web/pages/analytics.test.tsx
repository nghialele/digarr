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

vi.mock('@/web/lib/api', () => ({
  getAnalyticsBatches: vi.fn().mockResolvedValue([]),
  getAnalyticsGenres: vi.fn().mockResolvedValue([]),
  getAnalyticsOverview: vi.fn().mockResolvedValue({
    totalRecs: 0,
    approvalRate: 0,
    avgScore: 0,
    totalBatches: 0,
  }),
  getAnalyticsSources: vi.fn().mockResolvedValue([]),
  getApprovalTrend: vi.fn().mockResolvedValue([]),
  getUserPreferences: vi.fn().mockResolvedValue({ dismissedHints: [] }),
  getScoreDistribution: vi.fn().mockResolvedValue([]),
  getTimeToAct: vi.fn().mockResolvedValue([]),
}))

import { AnalyticsPage } from '@/web/pages/analytics'

describe('AnalyticsPage', () => {
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

  it('renders translated analytics intro copy in French', async () => {
    localStorage.setItem('digarr-locale', 'fr')
    renderWithQuery(<AnalyticsPage />)

    expect(
      await screen.findByText(
        'Suivez les performances de votre pipeline de découverte au fil du temps. Des taux d’approbation plus élevés signifient que Digarr apprend bien vos goûts.',
      ),
    ).toBeInTheDocument()
  })
})
