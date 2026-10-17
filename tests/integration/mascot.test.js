import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FatCat from '../../src/components/FatCat.vue'

describe('mascot (Biscuit)', () => {
  it('renders the mascot button with an aria label', () => {
    const wrapper = mount(FatCat)
    const btn = wrapper.find('.lct-mascot')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toContain('Biscuit')
  })

  it('does not auto-open the chat on mount', () => {
    const wrapper = mount(FatCat)
    expect(wrapper.find('.lct-chat').exists()).toBe(false)
  })

  it('opens the chat when the mascot is clicked', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    expect(wrapper.find('.lct-chat').exists()).toBe(true)
  })

  it('closes the chat when the close button is clicked', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    await wrapper.find('.lct-chat__close').trigger('click')
    expect(wrapper.find('.lct-chat').exists()).toBe(false)
  })
})
