import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import App from '../../src/App.vue'
import HomeView from '../../src/views/HomeView.vue'
import PartsView from '../../src/views/PartsView.vue'
import { state, finishQuiz } from '../../src/store.js'

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/parts', name: 'parts', component: PartsView },
      { path: '/builder', redirect: '/parts' },
    ],
  })
  router.beforeEach((to) => {
    if (to.name === 'parts' && !state.build) finishQuiz()
    return true
  })
  return router
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
  it('renders the brand, Home nav link, and 2 Parts stage in the navbar', async () => {
    const { wrapper } = await mountAt('/')

    expect(wrapper.find('.brand').text()).toContain('Le Chaton Typers')
    expect(wrapper.find('a.navlink[href="/"]').text()).toContain('Home')
    expect(wrapper.find('footer a[href="/privacy"]').text()).toBe('Privacy')
    expect(wrapper.find('footer a[href="/terms"]').text()).toBe('Terms')
    expect(wrapper.find('.stages').text()).toContain('2')
    expect(wrapper.find('.stages').text()).toContain('Parts')
    expect(wrapper.find('a.stg[href="/parts"]').exists()).toBe(true)
  })

  it('lets a guest reach the parts route directly (or via /builder redirect) rendering PartsView and 3D preview', async () => {
    const { router, wrapper } = await mountAt('/')

    await router.push('/builder')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/parts')
    expect(wrapper.findComponent(PartsView).exists()).toBe(true)
    expect(wrapper.text()).toContain('Build so far')
    expect(wrapper.find('.lct-build-preview-panel').exists()).toBe(true)
  })

  it('gives the home parts/builder CTA the custom .ui-btn namespace', async () => {
    const { wrapper } = await mountAt('/')

    expect(wrapper.find('a.ui-btn[href="/parts"]').exists()).toBe(true)
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
