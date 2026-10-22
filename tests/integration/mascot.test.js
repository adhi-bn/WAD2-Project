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

  it('renders the prototype Biscuit mascot SVG instead of an emoji', () => {
    const wrapper = mount(FatCat)
    const btn = wrapper.find('.lct-mascot')
    const svg = btn.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 120 120')
    expect(btn.text()).not.toContain('🐾')
  })

  it('renders an unread badge that clears when chat opens', async () => {
    const wrapper = mount(FatCat)
    const badge = wrapper.find('.cat-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('1')

    await wrapper.find('.lct-mascot').trigger('click')
    expect(wrapper.find('.cat-badge').exists()).toBe(false)
  })

  it('does not auto-open the chat on mount', () => {
    const wrapper = mount(FatCat)
    expect(wrapper.find('.lct-chat').exists()).toBe(false)
  })

  it('opens the chat when the mascot is clicked and displays avatar in header', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    expect(wrapper.find('.lct-chat').exists()).toBe(true)
    const avatar = wrapper.find('.lct-chat__header .lct-chat__av svg')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('viewBox')).toBe('0 0 120 120')
  })

  it('closes the chat when the close button is clicked', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    await wrapper.find('.lct-chat__close').trigger('click')
    expect(wrapper.find('.lct-chat').exists()).toBe(false)
  })

  it('updates aria-label dynamically based on open and badge state', async () => {
    const wrapper = mount(FatCat)
    const btn = wrapper.find('.lct-mascot')
    expect(btn.attributes('aria-label')).toBe('Open chat with Biscuit (1 unread message)')
    await btn.trigger('click')
    expect(btn.attributes('aria-label')).toBe('Close chat with Biscuit')
    await wrapper.find('.lct-chat__close').trigger('click')
    expect(btn.attributes('aria-label')).toBe('Open chat with Biscuit')
  })
})
