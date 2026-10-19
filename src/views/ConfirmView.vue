<script setup>
// Order confirmation: HitPay sends the customer back here. The page checks the order status
// every few seconds until the payment is confirmed by the webhook.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { functionsUrl, anonKey, supabaseReady } from '../lib/supabase.js'
import { money2 } from '../logic/builder.js'
import { clearCart } from '../store.js'

const route = useRoute()
const order = ref(null)
const err = ref('')
let timer
let polls = 0

async function load() {
  if (!supabaseReady) { err.value = 'Orders are not set up yet.'; clearInterval(timer); return }
  const res = await fetch(`${functionsUrl}/order-status?id=${encodeURIComponent(route.params.id)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  })
  if (!res.ok) { err.value = 'We could not find that order.'; clearInterval(timer); return }
  order.value = await res.json()
  if (order.value.status !== 'pending') {
    clearInterval(timer)
    // Empty the cart only for the order this browser just paid for.
    try {
      if (order.value.status === 'paid' && localStorage.getItem('lct_pending_order') === route.params.id) {
        clearCart()
        localStorage.removeItem('lct_pending_order')
      }
    } catch (e) { /* private mode */ }
  }
}

onMounted(() => {
  load()
  timer = setInterval(() => {
    polls++
    if (polls > 40) return clearInterval(timer)
    load()
  }, 3000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section class="screen" id="order">
    <div class="wrap">
      <div v-if="err" class="panel">
        <h3>{{ err }}</h3>
        <div class="actions"><router-link to="/" class="ui-btn">Back to home</router-link></div>
      </div>

      <div v-else-if="!order" class="panel"><p>Checking your order…</p></div>

      <div v-else-if="order.status === 'paid'" class="panel">
        <div class="eyebrow">Order confirmed</div>
        <h1>Thank you, {{ order.name }}</h1>
        <p>Your payment went through. We will be in touch about your keyboard.</p>
        <table class="tbl">
          <tbody>
            <tr v-for="(it, i) in order.items" :key="i"><td>{{ it.name }}</td><td class="r">{{ money2(it.price) }}</td></tr>
          </tbody>
          <tfoot>
            <tr v-if="order.discount > 0"><td>Voucher</td><td class="r">−{{ money2(order.discount) }}</td></tr>
            <tr><td>Total paid</td><td class="r">{{ money2(order.total) }}</td></tr>
          </tfoot>
        </table>
        <div class="actions"><router-link to="/" class="ui-btn primary">Back to home</router-link></div>
      </div>

      <div v-else-if="order.status === 'failed'" class="panel">
        <h1>The payment did not go through</h1>
        <p>Your cart is still saved. You can try again.</p>
        <div class="actions"><router-link to="/cart" class="ui-btn primary">Back to cart</router-link></div>
      </div>

      <div v-else class="panel">
        <h1>Waiting for payment</h1>
        <p>HitPay is confirming your payment. This page updates by itself, so you can leave it open.</p>
      </div>
    </div>
  </section>
</template>
