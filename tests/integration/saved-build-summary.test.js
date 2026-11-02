import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import SummaryView from '../../src/views/SummaryView.vue'
import { CATS, catalog } from '../../src/data/catalog.js'
import { state } from '../../src/store.js'

enableAutoUnmount(afterEach)

function activeBuild() {
  const options = catalog('75')
  return Object.fromEntries(CATS.map((group) => [group, options[group][0]]))
}

describe('Saved Build review on the preview page', () => {
  it('never shows a removed Part as zero-priced or allows it into the cart', () => {
    const build = activeBuild()
    build.keycaps = { ...build.keycaps, price: null, unavailable: true }
    state.build = build
    state.answers = { ...state.answers, layout: '75', budget: 350 }
    state.savedBuildReview = { issues: [{ group: 'keycaps', type: 'unavailable' }] }

    const wrapper = mount(SummaryView, {
      global: { stubs: { ProfileChips: true, RouterLink: true } },
    })

    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('S$0')
    const cartButton = wrapper.findAll('button').find((button) => button.text().includes('Review Parts to add to cart'))
    expect(cartButton?.attributes('disabled')).toBeDefined()
  })
})
