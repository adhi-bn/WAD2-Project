import { expect, test } from '@playwright/test'

test('shell loads and nav renders', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Le Chaton Typers' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Builder', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /dream keyboard|build/i })).toBeVisible()

  await page.getByRole('link', { name: 'Builder', exact: true }).click()
  await expect(page).toHaveURL(/\/builder$/)
  await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()
})
