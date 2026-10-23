---
date: 2026-10-23
adr-number: 0007
status: Accepted
---

# 0007. Temporary 8-Part Supabase Catalog Schema (Technical Debt)

**Status**: Accepted (Technical Debt)

## Context

In [CONTEXT.md](../../CONTEXT.md) and [docs/specs/keyboard-builder.md](../specs/keyboard-builder.md), the canonical domain model defines a **Build** as consisting of exactly three **Part** slots:
1. `barebones` (the base unit bundling case, plate, PCB, foam, and stabilizers into one Part)
2. `switches`
3. `keycaps`

In PR #24 (`Jian-Hao-Branch`), the imported prototype application (`le-chaton-typers`) persists parts into Supabase and local catalog files across **8 granular physical categories**:
`('case', 'plate', 'pcb', 'switches', 'keycaps', 'stabs', 'foam', 'cable')`.

Multiple user-facing flows currently depend directly on this 8-category structure:
- [src/views/PartsView.vue](../../src/views/PartsView.vue) presents 8 interactive tabs for picking individual layers.
- [src/views/QuizView.vue](../../src/views/QuizView.vue) and [src/logic/builder.js](../../src/logic/builder.js) calculate individual case, plate, and PCB recommendations.
- [src/views/SummaryView.vue](../../src/views/SummaryView.vue) and [src/views/CartView.vue](../../src/views/CartView.vue) render line-item pricing across all 8 components.
- [supabase/schema.sql](../../supabase/schema.sql), `supabase/data.js`, and `supabase/functions/advisor/` enforce category constraints across all 8 types.

Refactoring the database schema, recommendation logic, parts views, and edge functions to the 3-slot model immediately would block merging PR #24, destabilize active user flows, and delay shipping.

## Decision

We accept keeping the **8-part catalog schema temporarily** in Supabase and the catalog data layer for the current release milestone, but formally designate it as **architectural technical debt**.

1. **Interim Persistence**: Supabase table `parts` will continue to use `check (category in ('case','plate','pcb','switches','keycaps','stabs','foam','cable'))` to keep the Parts picker, Cart, Quiz, and checkout flows functional.
2. **Builder Domain Invariant**: The keyboard builder domain engine ([src/domain/build.js](../../src/domain/build.js)) and store ([src/stores/build.js](../../src/stores/build.js)) will **not** expand to support 8 parts. The canonical target architecture remains the 3-part slot model (`barebones`, `switches`, `keycaps`).
3. **UI Bridge**: In summary and review views, the 5 foundational physical layers (`case`, `plate`, `pcb`, `foam`, `stabs`) may be visually bracketed under a **"Barebones kit & internals"** section to preserve domain alignment in user communication.

## Alternatives Considered

- **Immediate Refactor to 3 Parts**: Rewrite `PartsView.vue`, `QuizView.vue`, `SummaryView.vue`, `builder.js`, `schema.sql`, and `supabase/data.js` prior to merging PR #24.
  - *Rejected*: Incurs massive development effort, delays release, and risks regressing the checkout and quiz flows.
- **Permanent Adoption of 8-Part Model in Domain**: Modify `src/domain/build.js` and `CONTEXT.md` to permanently endorse 8 independent slots.
  - *Rejected*: Violates core product strategy where beginners are guided through a simple 3-step decision flow (Barebones kit + Switches + Keycaps) rather than overwhelmed by soldering, plate mounting, and stabilizer tuning.

## Consequences

- **Positive**: PR #24 can be stabilized, tested, and merged without rewriting the interactive catalog, quiz recommendations, or Supabase backend.
- **Negative / Trade-offs (Technical Debt)**:
  - Divergence remains between the pure domain engine (`src/domain/build.js` using 3 slots) and the catalog data layer (`src/data/catalog.js` using 8 categories).
  - Two parallel state representations exist until the refactoring phase.
- **Migration & Refactoring Roadmap**:
  A dedicated refactoring milestone will consolidate the 8 categories into 3 slots by:
  1. Creating a composite `barebones_kits` view or bundling migration in Supabase.
  2. Refactoring `PartsView.vue` to group internal layers into customizable barebones bundles.
  3. Deprecating standalone `plate`, `pcb`, `foam`, and `stabs` foreign keys in `saved_builds` and `orders`.
