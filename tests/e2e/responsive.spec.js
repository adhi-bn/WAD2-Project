import { expect, test } from '@playwright/test'

// Approved mobile-responsiveness regression coverage.
//
// The tests describe user-visible outcomes (containment, visibility, navigation,
// reachability) instead of layout implementation class names. Required accessible
// contracts:
// - the mobile menu toggle exposes aria-expanded, aria-controls, and a name containing "menu";
// - the progress navigation keeps its accessible name "Progress" and visible stage labels;
// - the drawer exposes a dismissible, focus-managed surface while open.

const TEST_TIMEOUT = 90_000
const SCENE_READY_TIMEOUT = 20_000
const SCROLL_SETTLE_TIMEOUT = 3_000
const DRAWER_SETTLE_TIMEOUT = 2_000
const TOAST_SETTLE_MS = 350

const PHONES = [
  { name: 'phone 320', width: 320, height: 568 },
  { name: 'phone 375', width: 375, height: 667 },
  { name: 'phone 390', width: 390, height: 844 },
]
const PHONE_LANDSCAPE = { name: 'phone 667x375 landscape', width: 667, height: 375, kind: 'phone-landscape' }
const MOBILE_NAV_VIEWPORTS = [...PHONES, PHONE_LANDSCAPE]

const VIEWPORTS = [
  ...PHONES,
  PHONE_LANDSCAPE,
  { name: 'tablet 768 portrait', width: 768, height: 1024, kind: 'tablet' },
  { name: 'tablet 1024 landscape', width: 1024, height: 768, kind: 'tablet' },
  { name: 'desktop 1280', width: 1280, height: 800, kind: 'desktop' },
]

test.beforeEach(() => {
  test.setTimeout(TEST_TIMEOUT)
})

const ROUTES = [
  { path: '/build', name: '/build', heading: /Build Summary/i },
  { path: '/privacy', name: '/privacy', heading: /Privacy Policy/i },
  { path: '/terms', name: '/terms', heading: /Terms of Service/i },
]

const STAGE_LABELS = ['Swipe', 'Parts', 'Build', 'Cart']
const COMPARE_LINK = /^Compare( builds)?$/i

/**
 * Opens one route with the app's existing Build seeding convention.
 *
 * `/parts` initialises a default Build on direct entry (router beforeEach ->
 * finishQuiz), and the sticky-bar "Review build" link performs an in-app
 * navigation to `/build`. Reloading `/build` directly would lose the in-memory
 * Build and bounce to `/swipe`, so this helper never deep-links the summary.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ path: string, heading: RegExp }} route
 * @returns {Promise<void>}
 */
async function openRoute(page, route) {
  if (route.path === '/build') {
    await page.goto('/parts', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/parts$/)
    await expect(page.getByRole('heading', { name: /Your keyboard, part by part/i })).toBeVisible()
    await page.getByRole('link', { name: /Review build/i }).first().click()
    await expect(page).toHaveURL(/\/build$/)
  } else {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`${route.path}$`))
  }

  await expect(page.getByText(route.heading).first()).toBeVisible()
}

/**
 * Collects whole-page horizontal-overflow evidence and visible element offenders.
 *
 * The document/body width checks always fail on real page overflow. The element
 * list is a second signal for controls/text that visibly cross a viewport edge.
 * Overflow-hidden/clip ancestors only exempt a descendant when the descendant is
 * fully outside that ancestor's clip box; a partially visible offscreen control
 * still reports. Auto/scroll containers remain valid internal scrollers (the
 * approved stage strip is the intended case), but the scroller itself is still
 * checked for page containment.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
async function collectPageOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const viewportWidth = root.clientWidth || window.innerWidth
    const selectors = 'a[href], button, input, select, textarea, table, h1, h2, h3, p, nav, header, footer, section'

    const hiddenByAncestor = (element) => Boolean(element.closest('[hidden], [inert], [aria-hidden="true"]'))
    const isVisible = (element) => {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 1 && rect.height > 1
    }
    const crossesViewportEdge = (rect) => rect.left < -1 || rect.right > viewportWidth + 1

    // Genuine internal scrollers make offscreen content reachable by scrolling.
    // The stage strip is the approved case; the scroller itself is still checked.
    const insideHorizontalScroller = (element) => {
      for (let node = element.parentElement; node && node !== body; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') return true
      }
      return false
    }

    // Hidden/clip only hide what is actually outside their clip box. Do not blanket
    // exempt a partially visible control that also spills past the viewport.
    const fullyClippedByAncestor = (element, rect) => {
      for (let node = element.parentElement; node && node !== body; node = node.parentElement) {
        const style = getComputedStyle(node)
        const clipsHorizontally = style.overflowX === 'hidden' || style.overflowX === 'clip'
        const contain = style.contain || ''
        const clipsPaint = contain === 'strict' || contain === 'content' || /\bpaint\b/.test(contain)
          || (style.clipPath && style.clipPath !== 'none')
        if (!clipsHorizontally && !clipsPaint) continue

        const clipRect = node.getBoundingClientRect()
        if (clipsPaint) {
          if (rect.right <= clipRect.left || rect.left >= clipRect.right || rect.bottom <= clipRect.top || rect.top >= clipRect.bottom) return true
        } else if (rect.right <= clipRect.left || rect.left >= clipRect.right) {
          return true
        }
      }
      return false
    }

    // A properly contained off-screen layer (for example a closed drawer) does not
    // contribute page overflow. Require clipping, inert/aria-hidden, or no pointer
    // interaction so genuinely escaped positioned content still reports.
    const isContainedOffscreenLayer = (element) => {
      const isContainedLayer = (node) => {
        const style = getComputedStyle(node)
        if (style.position !== 'fixed' && style.position !== 'absolute') return false
        const rect = node.getBoundingClientRect()
        const fullyOffscreen = rect.right <= 0 || rect.left >= viewportWidth
        if (!fullyOffscreen) return false
        return style.overflowX !== 'visible'
          || style.pointerEvents === 'none'
          || node.hasAttribute('inert')
          || node.getAttribute('aria-hidden') === 'true'
      }

      if (isContainedLayer(element)) return true
      for (let node = element.parentElement; node && node !== body; node = node.parentElement) {
        if (isContainedLayer(node)) return true
      }
      return false
    }

    const offenders = []
    for (const element of body.querySelectorAll(selectors)) {
      if (hiddenByAncestor(element) || !isVisible(element)) continue
      const rect = element.getBoundingClientRect()
      if (!crossesViewportEdge(rect)) continue
      if (insideHorizontalScroller(element)) continue
      if (fullyClippedByAncestor(element, rect)) continue
      if (isContainedOffscreenLayer(element)) continue
      offenders.push({
        tag: element.tagName.toLowerCase(),
        text: (element.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 60),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      })
    }

    return {
      viewportWidth,
      rootOverflow: root.scrollWidth - root.clientWidth,
      bodyOverflow: body.scrollWidth - body.clientWidth,
      scrollX: window.scrollX,
      offenders: offenders.slice(0, 12),
    }
  })
}

/**
 * Asserts that the page neither scrolls horizontally nor places visible content
 * past either viewport edge.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectNoPageOverflow(page) {
  const metrics = await collectPageOverflow(page)
  const detail = JSON.stringify(metrics)
  expect(metrics.rootOverflow, `document scrollWidth exceeded viewport: ${detail}`).toBeLessThanOrEqual(1)
  expect(metrics.bodyOverflow, `body scrollWidth exceeded viewport: ${detail}`).toBeLessThanOrEqual(1)
  expect(metrics.scrollX, `page started horizontally scrolled: ${detail}`).toBe(0)
  expect(metrics.offenders, `visible content crossed a viewport edge: ${detail}`).toEqual([])
}

/**
 * Asserts the labelled progress strip container is visible and fully contained in
 * the viewport. The strip may scroll internally: labels must not be CSS-hidden,
 * and every stage must be reachable by scrolling it into the strip viewport.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectStageStripContained(page) {
  const progress = page.getByRole('navigation', { name: /progress/i })
  await expect(progress).toBeVisible()

  const box = await progress.boundingBox()
  const viewportWidth = page.viewportSize().width
  expect(box, 'progress strip must have a measurable box').not.toBeNull()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1)

  for (const label of STAGE_LABELS) {
    const labelNode = progress.getByText(label, { exact: true }).first()
    await expect(labelNode, `stage label "${label}" must not be hidden`).toBeVisible()

    // A labelled stage is an enabled link/button or an explicitly disabled stage.
    const stage = progress.locator('a, button, [aria-disabled="true"]').filter({ hasText: label }).first()
    await expect(stage, `stage "${label}" must exist`).toHaveCount(1)

    // Internal scrolling is allowed, but each stage must be reachable inside the
    // strip without pushing the strip itself outside the page viewport.
    await stage.scrollIntoViewIfNeeded()
    const stageBox = await stage.boundingBox()
    expect(stageBox, `stage "${label}" must have a measurable box`).not.toBeNull()
    expect(stageBox.x, `stage "${label}" must be reachable inside the strip`).toBeGreaterThanOrEqual(box.x - 1)
    expect(stageBox.x + stageBox.width, `stage "${label}" must be reachable inside the strip`).toBeLessThanOrEqual(box.x + box.width + 1)
    expect(stageBox.x).toBeGreaterThanOrEqual(-1)
    expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(viewportWidth + 1)
  }
}

/**
 * Finds the pinned CTA surface by walking up from its primary action. This avoids
 * depending on a layout class while still measuring the element that overlaps content.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ button: import('@playwright/test').Locator, box: { x: number, y: number, width: number, height: number } }>}
 */
async function pinnedCta(page) {
  const button = page.getByRole('button', { name: /Add to cart|Review Parts to add to cart/i }).first()
  await expect(button).toBeVisible()
  await button.scrollIntoViewIfNeeded()

  const box = await button.evaluate((element) => {
    let node = element
    while (node && getComputedStyle(node).position !== 'fixed') node = node.parentElement
    const target = node || element
    const rect = target.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  return { button, box }
}

/** @returns {boolean} Whether two measured boxes overlap. */
function intersects(a, b) {
  if (!a || !b) return false
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * Asserts the summary table remains readable without sideways page scrolling and
 * the footer legal links can be reached above the pinned CTA.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectSummaryAndFooterReachable(page) {
  await expect(page.getByRole('heading', { name: 'Parts breakdown' })).toBeVisible()

  const table = page.getByRole('table').first()
  await expect(table).toBeVisible()
  await expect(table).toContainText('Total')

  const tableMetrics = await table.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
  })
  const viewportWidth = page.viewportSize().width
  expect(tableMetrics.left).toBeGreaterThanOrEqual(-1)
  expect(tableMetrics.right).toBeLessThanOrEqual(viewportWidth + 1)
  expect(tableMetrics.scrollWidth, 'parts table should stack instead of needing sideways scrolling').toBeLessThanOrEqual(tableMetrics.clientWidth + 1)

  const { box: ctaBox } = await pinnedCta(page)
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))

  const footer = page.locator('footer').first()
  await expect(footer).toBeVisible()
  const privacy = footer.getByRole('link', { name: 'Privacy' })
  const terms = footer.getByRole('link', { name: 'Terms' })
  await expect(privacy).toBeVisible()
  await expect(terms).toBeVisible()

  const footerBox = await footer.boundingBox()
  expect(footerBox).not.toBeNull()
  expect(footerBox.y + footerBox.height, 'footer must clear the pinned CTA').toBeLessThanOrEqual(ctaBox.y + 1)

  const privacyIsCovered = await privacy.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return !hit || !(hit === element || element.contains(hit))
  })
  expect(privacyIsCovered, 'footer Privacy link must be clickable, not covered by the CTA').toBe(false)
}

/** Returns the shell's mobile menu trigger. */
function menuToggle(page) {
  return page.getByRole('button', { name: /menu|navigation/i }).first()
}

/**
 * Resolves the drawer from the toggle's aria-controls contract.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ toggle: import('@playwright/test').Locator, drawerId: string, drawer: import('@playwright/test').Locator }>}
 */
async function drawerFromToggle(page) {
  const toggle = menuToggle(page)
  const drawerId = await toggle.getAttribute('aria-controls')
  expect(drawerId, 'menu toggle must expose aria-controls').toBeTruthy()
  return { toggle, drawerId, drawer: page.locator(`[id="${drawerId}"]`) }
}

/**
 * Asserts the open drawer is fully inside the viewport and does not create page overflow.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} drawer
 * @returns {Promise<void>}
 */
async function expectDrawerContained(page, drawer) {
  await expect(drawer).toBeVisible()
  const { width, height } = page.viewportSize()

  // Wait for the full-screen menu's entrance to settle before measuring its bounds.
  await expect.poll(async () => {
    const box = await drawer.boundingBox()
    return box ? box.x + box.width - width : Infinity
  }, { timeout: DRAWER_SETTLE_TIMEOUT }).toBeLessThanOrEqual(1)

  const box = await drawer.boundingBox()
  expect(box, 'open drawer must have a measurable box').not.toBeNull()
  expect(Math.abs(box.x), 'menu must reach the left viewport edge').toBeLessThanOrEqual(1)
  expect(Math.abs(box.y), 'menu must reach the top viewport edge').toBeLessThanOrEqual(1)
  expect(Math.abs(box.width - width), 'menu must fill the viewport width').toBeLessThanOrEqual(1)
  expect(Math.abs(box.height - height), 'menu must fill the viewport height').toBeLessThanOrEqual(1)
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1)
  await expectNoPageOverflow(page)
}

/**
 * Opens the mobile drawer and verifies its contained open state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ viaTouch?: boolean }} [options]
 * @returns {Promise<{ toggle: import('@playwright/test').Locator, drawerId: string, drawer: import('@playwright/test').Locator }>}
 */
async function openMobileDrawer(page, { viaTouch = false } = {}) {
  const { toggle, drawerId, drawer } = await drawerFromToggle(page)
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  const toggleBox = await toggle.boundingBox()
  expect(Math.abs(toggleBox.x + toggleBox.width - (page.viewportSize().width - 20)), 'hamburger must be the rightmost header control').toBeLessThanOrEqual(1)
  if (viaTouch) await toggle.tap()
  else await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expectDrawerContained(page, drawer)
  return { toggle, drawerId, drawer }
}

/** @returns {Promise<boolean>} Whether focus is currently inside the drawer. */
function focusInsideDrawer(page, drawerId) {
  return page.evaluate((id) => Boolean(document.getElementById(id)?.contains(document.activeElement)), drawerId)
}

/**
 * Asserts the mobile menu is reachable, opens, navigates, and closes after use.
 * Navigation must restore focus to the trigger and remove the drawer from reach.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ viaTouch?: boolean }} [options]
 * @returns {Promise<void>}
 */
async function expectMobileMenuClosesAfterNavigation(page, { viaTouch = false } = {}) {
  const { toggle, drawer } = await openMobileDrawer(page, { viaTouch })
  const aboutLink = drawer.getByRole('link', { name: /^About( us)?$/i }).first()
  await expect(aboutLink).toBeVisible()

  if (viaTouch) await aboutLink.tap()
  else await aboutLink.click()

  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole('heading', { name: 'Le Chaton Typers' })).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(aboutLink).toBeHidden()
  await expect(toggle).toBeFocused()
}

/**
 * Asserts keyboard focus stays inside the open drawer and Escape restores it.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectDrawerKeyboardLifecycle(page) {
  const { toggle, drawerId } = await openMobileDrawer(page)
  expect(await focusInsideDrawer(page, drawerId), 'opening the drawer should move focus into it').toBe(true)

  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab')
    expect(await focusInsideDrawer(page, drawerId), 'Tab must not escape the open drawer').toBe(true)
  }
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusInsideDrawer(page, drawerId), 'Shift+Tab must not escape the open drawer').toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()

  // The closed drawer must not keep trapping focus. The next Tab moves elsewhere.
  await page.keyboard.press('Tab')
  expect(await focusInsideDrawer(page, drawerId)).toBe(false)
}

/**
 * Asserts a same-route drawer link closes the drawer and restores trigger focus.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} routePath
 * @param {RegExp} linkName
 * @returns {Promise<void>}
 */
async function expectSameRouteDrawerClose(page, routePath, linkName) {
  await page.goto(routePath, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(`${routePath}$`))
  const { toggle, drawer } = await openMobileDrawer(page)
  const link = drawer.getByRole('link', { name: linkName }).first()
  await expect(link).toBeVisible()
  await link.click()

  await expect(page).toHaveURL(new RegExp(`${routePath}$`))
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
}

/**
 * Seeds an applied 15% voucher before app boot so the summary shows a realistic
 * discounted total on the narrowest phone.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function seedAppliedVoucher(page) {
  await page.addInitScript(() => {
    localStorage.setItem('lct_ld', JSON.stringify({
      used: true,
      prize: 'p15',
      code: 'FATCAT15',
      expires: Date.now() + 15 * 60 * 1000,
      applied: true,
    }))
  })
}

/**
 * Asserts the applied-voucher total label wraps inside the viewport.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectVoucherTotalContained(page) {
  const voucherLabel = page.getByText(/Build total with FATCAT15/i).first()
  await expect(voucherLabel).toBeVisible()
  const metrics = await voucherLabel.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
  })
  const viewportWidth = page.viewportSize().width
  expect(metrics.left).toBeGreaterThanOrEqual(-1)
  expect(metrics.right).toBeLessThanOrEqual(viewportWidth + 1)
  expect(metrics.scrollWidth, 'voucher total label must wrap, not overflow').toBeLessThanOrEqual(metrics.clientWidth + 1)
  await expectNoPageOverflow(page)
  await expect((await pinnedCta(page)).button).toBeVisible()
}

/**
 * Hides the mascot and verifies the recovery paw tab clears the pinned CTA.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectHiddenMascotPawTabClearsCta(page) {
  const mascot = page.getByRole('button', { name: /Open chat with Biscuit/i }).first()
  await expect(mascot).toBeVisible()
  // The mascot has an infinite bob animation; force the real click so Playwright
  // does not wait forever for a transient "stable" position.
  await mascot.click({ force: true })

  const hide = page.getByRole('button', { name: /Hide Biscuit/i })
  await expect(hide).toBeVisible()
  // The chat is also inside the transformed/animated mascot layer; force the real
  // UI click so actionability does not wait on a transient layer position.
  await hide.click({ force: true })

  const pawTab = page.getByRole('button', { name: /Bring Biscuit back/i })
  await expect(pawTab).toBeVisible()
  const { box: ctaBox } = await pinnedCta(page)
  const pawBox = await pawTab.boundingBox()
  const viewport = page.viewportSize()
  expect(pawBox).not.toBeNull()
  expect(intersects(pawBox, ctaBox), 'hidden-mascot paw tab must not cover the pinned CTA').toBe(false)
  expect(pawBox.x).toBeGreaterThanOrEqual(-1)
  expect(pawBox.x + pawBox.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(pawBox.y).toBeGreaterThanOrEqual(-1)
  expect(pawBox.y + pawBox.height).toBeLessThanOrEqual(viewport.height + 1)
}

/**
 * Verifies the browser accessibility tree exposes the expected table semantics.
 * Uses Chromium CDP because Playwright's legacy accessibility snapshot is absent.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectTableAccessibilityRoles(page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Accessibility.enable')
  const { nodes } = await client.send('Accessibility.getFullAXTree')
  const roles = nodes.map((node) => node.role?.value).filter(Boolean)
  for (const role of ['table', 'row', 'columnheader', 'cell']) {
    expect(roles, `browser accessibility tree must expose role ${role}`).toContain(role)
  }
  const headerNames = nodes
    .filter((node) => node.role?.value === 'columnheader')
    .map((node) => String(node.name?.value || '').trim().toLowerCase())
  expect(headerNames).toEqual(expect.arrayContaining(['part', 'pick', 'price']))
}

/**
 * Emulates a touch-capable hybrid by making any-pointer:coarse match while the
 * primary pointer remains fine. This exercises the scene's capability check; it
 * is media-query emulation, not physical hybrid hardware.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function emulateHybridCoarsePointer(page) {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      if (query === '(any-pointer: coarse)') {
        return {
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() { return false },
        }
      }
      return nativeMatchMedia(query)
    }
  })
}

/**
 * Dispatches a synthetic touch path through Chromium's compositor path.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array<{ x: number, y: number }>} points - First point is touchStart, rest are moves.
 * @returns {Promise<void>}
 */
async function dispatchTouchPath(page, points) {
  const [start, ...moves] = points
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }],
  })
  for (const point of moves) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }],
    })
    await page.waitForTimeout(16)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Asserts the in-place title editor remains fully inside the viewport when opened.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectTitleEditorInViewport(page) {
  const rename = page.getByRole('button', { name: /Rename keyboard build/i })
  await expect(rename).toBeVisible()
  await rename.click()

  const input = page.getByRole('textbox', { name: /Name for this build/i })
  await expect(input).toBeVisible()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

  const box = await input.boundingBox()
  const { width, height } = page.viewportSize()
  expect(box).not.toBeNull()
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1)

  await expectNoPageOverflow(page)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(input).toBeHidden()
}

/**
 * Asserts deterministic overlays (mascot and toast) do not cover the pinned CTA.
 * The toast is triggered through the visible "Copy parts list" action so both the
 * success and clipboard-blocked messages satisfy the same reachability check.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectOverlaysClearCta(page) {
  const { box: ctaBox } = await pinnedCta(page)

  const mascot = page.getByRole('button', { name: /Open chat with Biscuit|Close chat with Biscuit/i }).first()
  await expect(mascot).toBeVisible()
  const mascotBox = await mascot.boundingBox()
  expect(intersects(mascotBox, ctaBox), 'mascot must not cover the pinned CTA').toBe(false)

  await page.getByRole('button', { name: /Copy parts list/i }).click()
  const toast = page.getByRole('status').filter({ hasText: /Parts list copied|Copy is blocked/i }).first()
  await expect(toast).toBeVisible()
  // The toast slides in over 250ms. Measure its resting position so the transient
  // translateY(20px) entry state is not mistaken for persistent CTA obstruction.
  await page.waitForTimeout(TOAST_SETTLE_MS)
  const toastBox = await toast.boundingBox()
  expect(intersects(toastBox, ctaBox), 'toast must not cover the pinned CTA').toBe(false)
}

/**
 * Asserts the /build identity group holds: the rename control sits beside the
 * title at every width, and the Save action lives in the right place — in the
 * header beside the title on desktop, and moved into the floating bar on phones
 * and tablets.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ stacked: boolean }} options - `stacked: true` for the mobile layout.
 * @returns {Promise<void>}
 */
async function expectHeaderIdentityGrouped(page, { stacked }) {
  const rename = page.getByRole('button', { name: /Rename keyboard build/i })
  await expect(rename).toBeVisible()

  const boxes = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`missing ${selector}`)
      const b = el.getBoundingClientRect()
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
    }
    return {
      title: rect('#summary .title-row h1'),
      rename: rect('#summary .icon-btn-edit'),
      headerSave: rect('#summary .save-action-group'),
      barSave: rect('#summary .bar-save'),
      barActions: rect('#summary .bar-actions'),
    }
  })

  // Rename control anchored directly right of the title, inside its vertical band.
  expect(boxes.rename.x, 'rename icon must sit right of the title').toBeGreaterThan(boxes.title.x + 1)
  expect(boxes.rename.y, 'rename icon must align with the title, not a detached row').toBeGreaterThanOrEqual(boxes.title.y - 2)
  expect(boxes.rename.bottom, 'rename icon must align with the title, not a detached row').toBeLessThanOrEqual(boxes.title.bottom + 2)

  if (stacked) {
    // Phone/tablet: header Save removed, Save present in the floating bar and
    // sharing its action row rather than floating on its own line.
    expect(boxes.headerSave.width, 'header Save must be removed on phones').toBe(0)
    expect(boxes.barSave.width, 'Save must move into the floating bar').toBeGreaterThan(0)
    const barOverlap = Math.min(boxes.barSave.bottom, boxes.barActions.bottom) - Math.max(boxes.barSave.y, boxes.barActions.y)
    expect(barOverlap, 'bar Save must share the bar action row').toBeGreaterThan(0)
  } else {
    // Wide: header Save shares the title row (vertical overlap), right of title;
    // the bar copy stays hidden.
    const overlap = Math.min(boxes.headerSave.bottom, boxes.title.bottom) - Math.max(boxes.headerSave.y, boxes.title.y)
    expect(overlap, 'header Save must share the title row on wide screens').toBeGreaterThan(0)
    expect(boxes.headerSave.x, 'header Save must sit to the right of the title').toBeGreaterThan(boxes.title.x)
    expect(boxes.barSave.width, 'bar Save must stay hidden on desktop').toBe(0)
  }

  await expectNoPageOverflow(page)
}

/**
 * Asserts the three build attribute chips sit on a single visual row (no chip
 * wrapped below) and stay inside the viewport without clipping or overflow.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectSpecChipsOneRow(page) {
  const chips = page.locator('#summary .subtitle-badge span')
  await expect(chips).toHaveCount(3)

  const tops = await chips.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  expect(Math.max(...tops) - Math.min(...tops), 'all three chips must share one row').toBeLessThanOrEqual(2)

  // Each chip keeps its full label (no ellipsis) and stays within the viewport.
  const labels = await chips.allInnerTexts()
  for (const label of labels) expect(label).not.toContain('…')
  const badge = await page.locator('#summary .subtitle-badge').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { left: b.left, right: b.right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  })
  const viewportWidth = page.viewportSize().width
  expect(badge.left).toBeGreaterThanOrEqual(-1)
  expect(badge.right).toBeLessThanOrEqual(viewportWidth + 1)
  expect(badge.scrollWidth, 'chips must not overflow the badge').toBeLessThanOrEqual(badge.clientWidth + 1)
  await expectNoPageOverflow(page)
}

test.describe('responsive route containment', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: /build, /privacy and /terms stay inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const route of ROUTES) {
        await openRoute(page, route)
        await expectNoPageOverflow(page)
        await expectStageStripContained(page)
      }

      if (viewport.kind === 'desktop') {
        await openRoute(page, ROUTES[0])
        await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Know your keyboard', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: COMPARE_LINK })).toBeVisible()
        await expect(page.getByRole('link', { name: 'About us', exact: true })).toBeVisible()
        await expect(page.getByRole('table').first()).toBeVisible()
      }
    })
  }
})

test.describe('mobile menu navigation', () => {
  for (const viewport of MOBILE_NAV_VIEWPORTS) {
    test(`${viewport.name}: menu opens, stays contained, and closes after navigation`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openRoute(page, ROUTES[0])
      await expectMobileMenuClosesAfterNavigation(page)
    })
  }

  test('phone 390: drawer traps Tab, Escape restores focus, same-route link closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openRoute(page, ROUTES[0])
    await expectDrawerKeyboardLifecycle(page)
    await expectSameRouteDrawerClose(page, '/about', /^About( us)?$/i)
  })
})

test.describe('mobile build interactions', () => {
  for (const phone of PHONES) {
    test(`${phone.name}: title editor, summary, footer and overlays stay usable`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height })
      await openRoute(page, ROUTES[0])
      const { box: barBox } = await pinnedCta(page)
      expect(barBox.height, 'checkout bar should remain compact on phones').toBeLessThanOrEqual(116)
      await expectTitleEditorInViewport(page)
      await expectSummaryAndFooterReachable(page)
      await expectOverlaysClearCta(page)
    })
  }

  test('phone 320: applied voucher total wraps without page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await seedAppliedVoucher(page)
    await openRoute(page, ROUTES[0])
    await expectVoucherTotalContained(page)
  })

  test('phone 320: hidden mascot paw tab clears the pinned CTA', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openRoute(page, ROUTES[0])
    await expectHiddenMascotPawTabClearsCta(page)
  })

  test('phone 320: stacked parts table keeps browser accessibility roles', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openRoute(page, ROUTES[0])
    await expect(page.getByRole('table').first()).toBeVisible()
    await expectTableAccessibilityRoles(page)
  })

  test('phone 320: parts card keeps the price in a right column and wraps long names', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openRoute(page, ROUTES[0])

    // Long, unbreakable part name must wrap inside the card without page overflow.
    const firstRow = page.locator('#summary .tbl tbody tr').first()
    await expect(firstRow).toBeVisible()
    const priceText = await firstRow.locator('td[data-label="Price"]').innerText()
    expect(priceText.toLowerCase()).not.toContain('price')

    const boxes = await firstRow.evaluate((row) => {
      const rect = (sel) => {
        const el = row.querySelector(sel)
        const b = el.getBoundingClientRect()
        return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width }
      }
      return {
        group: rect('td[data-label="Part"]'),
        price: rect('td[data-label="Price"]'),
        pick: rect('td[data-label="Pick"]'),
      }
    })

    // Group name and price share the top line; price sits to the right.
    expect(Math.abs(boxes.price.y - boxes.group.y), 'price must share the group line').toBeLessThan(10)
    expect(boxes.price.x, 'price must sit to the right of the group name').toBeGreaterThan(boxes.group.x + 1)
    // Part name + spec run full width below the header line.
    expect(boxes.pick.y, 'part name must sit below the header line').toBeGreaterThan(boxes.group.y + 1)
    expect(boxes.pick.width, 'part name must span the card width').toBeGreaterThan(boxes.price.width)

    // Save in the bar must not have pushed the tray past its compact bound.
    const { box: barBox } = await pinnedCta(page)
    expect(barBox.height, 'checkout bar stays compact with Save added').toBeLessThanOrEqual(116)
    await expectNoPageOverflow(page)
  })

  for (const width of [320, 390]) {
    test(`phone ${width}: three build attribute chips stay on one row`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 })
      await openRoute(page, ROUTES[0])
      await expectSpecChipsOneRow(page)
      // Compact phone sizing is applied; desktop keeps 12px.
      const size = await page.locator('#summary .subtitle-badge span').first().evaluate((el) => getComputedStyle(el).fontSize)
      expect(size).toBe('10.5px')
    })
  }

  test('phone 320: rename stays beside the title, Save moves into the bar, long names never overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openRoute(page, ROUTES[0])
    await expectHeaderIdentityGrouped(page, { stacked: true })

    const { box: barBox } = await pinnedCta(page)
    expect(barBox.height, 'save-in-bar keeps the compact checkout tray').toBeLessThanOrEqual(116)

    const rename = page.getByRole('button', { name: /Rename keyboard build/i })
    const heading = page.locator('#summary .title-row h1')
    const input = page.getByRole('textbox', { name: /Name for this build/i })

    // Commit a 60-character name with the keyboard (Enter).
    await rename.click()
    await input.fill('A'.repeat(60))
    await input.press('Enter')
    await expect(heading).toHaveText('A'.repeat(60))
    // The rename control stays anchored beside the wrapped long title.
    await expectHeaderIdentityGrouped(page, { stacked: true })

    // Escape cancels a new draft without replacing the committed name.
    await rename.click()
    await input.fill('Discarded draft')
    await input.press('Escape')
    await expect(heading).toHaveText('A'.repeat(60))
    await expectNoPageOverflow(page)
  })
})

test.describe('desktop chrome', () => {
  test('build review includes the merged interactive Type tester', async ({ page }) => {
    await openRoute(page, ROUTES[0])
    await page.getByRole('tab', { name: 'Type tester' }).click()
    const tester = page.getByRole('group', { name: /Keyboard tester controls/i })
    await expect(tester).toBeVisible()
    await expect(tester.locator('[data-key-id]')).toHaveCount(84)
    await expect(tester.getByRole('slider', { name: /volume/i })).toBeVisible()
    await page.getByRole('tab', { name: '3D view' }).click()
    await expect(tester).toBeHidden()
  })

  test('desktop 1280: primary navigation and the parts table remain available', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openRoute(page, ROUTES[0])

    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Know your keyboard', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: COMPARE_LINK })).toBeVisible()
    await expect(page.getByRole('link', { name: 'About us', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
    await expectStageStripContained(page)

    const table = page.getByRole('table').first()
    await expect(table).toBeVisible()
    await expect(table).toContainText('Total')
    await expectNoPageOverflow(page)
  })

  test('desktop 1280: rename stays beside the title and Save shares the header row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openRoute(page, ROUTES[0])
    await expectHeaderIdentityGrouped(page, { stacked: false })
  })

  test('desktop 1280: active site nav uses a filled ink pill; progress strip unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()

    const active = page.locator('.topnav-links .navlink.on')
    await expect(active).toHaveCount(1)
    await expect(active).toHaveAttribute('aria-current', 'page')

    const styles = await active.evaluate((el) => {
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, offset: s.textDecorationLine }
    })
    // Filled, rounded pill with contrasting text — not a transparent underlined link.
    expect(styles.bg, 'active nav must be filled').not.toBe('rgba(0, 0, 0, 0)')
    expect(styles.radius, 'active nav pill must be rounded').not.toBe('0px')
    expect(styles.bg, 'fill and text must contrast').not.toBe(styles.color)
    expect(styles.offset, 'active nav must not rely on an underline').toBe('none')

    // The Build progress strip keeps its own active treatment. Its step is only
    // active on a builder route, so check it there; its fill differs from the
    // site-nav ink pill.
    await page.goto('/parts', { waitUntil: 'domcontentloaded' })
    const step = page.locator('.stages .stg.on')
    await expect(step).toHaveCount(1)
    const stepBg = await step.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(stepBg, 'progress strip keeps its existing active background').not.toBe(styles.bg)
  })

  test('desktop 1280: spec chips keep their original larger sizing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openRoute(page, ROUTES[0])
    const size = await page.locator('#summary .subtitle-badge span').first().evaluate((el) => getComputedStyle(el).fontSize)
    expect(size, 'desktop chips are unchanged at 12px').toBe('12px')
    await expectSpecChipsOneRow(page)
  })

  test('desktop 1280: fine-pointer canvas keeps touch-action none for mouse orbit', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openRoute(page, ROUTES[0])

    const canvas = page.locator('canvas.lct-build-preview-canvas').first()
    await expect(canvas).toBeVisible()
    await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction), { timeout: SCENE_READY_TIMEOUT }).toBe('none')

    const pointer = await canvas.evaluate(() => ({
      coarse: window.matchMedia('(pointer: coarse)').matches,
      fine: window.matchMedia('(pointer: fine)').matches,
    }))
    expect(pointer.coarse).toBe(false)
    expect(pointer.fine).toBe(true)
  })

  test('desktop 1280: hybrid coarse-pointer capability selects pan-y while primary pointer stays fine', async ({ page }) => {
    await emulateHybridCoarsePointer(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openRoute(page, ROUTES[0])

    const canvas = page.locator('canvas.lct-build-preview-canvas').first()
    await expect(canvas).toBeVisible()
    await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction), { timeout: SCENE_READY_TIMEOUT }).toBe('pan-y')

    const pointer = await canvas.evaluate(() => ({
      fine: window.matchMedia('(pointer: fine)').matches,
      anyCoarse: window.matchMedia('(any-pointer: coarse)').matches,
    }))
    expect(pointer.fine, 'hybrid emulation must keep the fine primary pointer').toBe(true)
    expect(pointer.anyCoarse, 'hybrid emulation must expose a coarse-capable pointer').toBe(true)
  })
})

test.describe('synthetic touch navigation', () => {
  // Emulated touch in Chromium: this proves the touch path is wired, not that a
  // physical phone/tablet behaves identically. Real-device evidence stays separate.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('phone 390: touch tap opens the menu and a touch tap navigates then closes it', async ({ page }) => {
    await openRoute(page, ROUTES[0])
    await expectMobileMenuClosesAfterNavigation(page, { viaTouch: true })
  })

  test('phone 390: synthetic CDP vertical swipe over the 3D canvas scrolls the page', async ({ page }) => {
    await openRoute(page, ROUTES[0])

    const canvas = page.locator('canvas.lct-build-preview-canvas').first()
    await expect(canvas).toBeVisible()
    // Scene setup runs after mount; touch-capable inputs switch the canvas from
    // OrbitControls' default touch-action:none to pan-y so the page can scroll.
    await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction), { timeout: SCENE_READY_TIMEOUT }).toBe('pan-y')

    await canvas.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    const box = await canvas.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()

    const startX = box.x + box.width / 2
    const startY = Math.min(box.y + box.height * 0.65, viewport.height - 80)
    expect(startY).toBeGreaterThan(box.y + 10)
    expect(startY).toBeLessThan(box.y + box.height - 10)

    const before = await page.evaluate(() => window.scrollY)
    const points = Array.from({ length: 11 }, (_, step) => ({ x: startX, y: startY - step * 14 }))
    // CDP touch events exercise Chromium's real compositor/scroll path. This is
    // synthetic emulation, not physical-device evidence.
    await dispatchTouchPath(page, points)

    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: SCROLL_SETTLE_TIMEOUT }).toBeGreaterThan(before + 30)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
  })

  test('phone 390: synthetic CDP horizontal swipe rotates the model without page drift', async ({ page }) => {
    await openRoute(page, ROUTES[0])

    const canvas = page.locator('canvas.lct-build-preview-canvas').first()
    await expect(canvas).toBeVisible()
    await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction), { timeout: SCENE_READY_TIMEOUT }).toBe('pan-y')
    await expect.poll(
      () => canvas.evaluate((element) => Boolean(element.__sceneInstance?.getCameraState)),
      { timeout: SCENE_READY_TIMEOUT },
    ).toBe(true)

    await canvas.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    const box = await canvas.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()

    const startX = box.x + box.width * 0.35
    const startY = Math.min(box.y + box.height * 0.55, viewport.height - 80)
    expect(startY).toBeGreaterThan(box.y + 10)
    expect(startY).toBeLessThan(box.y + box.height - 10)

    const before = await canvas.evaluate((element) => element.__sceneInstance.getCameraState())
    const beforeScrollY = await page.evaluate(() => window.scrollY)
    const points = Array.from({ length: 9 }, (_, step) => ({ x: startX + step * 14, y: startY }))
    await dispatchTouchPath(page, points)

    await expect.poll(async () => {
      const state = await canvas.evaluate((element) => element.__sceneInstance?.getCameraState?.())
      if (!state) return 0
      return Math.hypot(
        state.position[0] - before.position[0],
        state.position[1] - before.position[1],
        state.position[2] - before.position[2],
      )
    }, { timeout: SCROLL_SETTLE_TIMEOUT }).toBeGreaterThan(0.01)
    await expect.poll(() => canvas.evaluate((element) => element.__sceneInstance.getCameraPreset()), { timeout: SCROLL_SETTLE_TIMEOUT }).toBe('custom')
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
    expect(Math.abs(await page.evaluate(() => window.scrollY) - beforeScrollY)).toBeLessThanOrEqual(1)
  })
})
