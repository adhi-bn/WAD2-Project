# Lechaton Typers

Custom mechanical-keyboard builder: users assemble a keyboard from compatible
parts against a target budget. This repo currently holds the runnable frontend
foundation — app shell, domain seed, and test/CI setup. Product features
(part pickers, persistence, auth) come later; integration points are stubbed.

## Documentation

- [`CONTEXT.md`](CONTEXT.md) — Domain vocabulary (Build, Part, Barebones kit, Compatibility, Budget) and banned synonyms.
- [`DESIGN.md`](DESIGN.md) — Visual identity, color tokens, typography, and component specifications.
- [`CHANGELOG.md`](CHANGELOG.md) — Release notes and `[Unreleased]` history following Keep a Changelog.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Architecture overview, tech stack, directory structure, data flow, and seams.
- [`docs/ADDING-A-FEATURE.md`](docs/ADDING-A-FEATURE.md) — 6-step recipe for introducing new features across domain, store, UI, and tests.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — Branch naming, Conventional Commits, changelog workflow, and pre-PR verification.
- [`docs/specs/keyboard-builder.md`](docs/specs/keyboard-builder.md) — Canonical product specification for the keyboard builder.
- [`docs/adr/`](docs/adr/) — Architecture Decision Records capturing stack and design choices.

## Stack

- Vue 3 (plain JavaScript, no TypeScript) + Vue Router 5
- Vite 8 + `@vitejs/plugin-vue`
- Bootstrap 5.3.3 + custom CSS (`src/style.css`, governed by `DESIGN.md` and `docs/adr/0002-bootstrap-styling.md`) as the active styling system (superseding ADR-0001's initial Tailwind seed)
- Supabase JS client as a null-safe seam (backend not built yet)
- Vitest 5 + jsdom for unit/integration, Playwright for E2E
- Node 22 (>= 22.12) + npm, Git

## Requirements

- Install Node 22 (>= 22.12) with npm and Git **natively**: PowerShell on Windows,
  Terminal on macOS. WSL is not required.
- Each teammate installs dependencies locally in the repo root with `npm ci`.
  Never share or copy `node_modules` between machines or operating systems —
  native bindings differ per OS.
- No editor extension or optional preview tooling (such as Impeccable) is
  required; such tooling stays local and is not part of the shared repo.

## Quick start

The shared work is on `feat/prototype-integration`; `main` has not received the
scaffold yet. These commands work in Windows PowerShell and macOS Terminal:

```sh
git clone --branch feat/prototype-integration https://github.com/adhi-bn/WAD2-Project.git
cd WAD2-Project
npm ci
npm run dev
```

## Commands

```bash
npm ci             # locked install from package-lock.json
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the production build
npm test           # Vitest unit + integration (tests/unit, tests/integration)
npm run test:e2e   # Playwright chromium smoke test (boots dev server)
```

If Windows PowerShell blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` with the same
arguments instead; no execution-policy change is required.

Install the Playwright browser on first use:

```bash
npx playwright install chromium
```

## Environment variables

Copy `.env.example` to `.env` and fill in as needed; both values are optional in
dev and the Supabase client stays `null` without them.

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS Terminal
cp .env.example .env
```

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
project environment variables. The SPA uses history routing, so configure and
verify a SPA history fallback that rewrites unknown paths to `index.html`, and
test a direct reload of `/builder` after deploying — do not assume the platform
already rewrites unknown routes.
