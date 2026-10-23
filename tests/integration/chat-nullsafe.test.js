import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FatCat from '../../src/components/FatCat.vue'
import { supabase, supabaseReady } from '../../src/lib/supabase.js'

describe('null-safe cloud action and chat interaction', () => {
  it('functions gracefully when supabase client is not configured', async () => {
    // When credentials are unset, client is null and ready flag is false
    expect(supabaseReady).toBe(false)
    expect(supabase).toBeNull()

    const wrapper = mount(FatCat, { attachTo: document.body })
    await wrapper.find('.catbtn').trigger('click')

    // Chat remains completely functional in local mode
    const dialog = wrapper.find('.lct-chat')
    expect(dialog.exists()).toBe(true)

    // User can still interact with chips
    const chip = wrapper.findAll('.lct-chat__chip').find((b) => /switch/i.test(b.text()))
    expect(chip).toBeTruthy()
    await chip.trigger('click')

    await nextTick()
    wrapper.unmount()
  })

  it('preserves an in-progress input draft when clicking a quick chip', async () => {
    const wrapper = mount(FatCat, { attachTo: document.body })
    await wrapper.find('.catbtn').trigger('click')

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('my unfinished draft')

    const spinChip = wrapper.findAll('.lct-chat__chip').find((b) => /spin/i.test(b.text()))
    expect(spinChip).toBeTruthy()
    await spinChip.trigger('click')

    expect(input.element.value).toBe('my unfinished draft')
    wrapper.unmount()
  })

  it('manages dialog visibility and close toggling', async () => {
    const wrapper = mount(FatCat, { attachTo: document.body })
    const mascot = wrapper.find('.catbtn')

    await mascot.trigger('click')
    await nextTick()
    expect(wrapper.find('.lct-chat').exists()).toBe(true)

    const closeBtn = wrapper.find('.lct-chat__close')
    await closeBtn.trigger('click')
    await nextTick()

    expect(wrapper.find('.lct-chat').exists()).toBe(false)
    wrapper.unmount()
  })
})
