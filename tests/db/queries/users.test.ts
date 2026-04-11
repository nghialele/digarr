import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db'
import { updateUserPreferredLocale } from '@/db/queries/users'

describe('updateUserPreferredLocale', () => {
  it('updates the preferred locale for a user', async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    const db = { update: vi.fn().mockReturnValue(chain) } as unknown as Database

    await updateUserPreferredLocale(db, 1, 'de')

    expect(db.update).toHaveBeenCalledOnce()
    expect(chain.set).toHaveBeenCalledWith({ preferredLocale: 'de' })
    expect(chain.where).toHaveBeenCalledOnce()
  })
})
