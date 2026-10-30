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

test('decodes every one-key MP3 recording used by the virtual keyboard', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')

  const results = await page.evaluate(async (switches) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const context = new AudioContextClass()
    const decoded = []
    await context.resume()

    try {
      for (const part of switches) {
        const response = await fetch(part.onePressSample)
        if (!response.ok) {
          decoded.push({ id: part.id, ok: false, reason: `HTTP ${response.status}` })
          continue
        }

        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        decoded.push({ id: part.id, ok: buffer.duration > 0 })
      }
    } finally {
      await context.close()
    }

    return decoded
  }, BASE.switches)

  expect(results.every((result) => result.ok)).toBe(true)
})
