<script setup>
// Account: sign up or sign in with email and password, then see and open saved builds.
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabaseReady } from '../lib/supabase.js'
import { total, money } from '../logic/builder.js'
import { state, signIn, signUp, signOut, refreshSaved, deleteSaved, buildFromIds, loadBuild } from '../store.js'

const router = useRouter()
const mode = ref('signin')
const email = ref('')
const password = ref('')
const busy = ref(false)
const err = ref('')
const info = ref('')

const saved = computed(() => state.savedBuilds.map((s) => ({ ...s, price: total(buildFromIds(s.layout, s.part_ids)) })))

onMounted(() => { if (state.user) refreshSaved() })

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

function open(s) {
  loadBuild({ layout: s.layout, part_ids: s.part_ids })
  router.push('/build')
}
</script>

<template>
  <section class="screen" id="account">
    <div class="wrap">
      <div class="phead">
        <div>
          <div class="eyebrow">Your account</div>
          <h1>{{ state.user ? 'Your saved builds' : 'Sign in to save your builds' }}</h1>
        </div>
        <router-link to="/cart" class="ui-btn">Cart</router-link>
      </div>

      <div v-if="!supabaseReady" class="panel">
        <p>Accounts are not connected yet. Add your Supabase details to the site settings to turn this on.</p>
      </div>

      <div v-else-if="!state.user" class="panel" style="max-width: 480px">
        <div class="actions" style="margin-bottom: 12px">
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
          <p v-if="err" class="sub" role="alert" style="color: #b42318">{{ err }}</p>
          <p v-if="info" class="sub">{{ info }}</p>
          <button type="submit" class="ui-btn primary big" :disabled="busy">
            {{ busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </div>

      <div v-else>
        <div class="panel" style="margin-bottom: 16px">
          <div class="vline"><span>Signed in as</span><span>{{ state.user.email }}</span></div>
          <div class="actions"><button type="button" class="ui-btn" @click="signOut">Sign out</button></div>
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
      </div>
    </div>
  </section>
</template>
