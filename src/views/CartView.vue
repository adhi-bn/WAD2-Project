<script setup>
// Cart: each item is a keyboard the customer built. Prices are worked out from the parts at today's prices.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { total, money, money2 } from '../logic/builder.js'
import { state, buildFromIds, removeFromCart, loadBuild, discountOf } from '../store.js'

const router = useRouter()
const lines = computed(() => state.cart.map((it) => {
  const b = buildFromIds(it.layout, it.part_ids)
  return { it, b, price: total(b) }
}))
const subtotal = computed(() => lines.value.reduce((s, l) => s + l.price, 0))
const disc = computed(() => discountOf(subtotal.value))
const due = computed(() => subtotal.value - disc.value)

function edit(l) {
  loadBuild(l.it)
  router.push('/build')
}
</script>

<template>
  <section class="screen" id="cart">
    <div class="wrap">
      <div class="phead">
        <div>
          <div class="eyebrow">Step 4 · Cart</div>
          <h1>Your cart</h1>
        </div>
        <router-link to="/account" class="ui-btn">Your saved builds</router-link>
      </div>

      <div v-if="lines.length === 0" class="panel">
        <h3>Your cart is empty</h3>
        <p>Build a keyboard, then add it here.</p>
        <div class="actions">
          <router-link to="/swipe" class="ui-btn primary">Start building →</router-link>
        </div>
      </div>

      <div v-else class="sumgrid">
        <div>
          <div v-for="l in lines" :key="l.it.uid" class="panel" style="margin-bottom: 16px">
            <div class="phead" style="margin-bottom: 8px">
              <div>
                <div class="eyebrow">{{ l.it.layout }}% keyboard</div>
                <h3 style="margin: 0">{{ l.it.name }}</h3>
              </div>
              <div class="amt mono">{{ money(l.price) }}</div>
            </div>
            <p class="sub" style="margin: 0 0 12px">
              {{ l.b.case.name }} · {{ l.b.plate.name }} · {{ l.b.pcb.name }} · {{ l.b.switches.name }} · {{ l.b.keycaps.name }}
            </p>
            <div class="actions">
              <button type="button" class="ui-btn" @click="edit(l)">Edit build</button>
              <button type="button" class="ui-btn" @click="removeFromCart(l.it.uid)">Remove</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>Order summary</h3>
          <div class="vline"><span>Subtotal</span><span class="mono">{{ money(subtotal) }}</span></div>
          <div v-if="disc > 0" class="vline"><span>{{ state.ld.code }} voucher</span><span class="mono">−{{ money2(disc) }}</span></div>
          <div class="bigtotal" style="margin-top: 12px"><span class="eyebrow">Total</span><span class="amt">{{ money2(due) }}</span></div>
          <p class="sub">Prices in SGD. The final amount is confirmed at payment.</p>
          <div class="actions">
            <router-link to="/checkout" class="ui-btn primary big">Checkout →</router-link>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
