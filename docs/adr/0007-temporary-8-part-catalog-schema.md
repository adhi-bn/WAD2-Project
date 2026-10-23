---
date: 2026-10-23
adr-number: 0007
status: Superseded by ADR-0008
---

# 0007. Temporary 8-Part Supabase Catalog Schema (Technical Debt)

**Status**: Superseded by [ADR-0008](0008-hybrid-six-group-builder-architecture.md)

> [!NOTE]
> **Superseded by ADR-0008**: The temporary 8-part technical debt framing documented in this ADR has been formally superseded by team consensus codified in [0008. Hybrid 6-Group Keyboard Builder Architecture](0008-hybrid-six-group-builder-architecture.md). Rather than retrofitting the application into a restrictive 3-slot model (`barebones`, `switches`, `keycaps`), the team established a 6-group hybrid builder architecture (Case, Plate, PCB, Switches, Keycaps, and Add-ons) that condenses the 8 physical layers to eliminate desktop horizontal scrolling while bundling secondary accessories (Foam, Stabilizers, Cable) into preselected Add-ons.

## Context

In [CONTEXT.md](../../CONTEXT.md) and [docs/specs/keyboard-builder.md](../specs/keyboard-builder.md), the initial canonical domain model defined a **Build** as consisting of exactly three **Part** slots:
1. `barebones` (the base unit bundling case, plate, PCB, foam, and stabilizers into one Part)
2. `switches`
3. `keycaps`

In PR #24 (`Jian-Hao-Branch`), the imported prototype application (`le-chaton-typers`) persisted parts into Supabase and local catalog files across **8 granular physical categories**:
`('case', 'plate', 'pcb', 'switches', 'keycaps', 'stabs', 'foam', 'cable')`.

Multiple user-facing flows depended directly on this 8-category structure:
- [src/views/PartsView.vue](../../src/views/PartsView.vue) presented 8 interactive tabs for picking individual layers.
- [src/views/QuizView.vue](../../src/views/QuizView.vue) and [src/logic/builder.js](../../src/logic/builder.js) calculated individual case, plate, and PCB recommendations.
- [src/views/SummaryView.vue](../../src/views/SummaryView.vue) and [src/views/CartView.vue](../../src/views/CartView.vue) rendered line-item pricing across all 8 components.
- [supabase/schema.sql](../../supabase/schema.sql), `supabase/data.js`, and `supabase/functions/advisor/` enforced category constraints across all 8 types.

Refactoring the database schema, recommendation logic, parts views, and edge functions to the 3-slot model immediately would have blocked merging PR #24, destabilized active user flows, and delayed shipping.

## Decision

We initially accepted keeping the **8-part catalog schema temporarily** in Supabase and the catalog data layer for the release milestone, formally designating it as **architectural technical debt**.

1. **Interim Persistence**: Supabase table `parts` continued to use `check (category in ('case','plate','pcb','switches','keycaps','stabs','foam','cable'))` to keep the Parts picker, Cart, Quiz, and checkout flows functional.
2. **Builder Domain Invariant**: The initial keyboard builder domain engine ([src/domain/build.js](../../src/domain/build.js)) and store ([src/stores/build.js](../../src/stores/build.js)) were held at 3 slots pending resolution.
3. **UI Bridge**: In summary and review views, the 5 foundational physical layers (`case`, `plate`, `pcb`, `foam`, `stabs`) were visually bracketed under a **"Barebones kit & internals"** section.

*(Note: This transitional policy is fully superseded by [ADR-0008](0008-hybrid-six-group-builder-architecture.md), which establishes the 6 Component Groups architecture).*

## Alternatives Considered

- **Immediate Refactor to 3 Parts**: Rewrite `PartsView.vue`, `QuizView.vue`, `SummaryView.vue`, `builder.js`, `schema.sql`, and `supabase/data.js` prior to merging PR #24.
  - *Rejected*: Incurs massive development effort, delays release, and risks regressing the checkout and quiz flows.
- **Permanent Adoption of 8-Part Model in Domain**: Modify `src/domain/build.js` and `CONTEXT.md` to permanently endorse 8 independent slots.
  - *Rejected*: Creates severe UI overflow (horizontal scrolling on standard laptops) and 3D asset bloat; superseded by the 6-group model in ADR-0008.

## Consequences

- **Positive**: PR #24 was stabilized, tested, and merged without rewriting the interactive catalog, quiz recommendations, or Supabase backend.
- **Negative / Trade-offs (Technical Debt)**:
  - Divergence remained between the pure domain engine and the catalog data layer.
  - Two parallel state representations existed until the ADR-0008 resolution.
- **Superseded by ADR-0008**:
  The refactoring roadmap is fulfilled by [ADR-0008](0008-hybrid-six-group-builder-architecture.md), replacing this temporary debt status with the formal 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, Add-ons) architecture and 3-layer 3D visual preview boundary.
