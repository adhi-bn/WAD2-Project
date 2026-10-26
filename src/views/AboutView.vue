<script setup>
import { RouterLink } from 'vue-router'
import AboutFeatureCards from '../components/AboutFeatureCards.vue'
import AboutKeyboardVisual from '../components/AboutKeyboardVisual.vue'
import AboutStoreLocation from '../components/AboutStoreLocation.vue'
</script>

<template>
  <div class="about-page">
    <section class="about-hero" aria-labelledby="about-page-title">
      <div class="lct-container">
        <div class="row align-items-center g-5">
          <div class="col-12 col-lg-7">
            <p class="eyebrow">About <span translate="no">Le Chaton Typers</span></p>
            <h1 id="about-page-title" class="lct-display lct-balance"><span translate="no">Le Chaton Typers</span></h1>
            <p class="about-hero__tagline">Your Keyboard. Your Style. Your Sound.</p>
            <p class="lct-lead">
              A mechanical-keyboard platform that helps you design, visualise, hear, compare, and track the Budget for your Build before checkout.
            </p>
            <RouterLink to="/builder" class="ui-btn primary big about-hero__action">Start building <span aria-hidden="true">→</span></RouterLink>
          </div>
          <div class="col-12 col-lg-5">
            <AboutKeyboardVisual />
          </div>
        </div>
      </div>
    </section>

    <section class="about-section" aria-labelledby="story-heading">
      <div class="lct-container">
        <div class="row justify-content-between g-4">
          <div class="col-12 col-lg-4">
            <p class="eyebrow">Our story &amp; vision</p>
            <h2 id="story-heading" class="lct-headline lct-balance">A clearer way to make a keyboard yours.</h2>
          </div>
          <div class="col-12 col-lg-7">
            <div class="about-story lct-reveal">
              <p>
                Assembling a Build can feel complicated when you are just getting started. Part information is scattered, Parts can be incompatible, and it is hard to know how the finished keyboard will look, feel, sound, or fit your Budget.
              </p>
              <p class="mb-0">
                We are creating a more accessible, interactive, and convenient way to explore Parts and assemble a Build—so you can make considered choices and enjoy building something that feels entirely yours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="about-section about-section--tinted" aria-labelledby="different-heading">
      <div class="lct-container">
        <div class="about-section__heading">
          <p class="eyebrow">What makes us different</p>
          <h2 id="different-heading" class="lct-headline lct-balance">Everything you need to decide with confidence.</h2>
        </div>
        <AboutFeatureCards />
      </div>
    </section>

    <div class="about-section">
      <div class="lct-container">
        <AboutStoreLocation />
      </div>
    </div>

    <section class="about-final-cta" aria-labelledby="final-cta-heading">
      <div class="lct-container">
        <div class="about-final-cta__panel lct-reveal">
          <p class="eyebrow">Your workbench awaits</p>
          <h2 id="final-cta-heading" class="lct-headline lct-balance">Ready to build your dream keyboard?</h2>
          <RouterLink to="/builder" class="ui-btn primary big">Start building <span aria-hidden="true">→</span></RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
