## Where things are documented

Read these instead of re-deriving; do not duplicate their content here:

- `CONTEXT.md` — Domain glossary, canonical terms (Build, Part, Barebones kit, Compatibility, Budget), and banned synonyms.
- `DESIGN.md` — Visual identity, theme color tokens, typography scales, spacing, and component visual specs.
- `CHANGELOG.md` — Release notes and `[Unreleased]` changes following Keep a Changelog.
- `docs/specs/keyboard-builder.md` — Canonical product requirements for the keyboard builder.
- `docs/ARCHITECTURE.md` — System architecture, tech stack, directory layout, reactive data flow, and backend seams.
- `docs/ADDING-A-FEATURE.md` — 6-step recipe for implementing new domain and UI features.
- `docs/CONTRIBUTING.md` — Branch naming, Conventional Commits, changelog workflow, and pre-PR verification steps.
- `docs/adr/` — Architecture Decision Records capturing technical choices and rationale.
- `README.md` — Quick start, commands, environment variables, CI pipeline, and Vercel deployment.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (adhi-bn/WAD2-Project). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage labels used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (root `CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Running a single test

Single unit or integration test file:
```sh
npx vitest run tests/unit/build.test.js
```

Single test case by name:
```sh
npx vitest run tests/unit/build.test.js -t "sums prices and reports within budget"
```

Single Playwright E2E test by name:
```sh
npx playwright test tests/e2e/smoke.spec.js -g "shell loads and nav renders"
```

## Test layout & environment gotchas

- `tests/unit/`: Pure domain logic tests (`src/domain/`) with zero DOM dependencies.
- `tests/integration/`: Vue component, router, store, and seam tests (`@vue/test-utils` + `jsdom`).
- `tests/e2e/`: Playwright Chromium browser tests executing against the local Vite dev server.
- Null-safe seam invariant: All tests must pass with zero `.env` credentials (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset; `getSupabase()` and `createSupabaseClient(url, key)` return `null`).

## Codebase boundaries & conventions

- Plain JavaScript (ESM) only across the entire codebase — no TypeScript (`.ts`/`.tsx`).
- Styling uses Bootstrap 5.3.3 + custom CSS namespace in `src/style.css` governed by `DESIGN.md` (ADR-0002; no Tailwind classes).
- Domain vocabulary in code, tests, issues, and PRs follows `CONTEXT.md`. Parts expose `part.price` in major currency units (converted internally to integer cents via `toCents(part?.price)` inside `src/domain/build.js` to avoid floating-point drift), and the reactive build store (`src/stores/build.js`) tracks the budget cap as `build.limit`.
- Pure domain rules live in `src/domain/`; reactive state in `src/stores/`; external I/O seams in `src/lib/`.
- Record user-visible features, fixes, or architectural changes under `## [Unreleased]` in `CHANGELOG.md`.

## Adding an environment variable

Vite client variables use the `VITE_` prefix and require a 3-place sync in the same change:
1. `.env.example` — Add the variable key and placeholder value.
2. Consuming seam module in `src/lib/` — Read via `import.meta.env.VITE_*` while maintaining fallback and null-safety when unset.
3. `README.md` — Document variable name and purpose in the Environment Variables table.
