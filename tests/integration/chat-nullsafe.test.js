import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FatCat from '../../src/components/FatCat.vue'
import { getSupabase } from '../../src/lib/supabase.js'

describe('null-safe cloud action and chat interaction', () => {
  it('explains cloud save is unavailable when getSupabase() is null and keeps chat usable', async () => {
    expect(getSupabase()).toBeNull()

    const wrapper = mount(FatCat, { attachTo: document.body })
    await wrapper.find('.lct-mascot').trigger('click')

    const chip = wrapper
      .findAll('.lct-chat__chips button')
      .find((b) => /save/i.test(b.text()))
    expect(chip).toBeTruthy()
    await chip.trigger('click')

    const text = wrapper.find('.lct-chat__messages').text()
    expect(text).toMatch(/cloud save is not available|supabase is not configured/i)
    expect(text).toMatch(/keep building/i)

    await wrapper.find('.lct-chat__input-field').setValue('hello')
    await wrapper.find('.lct-chat__input-row').trigger('submit')

    const after = wrapper.find('.lct-chat__messages').text()
    expect(after).toMatch(/meow/i)
    wrapper.unmount()
  })

  it('preserves an in-progress input draft when clicking a quick chip and returns domain help', async () => {
    const wrapper = mount(FatCat, { attachTo: document.body })
    await wrapper.find('.lct-mascot').trigger('click')

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('my unfinished draft')

    const switchChip = wrapper
      .findAll('.lct-chat__chip')
      .find((b) => /5-pin/i.test(b.text()))
    expect(switchChip).toBeTruthy()
    await switchChip.trigger('click')

    expect(input.element.value).toBe('my unfinished draft')
    expect(wrapper.find('.lct-chat__messages').text()).toMatch(/5-pin-only switch policy/i)
    wrapper.unmount()
  })

  it('manages dialog focus on open, Escape close, and Tab focus trapping', async () => {
    const wrapper = mount(FatCat, { attachTo: document.body })
    const mascot = wrapper.find('.lct-mascot')

    await mascot.trigger('click')
    await nextTick()

    const input = wrapper.find('.lct-chat__input-field')
    expect(document.activeElement).toBe(input.element)

    const chips = wrapper.findAll('.lct-chat__chip')
    const lastChip = chips[chips.length - 1]
    lastChip.element.focus()
    expect(document.activeElement).toBe(lastChip.element)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    const closeBtn = wrapper.find('.lct-chat__close')
    expect(document.activeElement).toBe(closeBtn.element)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(lastChip.element)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()

    expect(wrapper.find('.lct-chat').exists()).toBe(false)
    expect(document.activeElement).toBe(mascot.element)
    wrapper.unmount()
  })
})
