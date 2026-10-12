import { expect, test } from '@playwright/test'

test('shell loads and nav renders', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Lechaton Typers' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Builder' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your keyboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Builder' }).click()
  await expect(page).toHaveURL(/\/builder$/)
  await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()
})
