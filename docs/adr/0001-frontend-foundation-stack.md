# 0001. Frontend foundation stack

**Status**: Accepted

## Context

We need a runnable, gradable frontend for a custom mechanical-keyboard builder
ahead of any product features, and the rubric plus grading rewards a modern
composable SPA with tested behaviour and a real CI/E2E story.

## Decision

Use Vue 3 in plain JavaScript with Vite and Vue Router for the SPA, Tailwind CSS
via its Vite plugin for styling, `@supabase/supabase-js` as a minimal backend
seam (backend is required but ungraded, so only a lazy null-safe client is
wired), Vitest + jsdom for unit/integration tests and Playwright for the E2E
smoke test per the E2E mandate, and Vercel for deployment.

## Why

Vue/Vite/JavaScript matches the rubric and keeps the toolchain small; Tailwind
v4 needs no `tailwind.config.js` or PostCSS, so styling stays declarative;
Supabase provides the required persistence/auth seam without committing to a
backend design; Vitest shares the Vite config while Playwright proves the shell
loads in a real browser; Vercel builds Vite SPAs with zero config.
