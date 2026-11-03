import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SummaryView from '../../src/views/SummaryView.vue'
import Keyboard3DView from '../../src/components/Keyboard3DView.vue'
import TypeTesterView from '../../src/components/TypeTesterView.vue'
import { CATS, catalog } from '../../src/data/catalog.js'
import { grams } from '../../src/logic/builder.js'
import {
  discardCurrentBuild,
  idsOf,
  loadBuild,
  openSavedBuild,
  setLayout,
  startBuild,
  state,
} from '../../src/store.js'

enableAutoUnmount(afterEach)

/**
 * Creates a fresh full 8-part build object for the chosen layout.
 *
 * @param {'60'|'75'|'100'} [layout='75'] - Keyboard layout format.
 * @returns {Record<string, object>}
 */
function createFullBuild(layout = '75') {
  const options = catalog(layout)
  return Object.fromEntries(CATS.map((group) => [group, { ...options[group][0] }]))
}

let activeWrapper = null

/**
 * Mounts SummaryView inside an isolated memory router context.
 *
 * @returns {Promise<import('@vue/test-utils').VueWrapper>}
 */
async function mountSummary() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/build', component: SummaryView },
      { path: '/parts', component: { template: '<div>Parts</div>' } },
      { path: '/cart', component: { template: '<div>Cart</div>' } },
      { path: '/account', component: { template: '<div>Account</div>' } },
    ],
  })
  await router.push('/build')
  await router.isReady()
  activeWrapper = mount(SummaryView, {
    global: {
      plugins: [router],
      stubs: { ProfileChips: true },
    },
  })
  return activeWrapper
}

describe('SummaryView /build 3D view and red status tags', () => {
  beforeEach(() => {
    try {
      sessionStorage.removeItem('summaryView')
    } catch {
      /* ignore */
    }
    state.build = createFullBuild('75')
    state.rec = createFullBuild('75')
    state.cat = catalog('75')
    state.answers = { ...state.answers, layout: '75', budget: 350 }
    state.savedBuildReview = null
    state.savedBuildBaselineIds = null
    state.editingSavedBuildId = null
    state.editingSavedBuildName = ''
  })

  afterEach(() => {
    if (activeWrapper) {
      activeWrapper.unmount()
      activeWrapper = null
    }
    discardCurrentBuild()
    state.savedBuildReview = null
    state.savedBuildBaselineIds = null
    state.editingSavedBuildId = null
    state.editingSavedBuildName = ''
    try {
      sessionStorage.removeItem('summaryView')
    } catch {
      /* ignore */
    }
  })

  it('renders Keyboard3DView by default in the 3D view tab', async () => {
    const wrapper = await mountSummary()

    const viewToggleButtons = wrapper.findAll('.viewtoggle button')
    expect(viewToggleButtons).toHaveLength(2)
    expect(viewToggleButtons[0].text()).toContain('3D view')
    expect(viewToggleButtons[0].classes()).toContain('primary')
    expect(viewToggleButtons[0].attributes('aria-selected')).toBe('true')

    expect(wrapper.findComponent(Keyboard3DView).exists()).toBe(true)
    expect(wrapper.findComponent(TypeTesterView).exists()).toBe(false)
  })

  it('switches between 3D view and Type tester tabs interactively', async () => {
    const wrapper = await mountSummary()

    const viewToggleButtons = wrapper.findAll('.viewtoggle button')
    const typeTesterBtn = viewToggleButtons[1]
    expect(typeTesterBtn.text()).toContain('Type tester')

    // Switch to Type tester tab
    await typeTesterBtn.trigger('click')

    expect(wrapper.findComponent(TypeTesterView).exists()).toBe(true)
    expect(wrapper.findComponent(Keyboard3DView).exists()).toBe(false)
    expect(typeTesterBtn.classes()).toContain('primary')
    expect(typeTesterBtn.attributes('aria-selected')).toBe('true')

    // Switch back to 3D view tab
    const threeDBtn = viewToggleButtons[0]
    await threeDBtn.trigger('click')

    expect(wrapper.findComponent(Keyboard3DView).exists()).toBe(true)
    expect(wrapper.findComponent(TypeTesterView).exists()).toBe(false)
    expect(threeDBtn.classes()).toContain('primary')
  })

  it('renders "Unavailable" red status tag when a part has null price or unavailable flag', async () => {
    state.build.keycaps = { ...state.build.keycaps, price: null, unavailable: true }
    const wrapper = await mountSummary()

    const tag = wrapper.find('[data-testid="part-status-tag-keycaps"]')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('part-status-tag')
    expect(tag.text()).toBe('Unavailable')

    // The corresponding row must have is-flagged-part
    const row = tag.element.closest('tr')
    expect(row?.classList.contains('is-flagged-part')).toBe(true)
  })

  it('renders "Incompatible" red status tag when saved build review reports an incompatibility', async () => {
    state.savedBuildReview = {
      issues: [
        { group: 'switches', type: 'incompatible', message: 'Incompatible socket pin configuration' },
      ],
    }
    const wrapper = await mountSummary()

    const tag = wrapper.find('[data-testid="part-status-tag-switches"]')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('part-status-tag')
    expect(tag.text()).toBe('Incompatible')

    const row = tag.element.closest('tr')
    expect(row?.classList.contains('is-flagged-part')).toBe(true)
  })

  it('renders "Price changed" red status tag when saved build review reports a price drift', async () => {
    state.savedBuildReview = {
      issues: [
        { group: 'case', type: 'price-changed', message: 'Case price has changed in current catalog' },
      ],
    }
    const wrapper = await mountSummary()

    const tag = wrapper.find('[data-testid="part-status-tag-case"]')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('part-status-tag')
    expect(tag.text()).toBe('Price changed')

    const row = tag.element.closest('tr')
    expect(row?.classList.contains('is-flagged-part')).toBe(true)
  })

  it('renders "Differs from saved" red status tag when a part differs from baseline IDs', async () => {
    const originalBuild = createFullBuild('75')
    const originalIds = idsOf(originalBuild)

    // Baseline tracks original build part IDs
    state.savedBuildBaselineIds = { ...originalIds }
    state.editingSavedBuildId = 'saved-build-123'
    state.savedBuildReview = null

    // User swaps the cable part to an alternative
    const options = catalog('75')
    const alternativeCable = options.cable[1] || { id: 'alt-cable', name: 'Coiled Custom Cable', price: 35 }
    state.build = { ...originalBuild, cable: alternativeCable }

    const wrapper = await mountSummary()

    const tag = wrapper.find('[data-testid="part-status-tag-cable"]')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('part-status-tag')
    expect(tag.text()).toBe('Differs from saved')

    const row = tag.element.closest('tr')
    expect(row?.classList.contains('is-flagged-part')).toBe(true)

    // Other untouched parts must not be flagged
    expect(wrapper.find('[data-testid="part-status-tag-case"]').exists()).toBe(false)
  })

  it('renders "Incompatible" red status tag when real-time compatibility rule fails', async () => {
    // When case has no battery bay (nobatt: true) and pcb is wireless (wl: true)
    state.build.case = { ...state.build.case, nobatt: true }
    state.build.pcb = { ...state.build.pcb, wl: true }
    const wrapper = await mountSummary()

    const caseTag = wrapper.find('[data-testid="part-status-tag-case"]')
    expect(caseTag.exists()).toBe(true)
    expect(caseTag.text()).toBe('Incompatible')

    const pcbTag = wrapper.find('[data-testid="part-status-tag-pcb"]')
    expect(pcbTag.exists()).toBe(true)
    expect(pcbTag.text()).toBe('Incompatible')
  })

  it('renders no status tags when all parts are valid, compatible, and match baseline', async () => {
    const wrapper = await mountSummary()

    for (const group of CATS) {
      expect(wrapper.find(`[data-testid="part-status-tag-${group}"]`).exists()).toBe(false)
    }
    expect(wrapper.findAll('tr.is-flagged-part')).toHaveLength(0)
  })

  it('supports ARIA tab semantics and keyboard arrow navigation between tabs', async () => {
    const wrapper = await mountSummary()

    const viewToggleButtons = wrapper.findAll('.viewtoggle button')
    const threeDBtn = viewToggleButtons[0]
    const typeTesterBtn = viewToggleButtons[1]

    expect(threeDBtn.attributes('id')).toBe('tab-3d')
    expect(threeDBtn.attributes('aria-controls')).toBe('summary-view-panel')
    expect(threeDBtn.attributes('tabindex')).toBe('0')
    expect(threeDBtn.attributes('aria-selected')).toBe('true')

    expect(typeTesterBtn.attributes('id')).toBe('tab-type')
    expect(typeTesterBtn.attributes('aria-controls')).toBe('summary-view-panel')
    expect(typeTesterBtn.attributes('tabindex')).toBe('-1')
    expect(typeTesterBtn.attributes('aria-selected')).toBe('false')

    const viewpanel = wrapper.find('.viewpanel')
    expect(viewpanel.attributes('id')).toBe('summary-view-panel')
    expect(viewpanel.attributes('aria-labelledby')).toBe('tab-3d')

    // Arrow navigation from 3D view tab to Type tester tab
    await threeDBtn.trigger('keydown.right')
    expect(wrapper.findComponent(TypeTesterView).exists()).toBe(true)
    expect(threeDBtn.attributes('tabindex')).toBe('-1')
    expect(threeDBtn.attributes('aria-selected')).toBe('false')
    expect(typeTesterBtn.attributes('tabindex')).toBe('0')
    expect(typeTesterBtn.attributes('aria-selected')).toBe('true')
    expect(viewpanel.attributes('aria-labelledby')).toBe('tab-type')

    // Arrow navigation back via keydown.left
    await typeTesterBtn.trigger('keydown.left')
    expect(wrapper.findComponent(Keyboard3DView).exists()).toBe(true)
    expect(threeDBtn.attributes('tabindex')).toBe('0')
    expect(threeDBtn.attributes('aria-selected')).toBe('true')
  })

  it('formats table prices using canonical money/Included and places Copy parts list in panel header', async () => {
    const wrapper = await mountSummary()

    // Copy parts list is in the parts-panel header, not the sticky bottom bar
    const partsPanel = wrapper.find('.parts-panel')
    expect(partsPanel.exists()).toBe(true)
    const copyBtn = partsPanel.find('.panel-header button')
    expect(copyBtn.exists()).toBe(true)
    expect(copyBtn.text()).toContain('Copy parts list')
    expect(wrapper.find('.bar-actions').text()).not.toContain('Copy parts list')

    // Canonical price formatting (S$XX or Included)
    const priceCells = wrapper.findAll('.tbl tbody td.r')
    expect(priceCells.length).toBe(CATS.length)
    for (const cell of priceCells) {
      expect(cell.text()).toMatch(/^(S\$\d+|Included|Unavailable)$/)
      expect(cell.text()).not.toContain('—')
    }

    // Table footer has colspan="2" for Total
    const footerLabel = wrapper.find('.tbl tfoot tr td')
    expect(footerLabel.attributes('colspan')).toBe('2')
    expect(footerLabel.text()).toBe('Total')
  })

  it('does not render a budget meter bar and omits pct computed property', async () => {
    const wrapper = await mountSummary()
    expect(wrapper.find('.meter').exists()).toBe(false)
    expect(wrapper.vm.pct).toBeUndefined()
  })

  it('blocks adding to cart when any part is Unavailable or Incompatible', async () => {
    // 1. Part with null price / unavailable flag
    state.build.keycaps = { ...state.build.keycaps, price: null, unavailable: true }
    const wrapper = await mountSummary()

    const cartBtn = wrapper.find('.bar-actions button.primary')
    expect(cartBtn.attributes('disabled')).toBeDefined()
    expect(cartBtn.text()).toContain('Review Parts to add to cart')

    // 2. Part with incompatibility
    state.build = createFullBuild('75')
    state.savedBuildReview = { issues: [{ group: 'switches', type: 'incompatible' }] }
    const wrapperIncompat = await mountSummary()
    const cartBtnIncompat = wrapperIncompat.find('.bar-actions button.primary')
    expect(cartBtnIncompat.attributes('disabled')).toBeDefined()
    expect(cartBtnIncompat.text()).toContain('Review Parts to add to cart')
  })

  it('calculates grams safely when parts or build are null or undefined', () => {
    expect(grams(null)).toBe(0)
    expect(grams({})).toBe(0)
    expect(grams({ case: null, switches: { grams: 50 } })).toBe(50)
  })

  it('renders summary header with enthusiast title, spec chips, and in-place editing', async () => {
    const wrapper = await mountSummary()

    // 1. Default title is enthusiast-grade ("75% Custom Mechanical Keyboard")
    const heading = wrapper.find('.title-row h1')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toBe('75% Custom Mechanical Keyboard')

    // 2. Subtitle chips render layout, switch feel, and material
    const chips = wrapper.find('.subtitle-badge')
    expect(chips.exists()).toBe(true)
    expect(chips.text()).toContain('75% Layout')
    expect(chips.text()).toContain('Linear')
    expect(chips.text()).toContain('ABS Plastic')

    // 3. Floating Save build button exists with no redundant "Name your build" card
    expect(wrapper.find('.save-build-top').exists()).toBe(false)
    const saveGroup = wrapper.find('.save-action-group')
    expect(saveGroup.exists()).toBe(true)
    expect(saveGroup.find('button.primary').text()).toContain('Save build')
    expect(saveGroup.find('.fine').text()).toContain('Sign in to save it to your Profile.')

    // 4. In-place title editing activates on click
    const editBtn = wrapper.find('.icon-btn-edit')
    expect(editBtn.exists()).toBe(true)
    await editBtn.trigger('click')

    // Form appears
    const input = wrapper.find('.title-edit-form input#buildName')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('75% Custom Mechanical Keyboard')

    // Change title and press Done
    await input.setValue('Obsidian Thock 75')
    const doneBtn = wrapper.find('.title-edit-form button.primary')
    await doneBtn.trigger('click')

    // Edit form closed, heading updated
    expect(wrapper.find('.title-edit-form').exists()).toBe(false)
    expect(wrapper.find('.title-row h1').text()).toBe('Obsidian Thock 75')

    // 5. Bottom 3 diagnostic cards preserved in exact format
    const perfCards = wrapper.findAll('.perf .pf')
    expect(perfCards).toHaveLength(3)
    expect(perfCards[0].find('b').text()).toBe('Loudness')
    expect(perfCards[1].find('b').text()).toBe('Typing feel')
    expect(perfCards[2].find('b').text()).toBe('Weight')
    expect(perfCards[0].findAll('.segs i')).toHaveLength(5)
  })

  it('cancels inline title editing without committing changes on Cancel or Esc', async () => {
    const wrapper = await mountSummary()

    // 1. Activate editing via title click and cancel with Cancel button
    await wrapper.find('.title-row h1').trigger('click')
    const input = wrapper.find('.title-edit-form input#buildName')
    expect(input.exists()).toBe(true)
    await input.setValue('Temporary Discarded Name')
    await wrapper.find('.title-edit-form button.ghost').trigger('click')
    expect(wrapper.find('.title-edit-form').exists()).toBe(false)
    expect(wrapper.find('.title-row h1').text()).toBe('75% Custom Mechanical Keyboard')

    // 2. Activate editing again and cancel via Escape key
    await wrapper.find('.icon-btn-edit').trigger('click')
    const escInput = wrapper.find('.title-edit-form input#buildName')
    await escInput.setValue('Another Discarded Draft')
    await escInput.trigger('keydown.esc')
    expect(wrapper.find('.title-edit-form').exists()).toBe(false)
    expect(wrapper.find('.title-row h1').text()).toBe('75% Custom Mechanical Keyboard')
  })
})

describe('src/store.js saved build baseline tracking lifecycle', () => {
  beforeEach(() => {
    discardCurrentBuild()
  })

  it('tracks baseline IDs upon openSavedBuild', () => {
    const options = catalog('75')
    const dummyBuild = Object.fromEntries(CATS.map((c) => [c, options[c][0]]))
    const saved = {
      id: 'saved-456',
      name: 'Studio Workstation',
      layout: '75',
      part_ids: idsOf(dummyBuild),
      part_prices: {},
    }

    openSavedBuild(saved)

    expect(state.savedBuildBaselineIds).toEqual(saved.part_ids)
    expect(state.editingSavedBuildId).toBe('saved-456')
  })

  it('clears baseline IDs on setLayout, loadBuild, startBuild, and discardCurrentBuild', () => {
    state.savedBuildBaselineIds = { case: 'c1', switches: 's1' }
    state.editingSavedBuildId = 'build-1'
    state.editingSavedBuildName = 'Build 1'
    setLayout('60')
    expect(state.savedBuildBaselineIds).toBeNull()
    expect(state.editingSavedBuildId).toBeNull()
    expect(state.editingSavedBuildName).toBe('')

    state.savedBuildBaselineIds = { case: 'c1', switches: 's1' }
    startBuild()
    expect(state.savedBuildBaselineIds).toBeNull()

    state.savedBuildBaselineIds = { case: 'c1', switches: 's1' }
    discardCurrentBuild()
    expect(state.savedBuildBaselineIds).toBeNull()

    state.savedBuildBaselineIds = { case: 'c1', switches: 's1' }
    loadBuild({ layout: '75', part_ids: {} })
    expect(state.savedBuildBaselineIds).toBeNull()
  })
})
