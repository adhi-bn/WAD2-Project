<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CATS, META } from '../data/catalog.js'
import { money, total } from '../logic/builder.js'
import { buildFromIds, loadBuild, refreshSaved, state } from '../store.js'

const router = useRouter()
const leftId = ref('')
const rightId = ref('')

const builds = computed(() => state.savedBuilds.map((saved) => ({
  ...saved,
  parts: buildFromIds(saved.layout, saved.part_ids),
  total: total(buildFromIds(saved.layout, saved.part_ids)),
})))

const leftBuild = computed(() => builds.value.find((build) => build.id === leftId.value) || null)
const rightBuild = computed(() => builds.value.find((build) => build.id === rightId.value) || null)
const canCompare = computed(() => Boolean(leftBuild.value && rightBuild.value && leftId.value !== rightId.value))
const priceDifference = computed(() => canCompare.value ? leftBuild.value.total - rightBuild.value.total : 0)

function priceClass(price, comparedPrice) {
  if (price > comparedPrice) return 'is-higher'
  if (price < comparedPrice) return 'is-lower'
  return 'is-equal'
}

function selectDefaults() {
  const ids = builds.value.map((build) => build.id)
  if (!ids.includes(leftId.value)) leftId.value = ids[0] || ''
  if (!ids.includes(rightId.value) || rightId.value === leftId.value) rightId.value = ids.find((id) => id !== leftId.value) || ''
}

function chooseLeft(event) {
  leftId.value = event.target.value
  if (leftId.value === rightId.value) rightId.value = builds.value.find((build) => build.id !== leftId.value)?.id || ''
}

function chooseRight(event) {
  rightId.value = event.target.value
  if (rightId.value === leftId.value) leftId.value = builds.value.find((build) => build.id !== rightId.value)?.id || ''
}

function editBuild(build) {
  loadBuild(build)
  router.push('/parts')
}

onMounted(() => {
  if (state.user) refreshSaved()
  selectDefaults()
})

watch(() => state.savedBuilds.map((build) => build.id).join(','), selectDefaults)
</script>

<template>
  <section class="screen compare-screen" id="compare-builds">
    <div class="wrap">
      <div class="phead compare-head">
        <div>
          <div class="eyebrow">Saved Build library</div>
          <h1>Compare Builds</h1>
          <p>Put two saved Builds side by side to compare their total and every Part before you edit.</p>
        </div>
        <router-link to="/account" class="ui-btn">Manage saved Builds</router-link>
      </div>

      <div v-if="builds.length < 2" class="compare-empty panel">
        <div class="eyebrow">Two Builds needed</div>
        <h2>Save one more Build to compare.</h2>
        <p>Comparisons use the Builds in your profile. Finish a Build, save it, then return here to see the differences side by side.</p>
        <router-link to="/swipe" class="ui-btn primary">Start a Build →</router-link>
      </div>

      <template v-else>
        <div class="compare-picker" aria-label="Choose Builds to compare">
          <label class="compare-select">
            <span class="eyebrow">Left Build</span>
            <select :value="leftId" @change="chooseLeft">
              <option v-for="build in builds" :key="build.id" :value="build.id" :disabled="build.id === rightId">
                {{ build.name }} · {{ build.layout }}%
              </option>
            </select>
          </label>
          <span class="compare-versus" aria-hidden="true">vs</span>
          <label class="compare-select">
            <span class="eyebrow">Right Build</span>
            <select :value="rightId" @change="chooseRight">
              <option v-for="build in builds" :key="build.id" :value="build.id" :disabled="build.id === leftId">
                {{ build.name }} · {{ build.layout }}%
              </option>
            </select>
          </label>
        </div>

        <div v-if="canCompare" class="compare-cards">
          <article v-for="(build, index) in [leftBuild, rightBuild]" :key="build.id" class="compare-card">
            <div class="compare-card-top">
              <span class="compare-side">{{ index === 0 ? 'Build A' : 'Build B' }}</span>
              <span class="chip">{{ build.layout }}% layout</span>
            </div>
            <div class="compare-card-title">
              <h2 :title="build.name">{{ build.name }}</h2>
              <p class="compare-saved">Saved {{ new Date(build.created_at).toLocaleDateString('en-SG') }}</p>
            </div>
            <!-- A saved Build can provide image_url later; this keeps the card polished until then. -->
            <img v-if="build.image_url" class="compare-preview" :src="build.image_url" :alt="`${build.name} keyboard Build`" />
            <div v-else class="compare-preview compare-preview--placeholder" role="img" :aria-label="`${build.name} keyboard image placeholder`">
              <div class="compare-preview__keys" aria-hidden="true"><i v-for="key in 24" :key="key"></i></div>
              <span>Build image</span>
              <small>Image coming soon</small>
            </div>
            <div class="compare-total">
              <span>Total</span>
              <strong :class="priceClass(build.total, index === 0 ? rightBuild.total : leftBuild.total)">{{ money(build.total) }}</strong>
            </div>
            <div class="compare-card-parts">
              <span>{{ build.parts.case.name }}</span>
              <span>{{ build.parts.switches.name }}</span>
              <span>{{ build.parts.keycaps.name }}</span>
            </div>
            <button type="button" class="ui-btn primary" :aria-label="`Edit ${build.name}`" @click="editBuild(build)">Edit this Build</button>
          </article>
        </div>

        <div v-if="canCompare" class="compare-insight" role="status">
          <template v-if="priceDifference === 0">These Builds have the same total.</template>
          <template v-else-if="priceDifference > 0">Build A costs {{ money(priceDifference) }} more than Build B.</template>
          <template v-else>Build B costs {{ money(Math.abs(priceDifference)) }} more than Build A.</template>
        </div>

        <details v-if="canCompare" class="compare-details">
          <summary>
            <span><span class="eyebrow">Side-by-side details</span> Compare all Parts</span>
            <span class="compare-summary-total">{{ CATS.length }} groups</span>
          </summary>
          <div class="compare-table-wrap">
            <table class="compare-table">
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col">{{ leftBuild.name }}</th>
                  <th scope="col">{{ rightBuild.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="category in CATS" :key="category" :class="{ 'is-different': leftBuild.parts[category].id !== rightBuild.parts[category].id }">
                  <th scope="row">{{ META[category].label }}</th>
                  <td><span>{{ leftBuild.parts[category].name }}</span><b :class="priceClass(leftBuild.parts[category].price, rightBuild.parts[category].price)">{{ money(leftBuild.parts[category].price) }}</b></td>
                  <td><span>{{ rightBuild.parts[category].name }}</span><b :class="priceClass(rightBuild.parts[category].price, leftBuild.parts[category].price)">{{ money(rightBuild.parts[category].price) }}</b></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Build total</th>
                  <td :class="priceClass(leftBuild.total, rightBuild.total)">{{ money(leftBuild.total) }}</td>
                  <td :class="priceClass(rightBuild.total, leftBuild.total)">{{ money(rightBuild.total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </template>
    </div>
  </section>
</template>
