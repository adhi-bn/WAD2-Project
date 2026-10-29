# Lechaton Typers — Keyboard Builder: Team Product Spec

**Document status**: Shared, owner-confirmed planning spec; implementation pending. **Not integrated** into the app; no prototype source import has happened. The approved backlog is tracked as GitHub issues in this repository, separate from this document.
**Branch**: `feat/prototype-integration`
**Visual identity**: Provisional. Current prototype cat branding, fonts, and colours are kept and refined, not redesigned; the user may change style later.
**Baseline**: Checked against current source and the seed rule/store/view checks; those checks cover the current seed behaviour only. This document claims no new full-product or live-service validation. Throughout, **Implemented (baseline)** means present in current source, and **Planned** means confirmed scope but not built.

### Vocabulary (from `CONTEXT.md`)
Terms follow **`CONTEXT.md`** — **Build**, **Part**, **Barebones kit**, **Component Groups**, **Add-ons**, **Compatibility**, **Incompatibility Badge / Banner**, **3D Build Preview Boundary**, **Budget**, **Saved build**, **Lucky draw**, **Voucher**. Use those terms as defined there rather than synonyms the glossary avoids (referencing [docs/adr/0008-hybrid-six-group-builder-architecture.md](../adr/0008-hybrid-six-group-builder-architecture.md)).

---

## Problem Statement

A learner who wants a custom mechanical keyboard cannot easily tell which Parts fit together, what a complete Build actually costs, or how to stay near a target spend. Retail part lists are long, internal components (such as plates, PCBs, foams, and stabilizers) are hard to reason about, and price maths is easy to get wrong. Furthermore, builders with too many granular tabs cause horizontal scrolling and cognitive overload on standard desktop viewports, while over-simplified 3-slot models strip away meaningful customization for core components like cases, plates, and PCBs. The current app is a runnable frontend foundation that needs a balanced, tested product definition: a 6-group hybrid builder that keeps navigation compact, guides users on compatibility, bounds 3D visual complexity, and prices a real Build cleanly.

The team needs one grounded, testable product definition before more code is written, so that later integration work targets approved behaviour rather than prototype drift.

## Solution

Ship a guided, guest-first keyboard builder structured around **6 Component Groups** — **Case**, **Plate**, **PCB**, **Switches**, **Keycaps**, and **Add-ons** (bundling Foam, Stabilizers, and Cable) — governed by [docs/adr/0008-hybrid-six-group-builder-architecture.md](../adr/0008-hybrid-six-group-builder-architecture.md). Guests can take an optional preference quiz or start from an editable compatible starter Build with preselected Add-ons, choose Parts, see real-time Compatibility and Budget feedback, and explore an interactive 3D preview bounded to 3 active exterior layers (Keycaps, Switches, Base/Case) alongside high-fidelity 2D imagery for internal parts. Hardware compatibility (layout size: 60%, 75%, 100%, and socket type: hot-swap) is validated against schema flags; incompatible components display a red badge on their option card and a top warning banner, blocking progression and checkout until resolved. A floating navigation shortcut button with a hover tooltip allows fast jumping between component groups. Google sign-in unlocks a personal named **Saved build** library and the account-level **Lucky draw**. Prices are SGD with cent precision, and the Budget compares the original full-Parts subtotal to the user's target so previewed discounts never hide true spend.

The approach balances customization and simplicity: 6 Component Groups prevent desktop horizontal scrolling while giving users creative control over core components, labelled demo bundles and demo pricing, no buying flow yet, and no retailer comparison. The delivery sequence is: scaffolded team foundation → this shared, owner-confirmed spec → approved GitHub issues tracked separately → team review and implementation → selective prototype integration. Everything in this document is planning, not implementation.

### Current baseline (Implemented)

- Reactive Build state with exactly the three slots plus an optional Budget limit, with Compatibility and Budget derived from pure domain rules. No quiz, draw, or Voucher logic in the main Build state.
- **Compatibility** returns a fit flag with human-readable reasons plus independent `incomplete` and `incompatible` booleans, so known clashes surface on a partial Build and the current 5-pin-only project policy is reported regardless of socket. Missing slots read as incomplete, never as a false "compatible".
- **Budget** returns a total with a within-budget flag and an `error` string (null when valid); invalid, missing, or non-numeric amounts yield a null total with an error rather than being coerced to zero, and valid amounts compare in integer cents. A missing limit means "no target chosen yet".
- The builder view renders both partial flags, their reasons, and the budget error or no-target state; the home view states the three Parts and that going over Budget warns rather than blocks.
- A lazy, null-safe Supabase client seam and a native-fetch JSON seam. Auth, cloud persistence, server draw, and 3D are **not** implemented. Recorded switch audio is implemented as described in the Audio module.
- Rule, store, and view checks cover the current seed behaviour, and an isolated byte-parity snapshot validates the current seed rule/store/view behaviour plus one Chromium routing smoke and the production build only — not full-product, backend, or live-service proof. Counts are not restated here.

### Planned (approved)

- Vue 3 / Vite / plain JS / npm retained; **Bootstrap plus custom CSS as the migration target** (see ADR-0002) for the team's familiarity. The current scaffold still uses Tailwind; the migration is **not** completed. Reuse the existing router, Supabase seams, and Vitest + Vue Test Utils + Playwright/CI. Do not replace the package with the old prototype Vite 5 / Router 4 stack.
- Public frontend deployment on Vercel; Supabase as backend data store; Google OAuth.
- Sandbox HitPay is **retained as a proposal payment requirement only**. The buying flow is deferred and no real payment is processed.

### What success looks like

- A Guest can move from the landing surface to a compatible, correctly priced Build — through the quiz or direct entry — with Compatibility and Budget feedback, without signing in and without a fabricated starting state.
- The quiz gives an honest suggestion: compatible and within budget where possible, with trade-offs named, or an explicit over-budget explanation rather than a false claim.
- An Account holder can sign in with Google, save, resume, and delete only their own Saved builds — including unfinished drafts — and can spin the Lucky draw exactly once, with the result recorded and enforced server-side.
- The 3D and audio surfaces enrich the Build without gating it; every non-visual and non-audio path remains complete.
- The app is usable on common mobile and desktop widths, operable by touch and keyboard, and comfortable under reduced motion.
- The frontend is publicly deployed on Vercel, and the evidence set includes unit, integration, and E2E checks plus separate real-Supabase and real external-API evidence.

## User Stories

Guest and general-user stories work without sign-in. Account-holder stories require Google sign-in; the team-member story concerns delivery evidence.

1. As a Guest, I want a branded home surface that explains the builder and may show a keyboard's full internals, so I understand what this is and what is inside before choosing anything.
2. As a Guest, I want to start from a compatible starter Build loaded into an editable builder with its visible defaults, so I see a working example and can change it.
3. As a Guest, I want direct entry to begin with that visible starter Build rather than fabricated personal quiz answers and to let me skip the quiz, so the builder reflects my real starting point and I can take control immediately.
4. As a Guest, I want an optional swipe quiz covering layout/size, weight, frame material, switch feel, keycap style, and budget, so I can get a suggestion without an account.
5. As a Guest, I want my quiz answers treated as preferences, not selectable components, so the suggestion does not pretend I chose specific Parts.
6. As a Guest, I want the quiz to output one or more compatible suggested Builds within budget where possible, so I get a usable starting point.
7. As a Guest, I want the quiz to explain trade-offs, or state honestly when the budget cannot be met, so I am not misled into thinking constraints were satisfied.
8. As a Guest, I want to choose components across 6 Component Groups — Case, Plate, PCB, Switches, Keycaps, and Add-ons — so I have full creative control over my keyboard's foundation and appearance without horizontal navigation overflow on desktop.
9. As a Guest, I want secondary accessory components (Foam, Stabilizers, Cable) bundled into a single Add-ons category and preselected by default from the starter build or quiz, so I can assemble a complete keyboard quickly while still having the freedom to customize accessories.
10. As a Guest, I want to quickly jump between the 6 component groups using a floating navigation shortcut button with a hover tooltip menu, so I can freely navigate any part of my Build without tedious sequential paging.
11. As a Guest, I want switch prices to cover enough of the purchased set or pack to meet my selected kit's required switch quantity, so a single switch is never counted as a full keyboard.
12. As a Guest, I want demo catalogue and reference pricing clearly labelled as demo prices, so I do not read them as a live shop.
13. As a Guest, I want keycap options described by arrangement, key sizes, and stem coverage, so I can judge whether they fit my Build.
14. As a Guest, I want my Budget to compare the original full-Parts subtotal against my target, so a previewed discount never hides the real spend.
15. As a Guest, I want hardware compatibility (layout size: 60%/75%/100%, socket type: hot-swap) validated against database schema flags, with incompatible components displaying a red badge on their option card and a top warning banner across the builder view that blocks progression and checkout until resolved, while preserving my selections so I can fix conflicts myself.
16. As a Guest, I want "incomplete" (a Part is missing) shown separately from "incompatible" (chosen Parts do not fit), so I know which problem I actually have.
17. As a Guest, I want to keep an incompatible Part while I decide, so the app never silently removes or replaces my choice.
18. As a Guest, I want a plain-language reason for each incompatibility plus valid alternatives, so I can fix it myself.
19. As a Guest, I want to select Parts that exceed my Budget and still keep the Build, so I am not blocked from exploring.
20. As a Guest, I want a clear excess warning with cheaper compatible alternatives when I am over budget, so I can adjust if I choose to.
21. As a user, I want money shown in SGD at cent precision with percentages rounded to the cent and fixed discounts capped so the payable preview cannot go below zero, so the maths is trustworthy.
22. As an account holder, I want to apply or remove my active Voucher as a preview that affects only the discount preview, and to see its expiry and expired states, so my gross Budget comparison is unchanged and I know whether the discount still applies.
23. As a user, I want invalid monetary or budget input at a trust boundary rejected or corrected with feedback, so missing or malformed costs are never silently treated as zero.
24. As a Guest, I want the quiz, builder, Compatibility, Budget, 3D, and audio surfaces to work without signing in, so I can try everything first.
25. As a Guest, I want the app to stay usable as a null-safe demo when the backend is unconfigured, so missing configuration degrades gracefully and cloud actions explain they are unavailable.
26. As an account holder, I want to sign in with Google, so my account-specific saves and draw are tied to my account.
27. As an account holder, I want a personal named Saved build library where I can save, reopen for editing, and delete only my own Saved builds, and where signing out clears my account-owned library, Voucher, and draw so my private data is never carried into another account's session, so my work stays private to me and I can return to it.
28. As an account holder, I want to save incomplete or incompatible drafts with warnings, so saving is never confused with purchase-readiness.
29. As an account holder, I want my selections, preferences, and target Budget retained in a Saved build and revalidated against the current catalogue and current prices when I reopen it — flagging removed, unavailable, or changed entries and offering alternatives without silently replacing my picks — so I can trust what I resume.
30. As an account holder, I want loading, auth, or save failures to preserve my current editable draft and clearly report the failure, so nothing is lost or falsely reported as saved.
31. As an account holder, I want exactly one Lucky draw spin per Google account, recorded server-side, so no retry, second device, or new session grants another prize.
32. As an account holder, I want repeat or concurrent draw requests to return my existing recorded outcome, and a failed request to retry safely — recovering the committed outcome if the server already recorded one, or re-attempting if it did not — so a race cannot award two prizes and a retry never creates a second prize or new spin.
33. As an account holder, I want my draw outcome to survive Voucher expiry, so expiry never restores a spin.
34. As an account holder, I want the draw to follow the current prize defaults — 15% off at 5%, 10% off at 20%, SGD 5 off at 35%, no prize at 40%, no stacking, 15-minute Voucher lifetime — so the demo promotion behaves exactly as designed.
35. As a Guest, I want an educational 3D intro plus an interactive 3D Build preview governed by a 3-layer visual boundary (Keycaps, Switches, and Base/Case) with high-fidelity 2D product imagery for internal components (PCB, Plate, Foam, Stabilizers), so I see exterior aesthetics update smoothly in real time without WebGL performance degradation, mesh clipping, or visual misalignment.
36. As a user, I want the selected-Part data available in the HTML even when the canvas is unavailable, so I am never dependent on WebGL.
37. As a user, I want a clear WebGL failure fallback, preview teardown/resource cleanup, paused work when the preview is hidden, and reduced motion honoured, so the page stays usable, efficient, and comfortable.
38. As a user, I want a user-initiated Web Audio typing/switch demo with mute/volume, selected-profile linkage, and missing-sample or playback-error states, so I can hear my Build; a clearly-labelled placeholder is acceptable only during initial integration, with permitted or self-owned recorded clips as the final requirement.
39. As a user, I want responsive layouts across mobile and desktop widths with no page overflow and usable navigation labels, so I can build on any device.
40. As a user, I want touch- and keyboard-operable controls with visible focus, so I can operate everything without a mouse.
41. As a user, I want modals and drawers to trap and return focus, close on Escape, and make the background inert, so focus stays predictable.
42. As a user, I want semantic names and statuses plus colour-independent Compatibility and Budget cues, so meaning is never carried by colour alone.
43. As a user, I want the mascot, help, chat, prize-wheel, and Voucher surfaces kept and refined, with any canned chat labelled demo/placeholder, so brand continuity holds without fake AI or prize claims.
44. As a team member, I want the spec's requirements traceable to observable acceptance checks, so integration work has a shared definition of done.

> Stories 22, 31-34, and 38 are demo-scope: prize, voucher, and audio claims stay clearly labelled as demonstration behaviour, not real financial or completed-AI claims.

## Implementation Decisions

These describe logical modules, interfaces, data, and security — not chosen file names or schemas. Each item is tagged to distinguish **Implemented**, **Planned**, or **Open**.

### Modules and data flow (Planned unless noted)

- **Catalogue module** (**Planned**): provides the demo catalogue across the 6 Component Groups: Case, Plate, PCB, Switches, Keycaps, and Add-ons, with the metadata the rules need. Not implemented — only rule interfaces, state, and seams are present in current source. No real catalogue vendor data.
- **Part metadata model** (**Planned**): each Case declares its layout size (60%, 75%, 100%) and material; each Plate declares its layout size and material; each PCB declares its layout size and socket type (e.g., hot-swap); each Keycap set declares its arrangement, key sizes, and stem coverage; each Switch declares its pin/stem type and pack size; Add-ons bundle compatible Foam, Stabilizers, and Cable. Required switch quantities match the selected layout size.
- **Compatibility rule module** (**seed Implemented / metadata engine Planned**): validates hardware compatibility based on JSON schema flags:
  1. Layout size matching: Case, Plate, and PCB must share the same form factor (60%, 75%, 100%).
  2. Socket type matching: switch pin compatibility (5-pin hot-swap policy).
  Incompatible components trigger a prominent red badge on their option card and a top warning banner across the builder view, explaining the conflict and blocking progression/checkout until resolved. Missing slots read as incomplete, never as a false "compatible".
- **Budget and pricing module** (**Implemented** for valid cent arithmetic and invalid-input errors; **Planned** for discounts/Voucher preview): computes the original full-Parts subtotal in integer cents and compares it to the target Budget. Base prices and the target are finite, nonnegative numeric amounts with at most two decimals (safe integer cents); a string, missing, or otherwise invalid amount yields a null total with an explicit error, never a silent zero. Totals must stay exactly representable as returned numbers, so a value whose cent-to-currency conversion would lose cent precision is rejected with an error rather than rounded silently; this is an internal exactness guarantee and adds no arbitrary public cents API or amount limit. Discounts and Voucher previews are a separate net preview that never changes the gross comparison. Positive half-cent ties round **up** to the next cent, a discount cannot exceed the subtotal (net stays at or above zero), and discounts do not stack.
- **Build state** (**Implemented**): reactive state across the 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, Add-ons) plus optional target Budget, with Compatibility and Budget as derived values so the UI never re-implements rules. **Planned** additions: preference object (quiz output), Voucher preview state, starter-Build loading with preselected Add-ons, and incompatibility-preserving edits. A state library mandate is not assumed.
- **Quiz module** (**Planned**): pure preference capture and suggestion selection producing compatible suggestions from catalogue metadata across the 6 groups, with explicit trade-off or over-budget messaging. Must not fabricate user answers on direct entry.
- **Saved build module** (**Planned**): named Saved builds owned by one account, storing selections across the 6 groups, preferences, and target Budget, and tolerating incomplete/incompatible drafts with warnings. Reopen-for-edit and delete-own operations only.
- **Auth seam and session transition** (**Implemented** as a null-safe client; **Planned** for Google OAuth and transitions): when unconfigured it returns no client and cloud actions report unavailability instead of failing hard. On sign-out or account switch, account-owned library, Voucher, and draw state and any account-bound Saved-build-derived UI are cleared before the next identity is used; one account's private state is never carried automatically to another; responses from the previous auth session (including late save, fetch, or draw responses) are ignored or cancelled; and anonymous guest build use is preserved. An unsaved edit is kept only through an explicit "preserve as local guest draft" choice or is discarded with confirmation — never auto-uploaded or reassigned to the next account.
- **Lucky draw module** (**Planned**): a server-authoritative operation that records one outcome per account and returns the existing outcome for repeat or concurrent calls. The client never self-awards. Outcome persistence and account result are independent of Voucher expiry. Deterministic fixtures are acceptable for tests; no public presenter/forced-prize commands ship as real entitlement.
- **Voucher preview** (**Planned**): derived from the account's awarded Voucher with expiry and expired states; apply/remove affects the discount preview only.
- **3D preview module** (**Implemented** via Issue #22): an educational intro (`HomeView.vue` / `explodedAnatomyScene.js`) and an interactive live Build preview (`PartsView.vue` / `BuildPreviewCanvas.vue` / `buildPreviewScene.js`) governed by the **3-Layer 3D Visual Preview Boundary** (Keycaps, Switches, and Base/Case). Internal components (Plate, PCB, Foam, Stabilizers) do not alter 3D geometry; their high-fidelity 2D product imagery on selection cards is **Planned** and tracked separately (not part of Issue #22). Operates in hybrid GLB + `THREE.InstancedMesh` mode (~255k–400k runtime triangles: 60% ≈255k, 75% ≈327k, 100% ≈399k, and ≤ 25 draw calls [≈19–21] across per-layout GLBs under a < 5.5 MB cap: `keyboard-60.glb` 3.60 MiB, `exploded-keyboard.glb` 3.91 MiB, `keyboard-100.glb` 5.08 MiB) with lazy-loading, in-memory caching, and in-flight deduplication. Reconciled with a guaranteed procedural fallback mode (< 50,000 triangles, 5–10 draw calls) when GLB assets are unavailable. Degrades to accessible plain-HTML selected-Part data when WebGL is unavailable, cleans up GPU resources on unmount, pauses rendering when off-screen via `IntersectionObserver`, and honours `prefers-reduced-motion`. No claim of photorealistic, acoustic, or engineering accuracy.
- **Navigation shortcut module** (**Planned**): a floating action button with a hover tooltip menu allowing users to jump directly between any of the 6 Component Groups without sequential paging.
- **Audio module** (**Implemented**): permitted/self-owned recorded switch samples play through the Web Audio API after a user action, with mute, volume, selected-switch/profile linkage, and announced missing-sample and playback-error states. The D3 decision records self-recorded clips from personal keyboards and Linear, Tactile, and Clicky profile coverage ([issue #5](https://github.com/adhi-bn/WAD2-Project/issues/5#issuecomment-6309756797), [ADR-0006](../adr/0006-team-recorded-audio-assets.md)). A missing variant remains unavailable rather than borrowing a different recording. Synthesised final profiles are not committed to.
- **Presentation layer** (**Implemented** as the shell; **Planned** for migration): migrate styling toward Bootstrap plus custom CSS while preserving the existing router and the provisional brand identity. Responsive and accessibility behaviour is a requirement, not decoration.
- **External async HTTP seam** (**Implemented** as a minimal JSON fetch): grows when a real async external API is chosen; counts only when a genuine external HTTP API is exercised.

### Domain invariants and state model

- **Slot and Build status**: each of the 6 Component Group slots (Case, Plate, PCB, Switches, Keycaps, Add-ons) is either empty or holds one Part. Missing slots mean **incomplete**. Known incompatibilities between the Parts already selected are still flagged even while another slot is missing, so a partial Build never shows a false ready or compatible claim. **Complete and compatible** means ready for a selection summary only — never purchase-ready, because checkout is pending. Incomplete and incompatible remain distinct states and must not be collapsed in the UI.
- **No silent repair**: editing a Part never auto-removes, auto-substitutes, or silently downgrades another Part. Incompatible choices persist and are explained until the user changes them.
- **Preferences are advisory**: quiz output is a preference record that informs suggestions; it never becomes a Part or overrides a chosen Part.
- **Gross versus net**: the Budget always compares the original full-Parts subtotal to the user's target. Discounts and Vouchers produce a separate net preview and never alter the gross comparison.
- **Money arithmetic**: values are cent-precise. Base prices and the target are finite, nonnegative amounts with at most two decimals (safe integer cents); a string, missing, or otherwise invalid amount produces an explicit error and a null total, never zero. Inputs and aggregate totals must remain exact at cent precision and safely representable as returned numbers, so a conversion that would lose cent precision is rejected rather than rounded. Positive half-cent ties round **up** to the next cent (example: 10% of SGD 10.05 is SGD 1.01). A discount cannot exceed the subtotal, so the net preview stays at or above zero, and discounts never stack.
- **Budget target**: no chosen target means "no target yet", never "a zero budget". Selecting over budget is allowed and flagged with an excess warning plus cheaper compatible alternatives where they exist.
- **5-pin project policy**: the project currently offers 5-pin switches only, and that restriction is reported on its own, on any socket. It is a product decision, not a physical universal — a hot-swap PCB may accept 3-pin or 5-pin switches depending on the board. Future 3-pin expansion is possible but not committed, and no new pin configuration or solver is introduced.
- **Catalogue drift on reopen (Planned cloud contract)**: when a Saved build is reopened, its selections are retained and revalidated against current catalogue support and current valid prices. Removed, unavailable, or changed entries are flagged, Compatibility and the gross total are recomputed, unknown prices report the Budget as unavailable (never zero), and valid alternatives are offered; a Part is never silently replaced and the Build is never called buying-ready. This is a planned feature contract, not a fix for an implemented bug, and it mandates no particular ID, snapshot, or version scheme.
- **Session transition safety (Planned)**: on sign-out or account switch, account-owned library, Voucher, and draw state and any account-bound Saved-build-derived UI are cleared before the next identity is used; responses from the previous auth session are ignored or cancelled; and an unsaved edit is preserved only by an explicit guest-draft choice or discarded with confirmation.
- **Draw authority**: the Lucky draw outcome is created exactly once per account on the server; the client is never able to award, alter, or replay a prize. Repeat and concurrent calls are idempotent, and Voucher expiry never restores or resets the account outcome.
- **Ownership**: every Saved build belongs to exactly one account; no user can read or write another user's builds.
- **Failure safety**: auth, load, and save failures leave the current editable draft untouched and surface a truthful error; success is reported only when it actually happened.
- **Graceful degradation**: with no backend configuration, guest surfaces stay fully usable and cloud-only actions explain that they are unavailable instead of erroring or lying.

### Security and data ownership

- Supabase ownership and row-level security are mandatory: a user must never read or write another user's Saved builds. Verification of isolation and draw concurrency must run against a real sandbox Supabase, because mocked tests cannot prove backend enforcement.
- **Frontend configuration and secrets**: the Supabase project URL and its intended-public publishable/anon key may be present in frontend environment config, protected by correct row-level security. Privileged secrets — service-role/secret keys, the Google client secret, HitPay credentials, and any future AI credentials — must never appear in public env or bundles and stay backend-only. The AI helper choice (rules-based versus an external model) remains **Open** and is not approved by this document.
- **Server-owned draw and Voucher**: draw outcomes and Voucher issuance/expiry are server-owned; a client cannot directly grant or alter a result or extend expiry by changing browser time. Any countdown is presentation only, with authoritative expiry derived from the server-recorded 15-minute lifetime. This is a security invariant, not a selected schema or RPC design.
- The one-spin rule is server-enforced; the prototype's client-only localStorage enforcement is insufficient and must not be relied on.
- Auth and save failures preserve the editable draft and report failure truthfully; no fake "saved" success.
- **Account transition**: no private account state (Saved builds, Voucher, draw outcome) may persist into another account's session; stale responses from a previous auth session must be ignored or cancelled, and a private draft must never be silently uploaded or reassigned to the next account.

## Non-Functional Requirements

- **Performance**: the interactive Build UI stays responsive on mid-range mobile; 3D work loads after the core builder, pauses when hidden, and is torn down when unmounted so it never blocks Part selection or status updates.
- **Resilience**: every async surface (auth, save, draw, 3D, audio) has explicit loading, success, absent/empty, and error states, and none leaves the user without a usable next action.
- **Accessibility**: keyboard operability, visible focus, focus management for modals/drawers, semantic names, roles, and status announcements, colour-independent Compatibility and Budget cues, and respect for reduced motion.
- **Security and privacy**: least-privilege data access, ownership enforced server-side, no privileged secrets in public bundles, and minimal personal data (Google identity only as needed for ownership and the draw).
- **Browser compatibility**: current evergreen desktop and mobile browsers, with graceful fallbacks where WebGL or audio is unavailable.
- **Deployment**: static frontend deploy on Vercel with history routing; backend configuration is injected at deploy time and never committed.

## Testing Decisions

Reuse the existing framework set (Vitest + Vue Test Utils, Playwright, CI) and the highest observable seam available rather than adding new tooling.

- **Pure rule checks (fast unit)**: Compatibility over declared metadata with independent incomplete/incompatible flags and the 5-pin policy on a partial Build; complete-bundle pricing; gross Budget in integer cents; and money regressions — `0.1 + 0.2` compares equal to `0.3`, a genuine one-cent excess is over budget, invalid/missing/string prices and limits return a null total with an error (never zero), and positive half-cent ties round up (10% of SGD 10.05 → SGD 1.01); plus discount/Voucher cap, no stacking, and expiry.
- **Component/integration (visible behaviour)**: quiz and direct-entry flows, incompatibility-preserve-and-explain on edits, both partial flags with reasons plus the budget error/no-target state, over-budget warning with alternatives, Saved build save/reopen/delete visible behaviour, reopening a draft after catalogue changes (retain selections, flag removed/unavailable/changed entries, recompute Compatibility and gross total, offer alternatives, no silent replacement), sign-out/account-switch clearing account state and ignoring stale responses, 3D and audio control/fallback states, and failure states that preserve the draft.
- **E2E (core features)**: quiz path, direct entry with starter Build, edit warnings, Saved drafts, 3D plus audio controls, and the authenticated draw flow.
- **Real backend checks (separate from mocked tests)**: account isolation and single-draw concurrency/retry enforcement against a real Supabase sandbox. Mocked tests do **not** prove backend behaviour.
- **Real external integration evidence (separate)**: identify an approved real external integration and produce actual async HTTP evidence, and confirm it meets the course criteria. An approved auth or storage service may qualify only if the criteria accept it; SDK presence, fixtures, or mocked calls do **not** prove it. This requirement stays open until resolved, and no unrelated API is added solely to tick the box. Payment and AI delivery risks remain visible separately.
- **Baseline discipline**: the frozen seed baseline covers only the original rule contracts (Compatibility and Budget), their then-existing unit/integration coverage, one E2E routing smoke, and the original passing build. Recorded switch audio is now implemented with focused component tests; this does not prove unrelated planned features.
- **Integration discipline (later)**: preserve the unit + integration + E2E pyramid, the lockfile, CI, and native Windows-and-macOS `npm ci` installs, with each OS keeping its own `node_modules`; integration is not a copied dependency install.

### Evidence and traceability

- Every story and matrix row should be traceable to at least one observable check at the highest available seam, so "done" is testable rather than asserted.
- Rules with hidden edge cases (money rounding, discount capping, expiry, declared-support compatibility, draw idempotency) each need their own focused check; visible behaviour needs component/integration coverage; core journeys need E2E.
- Backend-enforced guarantees (account isolation, single-draw concurrency) are proven only against a real Supabase sandbox; mocked checks may still cover the client's handling of the same responses.
- The external-integration evidence requirement stays open until an approved real integration is identified and demonstrated; it is reported as a blocker rather than satisfied by unrelated data, SDK presence, mocked responses, or demo store prices.

## Acceptance / Requirements Matrix

| Area | Externally observable acceptance | Highest seam | Status |
| --- | --- | --- | --- |
| Six-Group selection | One Part per slot across 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, Add-ons) | UI + store integration | Planned |
| Add-ons bundling | Foam, Stabilizers, and Cable bundled into Add-ons, preselected by default from starter build / quiz | Rule check + UI | Planned |
| Switch quantity pricing | Switch price covers enough of its pack to meet the selected kit's required switch quantity | Rule check | Planned |
| Compatibility & feedback | Schema flags validate layout size (60/75/100%) and socket type (hot-swap); red badge on card + top warning banner blocks progression | Pure rule check + UI | Seed implemented; metadata engine Planned |
| Budget | Integer-cent gross subtotal vs target, exact and safely representable; invalid/missing amounts error with a null total (never zero); over-budget allowed with warning | Rule check | Implemented (rule), Planned (discounts/Voucher) |
| Discounts/Voucher preview | Cent rounding; discount capped at the subtotal (net never below zero); no stacking; expiry states; gross unchanged | Rule check | Planned |
| Quiz | Preference-based suggestions within budget or honest trade-off/over-budget message | Integration | Planned |
| Starter Build / direct entry | Direct entry starts from a compatible Build with visible editable defaults; no fabricated quiz answers | Integration | Planned |
| Incompatibility handling | Incompatible Parts retained, explained, and paired with valid alternatives; no silent replacement | Integration | Planned |
| Status separation | Both partial flags and reasons shown; known incompatibilities flagged on partial Builds; complete+compatible = summary-ready, not purchase-ready | Integration | Implemented (rule/UI), Planned (pickers) |
| Draft revalidation | Reopened drafts retained and revalidated against current catalogue/prices; removed or changed entries flagged, total recomputed, unknown price = unavailable, alternatives offered, no silent replacement | Real Supabase check | Planned |
| Session transition | Sign-out/account switch clears library/Voucher/draw and account-derived UI; stale responses ignored; unsaved edit kept only by explicit guest-draft choice or discarded | Real Supabase check | Planned |
| Draft saves | Incomplete/incompatible Saved builds allowed with warnings; save never implies purchase-ready | Real Supabase check | Planned |
| Draw idempotency | Repeat/concurrent/other-device requests return the same recorded outcome; recoverable error otherwise | Real Supabase concurrency check | Planned |
| Guest-first access | All guest surfaces usable signed out; cloud-only actions explain unavailability | Integration | Seam built, Planned |
| Demo labelling | Catalogue/prices, chat, prize, and audio labelled demo/placeholder | Integration | Planned |
| Saved builds | Own-name save/reopen/delete; drafts allowed with warnings; failures preserve draft | Real Supabase check | Planned |
| Auth | Google sign-in; guest surfaces remain usable; null-safe demo when unconfigured; sign-out/account switch clears private state | Real Supabase check | Seam built; OAuth + transitions Planned |
| Lucky draw | One server-recorded spin per account; repeat/concurrent returns same outcome; survives expiry | Real Supabase concurrency check | Planned |
| 3D preview boundary | 3-layer boundary (Keycaps, Switches, Base/Case); internal-parts 2D imagery Planned separately; hybrid mode (~255k–400k tris, ≤ 25 draw calls, < 5.5 MB per-layout GLB) vs. procedural fallback (< 50,000 tris, 5–10 draw calls); HTML fallback, cleanup, reduced motion | E2E + component | Implemented (Issue #22) |
| Navigation shortcut | Floating button with hover tooltip menu jumps between 6 groups without sequential paging | UI integration | Planned |
| Audio | Permitted/self-owned recorded Web Audio clips, user-initiated controls, profile linkage, mute/volume, and announced missing/error states | Component (E2E pending) | Implemented for supplied recordings; missing variants remain unavailable |
| Responsive/a11y | No overflow at common widths, keyboard/touch operable, focus management, colour-independent cues | E2E + component | Planned |
| Real external integration | Approved real integration with actual async HTTP evidence meeting course criteria; SDK presence/mocks insufficient | Integration against a real service | Decision pending |
| Course: frontend | HTML/CSS/JS and responsive behaviour evidenced | E2E + review | Planned |
| Course: data store | Backend data store used for Saved builds and the draw | Real Supabase check | Planned |
| Course: E2E | Core features covered end-to-end | E2E | Planned |
| Course: collaboration | GitHub team-collaboration evidence (history, PRs, reviews) at delivery | Repository/CI | Planning (evidence at delivery) |
| Course: public deploy | Public deployment | Manual/CI | Planned |
| Deployment | Public frontend on Vercel | Manual/CI | Planned |

## Deferred Decisions & Delivery Gates

Each deferred item names what is blocked and the gate that unblocks it.

1. **Buying purpose, order flow, and sandbox payment contract**, including Voucher redemption, is deferred. Gate: a project decision on the buying purpose and on the sandbox HitPay integration/order-flow contract. Sandbox HitPay stays a retained planned proposal requirement — deferring these decisions does not cancel it. Final delivery must demonstrate the agreed sandbox payment behaviour or explicitly obtain a scope revision; a proposal mention or a fake paid UI is not completion. Fee, shipping, and payment-order pricing stay unspecified and no real-money handling is built.
2. **AI helper choice** (rules-based versus an external model) is explicitly **not** decided here. Gate: a user decision. Until then, any canned chat is labelled demo/placeholder, never called working AI.
3. **Permitted sound assets and coverage** (resolved): D3 confirmed self-recorded personal-keyboard clips and Linear, Tactile, and Clicky coverage ([issue #5](https://github.com/adhi-bn/WAD2-Project/issues/5#issuecomment-6309756797), [ADR-0006](../adr/0006-team-recorded-audio-assets.md)). Individual variants without a matching recording remain explicitly unavailable.
4. **Visual identity finalisation**. Gate: user confirmation; current cat branding, fonts, and colours stay provisional.

### Delivery gates

Ordered capability gates; no dates or owners are implied.

1. **Gate 0 — Foundation (met)**: branded shell, three-slot Build state, seed rules, Supabase/HTTP seams, tests, CI, and a passing build.
2. **Gate 1 — Rule contracts**: the 5-pin project policy over declared kit support; Compatibility regressions for a partial Build that both misses a slot and clashes, plus independent incomplete/incompatible flags; integer-cent gross Budget; and money regressions for `0.1 + 0.2` vs `0.3`, invalid/missing price and limit returning an error with a null total, a real one-cent excess, and complete-bundle pricing — each with a focused check.
3. **Gate 2 — Guest builder**: quiz and direct entry, Part pickers, incomplete-versus-incompatible status, over-budget warning, and clear demo-pricing labels.
4. **Gate 3 — Accounts**: Google OAuth, a Saved build library with enforced ownership, draft-tolerant save/resume/delete, and failure safety.
5. **Gate 4 — Draw**: server-authoritative single spin, idempotent repeat/concurrent handling, Voucher preview with expiry states, and real-Supabase evidence.
6. **Gate 5 — Experience**: 3D schematic preview with fallbacks, cleanup, and reduced motion; recorded switch audio with user-initiated controls, profile linkage, and missing/error handling; responsive and accessibility pass.
7. **Gate 6 — Course evidence and deploy**: an approved real external integration with actual async HTTP evidence; HTML/CSS/JS and responsive behaviour; a backend data store; full E2E coverage of core features; GitHub team-collaboration evidence; public Vercel deployment; and a green unit/integration/E2E pyramid. Recorded audio has focused component checks; broader E2E and delivery evidence remain outstanding. Payment and AI outcomes are resolved or explicitly reported as blockers. Collaboration and publication evidence is produced at delivery, never fabricated now.

## Assumptions and Corrections

- **Pins (project restriction vs physical fact)**: the product currently offers **5-pin switches only** and applies that policy regardless of socket; this is a project restriction, not a claim that hot-swap is physically limited to five pins. Vendor documentation shows a hot-swap PCB can accept both 3-pin and 5-pin MX-compatible switches depending on the board (see Sources). Future 3-pin expansion is possible but not committed; the existing compatibility rule interface stays, and no new pin configuration or solver is added.
- **Implementation status**: the implemented surface includes the rule contracts (Compatibility with independent incomplete/incompatible flags and the 5-pin policy; Budget with integer-cent arithmetic and invalid-input errors), reactive Build state, null-safe seams, builder/home views, catalogue, Part pickers, and selected-switch recorded audio. Quiz, persistence, auth/OAuth, the draw, and 3D remain **Planned**; the builder view's "Part pickers land here" placeholder records the separate seed builder's unimplemented controls.
- **Unintegrated assets**: prototype branding, mascot, help, chat, prize-wheel, and Voucher surfaces are treated as provisional assets to integrate later, not as part of the verified baseline. Any canned chat is demo/placeholder until an AI decision is made.
- **Demo data**: all catalogue entries and reference prices are illustrative and labelled demo values. No real catalogue, live service, or retailer data is assumed.
- **3D assets**: the proposal Three.js/Blender workflow is context only; no specific supplied Blender asset is assumed to exist or be licensed.
- **Audio assets**: self-recorded personal-keyboard clips and profile coverage were confirmed in D3 and documented in ADR-0006. No synthesised-final-profile commitment is made.
- **Payment**: sandbox HitPay is a retained planned proposal requirement; buying purpose and order flow are deferred. It is not built and implies no live money handling.
- **Open choices**: the buying purpose and order flow and the AI helper choice remain open and are not resolved by this document.

## Out of Scope

- Real-money processing, payment capture, any live order flow, and invented shipping, tax, or inventory behaviour.
- Retailer comparisons, outbound parts/store links, or store price integrations (removed entirely).
- Individually unbundled secondary internal accessories (Foam, Stabilizers, Cable are bundled under Add-ons per ADR-0008).
- Public or social sharing, build duplication, renaming beyond a supplied save name, and other unrequested library extras.
- Admin surfaces, role management, and moderation.
- Real prize or financial claims; public presenter/forced-prize commands as entitlement.
- Unrequested architecture, added libraries, new frameworks, or a state-library mandate.
- Photorealistic, acoustic, or engineering-accuracy claims for the 3D or audio surfaces.

## Risks and Mitigations

- **Prototype drift**: unintegrated prototype code may carry behaviour that conflicts with this spec (store logic, client-only draw enforcement, or over-claimed visuals). Mitigation: integrate only through the delivery gates and re-verify rules against declared support.
- **Backend assumption gap**: mocked tests can pass while real row-level security or draw concurrency is broken. Mitigation: mandatory real-Supabase checks before the draw gate closes.
- **Money edge cases**: float drift, discounts exceeding the subtotal, or expiry bugs could misstate prices. Mitigation: cent-precise rules with focused checks and a net preview that never goes below zero.
- **Course evidence gap**: the qualifying real external async-HTTP integration may be unresolved, leaving the course requirement unmet. Mitigation: identify an approved real integration early and keep payment/AI delivery risks visible separately.
- **Accessibility regression**: visual-first 3D and brand surfaces can exclude keyboard, screen-reader, or reduced-motion users. Mitigation: HTML-first selected-Part data, focus management, and an accessibility pass before the experience gate closes.
- **Asset availability**: additional sound variants may be unavailable, and 3D assets may be unavailable or unlicensed. Mitigation: missing switch samples are reported rather than substituted; 3D asset use remains subject to its own licensing evidence.
- **Account-transition leak**: private Saved builds, Voucher, or draw state could bleed into the next account if transitions are not handled. Mitigation: clear account-owned and account-derived state on sign-out/switch, ignore stale-session responses, and require an explicit preserve-or-discard for unsaved drafts.

## Further Notes

- This is a planning artifact only. No prototype source is imported, no dependencies are installed, and no app integration happens from this document.
- The approved scope is tracked as GitHub issues in this repository, separate from this document; team review and assigned implementation remain pending. Prototype integration is selective and follows that review.
- Demo catalogue and reference pricing are illustrative and clearly labelled; no live services or real catalogue data are invented.
- Physical metadata claims stay within the cited vendor facts and each Part's declared metadata. Surface any contradiction with an ADR rather than silently overriding it.
- Related documents: this canonical spec, the root `DESIGN.md` (visual authority, independent of any tooling), and `docs/adr/` (including ADR-0002 for the Bootstrap styling direction).

## Sources

Vendor documentation referenced for physical facts (not retail shopping links):

- Keychron Q3 product page — the PCB supports both 3-pin and 5-pin MX-compatible switches: https://www.keychron.com/products/keychron-q3-qmk-custom-mechanical-keyboard
- Keychron guide, "How to choose a custom mechanical keyboard" — keyboard size is a different axis from ANSI/ISO/JIS arrangement: https://www.keychron.com/blogs/news/how-to-choose-a-custom-mechanical-keyboard
- Keychron Q3 user manual — barebones contents include case, PCB, plate, foam, gaskets, and stabilisers, i.e. not housing only: https://keychronsupport.zendesk.com/hc/en-us/articles/8914373226775-Keychron-Q3-User-Manual
