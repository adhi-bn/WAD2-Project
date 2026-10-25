import { expect, test } from '@playwright/test'
import { BASE } from '../../src/data/catalog.js'

test('decodes and plays every catalogued MP3 recording in Chromium', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Select .+/ }).first().click()
  await expect(page).toHaveURL(/\/parts$/)
  await page.getByRole('tab', { name: /Switch/ }).click()
  await expect(page.getByRole('heading', { name: 'Hear your selected switch' })).toBeVisible()
  await expect(page.locator('.switch-audio')).toHaveCSS('border-radius', '18px')
  await expect(page.locator('.switch-audio__volume')).toHaveCSS('display', 'flex')
  await page.locator('details.more summary').click()

  for (const part of BASE.switches) {
    const file = part.sample.split('/').pop()
    await page.locator('button.prow').filter({ hasText: part.name }).click()

    const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/switch-audio/${file}`))
    await page.locator('button[aria-label^="Play sample for"]').click()
    const response = await responsePromise

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('audio/mpeg')
    await expect(page.locator('.switch-audio__seek')).toBeEnabled()
    await expect(page.locator('.switch-audio__time span').nth(1)).not.toHaveText('--.-')
    await expect(page.locator('.switch-audio [role="status"]')).toContainText(
      new RegExp(`Playing ${part.type} typing sample for ${part.name}|Playback finished for ${part.name}`),
    )
  }
})
