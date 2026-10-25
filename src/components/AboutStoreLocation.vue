<script setup>
const storeLocation = 'Jewel Changi Airport, Singapore'
const storeAddress = 'Jewel Changi Airport, #02-123, Singapore'
const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(storeLocation)}&output=embed`
// With no origin, Maps uses the visitor's device location when available.
// `dir_action=navigate` starts navigation immediately where that is supported.
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(storeLocation)}&dir_action=navigate`
</script>

<template>
  <section class="about-store lct-reveal" aria-labelledby="store-heading">
    <div class="row g-4 align-items-stretch">
      <div class="col-12 col-lg-6">
        <div class="about-store__copy h-100">
          <p class="eyebrow">Visit our store</p>
          <h2 id="store-heading" class="lct-headline lct-balance">Try the feeling in person.</h2>
          <p class="lct-muted mb-4">
            Visit us at Jewel Changi Airport to see, hear, and try keyboard Parts in person.
          </p>

          <dl class="about-store__details">
            <div>
              <dt>Address</dt>
              <dd>{{ storeAddress }}</dd>
            </div>
            <div>
              <dt>Operating hours</dt>
              <dd>Daily, 10am–8pm</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd><a href="tel:+6596964835">+65 9696 4835</a></dd>
            </div>
          </dl>

          <a
            class="ui-btn primary"
            :href="directionsUrl"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get directions to Le Chaton Typers at Jewel Changi Airport in Google Maps"
          >
            Get directions
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="about-store__map-wrap">
          <iframe
            class="about-store__map"
            :src="mapUrl"
            title="Google Maps showing Le Chaton Typers at Jewel Changi Airport"
            width="600"
            height="450"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups"
          ></iframe>
          <p class="about-store__map-note">Jewel Changi Airport, Singapore</p>
        </div>
      </div>
    </div>
  </section>
</template>
