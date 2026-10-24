import { expect, test } from '@playwright/test'

test('guest profile keeps Google sign-in available', async ({ page }) => {
  await page.goto('/account')

  await expect(page.getByRole('heading', { name: 'Sign in to save your builds' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})
