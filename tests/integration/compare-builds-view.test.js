import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CompareBuildsView from '../../src/views/CompareBuildsView.vue'
import { catalog, CATS } from '../../src/data/catalog.js'
import { idsOf, state } from '../../src/store.js'

function savedBuild(id, name, offset) {
  const parts = catalog('75')
  const build = Object.fromEntries(CATS.map((category) => [category, parts[category][offset]]))
  return { id, name, layout: '75', part_ids: idsOf(build), created_at: '2026-10-27T00:00:00.000Z' }
}

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
})

describe('CompareBuildsView', () => {
  it('asks for another saved Build when there are fewer than two', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0)]
    const { wrapper } = await mountCompare()

    expect(wrapper.text()).toContain('Save one more Build to compare.')
    expect(wrapper.get('a[href="/swipe"]').text()).toContain('Start a Build')
  })

  it('compares two saved Builds, including every Part and total', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0), savedBuild('second', 'Studio Build', 1)]
    const { wrapper } = await mountCompare()

    expect(wrapper.text()).toContain('Desk Build')
    expect(wrapper.text()).toContain('Studio Build')
    expect(wrapper.text()).toContain('Compare all Parts')

    await wrapper.get('details').trigger('toggle')
    expect(wrapper.findAll('tbody tr')).toHaveLength(CATS.length)
    expect(wrapper.find('tfoot').text()).toContain('Build total')
  })

  it('loads the selected saved Build and opens the Parts editor', async () => {
    state.savedBuilds = [savedBuild('first', 'Desk Build', 0), savedBuild('second', 'Studio Build', 1)]
    const { router, wrapper } = await mountCompare()

    await wrapper.get('button[aria-label="Edit Desk Build"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/parts')
    expect(state.build.case.id).toBe(state.savedBuilds[0].part_ids.case)
  })
})
