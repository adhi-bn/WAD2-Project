import { test, expect } from '@playwright/test'

/**
 * Loads the home page and opens Biscuit's chat, retrying from a fresh page load.
 * The Vite dev server can reload the page once after it optimises dependencies on a cold start
 * (common on slow CI runners), which silently closes an already-open chat, so the whole
 * load-and-open step is retried instead of assuming a single pass.
 *
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {Promise<void>}
 */
async function openBiscuit(page) {
  await expect(async () => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const mascotBtn = page.locator('.catbtn')
    await expect(mascotBtn).toBeVisible({ timeout: 5000 })
    await mascotBtn.click({ force: true })
    await expect(page.locator('.lct-chat')).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 45000 })
}

test.describe('AI Advisor browser interaction', () => {
  test('opens chat, displays status badge, handles messages, and supports keyboard dismissal', async ({ page }) => {
    test.setTimeout(120000)

    await openBiscuit(page)
    const chatDialog = page.locator('.lct-chat')

    const badge = page.locator('.lct-chat__badge')
    await expect(badge).toBeVisible({ timeout: 10000 })
    const badgeText = ((await badge.textContent()) || '').trim()
    expect(badgeText).toMatch(/^(AI Advisor|Advisor)$/)

    const input = page.locator('.lct-chat__input-field')
    const query = 'I want a 75% quiet keyboard for office typing'

    if (badgeText === 'AI Advisor') {
      // Configured environment: wait for the live TokenRouter response.
      await input.fill(query)
      await page.locator('.lct-chat__send').click()

      await expect(page.locator('.lct-chat__msg b', { hasText: 'Suggested build (75%)' })).toBeVisible({ timeout: 40000 })

      const openChip = page.getByRole('button', { name: 'Open in builder' })
      await expect(openChip).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible({ timeout: 5000 })

      await openChip.click()
      const confirmChip = page.getByRole('button', { name: 'Yes, replace it' })
      if (await confirmChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmChip.click()
      }
      await expect(page).toHaveURL(/\/build/, { timeout: 10000 })
    } else {
      // Credential-free CI: Biscuit reports its offline status truthfully and offers fallback chips.
      await expect(async () => {
        if (!(await chatDialog.isVisible())) await openBiscuit(page)
        await input.fill(query)
        await page.locator('.lct-chat__send').click()
        await expect(page.locator('.lct-chat__msg', { hasText: /simple cat for now/i })).toBeVisible({ timeout: 5000 })
      }).toPass({ timeout: 45000 })

      const browseChip = page.getByRole('button', { name: 'Browse parts' })
      await expect(browseChip).toBeVisible({ timeout: 5000 })
      await browseChip.click()
      await expect(page).toHaveURL(/\/parts/, { timeout: 10000 })
    }

    // Escape dismisses the chat when it is still open (the /parts or /build route keeps the mascot mounted).
    if (await chatDialog.isVisible()) {
      await page.keyboard.press('Escape')
      await expect(chatDialog).toBeHidden({ timeout: 5000 })
    }
  })
})
