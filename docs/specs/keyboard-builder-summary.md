# Keyboard Builder — Team Product Spec (Summary)

> One-page overview only. Canonical detail: [keyboard-builder.md](keyboard-builder.md) (44 stories, full decisions, matrices). Visual authority: [DESIGN.md](../../DESIGN.md). Decisions: [docs/adr/](../adr/).
> **Status**: shared, owner-confirmed planning spec; implementation and team review pending. Branch `feat/prototype-integration`. Branding provisional.

## What it is
A guest-first builder for custom mechanical keyboards. Users assemble a **Build** from three Parts — a **barebones kit**, **switches**, and **keycaps** — and see **Compatibility** and **Budget** feedback as they choose. An optional swipe quiz (layout/size, weight, frame material, switch feel, keycap style, budget) suggests a starting Build; direct entry starts from an editable compatible starter Build, never from fabricated answers. An educational schematic 3D preview and a clearly-labelled audio demo enrich the Build without gating it.

## Key documents
- Canonical spec: [keyboard-builder.md](keyboard-builder.md) — all 44 stories, decisions, requirements matrix, tests, and delivery gates.
- Vocabulary and domain terms: [CONTEXT.md](../../CONTEXT.md).
- Visual authority: [DESIGN.md](../../DESIGN.md) (brand colours, typography, components).
- Decisions: [docs/adr/](../adr/) — [ADR-0001](../adr/0001-frontend-foundation-stack.md) (frontend stack) and [ADR-0002](../adr/0002-bootstrap-styling.md) (Bootstrap styling target).

## Success criteria
- A Guest reaches a compatible, correctly priced Build through the quiz or direct entry, signed out, without a fabricated starting state.
- The quiz suggests within budget where possible, names trade-offs, or states over-budget honestly.
- An account holder signs in with Google, manages only their own Saved builds (including drafts), and spins the draw exactly once, server-recorded.
- 3D and audio enrich without gating; responsive and accessible on mobile and desktop.
- Publicly deployed on Vercel, with unit/integration/E2E evidence plus separate real-Supabase and approved real external-integration evidence.

## Current vs planned
- **Implemented (current source)**: branded shell; three-slot Build state; **Compatibility** with independent incomplete/incompatible flags and the 5-pin-only policy; **Budget** with integer-cent arithmetic and invalid-input errors; null-safe Supabase and native-fetch seams; existing unit/integration suites, 1 E2E routing smoke, and a passing build.
- **Planned (confirmed scope, not built)**: demo catalogue, Part pickers, quiz, Saved build library, Google OAuth, server Lucky draw, 3D preview, audio, the Bootstrap + custom CSS migration (ADR-0002; scaffold still Tailwind), and public Vercel deploy.

## Headline choices
- **Three Parts only**; the barebones kit bundles its case and fixed internals at one combined price and is labelled a complete demo bundle. No individually selected PCB/plate/stabilisers/foam/cable, and demo catalogue/reference prices are clearly labelled.
- **No retailer comparison or outbound store links.**
- **5-pin switches only for now**, applied to switch options regardless of socket. This is a project restriction, not a physical universal: a hot-swap PCB can accept 3-pin or 5-pin switches depending on the board (see [Sources](keyboard-builder.md#sources)). Future 3-pin expansion is possible but not committed, and no new pin solver is added.
- **Money**: SGD, cent-precise; the gross Budget compares the original full-Parts subtotal to the target; discounts/Voucher are a separate net preview that never changes the gross; positive half-cent ties round up (10% of SGD 10.05 → SGD 1.01); a discount cannot exceed the subtotal (so net stays at or above zero) and discounts never stack.
- **Edits never silently repair** an incompatible choice; incomplete and incompatible show separately, and an over-budget selection is allowed with a warning plus cheaper alternatives.
- **Guests** use quiz, builder, compatibility, budget, 3D, and audio; **Google sign-in** unlocks a private named Saved build library and the account-level draw. Ownership is server-enforced; incomplete drafts are allowed with warnings, and saving is not purchase-readiness.
- **Lucky draw**: one server-recorded spin per account across devices and sessions; the client cannot self-award; the result survives Voucher expiry. Prize defaults: 15% off at 5%, 10% off at 20%, SGD 5 off at 35%, no prize at 40%, no stacking, 15-minute Voucher lifetime.
- **Payment**: sandbox HitPay is a retained planned proposal requirement. Buying purpose, order flow, and Voucher redemption are **deferred**; no real-money handling, and a proposal mention or fake paid UI is not completion.
- **Audio**: a labelled placeholder is acceptable only during initial integration; the final feature requires permitted or self-owned recorded switch/typing clips via Web Audio. No synthesised-final-profile commitment.
- **Accessibility and responsiveness** are requirements: keyboard and touch operability, visible focus, focus-managed modals, colour-independent cues, reduced motion, and no page overflow at common widths.

## Workflow
Scaffolded foundation → this shared, owner-confirmed spec → approved GitHub issues tracked separately → team review and implementation → selective prototype integration.

## Open / deferred decisions
- Buying purpose and order flow, plus the sandbox HitPay integration/order-flow contract (including Voucher redemption).
- AI helper choice (rules-based versus external model) — undecided; canned chat stays demo/placeholder.
- Permitted sound assets and coverage for final audio.
- Visual identity finalisation (branding stays provisional until confirmed).
- The qualifying real external async-HTTP integration for course evidence.

## Out of scope
Real-money processing and live orders; retailer comparisons/links; individually selectable internals; public/social sharing; admin surfaces; new frameworks or a state-library mandate; real prize/financial claims; photorealistic, acoustic, or engineering-accuracy claims.

For acceptance criteria, the requirements matrix, testing decisions, delivery gates, and all 44 user stories, read the canonical [keyboard-builder.md](keyboard-builder.md).
