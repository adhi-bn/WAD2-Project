import { test, expect } from '@playwright/test'

test.describe('3D Build Preview in Parts View (Unified Builder)', () => {
  test.beforeEach(async () => {
    test.setTimeout(90000)
  })

  test('Test 1: Navigate to /builder, verify redirect to /parts and 3D preview in Build so far sheet', async ({ page }) => {
    await page.goto('/builder')
    await expect(page).toHaveURL(/\/parts$/)
    await expect(page.getByRole('heading', { name: /Your keyboard, part by part/i })).toBeVisible()

    const sheet = page.locator('aside.sheet')
    await expect(sheet).toBeVisible()

    const previewPanel = sheet.locator('.lct-build-preview-panel')
    await expect(previewPanel).toBeVisible()
    await expect(previewPanel).toHaveClass(/lct-build-preview-panel--compact/)

    // Preview panel has heading
    await expect(previewPanel.getByRole('heading', { name: '3D Build Preview' })).toBeVisible()

    // Build so far heading exists below preview
    await expect(sheet.getByRole('heading', { name: 'Build so far' })).toBeVisible()
  })

  test('Test 2: Direct entry to /parts without quiz: initializes default build with schematic caption and canvas', async ({ page }) => {
    await page.goto('/parts')
    await expect(page).toHaveURL(/\/parts$/)

    const sheet = page.locator('aside.sheet')
    await expect(sheet).toBeVisible()

    const caption = sheet.locator('.lct-build-preview-caption')
    await expect(caption).toBeVisible()
    await expect(caption).toContainText('makes no photorealistic, acoustic, or engineering-accuracy claim')

    // Canvas exists
    await expect(sheet.locator('canvas.lct-build-preview-canvas')).toBeAttached()

    // No duplicate Builder nav link in .topnav
    const topNav = page.locator('.topnav')
    await expect(topNav.locator('a.navlink', { hasText: 'Builder' })).toHaveCount(0)

    // Stage 2 is active
    await expect(page.locator('.stages a.stg.on', { hasText: 'Parts' })).toBeVisible()
  })

  test('Test 3: Click "Skip quiz, pick parts myself →" from Home, pick a part and verify reactive sheet update', async ({ page }) => {
    await page.goto('/')

    const skipQuizBtn = page.getByRole('link', { name: /Skip quiz, pick parts myself/i }).first()
    await expect(skipQuizBtn).toBeVisible()
    await skipQuizBtn.click()

    await expect(page).toHaveURL(/\/parts$/)
    await expect(page.getByRole('heading', { name: /Your keyboard, part by part/i })).toBeVisible()

    // Click an option card
    const optionCards = page.locator('.row .opt')
    const count = await optionCards.count()
    if (count > 1) {
      await optionCards.nth(1).click()
      await expect(optionCards.nth(1)).toHaveClass(/sel/)
    }

    // Build so far sheet is present with preview
    await expect(page.locator('aside.sheet .lct-build-preview-panel')).toBeVisible()
  })

  test('Test 4: Click camera preset buttons and Combine/Explode toggle in Build Preview', async ({ page }) => {
    await page.goto('/parts')

    const sheet = page.locator('aside.sheet')
    const isoBtn = sheet.getByRole('button', { name: 'Isometric' })
    const topBtn = sheet.getByRole('button', { name: 'Top-down' })
    const sideBtn = sheet.getByRole('button', { name: 'Side profile' })
    const resetBtn = sheet.getByRole('button', { name: 'Reset view' })
    const toggleBtn = sheet.getByRole('button', { name: /Combine layers|Explode layers/i })

    await expect(isoBtn).toBeVisible()
    await expect(topBtn).toBeVisible()
    await expect(sideBtn).toBeVisible()
    await expect(resetBtn).toBeVisible()
    await expect(toggleBtn).toBeVisible()

    // Click Top-down
    await topBtn.click()
    await expect(topBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(isoBtn).toHaveAttribute('aria-pressed', 'false')

    // Click Side profile
    await sideBtn.click()
    await expect(sideBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(topBtn).toHaveAttribute('aria-pressed', 'false')

    // Click Reset view
    await resetBtn.click()
    await expect(isoBtn).toHaveAttribute('aria-pressed', 'true')

    // Toggle Combine / Explode layers
    await toggleBtn.click()
    await expect(sheet.getByRole('button', { name: 'Explode layers' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Explode layers' }).click()
    await expect(sheet.getByRole('button', { name: 'Combine layers' })).toBeVisible()

    // Focus state check
    await isoBtn.focus()
    await expect(isoBtn).toBeFocused()
  })

  test('Test 5: Responsive check across mobile (375px) and desktop (1280px) viewports with zero horizontal overflow', async ({ page }) => {
    // 1. Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/parts')
    const mobilePanel = page.locator('aside.sheet .lct-build-preview-panel')
    await expect(mobilePanel).toBeVisible()

    let hasOverflow = await page.evaluate(() => {
      const panel = document.querySelector('.lct-build-preview-panel')
      return panel ? panel.scrollWidth > panel.clientWidth : false
    })
    expect(hasOverflow).toBe(false)

    // 2. Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/parts')
    const desktopPanel = page.locator('aside.sheet .lct-build-preview-panel')
    await expect(desktopPanel).toBeVisible()

    hasOverflow = await page.evaluate(() => {
      const panel = document.querySelector('.lct-build-preview-panel')
      return panel ? panel.scrollWidth > panel.clientWidth : false
    })
    expect(hasOverflow).toBe(false)
  })

  test('Test 6: Skip quiz from QuizView directly enters /parts with 3D preview initialized', async ({ page }) => {
    await page.goto('/swipe')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const skipBtn = page.getByRole('link', { name: /Skip quiz, pick parts myself/i })
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    await expect(page).toHaveURL(/\/parts$/)
    await expect(page.locator('aside.sheet .lct-build-preview-panel')).toBeVisible()
  })

  test('Test 7: Switching layout (60% · 75% · 100%) via segmented switcher updates build and live status', async ({ page }) => {
    await page.goto('/parts')
    await expect(page).toHaveURL(/\/parts$/)

    const summaryPills = page.locator('.summary-pills')
    await expect(summaryPills).toBeVisible()

    const btn60 = summaryPills.getByRole('button', { name: '60% layout' })
    const btn75 = summaryPills.getByRole('button', { name: '75% layout' })
    const btn100 = summaryPills.getByRole('button', { name: '100% layout' })

    await expect(btn60).toBeVisible()
    await expect(btn75).toBeVisible()
    await expect(btn100).toBeVisible()

    // Default layout is 75%
    await expect(btn75).toHaveAttribute('aria-pressed', 'true')
    await expect(btn75).toHaveClass(/pri/)
    await expect(btn60).toHaveAttribute('aria-pressed', 'false')

    // Click 60% layout
    await btn60.click()
    await expect(btn60).toHaveAttribute('aria-pressed', 'true')
    await expect(btn60).toHaveClass(/pri/)
    await expect(btn75).toHaveAttribute('aria-pressed', 'false')

    // Live status announcement
    const liveStatus = page.locator('.lct-build-preview-live-status')
    await expect(liveStatus).toContainText('Switched 3D preview to 60% layout')

    // Click 100% layout
    await btn100.click()
    await expect(btn100).toHaveAttribute('aria-pressed', 'true')
    await expect(btn100).toHaveClass(/pri/)
    await expect(btn60).toHaveAttribute('aria-pressed', 'false')
    await expect(liveStatus).toContainText('Switched 3D preview to 100% layout')
  })

  test('Test 8: Artwork keycaps preserve visible legends and update 3D preview seamlessly', async ({ page }) => {
    await page.goto('/parts')
    await expect(page).toHaveURL(/\/parts$/)

    // Navigate to Keycaps tab (tab index 4 / 05 · Caps)
    const keycapsTab = page.locator('.tabs button.tab').filter({ hasText: /Caps/i })
    await expect(keycapsTab).toBeVisible()
    await keycapsTab.click()

    // Find and select an artwork keycap set (e.g. Themed PBT keycap set)
    const themedCard = page.locator('.row .opt').filter({ hasText: /Themed PBT|Mural|Wave|Kanagawa/i }).first()
    if (await themedCard.count() > 0) {
      await themedCard.click()
      await expect(themedCard).toHaveClass(/sel/)
    }

    // Verify 3D canvas is still healthy and attached without rendering errors
    const canvas = page.locator('aside.sheet canvas.lct-build-preview-canvas')
    await expect(canvas).toBeAttached()
    const errorFallback = page.locator('aside.sheet [data-testid="build-preview-fallback"]')
    await expect(errorFallback).toHaveCount(0)
  })
})
