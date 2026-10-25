<script setup>
// Profile: guest-first email/Google authentication and the signed-in Build library.
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseReady } from '../lib/supabase.js'
import { total, money } from '../logic/builder.js'
import { state, signIn, signUp, signOut, signInWithGoogle, refreshSaved, deleteSaved, buildFromIds, loadBuild, restoreGuestDraft, resolveAccountTransition } from '../store.js'

const router = useRouter()
const mode = ref('signin')
const email = ref('')
const password = ref('')
const busy = ref(false)
const err = ref('')
const info = ref('')
const signingInWithGoogle = ref(false)
const confirmSignOut = ref(false)
const googleButton = ref(null)
const signOutButton = ref(null)
const transitionDialog = ref(null)
const confirmSignOutDialog = ref(null)

const saved = computed(() => state.savedBuilds.map((s) => ({ ...s, price: total(buildFromIds(s.layout, s.part_ids)) })))

onMounted(() => { if (state.user) refreshSaved() })

watch(() => state.ui.accountTransition, async (needsDecision) => {
  if (!needsDecision) return
  await nextTick()
  transitionDialog.value?.focus()
})

async function submit() {
  err.value = ''
  info.value = ''
  busy.value = true
  const res = mode.value === 'signin' ? await signIn(email.value.trim(), password.value) : await signUp(email.value.trim(), password.value)
  busy.value = false
  if (res.error) err.value = res.error
  if (res.info) info.value = res.info
  if (!res.error) password.value = ''
}

async function googleSignIn() {
  err.value = ''
  info.value = ''
  signingInWithGoogle.value = true
  const res = await signInWithGoogle()
  signingInWithGoogle.value = false
  if (res.error) err.value = res.error
  else info.value = 'Opening Google sign-in…'
}

async function finishSignOut(preserveDraft) {
  err.value = ''
  const res = await signOut({ preserveDraft })
  confirmSignOut.value = false
  if (res.error) err.value = `Could not sign out: ${res.error}`
  else {
    info.value = preserveDraft ? 'Your Build is saved locally as a guest draft.' : 'You are signed out.'
    await nextTick()
    googleButton.value?.focus()
  }
}

async function startSignOut() {
  if (!state.build) { await finishSignOut(false); return }
  confirmSignOut.value = true
  await nextTick()
  confirmSignOutDialog.value?.focus()
}

async function cancelSignOut() {
  confirmSignOut.value = false
  await nextTick()
  signOutButton.value?.focus()
}

function resolveTransition(preserveDraft) {
  resolveAccountTransition({ preserveDraft })
  info.value = preserveDraft ? 'Your previous Build is saved locally as a guest draft.' : 'Your previous Build was discarded.'
}

function dismissTransition() {
  resolveTransition(false)
}

function open(s) {
  loadBuild({ layout: s.layout, part_ids: s.part_ids })
  router.push('/build')
}

function continueGuestDraft() {
  if (restoreGuestDraft()) router.push('/build')
}
</script>

<template>
  <section class="screen" id="account">
    <div class="wrap">
      <div class="phead">
        <div>
          <div class="eyebrow">{{ state.user ? 'Your profile' : 'Your account' }}</div>
          <h1>{{ state.user ? 'Your saved builds' : 'Sign in to save your builds' }}</h1>
        </div>
        <router-link to="/cart" class="ui-btn">Cart</router-link>
      </div>

      <div v-if="!supabaseReady" class="panel">
        <p>Accounts are not connected yet. Add your Supabase details to the site settings to turn this on.</p>
        <button ref="googleButton" type="button" class="ui-btn google-btn" disabled aria-describedby="googleUnavailable">
          Continue with Google
        </button>
        <p id="googleUnavailable" class="account-status">Google sign-in is unavailable until Supabase is configured.</p>
      </div>

      <div v-else-if="!state.user" class="panel" style="max-width: 480px">
        <div class="actions account-auth-actions" style="margin-bottom: 12px">
          <button ref="googleButton" type="button" class="ui-btn google-btn" :disabled="signingInWithGoogle" @click="googleSignIn">
            {{ signingInWithGoogle ? 'Opening Google…' : 'Continue with Google' }}
          </button>
          <button type="button" class="ui-btn" :class="{ primary: mode === 'signin' }" @click="mode = 'signin'">Sign in</button>
          <button type="button" class="ui-btn" :class="{ primary: mode === 'signup' }" @click="mode = 'signup'">Create account</button>
        </div>
        <form @submit.prevent="submit">
          <div class="mb-3">
            <label class="form-label" for="acEmail">Email</label>
            <input id="acEmail" v-model="email" type="email" class="form-control" autocomplete="email" required />
          </div>
          <div class="mb-3">
            <label class="form-label" for="acPass">Password</label>
            <input id="acPass" v-model="password" type="password" class="form-control" minlength="6" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" required />
          </div>
          <p v-if="err" class="account-status is-error" role="alert">{{ err }}</p>
          <p v-if="info" class="account-status" role="status">{{ info }}</p>
          <button type="submit" class="ui-btn primary big" :disabled="busy">
            {{ busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </div>

      <div v-else class="profile-layout">
        <div class="panel profile-identity">
          <div>
            <div class="eyebrow">Signed in</div>
            <h2>{{ state.user.user_metadata?.full_name || state.user.email }}</h2>
            <p>{{ state.user.email }}</p>
          </div>
          <button ref="signOutButton" type="button" class="ui-btn" @click="startSignOut">Sign out</button>
        </div>

        <div v-if="state.ui.accountTransition" ref="transitionDialog" class="panel profile-signout" role="dialog" aria-modal="true" aria-labelledby="accountTransitionTitle" tabindex="-1" @keydown.esc="dismissTransition">
          <div class="eyebrow">Account changed</div>
          <h2 id="accountTransitionTitle">What should happen to the previous Build?</h2>
          <p>It cannot be saved to this profile unless you create a new Build here. Choose whether to keep a device-only guest draft or discard it.</p>
          <div class="actions">
            <button type="button" class="ui-btn primary" @click="resolveTransition(true)">Preserve as guest draft</button>
            <button type="button" class="ui-btn" @click="resolveTransition(false)">Discard previous Build</button>
          </div>
        </div>

        <div v-if="confirmSignOut" ref="confirmSignOutDialog" class="panel profile-signout" role="dialog" aria-modal="true" aria-labelledby="signOutTitle" tabindex="-1" @keydown.esc="cancelSignOut">
          <div class="eyebrow">Before you sign out</div>
          <h2 id="signOutTitle">What should happen to this Build?</h2>
          <p>Your current Build is not saved to another account. Choose whether to preserve it only on this device.</p>
          <div class="actions">
            <button type="button" class="ui-btn primary" @click="finishSignOut(true)">Preserve as guest draft</button>
            <button type="button" class="ui-btn" @click="finishSignOut(false)">Discard Build and sign out</button>
            <button type="button" class="ui-btn" @click="cancelSignOut">Cancel</button>
          </div>
        </div>

        <div v-if="saved.length === 0" class="panel">
          <h3>No saved builds yet</h3>
          <p>Build a keyboard and press "Save build" on the build page.</p>
          <div class="actions"><router-link to="/swipe" class="ui-btn primary">Start building →</router-link></div>
        </div>

        <div v-for="s in saved" :key="s.id" class="panel" style="margin-bottom: 12px">
          <div class="phead" style="margin-bottom: 0">
            <div>
              <div class="eyebrow">{{ s.layout }}% · saved {{ new Date(s.created_at).toLocaleDateString('en-SG') }}</div>
              <h3 style="margin: 0">{{ s.name }}</h3>
            </div>
            <div class="amt mono">{{ money(s.price) }}</div>
          </div>
          <div class="actions">
            <button type="button" class="ui-btn primary" @click="open(s)">Open</button>
            <button type="button" class="ui-btn" @click="deleteSaved(s.id)">Delete</button>
          </div>
        </div>

        <div class="profile-details" aria-label="Profile details">
          <section class="panel">
            <div class="eyebrow">Address</div>
            <h3>Address book</h3>
            <p>Address saving is not connected yet. No address data is collected or stored in this demo.</p>
          </section>
          <section class="panel">
            <div class="eyebrow">Payment</div>
            <h3>Payment details</h3>
            <p>Payment details are unavailable. This app does not collect or store card information.</p>
          </section>
        </div>
      </div>

      <div v-if="state.guestDraft && !state.user" class="panel profile-draft">
        <div><div class="eyebrow">Local guest draft</div><p>A Build was explicitly preserved on this device and is not attached to your profile.</p></div>
        <button type="button" class="ui-btn" @click="continueGuestDraft">Open guest draft</button>
      </div>
    </div>
  </section>
</template>
