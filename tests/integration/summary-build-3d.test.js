import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SummaryView from '../../src/views/SummaryView.vue'
import Keyboard3DView from '../../src/components/Keyboard3DView.vue'
import TypeTesterView from '../../src/components/TypeTesterView.vue'
import { CATS, catalog } from '../../src/data/catalog.js'
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
    setLayout('60')
    expect(state.savedBuildBaselineIds).toBeNull()

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
