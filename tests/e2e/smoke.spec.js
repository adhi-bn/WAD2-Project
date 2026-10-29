import { expect, test } from '@playwright/test'

test('shell loads and nav renders', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Le Chaton Typers' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Know your keyboard', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'About us', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /dream keyboard|build/i })).toBeVisible()

  // 2 Parts stage is always visible and clickable in navbar stages
  const partsNav = page.locator('.stages a.stg', { hasText: 'Parts' })
  await expect(partsNav).toBeVisible()
  await partsNav.click()

  await expect(page).toHaveURL(/\/parts$/)
  await expect(page.getByRole('heading', { name: /Your keyboard, part by part/i })).toBeVisible()
  await expect(page.getByText('Build so far')).toBeVisible()

  await page.getByRole('link', { name: 'About us', exact: true }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole('heading', { name: 'Le Chaton Typers' })).toBeVisible()
})
