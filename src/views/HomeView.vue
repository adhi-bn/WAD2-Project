<template>
  <section class="lct-home py-5">
    <div class="lct-container">
      <h1 class="lct-display">Build your keyboard</h1>
      <p class="lct-lead">
        Choose a barebones kit, switches and keycaps. Check compatibility and compare the total
        in SGD with your target budget. Going over your budget shows a warning and will never block your build.
      </p>
      <div class="row gy-4 g-4">
        <div class="col-12 col-sm-6 col-md-4">
          <div class="scard h-100 d-flex flex-column">
            <h3 class="lct-title">Barebones kit</h3>
            <p class="lct-muted flex-fill mb-0">
              The base unit with case and fixed internals bundled and priced as one Part.
            </p>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <div class="scard h-100 d-flex flex-column">
            <h3 class="lct-title">Switches</h3>
            <p class="lct-muted flex-fill mb-0">
              Choose your 5-pin switches — matched under our 5-pin-only switch policy to your barebones kit.
            </p>
          </div>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <div class="scard h-100 d-flex flex-column">
            <h3 class="lct-title">Keycaps</h3>
            <p class="lct-muted flex-fill mb-0">
              Pick your keycap profile and layout — ANSI or ISO, matched to your kit.
            </p>
          </div>
        </div>
      </div>
      <RouterLink to="/builder" class="ui-btn primary mt-4">Start building →</RouterLink>
    </div>
  </section>
</template>
