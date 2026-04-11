import { expect, test } from '@playwright/test'
import { ensureAdminToken, installAuthToken, installBrowserLocale } from './auth'

test.describe('Language switching', () => {
  test('pre-login language switcher persists the selected locale', async ({ page }) => {
    const token = await ensureAdminToken(page.request)
    expect(token).toBeTruthy()

    await installBrowserLocale(page, 'en')
    await page.goto('/')

    const languageSwitcher = page.getByLabel('Language')
    await expect(languageSwitcher).toHaveValue('en')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await languageSwitcher.selectOption('fr')
    await expect(languageSwitcher).toHaveValue('fr')
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('digarr-locale')))
      .toBe('fr')

    await page.reload()

    await expect(languageSwitcher).toHaveValue('fr')
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('authenticated top-bar switcher updates the shell without logout', async ({ page }) => {
    const token = await ensureAdminToken(page.request, { completeSetup: true })
    expect(token).toBeTruthy()
    if (!token) return

    await installBrowserLocale(page, 'en')
    await installAuthToken(page, token)
    await page.goto('/')

    const languageSwitcher = page.getByLabel('Language')
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0)

    await languageSwitcher.selectOption('fr')

    await expect(languageSwitcher).toHaveValue('fr')
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toHaveCount(0)
  })
})
