import { describe, expect, it } from 'vitest'
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
})
