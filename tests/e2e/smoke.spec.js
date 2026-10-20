import { expect, test } from '@playwright/test'

test.beforeEach(async () => {
  test.setTimeout(120000)
})

test('shell loads and nav renders', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Le Chaton Typers' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Builder', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your keyboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Builder', exact: true }).click()
  await expect(page).toHaveURL(/\/builder$/)
  await expect(page.getByRole('heading', { name: 'Builder' })).toBeVisible()
})

test('home view renders exploded anatomy section with interactive layer chips', async ({ page }) => {
  await page.goto('/')

  // Wait for 3D stage and WebGL capability detection to settle
  await expect(page.locator('.exploded-anatomy-container')).toHaveAttribute(
    'data-webgl-status',
    /ready|unavailable/
  )

  // Exploded anatomy section is visible on home
  const lookSection = page.locator('.hs.hs-look')
  await expect(lookSection).toBeVisible()
  await expect(
    lookSection.getByRole('heading', { name: 'Build your keyboard across three core parts.' })
  ).toBeVisible()

  // 6 layer chips are present
  await expect(lookSection.getByRole('button', { name: 'Keycaps' })).toBeVisible()
  await expect(lookSection.getByRole('button', { name: '5-pin Switches' })).toBeVisible()

  // Barebones kit bundled internals bracket
  const barebonesBracket = lookSection.locator('.barebones-bracket')
  await expect(barebonesBracket).toBeVisible()
  await expect(barebonesBracket.getByText('Barebones kit (bundled internals)')).toBeVisible()
  await expect(barebonesBracket.getByRole('button', { name: 'Plate' })).toBeVisible()
  await expect(barebonesBracket.getByRole('button', { name: 'PCB' })).toBeVisible()
  await expect(barebonesBracket.getByRole('button', { name: 'Foam' })).toBeVisible()
  await expect(barebonesBracket.getByRole('button', { name: 'Case' })).toBeVisible()

  // Clicking a layer chip displays details and acoustic specs
  const foamBtn = page.locator('.layer-chip-btn').filter({ hasText: 'Foam' })
  await expect(foamBtn).toBeVisible()
  await foamBtn.click()
  await expect(foamBtn).toHaveAttribute('aria-pressed', 'true')

  const detailCard = page.locator('.layer-detail-card')
  await expect(detailCard).toBeVisible()
  await expect(detailCard).toContainText('Foam')
  await expect(detailCard).toContainText('Barebones kit bundled')
  await expect(detailCard).toContainText('Gasket acoustic stack:')
  await expect(detailCard).toContainText('PORON plate cotton')

  // Disclaimer is visible
  await expect(page.locator('.anatomy-disclaimer')).toBeVisible()

  // CTA link to /builder is present and points to /builder
  const builderCta = page.locator('.acts').getByRole('link', { name: /Explore the builder/i })
  await expect(builderCta).toBeAttached()
  await expect(builderCta).toHaveAttribute('href', '/builder')
})

test('home view renders 6 guided layer cards and chip click focuses the card', async ({ page }) => {
  await page.goto('/')

  // Verify all 6 guided layer cards exist in DOM
  const layerCards = page.locator('.layer-step-section')
  await expect(layerCards).toHaveCount(6)

  // Verify PCB card exists
  const pcbCard = page.locator('.layer-step-section[data-layer-id="pcb"]')
  await expect(pcbCard).toBeAttached()
  await expect(pcbCard.getByRole('heading', { name: 'Hot-swap PCB' })).toBeAttached()

  // Clicking the PCB chip activates it and focuses the card
  const pcbChip = page.locator('.layer-chip-btn').filter({ hasText: 'PCB' })
  await expect(pcbChip).toBeVisible()
  await pcbChip.click()

  await expect(pcbChip).toHaveAttribute('aria-pressed', 'true')
  await expect(pcbCard).toHaveAttribute('aria-current', 'step')
})
