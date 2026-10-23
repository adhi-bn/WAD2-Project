<script setup>
// Checkout: collects the customer's details, asks the checkout function to create the order and
// HitPay payment, then sends the customer to HitPay's payment page.
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseReady } from '../lib/supabase.js'
import { total, money2 } from '../logic/builder.js'
import { state, buildFromIds, discountOf } from '../store.js'

const name = ref('')
const email = ref('')
const voucher = ref(state.ld.applied && state.ld.code ? state.ld.code : '')
const busy = ref(false)
const err = ref('')

const subtotal = computed(() => state.cart.reduce((s, it) => s + total(buildFromIds(it.layout, it.part_ids)), 0))
const disc = computed(() => discountOf(subtotal.value))
const canPay = computed(() => name.value.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) && !busy.value)

onMounted(() => {
  if (state.user?.email) email.value = state.user.email
})

async function pay() {
  err.value = ''
  if (!supabaseReady || !supabase) { err.value = 'Payments are not set up yet.'; return }
  busy.value = true
  const items = state.cart.map((it) => ({ name: it.name, layout: it.layout, part_ids: it.part_ids }))
  const { data, error } = await supabase.functions.invoke('checkout', {
    body: {
      items,
      customer: { name: name.value.trim(), email: email.value.trim() },
      voucher: voucher.value.trim() || null,
      origin: window.location.origin,
    },
  })
  if (error) {
    // Errors come back as a non-2xx response with a readable message in the body.
    const body = await error.context?.json?.().catch(() => null)
    err.value = body?.error || 'Could not start payment. Please try again.'
    busy.value = false
    return
  }
  if (data?.error) { err.value = data.error; busy.value = false; return }
  // Remember which order this was, so the confirmation page knows to empty the cart once it is paid.
  try { localStorage.setItem('lct_pending_order', data.orderId) } catch (e) { /* private mode */ }
  window.location.href = data.url
}
</script>

<template>
  <section class="screen" id="checkout">
    <div class="wrap">
      <div class="phead">
        <div>
          <div class="eyebrow">Checkout</div>
          <h1>Pay for your keyboard</h1>
        </div>
        <router-link to="/cart" class="ui-btn">← Back to cart</router-link>
      </div>

      <div class="sumgrid">
        <form class="panel" @submit.prevent="pay">
          <h3>Your details</h3>
          <div class="mb-3">
            <label class="form-label" for="ckName">Full name</label>
            <input id="ckName" v-model="name" class="form-control" autocomplete="name" required />
          </div>
          <div class="mb-3">
            <label class="form-label" for="ckEmail">Email</label>
            <input id="ckEmail" v-model="email" type="email" class="form-control" autocomplete="email" required />
            <div class="sub">We send your order confirmation here.</div>
          </div>
          <div class="mb-3">
            <label class="form-label" for="ckVoucher">Voucher code (optional)</label>
            <input id="ckVoucher" v-model="voucher" class="form-control" placeholder="e.g. FATCAT10" />
          </div>
          <p v-if="err" class="sub" role="alert" style="color: #b42318">{{ err }}</p>
          <div class="actions">
            <button type="submit" class="ui-btn primary big" :disabled="!canPay">
              {{ busy ? 'Starting payment…' : 'Pay securely with HitPay →' }}
            </button>
          </div>
        </form>

        <div class="panel">
          <h3>Order</h3>
          <div v-for="it in state.cart" :key="it.uid" class="vline">
            <span>{{ it.name }}</span>
            <span class="mono">{{ money2(total(buildFromIds(it.layout, it.part_ids))) }}</span>
          </div>
          <div class="vline"><span>Subtotal</span><span class="mono">{{ money2(subtotal) }}</span></div>
          <div v-if="disc > 0" class="vline"><span>Voucher (estimate)</span><span class="mono">−{{ money2(disc) }}</span></div>
          <div class="bigtotal" style="margin-top: 12px"><span class="eyebrow">Total</span><span class="amt">{{ money2(subtotal - disc) }}</span></div>
          <p class="sub">The server recalculates the total when you pay, so the amount charged is always the one shown on the payment page.</p>
        </div>
      </div>
    </div>
  </section>
</template>
