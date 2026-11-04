import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CompareBuildsView from '../../src/views/CompareBuildsView.vue'
import BuildPreviewCanvas from '../../src/components/BuildPreviewCanvas.vue'
import { catalog, CATS } from '../../src/data/catalog.js'
import { idsOf, state } from '../../src/store.js'

/**
 * Builds a valid saved Build record from catalog offsets.
 *
 * @param {string} id - Unique build identifier.
 * @param {string} name - Display name.
 * @param {number} offset - Catalog part index.
 * @param {string} [layout='75'] - Keyboard layout format.
 * @returns {object} Canonical saved Build record.
 */
function savedBuild(id, name, offset, layout = '75') {
  const parts = catalog(layout)
  const build = Object.fromEntries(CATS.map((group) => [group, parts[group][offset]]))
  return { id, name, layout, part_ids: idsOf(build), created_at: '2026-10-27T00:00:00.000Z' }
}

/**
 * Mounts CompareBuildsView inside a memory router container.
 *
 * @returns {Promise<{ router: object, wrapper: import('@vue/test-utils').VueWrapper }>}
 */
async function mountCompare() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/compare', component: CompareBuildsView },
      { path: '/parts', component: { template: '<div>Parts editor</div>' } },
      { path: '/account', component: { template: '<div>Account</div>' } },
      { path: '/swipe', component: { template: '<div>Swipe</div>' } },
    ],
  })
  await router.push('/compare')
  await router.isReady()
  return { router, wrapper: mount(CompareBuildsView, { global: { plugins: [router] } }) }
}

afterEach(() => {
  state.user = null
  state.savedBuilds = []
  state.build = null
  state.cat = null
  state.rec = null
  state.savedBuildReview = null
  state.editingSavedBuildId = null
  state.editingSavedBuildName = ''
})

describe('CompareBuildsView', () => {
  it('asks for another saved Build when there are fewer than two', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0)]
    const { wrapper } = await mountCompare()

    expect(wrapper.text()).toContain('Save one more Build to compare.')
    expect(wrapper.get('a[href="/swipe"]').text()).toContain('Start a Build')
    expect(wrapper.findComponent(BuildPreviewCanvas).exists()).toBe(false)
  })

  it('compares two saved Builds and mounts dual static 3D BuildPreviewCanvas instances with contract props', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0), savedBuild('second', 'Studio Build', 1)]
    const { wrapper } = await mountCompare()

    expect(wrapper.text()).toContain('Desk Build')
    expect(wrapper.text()).toContain('Studio Build')

    // Note above cards has been removed for static previews
    expect(wrapper.find('[data-testid="compare-3d-note"]').exists()).toBe(false)
    expect(wrapper.find('.compare-3d-note').exists()).toBe(false)

    // Dual 3D previews mounted side by side
    const previews = wrapper.findAllComponents(BuildPreviewCanvas)
    expect(previews).toHaveLength(2)

    const deskParts = catalog('75')
    const leftCase = deskParts.case[0]
    const leftSwitches = deskParts.switches[0]
    const leftKeycaps = deskParts.keycaps[0]

    const rightCase = deskParts.case[1]
    const rightSwitches = deskParts.switches[1]
    const rightKeycaps = deskParts.keycaps[1]

    // Left card preview props: compact, canvasOnly, interactive: false, combined 3-layer view (initialExploded: false)
    expect(previews[0].props('layout')).toBe('75')
    expect(previews[0].props('compact')).toBe(true)
    expect(previews[0].props('canvasOnly')).toBe(true)
    expect(previews[0].props('initialExploded')).toBe(false)
    expect(previews[0].props('interactive')).toBe(false)
    expect(previews[0].props('barebones')).toEqual(leftCase)
    expect(previews[0].props('switches')).toEqual(leftSwitches)
    expect(previews[0].props('keycaps')).toEqual(leftKeycaps)

    // Right card preview props
    expect(previews[1].props('layout')).toBe('75')
    expect(previews[1].props('compact')).toBe(true)
    expect(previews[1].props('canvasOnly')).toBe(true)
    expect(previews[1].props('initialExploded')).toBe(false)
    expect(previews[1].props('interactive')).toBe(false)
    expect(previews[1].props('barebones')).toEqual(rightCase)
    expect(previews[1].props('switches')).toEqual(rightSwitches)
    expect(previews[1].props('keycaps')).toEqual(rightKeycaps)

    // Canvas-only mode suppresses preview header bar, toolbars, and schematic caption (REV-8)
    expect(wrapper.find('.lct-build-preview-header').exists()).toBe(false)
    expect(wrapper.find('.lct-build-preview-caption').exists()).toBe(false)

    // Side-by-side details table
    await wrapper.get('details').trigger('toggle')
    expect(wrapper.findAll('tbody tr')).toHaveLength(6)
    expect(wrapper.find('tfoot').text()).toContain('Build total')
    expect(wrapper.findAll('.compare-table .is-higher').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.compare-price-marker').length).toBeGreaterThan(0)
  })

  it('reopens the selected saved Build with its identity and drift review intact', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0), savedBuild('second', 'Studio Build', 1)]
    const { router, wrapper } = await mountCompare()

    await wrapper.get('button[aria-label="Edit Desk Build"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/parts')
    expect(state.build.case.id).toBe(state.savedBuilds[0].part_ids.case)
    expect(state.editingSavedBuildId).toBe('first')
    expect(state.editingSavedBuildName).toBe('Desk Build')
    expect(state.savedBuildReview).toBeTruthy()
  })

  it('highlights missing or unavailable historical Parts in 3D preview, card pills, and table details', async () => {
    const unavailable = savedBuild('first', 'Older Build', 0)
    unavailable.part_ids.case = 'discontinued-case'
    state.savedBuilds = [unavailable, savedBuild('second', 'Studio Build', 1)]
    const { wrapper } = await mountCompare()

    const previews = wrapper.findAllComponents(BuildPreviewCanvas)
    expect(previews).toHaveLength(2)

    // Missing case results in null barebones passed to left 3D canvas
    expect(previews[0].props('barebones')).toBeNull()
    expect(previews[0].props('switches')).not.toBeNull()
    expect(previews[0].props('keycaps')).not.toBeNull()

    // Card pill highlights missing part with explicit fallback text and is-missing-part class
    const leftPills = wrapper.findAll('.compare-cards .compare-card:first-child .compare-card-parts span')
    expect(leftPills[0].text()).toBe('Unavailable Case')
    expect(leftPills[0].classes()).toContain('is-missing-part')
    expect(leftPills[1].classes()).not.toContain('is-missing-part')
    expect(leftPills[2].classes()).not.toContain('is-missing-part')

    // Table details highlight missing cell with is-missing-cell and compare-missing-badge
    await wrapper.get('details').trigger('toggle')
    const caseRow = wrapper.find('tbody tr:first-child')
    const caseLeftCell = caseRow.find('td:nth-of-type(1)')
    expect(caseLeftCell.classes()).toContain('is-missing-cell')

    const badge = caseLeftCell.find('[data-testid="compare-missing-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Missing part')
    expect(caseLeftCell.text()).toContain('Unavailable')

    // Right cell is not missing and has no missing badge
    const caseRightCell = caseRow.find('td:nth-of-type(2)')
    expect(caseRightCell.classes()).not.toContain('is-missing-cell')
    expect(caseRightCell.find('[data-testid="compare-missing-badge"]').exists()).toBe(false)
  })

  it('preserves preview canvas and does not remount canvas when switching builds in dropdown', async () => {
    state.savedBuilds = [
      savedBuild('first', 'Desk Build', 0),
      savedBuild('second', 'Studio Build', 1),
      savedBuild('third', 'Gaming Build', 2),
    ]
    const { wrapper } = await mountCompare()

    const previews = wrapper.findAllComponents(BuildPreviewCanvas)
    expect(previews).toHaveLength(2)

    // Capture the initial left BuildPreviewCanvas component instance and DOM element
    const initialLeftPreview = previews[0]
    const initialLeftCanvas = initialLeftPreview.find('canvas').element

    // Switch left build from 'first' to 'third' in the picker dropdown
    const leftSelect = wrapper.find('.compare-picker .compare-select:first-child select')
    await leftSelect.setValue('third')
    await flushPromises()

    const currentPreviews = wrapper.findAllComponents(BuildPreviewCanvas)
    expect(currentPreviews).toHaveLength(2)

    // The left preview canvas was not unmounted or remounted because compare-card articles are keyed by slot ('left' / 'right')
    expect(currentPreviews[0].find('canvas').element).toBe(initialLeftCanvas)

    // Build details are reactively updated to third build
    const deskParts = catalog('75')
    expect(currentPreviews[0].props('barebones')).toEqual(deskParts.case[2])
    expect(wrapper.text()).toContain('Gaming Build')
  })
})
