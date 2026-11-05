import { test, expect } from '@playwright/test'

test.describe('AI Advisor live browser interaction', () => {
  test('opens chat, displays AI Advisor badge, interacts with TokenRouter, and opens suggested build', async ({ page }) => {
    test.setTimeout(90000)

    page.on('console', (msg) => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()))
    page.on('pageerror', (err) => console.log('[BROWSER ERROR]', err.message))

    // 1. Visit homepage
    console.log('1. Navigating to /...')
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // 2. Open chat via mascot
    console.log('2. Clicking mascot button...')
    const mascotBtn = page.locator('.catbtn')
    await expect(mascotBtn).toBeVisible()
    await mascotBtn.click({ force: true })

    // 3. Verify chat dialog and AI Advisor badge
    console.log('3. Verifying chat dialog...')
    const chatDialog = page.locator('.lct-chat')
    await expect(chatDialog).toBeVisible({ timeout: 10000 })

    const badge = page.locator('.lct-chat__badge')
    await expect(badge).toHaveText('AI Advisor', { timeout: 10000 })
    console.log('3b. AI Advisor badge confirmed!')

    // 4. Type query and send to live AI advisor
    console.log('4. Sending query to AI...')
    const input = page.locator('.lct-chat__input-field')
    await input.fill('I want a 75% quiet keyboard for office typing')
    await page.locator('.lct-chat__send').click()

    // 5. Wait for live AI response (TokenRouter latency ~5-10s)
    console.log('5. Waiting for AI response...')
    const suggestedBuildHeading = page.locator('.lct-chat__msg b', { hasText: 'Suggested build (75%)' })
    await expect(suggestedBuildHeading).toBeVisible({ timeout: 35000 })
    console.log('5b. Suggested build received from TokenRouter!')

    // 6. Action chips are visible
    const openChip = page.getByRole('button', { name: 'Open in builder' })
    const addChip = page.getByRole('button', { name: 'Add to cart' })
    await expect(openChip).toBeVisible({ timeout: 10000 })
    await expect(addChip).toBeVisible({ timeout: 10000 })

    // 7. Click "Open in builder" and confirm navigation
    console.log('7. Clicking Open in builder...')
    await openChip.click()

    // If a build is already active, Biscuit prompts overwrite confirmation
    const confirmChip = page.getByRole('button', { name: 'Yes, replace it' })
    if (await confirmChip.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('7b. Overwrite confirmation detected, confirming...')
      await confirmChip.click()
    }

    // 8. Should navigate to /build
    console.log('8. Verifying URL is /build...')
    await expect(page).toHaveURL(/\/build/, { timeout: 15000 })

    // 9. Close chat using Escape key
    console.log('9. Testing Escape key dismissal...')
    await page.keyboard.press('Escape')
    await expect(chatDialog).toBeHidden({ timeout: 5000 })
    console.log('All steps completed successfully!')
  })
})
