# Le Chaton Typers (aka Fat Cat Typers)

A custom mechanical keyboard builder: swipe through six cards, get a recommended build,
swap parts with live price changes, save builds to an account, and check out. Includes a 3D
keyboard that explodes as you scroll (Three.js) and Biscuit the fat cat with a Spin-to-Win lucky draw.

Built with **Vue 3 + Vite**, **Vue Router**, **Bootstrap 5**, vanilla CSS, **Three.js**,
and **Supabase** (catalogue, accounts, saved builds, orders) with **HitPay** for payments.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install                  # once, downloads the packages
cp .env.example .env         # then fill in your Supabase URL and anon key
npm run dev                  # starts the dev server
```

Open the address it prints (usually http://localhost:5173). Edits to files in `src/` reload instantly.

`npm run build` makes a production copy in `dist/`; `npm run preview` serves that copy.

Without a `.env` file the site still runs. The catalogue comes from the code, and sign-in and
checkout show a "not set up yet" message.

## Supabase setup (once per project)

1. In the Supabase SQL editor, run `supabase/schema.sql`.
2. Import the catalogue and prebuilt keyboards. From a Node script or the Supabase client, call
   `importAll(supabase)` from `supabase/data.js`. Use the **service role** key here, never in the site.
3. Deploy the server functions in `supabase/functions/`:
   ```bash
   supabase functions deploy checkout order-status advisor
   supabase functions deploy hitpay-webhook --no-verify-jwt
   ```
4. Set the secrets for the functions. Copy `supabase/.env.example` to `supabase/.env`, fill it in, then:
   ```bash
   supabase secrets set --env-file ./supabase/.env
   ```
   Keys live in two places, and neither file is committed:
   - `.env` (website, public keys only): Supabase URL and anon key.
   - `supabase/.env` (server, secret keys): HitPay key and salt, service role key, OpenAI key.
   Never add a secret to `.env`. Anything starting with `VITE_` is sent to every visitor's browser.
5. In the HitPay dashboard, add the `hitpay-webhook` URL under Developers > Webhook Endpoints.

Use the HitPay sandbox until the payment flow has been tested end to end.

## Where things are

```
src/
  main.js                 starts Vue, loads Bootstrap + our CSS
  App.vue                 event banner, top nav, page outlet, footer, Biscuit, toast
  router.js               pages: / , /know, /swipe, /parts, /build, /cart, /checkout, /order/:id, /account
  store.js                shared state: answers, build, cart, user, saved builds, lucky-draw voucher
  lib/supabase.js         Supabase client (reads VITE_SUPABASE_* from .env)
  assets/main.css         our own styles (theme colours as CSS variables)
  data/catalog.js         parts, prices, swipe questions  <- edit products here (sample prices)
  data/fatcat.js          Biscuit's SVG, lucky-draw prizes and odds
  logic/builder.js        compatibility rules + recommendation engine (plain JS, no Vue)
  components/
    Keyboard3D.vue        Three.js keyboard: mode "home" (background), "know" (teardown), "off"
    FatCat.vue            mascot, chat box, spin wheel, confetti
    ProfileChips.vue      the answer chips shown on Parts and Build
  views/
    HomeView.vue          hero + swipe-card preview, keyboard explodes behind as you scroll
    KnowView.vue          "Know your keyboard" layer-by-layer teardown
    QuizView.vue          Tinder-style swipe questionnaire
    PartsView.vue         part-by-part picker with price differences and running total
    SummaryView.vue       full build, ratings, compatibility check, save build, add to cart
    CartView.vue          cart: one or more builds, edit or remove, totals
    CheckoutView.vue      customer details, then HitPay payment
    ConfirmView.vue       order status after payment
    AccountView.vue       sign up / sign in, saved builds
supabase/
  schema.sql              tables and row level security (run once)
  data.js                 parts and prebuilt keyboards, with importAll() for Supabase
  functions/
    checkout/             prices the cart on the server, creates the order and HitPay request
    hitpay-webhook/       marks an order paid after HitPay's signature check
    order-status/         returns one order's status to the confirmation page
    _shared/catalog.js    a copy of src/data/catalog.js used by the functions (keep in sync)
```

## Good to know

- **Prices are sample data** until the team loads real ones into `supabase/data.js` and re-imports.
  The site price always comes from the server at checkout, never from the browser.
- **Keep the two catalogue copies in sync.** `src/data/catalog.js` and
  `supabase/functions/_shared/catalog.js` must match. Copy the file again after any change.
- **Lucky draw:** the wheel result is saved in the browser only. Its voucher codes are not yet
  created on the server, so they won't be accepted at checkout until that is done.
- **Demo shortcuts to remove before launch:** in Biscuit's chat, `/win10` (or `/win15`, `/win5`,
  `/lose`) fixes the next spin. Remove these commands before going live.
- **Placeholders:** the store address and opening hours in `FatCat.vue` are still `[store address]` and `[opening hours]`.
- **3D model:** the keyboard is built from simple shapes in `Keyboard3D.vue`. To use Blender models later,
  export `.glb` files and load them with Three.js's `GLTFLoader` in the same component.
- **Class names:** our CSS avoids Bootstrap's names (`.ui-btn` instead of `.btn`, `.scard` instead of `.card`,
  `.ld-modal` instead of `.modal`). Bootstrap's grid (`row`, `col-*`) is used on Home and Parts.
