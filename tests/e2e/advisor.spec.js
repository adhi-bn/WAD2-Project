import { test, expect } from '@playwright/test'

test.describe('AI Advisor browser interaction', () => {
  test('opens chat, displays status badge, handles messages, and supports keyboard dismissal', async ({ page }) => {
    test.setTimeout(90000)

    // 1. Visit homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // 2. Open chat via mascot
    const mascotBtn = page.locator('.catbtn')
    await expect(mascotBtn).toBeVisible()
    await mascotBtn.click({ force: true })

    // 3. Verify chat dialog and status badge
    const chatDialog = page.locator('.lct-chat')
    await expect(chatDialog).toBeVisible({ timeout: 10000 })

    const badge = page.locator('.lct-chat__badge')
    await expect(badge).toBeVisible({ timeout: 10000 })
    const badgeText = (await badge.textContent() || '').trim()
    expect(badgeText).toMatch(/^(AI Advisor|Advisor)$/)

    // 4. Type query and send
    const input = page.locator('.lct-chat__input-field')
    await input.fill('I want a 75% quiet keyboard for office typing')
    await page.locator('.lct-chat__send').click()

    if (badgeText === 'AI Advisor') {
      // Configured environment: wait for live TokenRouter response
      const suggestedBuildHeading = page.locator('.lct-chat__msg b', { hasText: 'Suggested build (75%)' })
      await expect(suggestedBuildHeading).toBeVisible({ timeout: 25000 })

      const openChip = page.getByRole('button', { name: 'Open in builder' })
      const addChip = page.getByRole('button', { name: 'Add to cart' })
      await expect(openChip).toBeVisible({ timeout: 5000 })
      await expect(addChip).toBeVisible({ timeout: 5000 })

      await openChip.click()
      const confirmChip = page.getByRole('button', { name: 'Yes, replace it' })
      if (await confirmChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmChip.click()
      }
      await expect(page).toHaveURL(/\/build/, { timeout: 10000 })
    } else {
      // Null-safe CI environment (zero .env credentials): Biscuit reports offline status truthfully
      const botMsg = page.locator('.lct-chat__msg', { hasText: /simple cat for now/i })
      await expect(botMsg).toBeVisible({ timeout: 10000 })

      const browseChip = page.getByRole('button', { name: 'Browse parts' })
      await expect(browseChip).toBeVisible({ timeout: 5000 })
      await browseChip.click()
      await expect(page).toHaveURL(/\/parts/, { timeout: 10000 })
    }

    // 5. Test Escape key dismissal
    if (await chatDialog.isVisible()) {
      await page.keyboard.press('Escape')
      await expect(chatDialog).toBeHidden({ timeout: 5000 })
    }
  })
})
