---
name: Le Chaton Typers
description: Custom mechanical-keyboard builder — assemble a Build from a barebones kit, switches and keycaps against a target Budget.
colors:
  accent-indigo: "#3346FF"
  accent-tint: "#E2E5FF"
  on-accent: "#FFFFFF"
  app-grey: "#ECEEF2"
  card-surface: "#FFFFFF"
  sunken-surface: "#F4F5F9"
  text-ink: "#12151C"
  muted-ink: "#596072"
  line-grey: "#D6DAE3"
  success-green: "#12805A"
  success-tint: "#DDF3EA"
  danger-orange: "#D2461A"
  danger-tint: "#FCE6DD"
  warning-ochre: "#9A6400"
  event-amber: "#FFB020"
  event-charcoal: "#15171C"
  event-offwhite: "#F1F2F4"
  accent-indigo-dm: "#8391FF"
  accent-tint-dm: "#242B57"
  on-accent-dm: "#0D1016"
  app-grey-dm: "#0D1016"
  card-surface-dm: "#161A23"
  sunken-surface-dm: "#1C212C"
  text-ink-dm: "#E9ECF3"
  muted-ink-dm: "#98A0B2"
  line-grey-dm: "#2A303D"
  success-green-dm: "#41D39C"
  success-tint-dm: "#133528"
  danger-orange-dm: "#FF8B61"
  danger-tint-dm: "#3A1E15"
  warning-ochre-dm: "#F2C14E"
typography:
  display:
    fontFamily: '"Unbounded","Arial Black",system-ui,sans-serif'
    fontSize: "clamp(34px,5.6vw,60px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-.01em"
  headline:
    fontFamily: '"Unbounded","Arial Black",system-ui,sans-serif'
    fontSize: "clamp(24px,3.4vw,34px)"
    fontWeight: 600
    letterSpacing: "-.01em"
  body:
    fontFamily: '"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace'
    fontSize: "11.5px"
    fontWeight: 500
    letterSpacing: ".08em"
rounded:
  tag: "6px"
  control: "12px"
  row: "14px"
  card: "18px"
  feature-card: "24px"
  pill: "999px"
spacing:
  gutter: "20px"
  gap-sm: "12px"
  gap-md: "16px"
  gap-lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-indigo}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  chip:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.sunken-surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
---

# Design System: Le Chaton Typers

## Overview

**Creative North Star: "Parts workbench"**

Le Chaton Typers is a builder tool first: the layout of a workbench where three Parts — a barebones kit, switches, keycaps — sit within reach, the running spend is always visible, and every choice has a clear state. Playful moments (Biscuit the cat mascot, the lucky-draw wheel) add personality without taking over. The feel is precise, friendly, and calm: quiet neutral surfaces, one calm indigo build accent, and technical mono type wherever numbers and labels need to line up.

This file is the team's **initial** style guide. It was extracted from the reviewed prototype (prototype only: `src/assets/main.css`, `src/App.vue`, `src/components/`, `src/views/`), not from the current root app, which is still a placeholder Tailwind scaffold. Prototype integration is paused for team review; the migration target is Bootstrap plus this custom CSS, not two frameworks. Product behaviour (scope, vocabulary, money, draw, accessibility requirements) is governed by `docs/specs/keyboard-builder.md` and the glossary in `CONTEXT.md`; this guide covers visual style only. The identity is provisional — kept and refined for now, open to change after team review (spec, Deferred Decisions §4). Each section separates **extracted prototype behaviour** from **required corrections** planned for the migration; required corrections are stated as standards to apply, never as claims that the future app already meets them.

**Key Characteristics:**
- Tool first, playful moments second: the cat and wheel never obscure the build task.
- One calm build accent: indigo carries primary actions, selection and progress; everything else stays neutral (deliberate exceptions noted under Colors).
- Plain-spoken, tactile shapes: pill actions, softly rounded cards, visible state.
- Mono for data: prices, budgets, part labels and progress always use the mono face with tabular figures.
- Themed by the OS: a full dark palette exists, driven by `prefers-color-scheme`, with an observed `data-theme` override hook and no committed in-app toggle.

### Using this guide

This is a tool-independent team standard: read the Markdown and the plain YAML token values above, then implement the styles with the project's Vue, Bootstrap and CSS setup. No teammate needs Impeccable, an AI agent, or a particular editor plugin to follow it.

`.impeccable/` is optional local preview metadata for people who choose to use Impeccable. It is ignored by the shared repo and not included in commits, so nothing in this guide depends on it. The normative Markdown and the plain YAML token values in this file remain the shared, authoritative style source.

## Colors

The palette is a cool grey work surface with a single saturated indigo accent, a warm amber reserved for promotions, and restrained success/danger/warning semantics. Exact values live in the frontmatter; dark-scheme values are the `*-dm` tokens.

### Primary
- **Accent indigo** (`accent-indigo`, dark `accent-indigo-dm`): the build accent — primary buttons, links, selection rings, active part tabs, focus outlines, and progress/meter fills. It is the accent for action and selection, but not a claim that everything indigo is clickable or that every control is indigo: active navigation deliberately uses plain ink, and promotion actions use the reserved event palette.
- **On-accent** (`on-accent` / `on-accent-dm`): text and icons sitting directly on accent indigo.
- **Accent tint** (`accent-tint` / `accent-tint-dm`): selected-row and chip backgrounds, icon wells, soft highlights behind accent content.

### Promotional (reserved)
- **Event amber** (`event-amber`): the lucky draw, voucher codes, and the event banner only — paired with **Event charcoal** (`event-charcoal`) backgrounds and **Event offwhite** (`event-offwhite`) text, which stay constant across light and dark schemes.

### Neutral
- **App grey** (`app-grey` / `app-grey-dm`): page background.
- **Card surface** (`card-surface` / `card-surface-dm`): cards, panels, overlays, sticky bars.
- **Sunken surface** (`sunken-surface` / `sunken-surface-dm`): input wells, table striping, recessed details.
- **Text ink** (`text-ink` / `text-ink-dm`): headings, body, active navigation (also used as a fill for active nav pills, with the background colour as text).
- **Muted ink** (`muted-ink` / `muted-ink-dm`): secondary text, eyebrows, hints, disabled labels.
- **Line grey** (`line-grey` / `line-grey-dm`): borders, dividers, meter tracks, disabled fills.

### Semantic
- **Success green** (`success-green`, tint `success-tint`; dark variants exist): compatible, under-budget, saved. **Danger orange** (`danger-orange`, tint `danger-tint`): incompatible, over-budget, errors, expiry. **Warning ochre** (`warning-ochre`): caution notes — observed only in the light scheme in the prototype; the themed dark token `warning-ochre-dm` is extracted alongside it for dark-mode use.

**Measured contrast** (computed with WCAG 2.x relative-luminance ratios on flat fills; threshold 4.5:1 for normal text, 3.0:1 for large — spot-check assumptions, not a certification, and component-level checks are still owed before any compliance claim):
- Passing key pairs: body ink on app grey (15.7), muted ink on app grey (5.4), accent indigo on card white (6.1), on-accent on accent indigo (6.1), accent indigo on accent tint (4.9), success/danger/warning text on card white (4.5–5.0), text ink on the success/danger/accent tints (14.7–15.7), event amber on event charcoal (9.8). Tested dark-scheme pairs — text ink and muted ink on dark app grey and dark card, accent and on-accent, and success/danger/warning on dark card (6.6–16.1) — passed; other dark combinations are untested.
- **Flagged for treatment correction before implementation (palette unchanged):** danger text on danger tint (3.8) and success text on success tint (4.2) fail 4.5:1 at the 12px price-delta size. Font weight does not change contrast, and a larger threshold only applies to legitimately large text — so the fix is treatment, not styling tricks: keep normal-size wording in ordinary text ink on the tint fill (15.2–15.7 measured) with meaning carried by a semantic icon or accent marker, or place standalone semantic-coloured text on the measured card-white surface. Semantic text on app grey is not approved as a backdrop (spot check: 3.9–4.3). Dark-scheme ink on the dark tints also passes (11.3–12.9). The prototype's disabled progress pills composite to ~1.8:1 and are illegible; treat as part of the navigation fix in Layout/Components, not as a norm.

**The Event Amber Rule.** Event amber appears only on lucky-draw and voucher surfaces. If a non-promotional screen needs warmth, it does not get it — one calm accent is the brand.

**The Single-Voice Accent Rule.** Accent indigo is the one build accent: primary actions, links, selection/focus states, and progress and meter fills. Static decoration stays neutral so the accent never cries wolf. Two deliberate exceptions are features, not leaks: active navigation pills use plain ink, and promotion controls use the reserved event palette. The rule does not claim that every indigo element is clickable, nor that every interactive element must be indigo.

## Typography

**Display Font:** Unbounded 500–700 (fallback "Arial Black", system-ui) — headings, brand wordmark, wheel results.
**Body Font:** Figtree 400–700 (fallback system-ui, -apple-system, "Segoe UI") — everything else.
**Mono Font:** JetBrains Mono 400–600 (fallback ui-monospace, "SF Mono", Menlo) — prices, budgets, countdowns, eyebrows, tags, keyboard hints.

**Character:** rounded geometric display headlines over a plain readable body, with the mono face giving the builder its measured, parts-catalogue voice.

### Hierarchy
- **Display** (600, see frontmatter for the clamp, tight line-height, -0.01em tracking): hero and intro page titles only; one per screen.
- **Headline** (600, frontmatter clamp): section and page-sub heads (part pickers, summary, wheel side panel).
- **Title** (Figtree 700, ~15–18px): card names, part option names, panel titles.
- **Body** (400, 15px, 1.55 line-height): descriptions and helper text; long prose maxes out around 46–62ch in the prototype — keep line lengths in that band.
- **Label** (mono, 11.5px, +0.08em tracking, uppercase): eyebrows ("Step 2 · Choose your parts"), tags, table headers, units.

### Rules
- **The Mono-for-Money Rule.** Every price, total, budget figure, discount and countdown is mono with `font-variant-numeric: tabular-nums` so digits never jitter when values change. Vocabulary follows `CONTEXT.md`: **Budget** for the target, never "price" for it.
- Headings use sentence case; only labels/eyebrows are uppercase.
- Keep fallback stacks as extracted; fonts load via one Google Fonts stylesheet link in the page head.

## Layout

Single-column content centred in a **1120px** container with 20px side gutters (`{spacing.gutter}`). Section rhythm: 36px top / 120px bottom padding on full screens; home and learn pages use taller scroll sections (85–100vh) that sit over the 3D canvas. Page layout uses Bootstrap's grid and responsive utilities (`row`, `col-*`, breakpoint helpers as needed); all brand component styling stays in the custom class namespace (see Do's and Don'ts).

**Observed breakpoints and required behaviour (from the prototype's five media queries):**
- **≤900px** — two-column areas (parts + summary sheet, build grid) collapse to one column; the build sheet stops being sticky.
- **≤760px** — hero goes single column; step cards go 2-up; option cards go 1-up; the sticky bottom bar drops its meter.
- **≤720px** — the lucky-draw modal stacks to one column and the wheel shrinks (~290px).
- **≤520px** — the brand wordmark in the header may collapse to the cat mark.
- **≤420px** — step cards go 1-up; swipe deck gets taller.

**Layout standards to apply during migration (not present or only partial in the prototype):**
- Navigation and step labels must stay readable at every width — the prototype hides the step labels below 760px; that is a defect, not a norm. Prefer wrapping labels onto a second line or letting the strip scroll horizontally, so the full label is always present. If truncation is truly unavoidable, the full text must still be reachable by keyboard focus and tap (a focusable element or accessible disclosure showing the full string) — never only via a hover-triggered native `title`.
- Sticky layers (header, bottom build bar, mascot) must reserve space: page bottom padding must clear the bar, and the mascot must never overlap the bar's call to action.
- The 3D canvas is a background layer behind content; content keeps its own opaque or blurred surface and stays usable if the canvas fails (see Components → 3D preview).

## Elevation & Depth

The system is **softly layered**: depth comes from tonal steps (app grey → card surface → sunken surface) plus one quiet ambient shadow on raised surfaces, with a deeper shadow reserved for modals. There are no hard drop shadows, no gradients used for depth, and no elevation colour tints.

### Shadow vocabulary
- **Ambient card shadow** (`0 1px 2px rgba(18,21,28,.06), 0 10px 30px rgba(24,32,80,.10)`; dark scheme `0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.35)`): swipe cards, chat and teaser bubbles, side tabs — anything meant to float above the page.
- **Overlay shadow** (`0 30px 80px rgba(0,0,0,.35)`): the lucky-draw modal and any future dialog. One level above everything.
- **Sticky-bar lift** (`0 -8px 24px rgba(0,0,0,.06)`): the bottom build bar only, so it reads as attached to the screen edge.
- **Selection ring** (`0 0 0 2px` in accent indigo, over an accent border): marks the chosen part/card. This is a state, not elevation.

Panels resting on the 3D canvas add a blurred translucent surface (backdrop blur ~10px at ~86% opacity) so text stays readable over moving layers.

**The Soft Layer Rule.** Flat at rest inside the page flow; shadow appears only for genuinely raised surfaces (floating cards, modal, sticky bar). Depth never decorates.

## Shapes

Rounded and tactile throughout:
- **Actions, chips, nav pills, countdowns** are full pills (`{rounded.pill}`).
- **Cards and panels** are softly rounded (`{rounded.card}`, `{rounded.feature-card}` for showcase/swipe cards).
- **Controls and rows** use the smaller steps: fields and tabs at `{rounded.control}`, option rows and chat bubbles at `{rounded.row}`, tags and badges at `{rounded.tag}`.
- **Borders** are 1px in line grey on resting surfaces; interactive surfaces switch the border to accent indigo on hover and add the selection ring when chosen.
- Dashed lines are reserved for incidental detail: voucher code boxes, receipt-style dividers — never for primary containers.
- Buttons never have sharp corners; imagery and icons sit in rounded wells.

## Components

Component classes live in the custom namespace (`ui-btn`, `scard`, `chip`, `tab`, `opt`, `panel`, `ld-modal`, …) precisely so they cannot collide with Bootstrap's `.btn` / `.card` / `.modal`. The frontmatter carries the machine-readable primitives; this section is the usage contract. Each interactive component carries its **relevant** states: hover and visible focus on everything interactive; disabled, pending, error, success and selected states where the component can actually be in them — a plain link does not need an error state, and not every control needs a pending state. Where the prototype shows only some of these, the missing ones are required additions, marked as such.

### Buttons
- **Shape:** full pill (`{rounded.pill}`), padding `{components.button-primary.padding}` (large hero variant: 14px 26px).
- **Primary:** accent indigo fill with on-accent text (`{components.button-primary.backgroundColor}`); hover brightens slightly (filter ~1.08).
- **Ghost/secondary:** card surface with a 1px line-grey border and text-ink label (`{components.button-ghost.backgroundColor}`); hover darkens the border toward text ink.
- **Focus:** 2px accent outline, 2px offset, always visible — keyboard and touch users rely on it.
- **Disabled/pending:** disabled controls use the native `disabled` attribute so activation is genuinely prevented (or `aria-disabled` plus real activation blocking, where no native control fits); reduced opacity (~0.45) is presentation only, never the mechanism. Labels on disabled controls stay legible, and important locked items stay discoverable as text. Pending actions announce themselves (label swap, e.g. "Spinning…", plus the control being actually inert).
- **Event amber buttons** exist only inside lucky-draw/voucher surfaces (see The Event Amber Rule).

### Chips, tags and option cards
- **Chips** (profile/preference summary): pill, bordered, 12.5px semi-bold; the confirmed-preference variant uses accent tint with no border.
- **Part tags** ("Best fit", "Save", "Upgrade"): mono 10.5px uppercase, `{rounded.tag}`, sunken fill; only the recommended tag gets the accent fill.
- **Option cards** (part picker): `{rounded.card}` with border, name + spec + mono price, and price deltas worded as well as numbered ("Save S$12.00", "Upgrade +S$6.00"), never colour alone. Selected = accent border + selection ring plus a semantic selected state (e.g. `aria-pressed`). An already-selected Part that becomes incompatible **stays selected, visible and fully operable**: it carries a warning flag with a plain-language reason, and the UI suggests compatible alternatives — it is never silently removed, replaced, cleared, or locked (spec: no silent repair), and it is never styled as unclickable. Unselected options that would clash may show the same warning affordance, but incompatibility alone does not hard-ban choosing them.
- The picker is **three slots** (barebones kit, switches, keycaps) — the prototype's denser eight-category picker (case, plate, PCB, switches, keycaps, stabilisers, foam, cable) is not the target.

### Inputs
- Text/email fields: `{rounded.control}`, sunken fill, 1px line border, padding `{components.input.padding}`; focus = accent outline. Chat-style inline inputs may be pills. Validation errors are text in danger orange next to the field, never colour-only.
- Range/budget slider: accent-coloured thumb/track via `accent-color` with a paired numeric readout in mono.

### Part navigation and progress
- A horizontal **part tab strip** (one tab per slot): mono kicker + current price, active tab marked with a dark border; **labels and prices must never clip** — scroll the strip horizontally rather than truncating.
- A **progress stepper** of pill steps (optional quiz step labelled "optional"; direct entry lands straight on part picking): active = filled ink pill, available = plain, locked = readable muted-ink label with an explicit text state (e.g. "· locked") — never an illegible opacity fade, and never a silent block. Mobile keeps labels readable (see Layout standards).

### Budget and totals
- Always show the **gross subtotal against the target Budget first**; a voucher/discount preview is a separate struck-through/net figure, never replacing the gross number (spec: "Gross versus net").
- **Budget meter:** thin rounded track, accent fill, turns to danger orange when over; the under/over amount is always written out in mono text ("S$48 over budget"), never conveyed by colour alone (spec: colour-independent cues).

### Status and feedback (incomplete / incompatible / over-budget)
- Incomplete ("a Part is missing") and incompatible ("chosen Parts do not fit") are distinct labels with distinct wording — never collapsed (spec: status separation). Every status pairs an icon + text + colour, and offers valid alternatives where they exist.
- **Toast:** bottom-centre rounded message (a rounded rectangle, 12px radius — not a pill), inverted (text-ink background, background-coloured text), `role="status"` + `aria-live="polite"`, short timeout; used for build changes, copy confirmation, voucher expiry.

### Dialog (lucky-draw wheel)
- Centred overlay at 62% dark scrim, feature-card-sized box with the deep overlay shadow; wheel slice labels in the display face; big spin hub button.
- **Required behaviour (planned, not audited in the prototype):** Escape closes, focus is trapped and returned to the opener, the background is inert while open. One spin per account is server-enforced (spec: draw authority); browser-local locks are not a design pattern to copy.

### Mascot and chat (Biscuit)
- Fixed bottom-right mascot with a small badge for nudges; chat is a rounded panel with header, messages, quick-reply chips and an input. Chat content is rules-based demo copy and must be labelled as demo/placeholder until the spec's open AI decision is made.
- The mascot and teasers **must never cover task controls** (bottom bar, nav); auto-animation idles under `prefers-reduced-motion`; chat never auto-opens uninvited.

### 3D preview and sound
- The Three.js keyboard preview is **schematic/educational** (no photorealistic or engineering-accuracy claims, per spec). Content-section labels highlight layers on scroll.
- **Fallbacks (required):** selected-part data must exist as plain HTML even with no WebGL; rendering pauses when hidden and tears down on unmount; reduced motion is honoured.
- **Sound:** user-initiated Web Audio typing/switch demo with mute/volume, tied to the selected switch profile, with missing-sample and playback-error states. Available samples are self-recorded demo audio per [ADR-0006](docs/adr/0006-team-recorded-audio-assets.md); do not claim acoustic or engineering accuracy.

### Deferred / not part of the system
- No payment, checkout, order, shipping or inventory components (buying flow deferred; sandbox HitPay stays a retained planned requirement — visual and order-flow details await the buying decision, so no checkout components are committed in this guide).
- No retailer links or store-price comparison tables — that prototype surface was removed from scope.
- The swipe-card quiz is **optional**: cards, stamps and drag physics documented in the prototype may be reused for it, but direct entry to the builder must never depend on them.

## Do's and Don'ts

### Do:
- **Do** show the gross subtotal against the Budget first, with any voucher preview shown separately as a secondary net figure.
- **Do** set every price, total, discount, date and countdown in the mono face with tabular figures.
- **Do** pair every status (incomplete, incompatible, over-budget, win/lose, success) with an icon and words, never colour alone.
- **Do** give modals Escape-to-close, focus trap and return, and an inert background; give every control a visible focus ring and working keyboard/touch paths.
- **Do** honour `prefers-reduced-motion` everywhere (wheel spin, mascot, card drags) and pause/hide off-screen animation and 3D rendering.
- **Do** label demo catalogue data, prices, chat, prizes and audio clearly as demo/placeholder where the spec requires.
- **Do** use Bootstrap's grid and responsive layout utilities (`row`, `col-*`, breakpoint helpers) for page-level layout; style brand components with the custom class namespace.

### Don't:
- **Don't** restyle Bootstrap's own `.btn`, `.card`, `.modal` classes or run a second utility framework alongside the custom CSS — pick the custom namespace per component.
- **Don't** use event amber on non-promotional UI, and don't add a second accent colour.
- **Don't** clip, hide or icon-ify navigation and tab labels on narrow screens; prefer wrapped or horizontally scrolling labels, and if anything truncates expose the full text on focus or tap — never hover-only native tooltips.
- **Don't** let the mascot, teaser bubbles or sticky bars cover form controls or the primary call to action.
- **Don't** model pickers, stores or prizes on removed prototype scope (eight-category picker density, retailer comparison, browser-enforced draw locks).
- **Don't** introduce real checkout, payment, or "working AI" visuals while those decisions are deferred in the spec.
- **Don't** restate token values outside the frontmatter; reference the names. And never claim accessibility compliance from this document alone — measured checks happen at implementation.
