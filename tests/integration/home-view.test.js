import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../../src/views/HomeView.vue'

function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/builder', component: { template: '<div />' } },
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

  it('links its primary CTA to the builder', () => {
    expect(mountHome().find('a.ui-btn.primary[href="/builder"]').exists()).toBe(true)
  })

  it('has no links to removed prototype routes', () => {
    for (const a of mountHome().findAll('a')) {
      expect(a.attributes('href') || '').not.toMatch(/\/(swipe|know)\b/)
    }
  })
})
