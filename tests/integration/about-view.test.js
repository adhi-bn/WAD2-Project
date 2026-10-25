import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AboutView from '../../src/views/AboutView.vue'

function mountAbout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/about', component: AboutView },
      { path: '/builder', component: { template: '<div>Builder</div>' } },
    ],
  })
  return mount(AboutView, { global: { plugins: [router] } })
}

describe('AboutView', () => {
  it('introduces the platform and links both calls to action to the builder', () => {
    const wrapper = mountAbout()

    expect(wrapper.get('h1').text()).toBe('Le Chaton Typers')
    expect(wrapper.text()).toContain('Your Keyboard. Your Style. Your Sound.')
    expect(wrapper.findAll('a.ui-btn.primary[href="/builder"]')).toHaveLength(2)
  })

  it('renders all four platform feature cards', () => {
    const text = mountAbout().text()

    expect(text).toContain('3D Build Visualisation')
    expect(text).toContain('Switch Sound Preview')
    expect(text).toContain('Compatibility Checking')
    expect(text).toContain('Budget clarity')
  })

  it('shows the store information and accessible map title', () => {
    const wrapper = mountAbout()

    expect(wrapper.text()).toMatch(/Jewel Changi Airport, #02-123, Singapore/i)
    expect(wrapper.text()).toMatch(/Daily, 10am–8pm/i)
    expect(wrapper.get('a[href="tel:+6569694835"]').text()).toBe('+65 9696 4835')
    expect(wrapper.get('iframe').attributes('title')).toMatch(/Jewel Changi Airport/i)
  })
})
