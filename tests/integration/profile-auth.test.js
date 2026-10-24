import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountView from '../../src/views/AccountView.vue'
import App from '../../src/App.vue'
import HomeView from '../../src/views/HomeView.vue'
import { catalog, CATS } from '../../src/data/catalog.js'
import { preserveGuestDraft, resolveAccountTransition, signOut, state } from '../../src/store.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/account', name: 'account', component: AccountView },
    ],
  })
}

afterEach(() => {
  state.user = null
  state.build = null
  state.cat = null
  state.rec = null
  state.guestDraft = null
  state.savedBuilds = []
  state.ui.accountTransition = false
  Object.assign(state.ld, { used: false, prize: null, code: null, expires: 0, applied: false })
  localStorage.removeItem('lct_guest_draft')
})

describe('profile authentication surface', () => {
  it('keeps the guest profile usable when cloud authentication is unavailable', () => {
    const wrapper = mount(AccountView)

    expect(wrapper.get('h1').text()).toBe('Sign in to save your builds')
    expect(wrapper.text()).toContain('Accounts are not connected yet.')
  })

  it('changes the shell account label to Profile for a signed-in user', async () => {
    state.user = { id: 'account-a', email: 'member@example.com' }
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.get('a.navlink[href="/account"]').text()).toContain('Profile')
  })

  it('clears account state while preserving a Build only after an explicit guest-draft choice', async () => {
    const parts = catalog('75')
    state.answers.layout = '75'
    state.answers.budget = 420
    state.build = Object.fromEntries(CATS.map((group) => [group, parts[group][0]]))
    state.user = { id: 'account-a', email: 'member@example.com' }
    state.savedBuilds = [{ id: 'saved-a' }]
    Object.assign(state.ld, { used: true, prize: 0, code: 'TEST', expires: Date.now() + 1000, applied: true })

    expect(preserveGuestDraft()).toBe(true)
    await signOut({ preserveDraft: true })

    expect(state.user).toBeNull()
    expect(state.savedBuilds).toEqual([])
    expect(state.ld.code).toBeNull()
    expect(state.build).toBeNull()
    expect(state.guestDraft.part_ids).toHaveProperty(CATS[0])
  })

  it('does not leave a Build available for a changed account until the user resolves it', () => {
    const parts = catalog('75')
    state.answers.layout = '75'
    state.build = Object.fromEntries(CATS.map((group) => [group, parts[group][0]]))
    state.ui.accountTransition = true

    resolveAccountTransition({ preserveDraft: false })

    expect(state.build).toBeNull()
    expect(state.guestDraft).toBeNull()
    expect(state.ui.accountTransition).toBe(false)
  })
})
