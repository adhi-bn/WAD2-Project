<script setup>
import { computed } from 'vue'
import { build, budget, compatibility } from '../stores/build.js'

// SGD at cent precision via the platform formatter; no new util or dependency.
// currencyDisplay 'code' renders an unambiguous "SGD" label, not a bare "$".
const money = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'code',
})

// Domain contract: { compatible, reasons, incomplete, incompatible }.
// incomplete = a slot is missing; incompatible = a clash among chosen Parts.
// Both can be true at once, and a false `compatible` always carries at least
// one flag, so show every flag that applies.
const flags = computed(() => {
  const result = compatibility.value
  if (result.compatible) return ['Compatible']
  const labels = []
  if (result.incomplete) labels.push('Incomplete')
  if (result.incompatible) labels.push('Incompatible')
  return labels
})

const totalText = computed(() =>
  budget.value.total == null ? null : money.format(budget.value.total),
)
</script>

<template>
  <section class="lct-builder py-5">
    <div class="lct-container">
      <h1 class="lct-headline">Builder</h1>
      <p class="lct-lead">Part pickers land here. Compatibility and budget update as you choose.</p>
      <div class="row gy-4">
        <div class="col-12 col-md-6">
          <div class="scard">
            <div class="lct-label mb-2">Compatibility</div>
            <p>{{ flags.join(' + ') }}</p>
            <ul v-if="compatibility.reasons.length" class="mb-0">
              <li v-for="reason in compatibility.reasons" :key="reason">{{ reason }}</li>
            </ul>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="scard">
            <div class="lct-label mb-2">Budget</div>
            <p v-if="budget.error" class="mb-0">Budget unavailable: {{ budget.error }}</p>
            <p v-else-if="totalText == null" class="mb-0">Budget unavailable</p>
            <p v-else class="mb-0 lct-money">
              Total <span class="lct-money">{{ totalText }}</span> ·
              <span v-if="build.limit == null">no target set</span>
              <span v-else>{{ budget.withinBudget ? 'within budget' : 'over budget' }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
