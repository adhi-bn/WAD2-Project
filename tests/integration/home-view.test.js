import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../../src/views/HomeView.vue'

function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/swipe', component: { template: '<div />' } },
      { path: '/know', component: { template: '<div />' } },
      { path: '/builder', component: { template: '<div />' } },
      { path: '/parts', component: { template: '<div />' } },
    ],
  })
  return mount(HomeView, { global: { plugins: [router] } })
}

describe('HomeView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('names all three Parts', () => {
    const text = mountHome().text()
    expect(text).toMatch(/barebones kit/i)
    expect(text).toMatch(/switches/i)
    expect(text).toMatch(/keycaps/i)
  })

  it('states that going over budget warns, never blocks', () => {
    const text = mountHome().text()
    expect(text).toMatch(/budget/i)
    expect(text).toMatch(/warn/i)
    expect(text).toMatch(/never block|not block|won't block/i)
  })

  it('links its primary CTA to start swiping and educational tour to know', () => {
    const wrapper = mountHome()
    expect(wrapper.find('a.ui-btn.primary[href="/swipe"]').exists()).toBe(true)
    expect(wrapper.find('a.ui-btn[href="/know"]').exists()).toBe(true)
  })

  it('renders the ready-made FATKEY keyboard options', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.fk-pick').exists()).toBe(true)
    const cards = wrapper.findAll('.fk-card')
    expect(cards.length).toBe(3)
    const text = wrapper.find('.fk-pick').text()
    expect(text).toContain('FATKEY')
    expect(text).toContain('FATKEY PRO')
    expect(text).toContain('FATKEY PRO MAX')
  })

  it('renders the layout sections and step cards', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.hero').exists()).toBe(true)
    expect(wrapper.find('.stackdemo').exists()).toBe(true)
    expect(wrapper.find('.hs.hs-look').exists()).toBe(true)
    expect(wrapper.findAll('.step').length).toBeGreaterThanOrEqual(4)
    expect(wrapper.find('.hs.hs-end').exists()).toBe(true)
  })

  it('renders the 75% schematic keyboard SVG inside .stackdemo', () => {
    const wrapper = mountHome()
    const kb = wrapper.find('.stackdemo .kbwrap svg.kb')
    expect(kb.exists()).toBe(true)
    expect(kb.attributes('viewBox')).toBe('-6 -6 172 74.5')
  })

  it('preserves full accessible heading name matching /dream keyboard/ immediately on mount', () => {
    const wrapper = mountHome()
    const heading = wrapper.find('h1')
    expect(heading.exists()).toBe(true)
    expect(heading.attributes('aria-label')).toMatch(/dream keyboard/i)
    expect(heading.attributes('aria-label')).toBe('Swipe right on your dream keyboard.')
  })

  it('types out characters after initial delay until the full title and emphasis are visible', async () => {
    vi.useFakeTimers()
    const wrapper = mountHome()

    const live = wrapper.find('.hero-typewriter-live')
    expect(live.exists()).toBe(true)

    // At mount before initial delay finishes, visible typing layer is empty
    expect(live.text()).toBe('')

    // Advance past initial delay (300ms) plus a few character ticks (50ms * 5)
    vi.advanceTimersByTime(300 + 50 * 5)
    await wrapper.vm.$nextTick()
    expect(live.text().length).toBeGreaterThan(0)
    expect(live.text()).toBe('Swipe')

    // Advance through the remaining text (35 chars total * 50ms = 1750ms + 300ms = 2050ms total)
    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()

    // Fully typed text includes plain prefix and emphasized "dream keyboard."
    expect(live.text()).toBe('Swipe right on your dream keyboard.')
    const em = live.find('em')
    expect(em.exists()).toBe(true)
    expect(em.text()).toBe('dream keyboard.')

    const caret = wrapper.find('.hero-caret')
    expect(caret.exists()).toBe(true)
    expect(caret.classes()).toContain('hero-caret--done')

    wrapper.unmount()
  })

  it('renders the full title immediately without caret animation when prefers-reduced-motion is active', () => {
    const origMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const wrapper = mountHome()
    const live = wrapper.find('.hero-typewriter-live')
    expect(live.text()).toBe('Swipe right on your dream keyboard.')
    expect(live.find('em').text()).toBe('dream keyboard.')
    expect(wrapper.find('.hero-caret').exists()).toBe(false)

    window.matchMedia = origMatchMedia
  })
})
