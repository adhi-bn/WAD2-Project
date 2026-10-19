import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import App from '../../src/App.vue'
import HomeView from '../../src/views/HomeView.vue'
import BuilderView from '../../src/views/BuilderView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/builder', name: 'builder', component: BuilderView },
    ],
  })
}

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

async function mountAt(path) {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  return { router, wrapper }
}

describe('branded shell', () => {
  it('renders the brand and the Home and Builder nav links', async () => {
    const { wrapper } = await mountAt('/')

    expect(wrapper.find('.brand').text()).toContain('Le Chaton Typers')
    expect(wrapper.find('a.navlink[href="/"]').text()).toContain('Home')
    expect(wrapper.find('a.navlink[href="/builder"]').text()).toContain('Builder')
  })

  it('lets a guest reach the builder route (no auth gate)', async () => {
    const { router, wrapper } = await mountAt('/')

    await router.push('/builder')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('builder')
    expect(wrapper.findComponent(BuilderView).exists()).toBe(true)
  })

  it('gives the home builder CTA the custom .ui-btn namespace', async () => {
    const { wrapper } = await mountAt('/')

    expect(wrapper.find('a.ui-btn[href="/builder"]').exists()).toBe(true)
  })

  it('keeps Bootstrap component classes and Tailwind out of the custom stylesheet', () => {
    const css = read('../../src/style.css').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/\.btn\b/)
    expect(css).not.toMatch(/\.card\b/)
    expect(css).not.toMatch(/\.modal\b/)

    const vite = read('../../vite.config.js')
    expect(css.toLowerCase()).not.toContain('tailwind')
    expect(vite.toLowerCase()).not.toContain('tailwind')
  })
})
