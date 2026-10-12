# Lechaton Typers

Custom mechanical-keyboard builder: users assemble a keyboard from compatible
parts within a budget. This repo currently holds the runnable frontend
foundation — app shell, domain seed, and test/CI setup. Product features
(part pickers, persistence, auth) come later; integration points are stubbed.

See `CONTEXT.md` for the domain vocabulary (Build, Part, Barebones kit,
Compatibility, Budget) and `docs/adr/` for decisions.

## Stack

- Vue 3 (plain JavaScript, no TypeScript) + Vue Router 5
- Vite 8 + `@vitejs/plugin-vue`
- Tailwind CSS 4 via `@tailwindcss/vite` (no `tailwind.config.js`, no PostCSS;
  `src/style.css` is just `@import "tailwindcss";`)
- Supabase JS client as a null-safe seam (backend not built yet)
- Vitest 5 + jsdom for unit/integration, Playwright for E2E
- Node 22, npm

## Commands

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the production build
npm test           # Vitest unit + integration (tests/unit, tests/integration)
npm run test:e2e   # Playwright chromium smoke test (boots dev server)
```

Run one Playwright browser on first use:

```bash
npx playwright install chromium
```

## Environment variables

Copy `.env.example` to `.env` and fill in as needed. Both are optional in dev;
without them the Supabase client stays `null`.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

## CI

`.github/workflows/ci.yml` runs on push to `main` and on pull requests:
Node 22 → `npm ci` → Vitest → Playwright (chromium) → build, then uploads the
Playwright HTML report as an artifact.

## Deploy (Vercel)

Import the repo; Vercel detects Vite. Build command `npm run build`, output
directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
project environment variables. The SPA uses history routing, so keep the
default rewrite of unknown paths to `index.html` (Vercel does this for Vite
projects out of the box).
