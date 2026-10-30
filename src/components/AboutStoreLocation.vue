<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { findNearestDrivingStore } from '../lib/storeLocator.js'

const stores = [
  { id: 'jewel', name: 'Jewel Changi Airport', address: 'Jewel Changi Airport, #02-123, Singapore', image: '/images/jewel-changi.webp', latitude: 1.3602, longitude: 103.989 },
  { id: 'mbs', name: 'Marina Bay Sands', address: '2 Bayfront Ave, B2-06, Singapore 018972', image: '/images/marina-bay-sands.avif', latitude: 1.2834, longitude: 103.8607 },
]

const selectedStoreId = ref('jewel')
const locationStatus = ref('')
const isLocating = ref(false)
const routeSummary = ref('')
const routeGeometry = ref('')
const routeDetails = ref({})
const visitorLocation = ref(null)
const mapPanel = ref(null)
const mapElement = ref(null)
const selectedStore = computed(() => stores.find((store) => store.id === selectedStoreId.value) || stores[0])

let map
let leaflet
let storeMarkers
let routeLine
let visitorMarker
let isUnmounted = false
let leafletPromise

function loadOneMapLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-onemap-leaflet]')) {
      const stylesheet = document.createElement('link')
      stylesheet.rel = 'stylesheet'
      stylesheet.href = 'https://www.onemap.gov.sg/web-assets/libs/leaflet/leaflet.css'
      stylesheet.dataset.onemapLeaflet = 'true'
      document.head.appendChild(stylesheet)
    }
    const script = document.createElement('script')
    script.src = 'https://www.onemap.gov.sg/web-assets/libs/leaflet/onemap-leaflet.js'
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('OneMap map library did not load.'))
    script.onerror = () => reject(new Error('OneMap map library could not load.'))
    document.head.appendChild(script)
  })
  return leafletPromise
}

// OneMap returns an encoded polyline. Decode it before Leaflet can draw the driving route.
function decodePolyline(encoded) {
  const points = []
  let index = 0
  let latitude = 0
  let longitude = 0
  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    latitude += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    longitude += result & 1 ? ~(result >> 1) : result >> 1
    points.push([latitude / 1e5, longitude / 1e5])
  }
  return points
}

function drawMap() {
  if (!map || !leaflet) return
  storeMarkers?.clearLayers()
  routeLine?.remove()
  visitorMarker?.remove()

  storeMarkers = leaflet.layerGroup().addTo(map)
  for (const store of stores) {
    const selected = store.id === selectedStoreId.value
    const marker = leaflet.circleMarker([store.latitude, store.longitude], {
      radius: selected ? 10 : 7,
      color: selected ? '#3346FF' : '#596072',
      weight: 2,
      fillColor: selected ? '#3346FF' : '#FFFFFF',
      fillOpacity: 1,
    }).bindPopup(`<strong>${store.name}</strong><br>${store.address}`)
    marker.addTo(storeMarkers)
  }

  if (visitorLocation.value) {
    visitorMarker = leaflet.circleMarker([visitorLocation.value.latitude, visitorLocation.value.longitude], {
      radius: 8, color: '#12805A', weight: 3, fillColor: '#FFFFFF', fillOpacity: 1,
    }).bindPopup('Your location').addTo(map)
  }

  const points = routeGeometry.value ? decodePolyline(routeGeometry.value) : []
  if (points.length > 1) {
    routeLine = leaflet.polyline(points, { color: '#3346FF', weight: 5, opacity: 0.9 }).addTo(map)
    map.fitBounds(routeLine.getBounds(), { padding: [32, 32] })
  } else {
    map.setView([selectedStore.value.latitude, selectedStore.value.longitude], 15)
  }
}

function selectStore(store) {
  selectedStoreId.value = store.id
  routeSummary.value = ''
  routeGeometry.value = ''
  visitorLocation.value = null
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDriveTime(seconds) {
  return `${Math.max(1, Math.round(seconds / 60))} min drive`
}

async function findNearestStore() {
  if (!navigator.geolocation) {
    locationStatus.value = 'Your browser cannot share a location. Choose either store below to view it on OneMap.'
    return
  }

  isLocating.value = true
  locationStatus.value = 'Finding the fastest driving route…'
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const result = await findNearestDrivingStore(coords.latitude, coords.longitude)
      isLocating.value = false
      if (result.error || !result.storeId) {
        locationStatus.value = result.error || 'We could not compare driving routes. Choose a store below to view it on OneMap.'
        return
      }
      selectedStoreId.value = result.storeId
      visitorLocation.value = { latitude: coords.latitude, longitude: coords.longitude }
      routeGeometry.value = result.routeGeometry || ''
      routeDetails.value = Object.fromEntries((result.routes || []).map((route) => [route.storeId, route]))
      routeSummary.value = `${formatDriveTime(result.durationSeconds)} · ${formatDistance(result.distanceMeters)}`
      locationStatus.value = `${selectedStore.value.name} is your nearest store by driving time.`
      mapPanel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    },
    () => {
      isLocating.value = false
      locationStatus.value = 'We could not access your location. Choose either store below to view it on OneMap.'
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  )
}

onMounted(async () => {
  try {
    leaflet = await loadOneMapLeaflet()
    if (isUnmounted || !mapElement.value) return
    map = leaflet.map(mapElement.value, { zoomControl: true, scrollWheelZoom: false })
    leaflet.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 11,
      attribution: '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:16px;width:16px" alt="" /> <a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | <a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>',
    }).addTo(map)
    drawMap()
  } catch (error) {
    locationStatus.value = 'The interactive OneMap could not load. Please try again later.'
  }
})

watch([selectedStoreId, routeGeometry, visitorLocation], drawMap)

onBeforeUnmount(() => {
  isUnmounted = true
  map?.remove()
})
</script>

<template>
  <section class="about-store lct-reveal" aria-labelledby="store-heading">
    <div class="about-store__intro">
      <div>
        <p class="eyebrow">Visit our stores</p>
        <h2 id="store-heading" class="lct-headline lct-balance">Try the feeling in person.</h2>
        <p class="lct-muted mb-0">See, hear, and try keyboard Parts in person at Jewel Changi Airport or Marina Bay Sands.</p>
      </div>
      <div class="about-store__locator">
        <button type="button" class="ui-btn primary" :disabled="isLocating" @click="findNearestStore">
          {{ isLocating ? 'Finding nearest store…' : 'Find nearest store' }} <span aria-hidden="true">⌖</span>
        </button>
        <p class="about-store__status" role="status" aria-live="polite">{{ locationStatus }}</p>
      </div>
    </div>

    <div class="about-store__grid">
      <article v-for="store in stores" :key="store.id" class="about-store__card" :class="{ 'is-selected': store.id === selectedStoreId }">
        <img class="about-store__thumbnail" :src="store.image" :alt="`${store.name} store location`" width="128" height="128" loading="lazy" />
        <div class="about-store__card-content">
        <div class="about-store__card-top">
          <span class="eyebrow">{{ store.id === 'jewel' ? 'East' : 'Central' }} Singapore</span>
          <span v-if="store.id === selectedStoreId" class="about-store__selected">Viewing</span>
        </div>
        <h3>{{ store.name }}</h3>
        <p>{{ store.address }}</p>
        <p v-if="routeDetails[store.id]" class="about-store__distance">{{ formatDistance(routeDetails[store.id].distanceMeters) }} · {{ formatDriveTime(routeDetails[store.id].durationSeconds) }}</p>
        <dl class="about-store__details">
          <div><dt>Operating hours</dt><dd>Daily, 10am–8pm</dd></div>
          <div><dt>Contact</dt><dd><a :href="store.id === 'jewel' ? 'tel:+6594623787' : 'tel:+6596964835'">{{ store.id === 'jewel' ? '+65 9462 3787' : '+65 9696 4835' }}</a></dd></div>
        </dl>
        <div class="about-store__actions"><button type="button" class="ui-btn" @click="selectStore(store)">View on OneMap</button></div>
        </div>
      </article>
    </div>

    <div ref="mapPanel" class="about-store__map-wrap">
      <div ref="mapElement" class="about-store__map" role="img" :aria-label="`Interactive OneMap showing Le Chaton Typers at ${selectedStore.name}`"></div>
      <div class="about-store__map-note">
        <strong>Viewing: {{ selectedStore.name }}</strong>
        <span v-if="routeSummary">{{ routeSummary }}</span>
        <span v-else>Select a store, or find the nearest driving route.</span>
      </div>
    </div>
  </section>
</template>
