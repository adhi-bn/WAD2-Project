import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import FatCat from '../../src/components/FatCat.vue'
import * as advisorModule from '../../src/lib/advisor.js'
import { state, discardCurrentBuild } from '../../src/store.js'

/**
 * Creates an isolated Vue Router test harness with dummy destinations.
 *
 * @returns {import('vue-router').Router}
 */
function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/parts', component: { template: '<div>Parts</div>' } },
      { path: '/build', component: { template: '<div>Build</div>' } },
      { path: '/cart', component: { template: '<div>Cart</div>' } },
      { path: '/swipe', component: { template: '<div>Swipe</div>' } },
    ],
  })
}

/**
 * Mounts FatCat mascot component with an initialized memory router.
 *
 * @param {import('vue-router').Router} [router]
 * @returns {Promise<{ router: import('vue-router').Router, wrapper: import('@vue/test-utils').VueWrapper }>}
 */
async function mountFatCat(router = createTestRouter()) {
  await router.push('/')
  await router.isReady()
  const wrapper = mount(FatCat, {
    attachTo: document.body,
    global: {
      plugins: [router],
    },
  })
  return { router, wrapper }
}

const SAMPLE_SUGGESTION = {
  ok: true,
  reply: 'Here is a balanced 75% build with smooth linear switches.',
  layout: '75',
  build: {
    layout: '75',
    total: 310,
    part_ids: {
      case: 'alu',
      plate: 'alp',
      pcb: 'hs',
      switches: 'gyellow',
      keycaps: 'plainpbt',
      stabs: 'durock',
      foam: 'basic',
      cable: 'std',
    },
    names: {
      case: 'CNC aluminium case',
      plate: 'Aluminium plate',
      pcb: 'Hot-swap PCB, wired USB-C',
      switches: 'Gateron Milky Yellow Pro',
      keycaps: 'Dye-sub PBT keycap set',
      stabs: 'Durock V2 screw-in stabilisers',
      foam: 'Case foam and switch pad',
      cable: 'Standard USB-C cable',
    },
  },
  change: null,
}

describe('null-safe cloud action and chat interaction', () => {
  beforeEach(() => {
    discardCurrentBuild()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    discardCurrentBuild()
  })

  it('displays badge "Advisor" when unconfigured / offline and handles chips gracefully', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(false)

    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const dialog = wrapper.find('.lct-chat')
    expect(dialog.exists()).toBe(true)

    // Header displays semantic badge "Advisor" (without "AI")
    const badge = wrapper.find('.lct-chat__badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Advisor')
    expect(badge.text()).not.toContain('AI')

    // Quick chips still work normally
    const chip = wrapper.findAll('.lct-chat__chip').find((b) => /switch/i.test(b.text()))
    expect(chip).toBeTruthy()
    await chip.trigger('click')
    await vi.advanceTimersByTimeAsync(650)

    wrapper.unmount()
  })

  it('displays badge "AI Advisor" when configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)

    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const badge = wrapper.find('.lct-chat__badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('AI Advisor')

    wrapper.unmount()
  })

  it('preserves an in-progress input draft when clicking a quick chip', async () => {
    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('my unfinished draft')

    const spinChip = wrapper.findAll('.lct-chat__chip').find((b) => /spin/i.test(b.text()))
    expect(spinChip).toBeTruthy()
    await spinChip.trigger('click')
    await vi.advanceTimersByTimeAsync(650)

    expect(input.element.value).toBe('my unfinished draft')
    wrapper.unmount()
  })

  it('manages dialog visibility and close toggling', async () => {
    const { wrapper } = await mountFatCat()
    const mascot = wrapper.find('.catbtn')

    await mascot.trigger('click')
    await nextTick()
    expect(wrapper.find('.lct-chat').exists()).toBe(true)

    const closeBtn = wrapper.find('.lct-chat__close')
    await closeBtn.trigger('click')
    await nextTick()

    expect(wrapper.find('.lct-chat').exists()).toBe(false)
    wrapper.unmount()
  })

  it('prompts for confirmation when state.build exists on openAI and retains build on cancel', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)
    vi.spyOn(advisorModule, 'askAdvisor').mockResolvedValue(SAMPLE_SUGGESTION)

    // Set an active existing build in state
    state.build = {
      case: { id: 'abs', name: 'ABS plastic case', price: 39 },
      plate: { id: 'pcp', name: 'Polycarbonate plate', price: 19 },
      pcb: { id: 'hs', name: 'Hot-swap PCB', price: 45 },
      switches: { id: 'cream', name: 'Akko Cream Yellow', price: 25 },
      keycaps: { id: 'blank', name: 'Blank PBT', price: 29 },
      stabs: { id: 'stock', name: 'Stock stabs', price: 10 },
      foam: { id: 'none', name: 'No foam', price: 0 },
      cable: { id: 'std', name: 'Standard cable', price: 0 },
    }

    const { router, wrapper } = await mountFatCat()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    // Ask Biscuit a question
    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Recommend a 75% keyboard')
    await wrapper.find('form.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(1000)

    // Find and click "Open in builder" chip
    const openBtn = wrapper.findAll('.lct-chat__chip').find((b) => /open in builder/i.test(b.text()))
    expect(openBtn).toBeTruthy()
    await openBtn.trigger('click')
    await vi.advanceTimersByTimeAsync(650)

    // Verify confirmation prompt was shown in chat
    const messages = wrapper.findAll('.lct-chat__msg')
    const lastMsg = messages[messages.length - 1]
    expect(lastMsg.text()).toContain('Load suggested Build? This will replace your current selections.')

    // Verify confirmation chips exist
    const confirmChip = wrapper.findAll('.lct-chat__chip').find((b) => /yes, replace it/i.test(b.text()))
    const cancelChip = wrapper.findAll('.lct-chat__chip').find((b) => /no, keep mine/i.test(b.text()))
    expect(confirmChip).toBeTruthy()
    expect(cancelChip).toBeTruthy()

    // Click "No, keep mine"
    await cancelChip.trigger('click')
    await vi.advanceTimersByTimeAsync(650)

    // Build was kept intact, router did not navigate to /build
    expect(state.build.case.id).toBe('abs')
    expect(pushSpy).not.toHaveBeenCalledWith('/build')
    expect(router.currentRoute.value.path).not.toBe('/build')

    const afterCancelMsgs = wrapper.findAll('.lct-chat__msg')
    expect(afterCancelMsgs[afterCancelMsgs.length - 1].text()).toContain('Kept your current build.')

    wrapper.unmount()
  })

  it('prompts for confirmation when state.build exists on openAI and loads suggested build on confirm', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)
    vi.spyOn(advisorModule, 'askAdvisor').mockResolvedValue(SAMPLE_SUGGESTION)

    // Set an active existing build in state
    state.build = {
      case: { id: 'abs', name: 'ABS plastic case', price: 39 },
      plate: { id: 'pcp', name: 'Polycarbonate plate', price: 19 },
      pcb: { id: 'hs', name: 'Hot-swap PCB', price: 45 },
      switches: { id: 'cream', name: 'Akko Cream Yellow', price: 25 },
      keycaps: { id: 'blank', name: 'Blank PBT', price: 29 },
      stabs: { id: 'stock', name: 'Stock stabs', price: 10 },
      foam: { id: 'none', name: 'No foam', price: 0 },
      cable: { id: 'std', name: 'Standard cable', price: 0 },
    }

    const { router, wrapper } = await mountFatCat()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Recommend a 75% keyboard')
    await wrapper.find('form.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(1000)

    const openBtn = wrapper.findAll('.lct-chat__chip').find((b) => /open in builder/i.test(b.text()))
    await openBtn.trigger('click')
    await vi.advanceTimersByTimeAsync(650)

    const confirmChip = wrapper.findAll('.lct-chat__chip').find((b) => /yes, replace it/i.test(b.text()))
    await confirmChip.trigger('click')
    await pushSpy.mock.results[0]?.value

    // Build was replaced by suggestion and navigated to /build
    expect(state.build.case.id).toBe('alu')
    expect(pushSpy).toHaveBeenCalledWith('/build')
    expect(router.currentRoute.value.path).toBe('/build')

    wrapper.unmount()
  })

  it('immediately loads build and navigates to /build when state.build is null', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)
    vi.spyOn(advisorModule, 'askAdvisor').mockResolvedValue(SAMPLE_SUGGESTION)

    expect(state.build).toBeNull()

    const { router, wrapper } = await mountFatCat()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Recommend a 75% keyboard')
    await wrapper.find('form.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(1000)

    const openBtn = wrapper.findAll('.lct-chat__chip').find((b) => /open in builder/i.test(b.text()))
    await openBtn.trigger('click')
    await pushSpy.mock.results[0]?.value

    // Loaded immediately without asking for confirmation
    expect(state.build.case.id).toBe('alu')
    expect(pushSpy).toHaveBeenCalledWith('/build')
    expect(router.currentRoute.value.path).toBe('/build')

    wrapper.unmount()
  })

  it('shows error fallback chips and navigates to /parts when advisor returns an error', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)
    vi.spyOn(advisorModule, 'askAdvisor').mockResolvedValue({
      ok: false,
      error: 'Rate limit reached. Biscuit needs a quick nap.',
    })

    const { router, wrapper } = await mountFatCat()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Recommend something cool')
    await wrapper.find('form.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(1000)

    // Bot displayed the error message
    const messages = wrapper.findAll('.lct-chat__msg')
    expect(messages[messages.length - 1].text()).toContain('Rate limit reached. Biscuit needs a quick nap.')

    // Error fallback chips are visible: Browse parts, Start swiping, Spin the wheel
    const browseChip = wrapper.findAll('.lct-chat__chip').find((b) => /browse parts/i.test(b.text()))
    const swipeChip = wrapper.findAll('.lct-chat__chip').find((b) => /start swiping/i.test(b.text()))
    expect(browseChip).toBeTruthy()
    expect(swipeChip).toBeTruthy()

    // Tapping "Browse parts" navigates to /parts
    await browseChip.trigger('click')
    await pushSpy.mock.results[0]?.value
    expect(pushSpy).toHaveBeenCalledWith('/parts')
    expect(router.currentRoute.value.path).toBe('/parts')

    wrapper.unmount()
  })

  it('announces status changes via accessible live region element', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)

    let resolveAdvisor
    vi.spyOn(advisorModule, 'askAdvisor').mockReturnValue(new Promise((resolve) => {
      resolveAdvisor = resolve
    }))

    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const statusEl = wrapper.find('[role="status"][aria-live="polite"]')
    expect(statusEl.exists()).toBe(true)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Find me a board')
    await wrapper.find('form.chatin').trigger('submit')

    // During fetch, status announced thinking
    expect(statusEl.text()).toContain('thinking')

    // Resolve advisor response
    resolveAdvisor(SAMPLE_SUGGESTION)
    await vi.advanceTimersByTimeAsync(1000)

    // After fetch, status announced answered
    expect(statusEl.text()).toContain('answered')

    wrapper.unmount()
  })

  it('handles photo input when advisor is not ready with friendly fallback', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(false)

    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const fileInput = wrapper.find('input[type="file"]')
    const dummyFile = new File(['dummy'], 'keyboard.png', { type: 'image/png' })

    // Simulate file selection
    Object.defineProperty(fileInput.element, 'files', {
      value: [dummyFile],
      configurable: true,
    })
    await fileInput.trigger('change')
    await vi.advanceTimersByTimeAsync(650)

    const messages = wrapper.findAll('.lct-chat__msg')
    expect(messages[messages.length - 1].text()).toContain('My photo eyes are not connected yet, meow.')

    const browseChip = wrapper.findAll('.lct-chat__chip').find((b) => /browse parts/i.test(b.text()))
    expect(browseChip).toBeTruthy()

    wrapper.unmount()
  })

  it('leaves state.build, state.answers.layout, and state.cat undisturbed when adding suggested build to cart', async () => {
    vi.spyOn(advisorModule, 'isAdvisorReady').mockReturnValue(true)
    vi.spyOn(advisorModule, 'askAdvisor').mockResolvedValue(SAMPLE_SUGGESTION)

    const existingBuild = {
      case: { id: 'custom-case', name: 'Custom case', price: 99 },
      plate: { id: 'custom-plate', name: 'Custom plate', price: 29 },
    }
    state.build = existingBuild
    state.answers.layout = '65'
    const existingCat = { dummy: true }
    state.cat = existingCat
    state.cart = []

    const { router, wrapper } = await mountFatCat()
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Pick a board')
    await wrapper.find('form.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(1000)

    const addBtn = wrapper.findAll('.lct-chat__chip').find((b) => /add to cart/i.test(b.text()))
    expect(addBtn).toBeTruthy()
    await addBtn.trigger('click')

    expect(state.build).toEqual(existingBuild)
    expect(state.build.case.id).toBe('custom-case')
    expect(state.answers.layout).toBe('65')
    expect(state.cat).toEqual(existingCat)

    expect(state.cart.length).toBe(1)
    expect(state.cart[0].name).toBe("Biscuit's pick (75%)")
    expect(state.cart[0].layout).toBe('75')
    expect(state.cart[0].part_ids).toEqual(SAMPLE_SUGGESTION.build.part_ids)
    expect(typeof state.cart[0].uid).toBe('string')

    expect(pushSpy).toHaveBeenCalledWith('/cart')

    wrapper.unmount()
  })

  it('unregisters keydown listener when component is unmounted', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { wrapper } = await mountFatCat()
    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('closes chat when Escape key is pressed and wheel is closed', async () => {
    const { wrapper } = await mountFatCat()
    await wrapper.find('.catbtn').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    expect(wrapper.find('.lct-chat').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.lct-chat').exists()).toBe(false)
    wrapper.unmount()
  })
})
