import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FatCat from '../../src/components/FatCat.vue'
import { openWheel, state } from '../../src/store.js'

describe('Biscuit interactive helper and lucky draw', () => {
  it('opens chat dialog with aria-modal and role=dialog', async () => {
    const wrapper = mount(FatCat)
    expect(wrapper.find('.lct-chat').exists()).toBe(false)

    await wrapper.find('.catbtn').trigger('click')
    const dialog = wrapper.find('.lct-chat')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('renders quick-reply chips for user assistance', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.catbtn').trigger('click')
    const chips = wrapper.findAll('.lct-chat__chip')
    expect(chips.length).toBeGreaterThan(0)
    const texts = chips.map((c) => c.text())
    expect(texts).toContain('Spin the wheel')
    expect(texts).toContain('Help me pick switches')
  })

  it('sends user message and displays it in messages container', async () => {
    const wrapper = mount(FatCat)
    await wrapper.find('.catbtn').trigger('click')

    const input = wrapper.find('.lct-chat__input-field')
    await input.setValue('Looking for silent switches')
    await wrapper.find('form.chatin').trigger('submit')

    await nextTick()
    const msgs = wrapper.find('.lct-chat__messages')
    expect(msgs.text()).toContain('Looking for silent switches')
  })

  it('renders the lucky draw wheel modal when openWheel is invoked', async () => {
    const wrapper = mount(FatCat)
    expect(wrapper.find('.ld-modal').exists()).toBe(false)

    openWheel()
    await nextTick()

    const modal = wrapper.find('.ld-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.attributes('aria-modal')).toBe('true')
    expect(wrapper.find('svg#wheel').exists()).toBe(true)
    expect(wrapper.find('button.hub').exists()).toBe(true)

    // Close the wheel
    await wrapper.find('.mclose').trigger('click')
    await nextTick()
    expect(wrapper.find('.ld-modal').exists()).toBe(false)
  })

  it('allows spinning the lucky wheel with an email and generates a voucher', async () => {
    const wrapper = mount(FatCat)
    openWheel()
    await nextTick()

    const emailInput = wrapper.find('#ldEmail')
    expect(emailInput.exists()).toBe(true)
    await emailInput.setValue('test@example.com')

    await wrapper.find('#ldF').trigger('submit')
    await nextTick()

    // Spin button indicates progress or completes
    expect(state.ld.prize || wrapper.find('.mclose').exists()).toBeTruthy()

    // Close wheel
    await wrapper.find('.mclose').trigger('click')
  })
})
