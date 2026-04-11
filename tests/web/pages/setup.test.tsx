// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/web/lib/api', () => ({
  completeSetup: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { SetupWizard } from '@/web/pages/setup'

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function goToLidarrStep() {
    render(<SetupWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Lidarr/i }))
    await screen.findByText('Connect Lidarr')
  }

  async function fillAndContinueLidarr() {
    fireEvent.change(screen.getByLabelText('Lidarr URL'), {
      target: { value: 'http://localhost:8686' },
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  }

  it('moves to AI setup after continuing past Lidarr details', async () => {
    await goToLidarrStep()
    await fillAndContinueLidarr()

    await screen.findByText('AI Provider')
    expect(
      screen.queryByText(/We'll start syncing your library in the background/i),
    ).not.toBeInTheDocument()
  })

  it('discovery mode goes straight to AI setup', async () => {
    render(<SetupWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Just discover/i }))

    await screen.findByText('AI Provider')
    expect(
      screen.getByText(
        /You'll connect personal listening sources later in Settings after you log in\./i,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Listening Sources')).not.toBeInTheDocument()
  })

  it('shows Emby as a setup mode option', async () => {
    render(<SetupWizard onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Emby/i })).toBeInTheDocument()
  })

  it('emby mode reveals the Emby connection step', async () => {
    render(<SetupWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Emby/i }))

    await screen.findByText('Connect Emby')
    expect(screen.getByLabelText('Emby URL')).toBeInTheDocument()
    expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    expect(screen.getByLabelText('User ID')).toBeInTheDocument()
  })
})
