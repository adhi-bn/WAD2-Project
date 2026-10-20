import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HomeView from '../../src/views/HomeView.vue'

function mountHome(options = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/builder', component: { template: '<div />' } },
    ],
  })
  return mount(HomeView, {
    global: { plugins: [router] },
    attachTo: document.body,
    ...options,
  })
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

  it('renders the prototype 4-section structure (.hero, .hs-look, .step, .hs-end)', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.hero').exists()).toBe(true)
    expect(wrapper.find('.stackdemo').exists()).toBe(true)
    expect(wrapper.find('.hs.hs-look').exists()).toBe(true)
    expect(wrapper.findAll('.step').length).toBe(4)
    expect(wrapper.find('.hs.hs-end').exists()).toBe(true)
  })

  it('renders the 75% schematic keyboard SVG inside .stackdemo', () => {
    const wrapper = mountHome()
    const kb = wrapper.find('.stackdemo .kbwrap svg.kb')
    expect(kb.exists()).toBe(true)
    expect(kb.attributes('viewBox')).toBe('-6 -6 172 74.5')
  })

  it('ensures all CTAs link to the builder', () => {
    const links = mountHome().findAll('a')
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) {
      expect(a.attributes('href')).toBe('/builder')
    }
  })

  it('renders all 6 guided layer cards from anatomyGuide with titles and facts', () => {
    const wrapper = mountHome()
    const cards = wrapper.findAll('.layer-step-section')
    expect(cards.length).toBe(6)

    const expectedLayers = ['keycaps', 'switches', 'plate', 'pcb', 'foam', 'case']
    cards.forEach((card, idx) => {
      expect(card.attributes('data-layer')).toBe(String(idx))
      expect(card.attributes('data-layer-id')).toBe(expectedLayers[idx])
    })

    const text = wrapper.text()
    expect(text).toContain('Keycaps')
    expect(text).toContain('5-pin Switches')
    expect(text).toContain('Positioning Plate')
    expect(text).toContain('Hot-swap PCB')
    expect(text).toContain('Multi-Layer Gasket Stack')
    expect(text).toContain('Case & Frame')
  })

  it('ensures banned synonym "component" is absent from guide copy and HomeView', () => {
    const text = mountHome().text()
    expect(text.toLowerCase()).not.toMatch(/\bcomponents?\b/)
  })

  it('sets aria-pressed on layer chips and calls scrollIntoView on click', async () => {
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    const wrapper = mountHome()
    const pcbChip = wrapper
      .findAll('.layer-chip-btn')
      .find((b) => b.text().includes('PCB'))
    expect(pcbChip).toBeDefined()
    expect(pcbChip.attributes('aria-pressed')).toBe('false')

    await pcbChip.trigger('click')
    expect(pcbChip.attributes('aria-pressed')).toBe('true')
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        block: 'center',
      })
    )
  })

  it('updates aria-current and active layer when card approaches viewport center', async () => {
    const wrapper = mountHome()
    const pcbSection = wrapper.find('.layer-step-section[data-layer-id="pcb"]')
    expect(pcbSection.exists()).toBe(true)

    // Simulate getBoundingClientRect placing PCB card near viewport center
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset?.layerId === 'pcb') {
        return { top: 250, bottom: 450, height: 200 }
      }
      return { top: 1200, bottom: 1600, height: 400 }
    }

    try {
      window.dispatchEvent(new Event('scroll'))
      // Wait for rAF or scroll update
      await new Promise((r) => setTimeout(r, 20))
      await wrapper.vm.$nextTick()

      expect(pcbSection.attributes('aria-current')).toBe('step')
      expect(pcbSection.find('.is-active-step').exists()).toBe(true)
    } finally {
      window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('locks programmatic scrolling during chip selection to prevent intermediate scroll events from thrashing active layer', async () => {
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    const wrapper = mountHome()
    const pcbChip = wrapper
      .findAll('.layer-chip-btn')
      .find((b) => b.text().includes('PCB'))
    expect(pcbChip).toBeDefined()

    // Trigger chip click
    await pcbChip.trigger('click')
    expect(pcbChip.attributes('aria-pressed')).toBe('true')

    // Simulate an intermediate scroll event where Switches card happens to cross center
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset?.layerId === 'switches') {
        return { top: 300, bottom: 500, height: 200 }
      }
      return { top: 1200, bottom: 1600, height: 400 }
    }

    try {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 20))
      await wrapper.vm.$nextTick()

      // Active layer must still remain 'pcb', not thrashed to 'switches'
      const activeSection = wrapper.find('.layer-step-section[data-layer-id="pcb"]')
      expect(activeSection.attributes('aria-current')).toBe('step')

      // Now fire scrollend to unlock
      window.dispatchEvent(new Event('scrollend'))
      await new Promise((r) => setTimeout(r, 20))

      // Now scroll should update
      window.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 20))
      await wrapper.vm.$nextTick()

      const switchesSection = wrapper.find('.layer-step-section[data-layer-id="switches"]')
      expect(switchesSection.attributes('aria-current')).toBe('step')
    } finally {
      window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('responds to resize events to update active layer', async () => {
    const wrapper = mountHome()
    const pcbSection = wrapper.find('.layer-step-section[data-layer-id="pcb"]')

    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset?.layerId === 'pcb') {
        return { top: 250, bottom: 450, height: 200 }
      }
      return { top: 1200, bottom: 1600, height: 400 }
    }

    try {
      window.dispatchEvent(new Event('resize'))
      await new Promise((r) => setTimeout(r, 20))
      await wrapper.vm.$nextTick()

      expect(pcbSection.attributes('aria-current')).toBe('step')
    } finally {
      window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })

  it('cleans up scroll, resize, and scrollend event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountHome()
    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('scrollend', expect.any(Function))
    removeEventListenerSpy.mockRestore()
  })
})
