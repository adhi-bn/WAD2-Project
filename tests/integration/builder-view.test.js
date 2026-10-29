import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PartsView from '../../src/views/PartsView.vue'
import BuildPreviewCanvas from '../../src/components/BuildPreviewCanvas.vue'
import { build as domainBuild, setLimit, setSlot } from '../../src/stores/build.js'
import { state, finishQuiz, choose } from '../../src/store.js'

enableAutoUnmount(afterEach)

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/parts', component: PartsView },
      { path: '/swipe', component: { template: '<div>Swipe</div>' } },
      { path: '/build', component: { template: '<div>Build</div>' } },
    ],
  })
}

describe('PartsView (Builder integration)', () => {
  beforeEach(() => {
    state.build = null
    setSlot('barebones', null)
    setSlot('switches', null)
    setSlot('keycaps', null)
    setLimit(null)
  })

  it('auto-initializes a compatible build and renders the build sheet with 3D preview on direct mount', async () => {
    const router = createTestRouter()
    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(state.build).not.toBeNull()
    expect(wrapper.text()).toContain('Build so far')
    expect(wrapper.text()).toContain('Step 2 · Choose your parts')
    expect(wrapper.findComponent(BuildPreviewCanvas).exists()).toBe(true)
  })

  it('shows under budget when total is within budget, and over budget when budget is exceeded', async () => {
    const router = createTestRouter()
    finishQuiz()
    state.answers.budget = 1000

    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('under budget')
    expect(wrapper.text()).not.toContain('over budget')

    // Lower budget so build exceeds budget
    state.answers.budget = 50
    await flushPromises()

    expect(wrapper.text()).toContain('over budget')
  })

  it('allows picking a different part and reactively updates the build total and sheet', async () => {
    const router = createTestRouter()
    finishQuiz()

    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const caseOptions = state.cat.case
    expect(caseOptions.length).toBeGreaterThan(1)

    // Select alternative case
    const altCase = caseOptions.find((c) => c.id !== state.build.case.id)
    choose('case', altCase.id)
    await flushPromises()

    expect(state.build.case.id).toBe(altCase.id)
    const newTotal = wrapper.find('.tot .mono').text()
    expect(newTotal).toBeDefined()
  })

  it('populates useBuildStore immediately on mount and passes props into BuildPreviewCanvas', async () => {
    const router = createTestRouter()
    finishQuiz()

    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const preview = wrapper.findComponent(BuildPreviewCanvas)
    // AC-R10: useBuildStore is populated immediately on mount from state.build
    expect(domainBuild.barebones).toEqual(state.build.case)
    expect(domainBuild.switches).toEqual(state.build.switches)
    expect(domainBuild.keycaps).toEqual(state.build.keycaps)

    expect(preview.props('barebones')).toEqual(state.build.case)
    expect(preview.props('switches')).toEqual(state.build.switches)
    expect(preview.props('keycaps')).toEqual(state.build.keycaps)

    // Select alternative case and verify useBuildStore updates reactively on part pick
    const altCase = state.cat.case.find((c) => c.id !== state.build.case.id)
    choose('case', altCase.id)
    await flushPromises()

    expect(domainBuild.barebones.id).toBe(altCase.id)
    expect(preview.props('barebones').id).toBe(altCase.id)
  })

  it('renders all part tabs and allows navigating between them', async () => {
    const router = createTestRouter()
    finishQuiz()

    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const tabs = wrapper.findAll('.tab')
    expect(tabs.length).toBe(8)

    // Switch to switches tab (index 3)
    await tabs[3].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Part 4 of 8')
  })

  it('renders interactive layout selector (60% · 75% · 100%) and updates build and preview props', async () => {
    const router = createTestRouter()
    finishQuiz()

    const wrapper = mount(PartsView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    const preview = wrapper.findComponent(BuildPreviewCanvas)
    expect(preview.props('layout')).toBe('75')

    const summaryStrip = wrapper.find('.summary-pills')
    expect(summaryStrip.exists()).toBe(true)

    const btn60 = summaryStrip.find('button[aria-label="60% layout"]')
    const btn75 = summaryStrip.find('button[aria-label="75% layout"]')
    const btn100 = summaryStrip.find('button[aria-label="100% layout"]')

    expect(btn60.exists()).toBe(true)
    expect(btn75.exists()).toBe(true)
    expect(btn100.exists()).toBe(true)

    // Initial state: 75% is active
    expect(btn75.attributes('aria-pressed')).toBe('true')
    expect(btn75.classes()).toContain('pri')
    expect(btn60.attributes('aria-pressed')).toBe('false')

    // Capture initial switch id and buy count
    const initialSwitchId = state.build.switches.id
    expect(state.build.switches.buy).toBe(90) // 84 keys -> 90 switches for 75%

    // Click 60% layout
    await btn60.trigger('click')
    await flushPromises()

    expect(state.answers.layout).toBe('60')
    expect(btn60.attributes('aria-pressed')).toBe('true')
    expect(btn60.classes()).toContain('pri')
    expect(btn75.attributes('aria-pressed')).toBe('false')
    expect(preview.props('layout')).toBe('60')
    expect(state.build.switches.id).toBe(initialSwitchId) // Preserves part choice!
    expect(state.build.switches.buy).toBe(70) // 61 keys -> 70 switches for 60%

    // Click 100% layout
    await btn100.trigger('click')
    await flushPromises()

    expect(state.answers.layout).toBe('100')
    expect(btn100.attributes('aria-pressed')).toBe('true')
    expect(btn100.classes()).toContain('pri')
    expect(btn60.attributes('aria-pressed')).toBe('false')
    expect(preview.props('layout')).toBe('100')
    expect(state.build.switches.id).toBe(initialSwitchId)
    expect(state.build.switches.buy).toBe(110) // 104 keys -> 110 switches for 100%
  })
})
