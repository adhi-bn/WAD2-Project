<script setup>
const features = [
  {
    number: '01',
    title: '360° Keyboard Visualisation',
    description: 'Preview custom keyboard configurations in an interactive 3D model before you commit to a Build.',
    icon: '◌',
  },
  {
    number: '02',
    title: 'Switch Sound Preview',
    description: 'Listen to switch sound samples before choosing the feel and sound that suits your desk.',
    icon: '♪',
  },
  {
    number: '03',
    title: 'Compatibility Checking',
    description: 'Spot incompatible Parts early and get guided toward suitable alternatives for your Build.',
    icon: '✓',
  },
  {
    number: '04',
    title: 'Transparent Pricing',
    description: 'Compare Part prices and keep an eye on your estimated total as you build.',
    icon: 'S$',
  },
]
</script>

<template>
  <div class="row g-3 g-lg-4">
    <div v-for="feature in features" :key="feature.title" class="col-12 col-sm-6">
      <article class="about-feature h-100 lct-reveal">
        <div class="about-feature__top">
          <span class="lct-label">{{ feature.number }}</span>
          <span class="about-feature__icon" aria-hidden="true">{{ feature.icon }}</span>
        </div>
        <h3 class="lct-title">{{ feature.title }}</h3>
        <p>{{ feature.description }}</p>
      </article>
    </div>
  </div>
</template>
