import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FatCat from '../../src/components/FatCat.vue'

describe('demo chat', () => {
  it('is labelled demo/placeholder and does not claim working AI', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    const text = wrapper.text()
    expect(text).toContain('demo')
    expect(text).toContain('placeholder')
    expect(text).not.toMatch(/working AI|artificial intelligence/i)
  })

  it('has role=dialog with aria-modal', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    const dialog = wrapper.find('.lct-chat')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('renders demo messages with polite aria-live', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    const msgs = wrapper.find('.lct-chat__messages')
    expect(msgs.attributes('aria-live')).toBe('polite')
    expect(wrapper.findAll('.lct-chat__msg').length).toBeGreaterThan(0)
  })

  it('has quick-reply chips', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    expect(wrapper.findAll('.lct-chat__chip').length).toBeGreaterThan(0)
  })

  it('sends a message and adds a demo reply', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.lct-mascot').trigger('click')
    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Hello')
    await wrapper.find('.lct-chat__send').trigger('click')
    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.text()).toContain('demo reply')
  })
})
