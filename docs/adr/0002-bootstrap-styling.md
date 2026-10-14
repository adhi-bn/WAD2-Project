# 0002. Styling target: Bootstrap plus custom CSS

**Status**: Accepted direction; migration pending.

## Context

ADR-0001 seeded the frontend with Tailwind CSS. The team is more familiar with
Bootstrap, the product carries a custom brand identity (see root `DESIGN.md`),
and the app must not ship two competing style systems. Changing styling must not
change the framework, routing, backend seam, or test stack.

## Decision

Migrate the frontend to Bootstrap plus custom CSS as the styling target. The
final state uses one styling system — Bootstrap and Tailwind do not ship
together. Vue 3, plain JavaScript, Vite, Vue Router, the Supabase seam, and the
Vitest/Playwright stack are unchanged. The root `DESIGN.md` remains the visual
authority; design tooling such as Impeccable is optional and independent of the
app's development, build, tests, and CI. The migration is pending: the current
scaffold still uses Tailwind.

## Why

Bootstrap is already known to every teammate, which lowers the cost of building
consistent, responsive components, while custom CSS carries the brand without
fighting a utility framework. Confining the change to styling keeps ADR-0001's
framework, backend, test, and deployment choices intact, and avoids a dual
framework in the final state.
