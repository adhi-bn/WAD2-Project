import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
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

async function mountApp() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  return mount(App, { global: { plugins: [router] } })
}

describe('null-safe cloud action (slice 5)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('let the "Save my build" chip explain the cloud is unavailable and what to do', async () => {
    const wrapper = await mountApp()
    await wrapper.find('.catbtn').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(700) // greeting
    await flushPromises()

    const chip = wrapper.findAll('.quick button').find((b) => /save/i.test(b.text()))
    expect(chip).toBeTruthy()
    await chip.trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    const text = wrapper.find('.msgs').text()
    expect(text).toMatch(/cloud|not available|needs/i)
    expect(text).toMatch(/keep building/i) // names an alternative

    // chat stays usable: send another message and get a reply
    await wrapper.find('.chatin input').setValue('hello')
    await wrapper.find('.chatin').trigger('submit')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    const after = wrapper.find('.msgs').text()
    expect(after).toMatch(/meow/i)
  })
})
