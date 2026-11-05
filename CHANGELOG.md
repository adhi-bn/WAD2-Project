# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `/build` mobile: the **Save build** action moves out of the summary header into the compact floating bar at ≤900px (collapsing to a 44px icon button on the narrowest phones), so the header keeps only the name and rename control and the bar stays a two-row tray within 320px; desktop ≥901px keeps Save in the header beside the title.
- `/build` parts breakdown on phones: each part is now one card with its price as a right-hand column on the group-name line instead of a separate vertical price row, reducing vertical space while the semantic table headers and accessibility roles stay intact.
- Global site navigation: the active link is now a filled ink pill with contrasting text (theme-aware, inverting cleanly in dark mode) instead of ink weight alone; the Build progress strip keeps its existing active treatment.
- `/build` mobile: the build attribute chips (`75% Layout`, `Silent Tactile`, `Polycarbonate`) use compact sizing and tighter spacing so all three fit on one row from 320px up, with full labels preserved (no clipping or ellipsis); desktop sizing is unchanged.

### Fixed
- Mobile shell, supported from 320px phones through 1024px tablets in both orientations: at ≤900px the global navigation links move behind an accessible full-screen menu (focus moves in and is trapped, Escape or the close button dismisses and returns focus to the trigger, any navigation — including same-route activation — closes it, the page behind is inert and scroll-locked, and resizing above 900px resets it), while the separate Progress row keeps visible `Swipe`/`Parts`/`Build`/`Cart` labels, contained and internally scrollable instead of hidden below 760px.
- Horizontal page overflow on phones from the single-row header; locked Progress steps keep readable labels plus a screen-reader `locked` state.
- `/build` parts table on narrow phones: rows stack semantically (`data-label` driven, explicit table roles and header associations preserved) with all specs, status tags, and prices retained; voucher totals wrap on narrow phones; mobile body/toast/mascot clearance tracks the rendered checkout bar height (`--lct-bar-h`, measured in `src/App.vue`, set only at ≤900px on `/parts`/`/build`; desktop and barless routes keep their fixed clearance offsets); the rename form wraps instead of overflowing at 320px.
- Touch-only scroll-first 3D stage: on coarse pointers the canvas re-enables vertical page pan (`touch-action: pan-y` after `OrbitControls` construction, which forces `none`), so one-finger vertical swipes scroll while horizontal drags rotate; mouse orbit is unchanged.
- Biscuit's auto-teaser no longer pops over task controls below 1024px, and hiding the mascot stays a per-visit choice with the paw tab as the recovery path.
- `/build` header identity group: the rename icon sits directly beside the build name (it no longer drops onto its own row when the title wraps) and the Save action stays in the same header group — right-aligned with the title on desktop, wrapping tightly beneath it on phones — instead of floating on separate rows; long custom build names wrap without overflowing the header.

### Added
- TokenRouter OpenAI-compatible endpoint migration for Biscuit's advisor Edge Function ([`supabase/functions/advisor/index.ts`](supabase/functions/advisor/index.ts)) using `z-ai/glm-5.3-flash`, backed by client advisor seam ([`src/lib/advisor.js`](src/lib/advisor.js)) with resilient JSON parsing, `<think>` tag stripping, multimodal image fallback, and live Supabase `parts` catalog grounding with static fallback (#19).
- Semantic header badge in FatCat chat (`AI Advisor` when connected, `Advisor` when unconfigured or degraded on failure) using Design tokens (`var(--lct-text-ink)`, `var(--lct-card-surface)`), and screen-reader status announcements (`aria-live="polite"`, `role="status"`) for thinking, answered, and error states (#19).
- Overwrite confirmation prompt in Biscuit's chat before replacing an existing build with a suggested build when navigating to `/build` (#19).
- Order history on the Account page: signed-in customers see their orders, status and items (reads their own rows under RLS).
- `supabase/seed/catalog-images.sql` sets the picture path for Case, Keycap and Switch options. Optional: the app falls back to `/parts/<id>.png`.
- Interactive 3D Build Preview on the `/build` review page ([`src/views/SummaryView.vue`](src/views/SummaryView.vue)) via [`src/components/Keyboard3DView.vue`](src/components/Keyboard3DView.vue) and [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) in embedded stage mode (`:embedded-stage="true"`), rendering edge-to-edge interactive 3D keyboard models with initial combined assembly state, orbit/zoom controls, and floating top-right action pills (`Explode layers` / `Combine layers` and `Reset view`).
- Red part status alert tags (`.part-status-tag`) in the `/build` summary table highlighting `Unavailable` parts, `Incompatible` parts, `Price changed` Parts, and slots that `Differs from saved` when compared against loaded saved build baseline IDs tracked in [`src/store.js`](src/store.js) (`savedBuildBaselineIds`).
- Synchronized inertia smooth scrolling powered by GSAP (`ScrollTrigger`) and Lenis in [`src/lib/smoothScroll.js`](src/lib/smoothScroll.js) across the application shell (`src/App.vue`) and router (`src/router/index.js`), with full `prefers-reduced-motion` accessibility compliance and scroll-trap isolation (`data-lenis-prevent`) on interactive 3D model canvases and Biscuit's assistant chat window.
- Side-by-side static 3D previews on the Compare Builds page (`/compare`, `CompareBuildsView.vue`) powered by `BuildPreviewCanvas.vue` in combined 3-layer static mode (`:interactive="false"`, `:canvas-only="true"`, `:initial-exploded="false"`, `:compact="true"`) on a clean transparent stage at full native pixel ratio with 0% idle GPU loop overhead, alongside accessible missing-part highlighting (`.is-missing-cell`, `.compare-missing-badge`, `.is-missing-part`) with explicit fallback indicators (#33).
- Compare Builds page (`/compare`) for selecting two saved Builds, comparing the six canonical Component Groups side by side, and reopening either Build for editing; includes resilient future `image_url` support and accessible higher/lower amount indicators (#33).
- OneMap-powered two-store locator on the About Us page, including Jewel Changi Airport and Marina Bay Sands store cards with photos, browser-location driving-route comparison, distance and estimated travel-time summaries, and an interactive route map.
- Saved-build snapshots now retain the selected eight Parts, quiz preferences, target Budget, and historical prices; reopening flags catalogue drift and offers alternatives without silently replacing a Part (#12).
- Saved-build Supabase migration adding the snapshot fields, update timestamp, and explicit per-account RLS policies (#12).
- Interactive part-by-part 3D Build Preview in [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) powered by [`src/lib/buildPreviewScene.js`](src/lib/buildPreviewScene.js) with Three.js `OrbitControls`, smooth vertical drop/snap assembly animation, real-time Part material/color/stem updates without additional `.glb` asset downloads on Part material swaps (lazy-loading per-layout `.glb` assets only when switching between 60%, 75%, and 100% form factors), camera preset views (`Isometric`, `Top-down`, `Side profile`), Combine/Explode layer toggle, accessible plain-HTML selected parts summary, and graceful WebGL failure fallback ([#22](https://github.com/adhi-bn/WAD2-Project/issues/22)).
- Multi-layout 3D keyboard support across `60%`, `75%`, and `100%` form factors with layout switcher pills in [`src/views/PartsView.vue`](src/views/PartsView.vue), dynamic layout scale adjustments, and procedural barebones case silhouettes (`high-profile`, `low-profile`, `sandwich`) (#22).
- Custom keycap artwork textures (*Le Chaton Anime Mural* and *Great Wave Kanagawa*) and dual Top-Printed (`wasd.blend` authentic font) vs. Side-Printed keycap legend variations (#22).
- Consolidated single-page Builder workflow in [`src/views/PartsView.vue`](src/views/PartsView.vue) (`/parts`) with automatic `/builder` route redirection, `/parts` direct entry initialization, and "Skip quiz, pick parts myself" quick links (#22).
- Interactive layout selector segmented switcher (`60%` · `75%` · `100%`) in [`src/views/PartsView.vue`](src/views/PartsView.vue) within the `.summary-pills` header bar, allowing instant switching between 60%, 75%, and 100% keyboard layouts without retaking the quiz (#22).
- Exported [`setLayout(layoutCode)`](src/store.js) in [`src/store.js`](src/store.js) dynamically updating layout answer state, recalculating catalog prices, weights, and key counts (61, 84, 104 keys), while preserving customer part selections (#22).
- Reactive `layout` prop on [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) wired to `sceneController.setLayout`, updating 3D form-factor scale and announcing layout changes via `liveStatusText` (#22).
- Integration and E2E tests covering layout switching across 60%, 75%, and 100% and validating keycap legend visibility across artwork keycap sets (#22).
- Interactive two-dimensional keyboard testing on the summary page, with physical and pointer key highlights, layout-aware typing, shifted-symbol support, and matching one-press sounds for every switch.
- Google OAuth entry point and a guest-first Profile surface with saved Builds, explicit local guest-draft preservation on sign-out, and clear payment availability states.
- Vercel SPA history fallback so direct links such as `/builder` resolve to the app shell.
- Selected-switch Web Audio playback with linked self-recorded samples, mute/volume controls, accessible status and failure reporting (#17).
- Linked dedicated Gazzew Boba recordings to U4 and U4T (#17).
- Architectural Decision Record [`docs/adr/0006-team-recorded-audio-assets.md`](docs/adr/0006-team-recorded-audio-assets.md) documenting self-recorded switch-audio assets, profile coverage, and missing-variant handling (#17).
- Responsive About Us page with keyboard visual, platform story, feature cards, store details, and Keyboard Builder calls to action.
- Architectural Decision Record [`docs/adr/0008-hybrid-six-group-builder-architecture.md`](docs/adr/0008-hybrid-six-group-builder-architecture.md) establishing the 6-group hybrid keyboard builder architecture (Case, Plate, PCB, Switches, Keycaps, Add-ons), 3-layer 3D visual preview boundary, preselected Add-ons, and database-driven compatibility feedback (#22).
- Architectural Decision Record [`docs/adr/0007-temporary-8-part-catalog-schema.md`](docs/adr/0007-temporary-8-part-catalog-schema.md) documenting the temporary retention of the 8-part Supabase catalog schema as technical debt (superseded by ADR-0008).
- Claude agent configuration and entrypoint in [`CLAUDE.md`](CLAUDE.md).
- System architecture documentation, directory outline, and technical seams in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Structured 6-step recipe for implementing new domain and UI features in [`docs/ADDING-A-FEATURE.md`](docs/ADDING-A-FEATURE.md).
- Standardized Architecture Decision Record template in [`docs/adr/ADR-TEMPLATE.md`](docs/adr/ADR-TEMPLATE.md).
- Contributor guidelines and workflow standards in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).
- Pull request template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) with issue closing link, key changes, screenshot section, and verification checklist.
- Repository changelog in [`CHANGELOG.md`](CHANGELOG.md) tracking milestones and unreleased changes following Keep a Changelog 1.1.0.

### Changed
- Updated environment documentation and server secrets to use `TOKENROUTER_API_KEY`, `TOKENROUTER_BASE_URL` (default `https://api.tokenrouter.com/v1`), and `TOKENROUTER_MODEL` (default `z-ai/glm-5.3-flash`) for server-side advisor recommendations (#19).
- Simplified global navigation to plain-text links and a separate slim Progress row; moved the phone/tablet hamburger to the far right and expanded its accessible menu to fill the viewport.
- Compacted the `/build` checkout bar with an inline total and side-by-side phone actions while retaining 44px touch targets.
- Removed the unused Address book placeholder from the Profile page so a signed-in customer's order history uses the full available row.
- Moved the interactive two-dimensional keyboard tester and its audio controls into the Type tester summary tab, with a responsive layout for the available panel space.
- Shared mute and volume controls and Web Audio helpers between the selected-switch player and the Type tester, and standardized recording assets as one-press samples.
- Reworked virtual keyboard switch playback to use Web Audio API decoding and one-shot audio buffers without changing the keyboard interface.
- Refactored the `/build` review page ([`src/views/SummaryView.vue`](src/views/SummaryView.vue)) header to replace the redundant "Name your build" card and generic title with an enthusiast-grade in-place editable heading (`${L}% Custom Mechanical Keyboard`), subtitle spec badges (layout, switch feel, case material), and a floating `Save build` button, while preserving the three diagnostic cards (*Loudness*, *Typing feel*, *Weight*) in their exact format.
- Switched the frontend and shared switch catalogues to MP3 recordings; removed the M4A originals after verifying all catalogue samples decode and play in Chromium.
- Expanded the switch-audio player with pause/resume, seeking, playback progress, and responsive card controls; linked Gazzew Boba U4 to its dedicated recording (#17).
- Moved the switch-audio card below the Switches description, compacted its controls, and replaced visible status text and the Mute label with accessible status and an icon (#17).
- Moved the `Reset view` button beside the `3D Build Preview` title row in [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) and grouped camera preset pills on a single line to prevent 3rd-row wrapping (#22).
- Made `state.build` the authoritative source for the 3D build preview in [`src/views/PartsView.vue`](src/views/PartsView.vue), keeping the domain build store in sync on every Part selection; defensive fallbacks remain in place until the two stores are merged (#22).
- Superseded ADR-0007 with ADR-0008, formalizing team consensus to condense 8 physical layers into 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, Add-ons) to eliminate desktop horizontal scrolling while bundling Foam, Stabilizers, and Cable into preselected Add-ons (#22).
- Aligned `CONTEXT.md`, `docs/specs/keyboard-builder.md`, and `docs/ARCHITECTURE.md` with ADR-0008, updating Build, Part, Barebones kit, Compatibility definitions, 6 Component Groups, 3-layer 3D visual preview boundary (Keycaps, Switches, Base/Case), 2D internal imagery, floating navigation shortcut, and red badge + top warning banner compatibility feedback.
- Documented collaboration conventions, branching strategy, Conventional Commits, dependency management, and environment variable synchronization.
- Standardized code documentation requirements across collaboration guides, mandating JSDoc docstrings for public exports/functions and inline comments for non-obvious logic when agents or contributors write code.

### Fixed
- Restored the `/build` review page styles for the part status tags, flagged table rows, action bar and panel headers, and removed the duplicated view-toggle rule in `SummaryView.vue`.
- The Parts page's bottom clearance is set only while that page is open, so `/build` and other pages keep their default. Disabled Part cards no longer show the hover border.
- Checkout function could not be deployed: `base` was declared twice. The HitPay URL is now `hitpayBase`.
- Checkout asks the customer to confirm a changed subtotal before it starts payment (HTTP 409 with `priceChanged`), instead of charging the new price silently.
- Checkout returns 503 for server or database faults and 400 only for problems with the cart. Voucher lookup errors are no longer treated as invalid codes.
- Catalogue loader and checkout reject parts whose price (or weight) is missing or not a finite, non-negative number.
- `supabase/schema.sql` runs again on an existing database (policies are dropped before they are created), grants signed-in customers read access to their orders, and documents the rollout order.
- App startup waits at most 2 seconds for the Supabase catalogue, then uses the local copy.
- Removed the unnecessary keyboard tester host tab stop and its outline suppression; physical-key listeners remain on `window`, and audio controls retain their focus indicators (#IMP-9).
- Added a regression assertion to keep the Build summary actions readable as `← Change parts` and `Add to cart →` (#IMP-11).
- Matched the 100% virtual keyboard to its spaced function-key groups, right-side navigation and arrow clusters, and 104-key geometry; fixed physical numpad presses to highlight numpad keycaps.
- Matched the 75% virtual keyboard to its 84-key layout, including Backquote, the right-side navigation keys, and the four-key arrow cluster, with physical presses highlighting the corresponding rectangles.
- Matched virtual keyboard key IDs to the drawn geometry for 60%, 75%, and 100% layouts, removed empty slots and duplicate Escape activation, and rejected hostile persisted layout values before rendering.
- Kept keyboard tester focus accessible without moving focus on page load, hid decorative SVG keys from assistive technology, preserved mute-button focus, and limited touch-action suppression to the keyboard.
- Prevented the About Us OneMap store locator from updating a removed map after visitors navigate away during a driving-route lookup; improved the map's interactive accessibility semantics and added direct OneMap store links.
- Restored switch-audio player styling in the active frontend stylesheet so controls render correctly in the builder.
- Made switch-audio load/decode errors visible, guarded late decode results when the selected Part changes, delayed seek restarts until slider adjustment completes, and made the player safe for missing Part data.
- Consolidated switch-audio styling under the governed design tokens, restored the mute control's 44px touch target, and corrected the story-section `.wrap` scope.
- Kept volume changes audible after mute, removed toggle semantics from the changing Play/Pause action, and added the legacy WebKit AudioContext fallback.
- Recreated closed Web Audio contexts, resumed interrupted contexts, kept playback progress out of rapid ARIA updates, and committed keyboard seeks with visible failure handling.
- Removed per-material shader recompiles and the multi-second drop animation stall on software-rendered or weak GPUs in [`src/lib/buildPreviewScene.js`](src/lib/buildPreviewScene.js): switch materials only flag `needsUpdate` when transparency actually changes, and a frame slower than 120 ms snaps the assembly animation to its settled state (#22).
- Kept the procedural 3D Build Preview visible when only the `.glb` fetch fails instead of hiding it behind a false "WebGL could not be initialized" alert, restored the screen-reader live region that announces layout and restore changes, reused the memoised keycap UV projection so part picks no longer re-project every vertex, and repainted keycaps in their colourway colours when an artwork texture fails to load (#22).
- Skip the 3D assembly drop animation on software-rendered GPUs (SwiftShader/llvmpipe, as used by headless browsers and CI runners) so selecting a Part applies instantly in a single render instead of blocking the main thread for seconds; real GPUs keep the animation (#22).

## [0.1.0] - 2026-10-18

### Added
- Vue 3 + Vite + Vue Router SPA foundation with Vitest unit/integration and Playwright Chromium E2E test suites and GitHub Actions CI (`def0ad5`, [ADR-0001](docs/adr/0001-frontend-foundation-stack.md)).
- Canonical 44-story keyboard builder product specification (`docs/specs/keyboard-builder.md`), domain glossary (`CONTEXT.md`), and integer-cent `Build`/`Part`/`Compatibility` domain engine (#2, `702e624`).
- Prototype landing page (`HomeView`), interactive Biscuit/FatCat mascot help system, and labelled demo community chat with null-safe Supabase seam (#8, `e6acb52`, `35b0056`).

### Changed
- Migrated styling system from initial Tailwind seed to Bootstrap 5.3.3 plus custom CSS tokens per `DESIGN.md` (#8, `e6acb52`, [ADR-0002](docs/adr/0002-bootstrap-styling.md)).

### Fixed
- Hardened shell styling, dark mode contrast, and demo chat keyboard/ARIA accessibility (#8, `47715a5`).

[Unreleased]: https://github.com/adhi-bn/WAD2-Project/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/adhi-bn/WAD2-Project/releases/tag/v0.1.0
