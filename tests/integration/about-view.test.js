import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AboutView from '../../src/views/AboutView.vue'

async function mountAbout() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/about', component: AboutView },
      { path: '/builder', component: { template: '<div>Builder</div>' } },
    ],
  })
  await router.push('/about')
  await router.isReady()
  return mount(AboutView, { global: { plugins: [router] } })
}

describe('AboutView', () => {
  it('introduces the platform and links both calls to action to the builder', async () => {
    const wrapper = await mountAbout()

    expect(wrapper.get('h1').text()).toBe('Le Chaton Typers')
    expect(wrapper.text()).toContain('Your Keyboard. Your Style. Your Sound.')
    expect(wrapper.findAll('a.ui-btn.primary[href="/builder"]')).toHaveLength(2)
  })

  it('renders all four platform feature cards', async () => {
    const text = (await mountAbout()).text()

    expect(text).toContain('3D Build Visualisation')
    expect(text).toContain('Switch Sound Preview')
    expect(text).toContain('Compatibility Checking')
    expect(text).toContain('Budget Clarity')
  })

  it('shows both store locations and an accessible interactive OneMap', async () => {
    const wrapper = await mountAbout()

    expect(wrapper.text()).toMatch(/Jewel Changi Airport, #02-123, Singapore/i)
    expect(wrapper.text()).toMatch(/2 Bayfront Ave, B2-06, Singapore 018972/i)
    expect(wrapper.text()).toMatch(/Daily, 10am–8pm/i)
    expect(wrapper.get('a[href="tel:+6594623787"]').text()).toBe('+65 9462 3787')
    expect(wrapper.get('a[href="tel:+6596964835"]').text()).toBe('+65 9696 4835')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toMatch(/Interactive OneMap showing Le Chaton Typers at Jewel Changi Airport/i)
    expect(wrapper.findAll('.about-store__thumbnail')).toHaveLength(2)
    expect(wrapper.get('button.ui-btn.primary').text()).toContain('Find nearest store')
  })

  it('lets visitors switch the interactive OneMap to Marina Bay Sands', async () => {
    const wrapper = await mountAbout()
    await wrapper.findAll('button.ui-btn:not(.primary)').at(-1).trigger('click')

    expect(wrapper.get('[role="img"]').attributes('aria-label')).toMatch(/Marina Bay Sands/i)
  })
})
