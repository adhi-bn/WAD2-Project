# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Interactive part-by-part 3D Build Preview in [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) powered by [`src/lib/buildPreviewScene.js`](src/lib/buildPreviewScene.js) with Three.js `OrbitControls`, smooth vertical drop/snap assembly animation, real-time Part material/color/stem updates without additional `.glb` asset downloads on Part material swaps (lazy-loading per-layout `.glb` assets only when switching between 60%, 75%, and 100% form factors), camera preset views (`Isometric`, `Top-down`, `Side profile`), Combine/Explode layer toggle, accessible plain-HTML selected parts summary, and graceful WebGL failure fallback ([#22](https://github.com/adhi-bn/WAD2-Project/issues/22)).
- Multi-layout 3D keyboard support across `60%`, `75%`, and `100%` form factors with layout switcher pills in [`src/views/PartsView.vue`](src/views/PartsView.vue), dynamic layout scale adjustments, and procedural barebones case silhouettes (`high-profile`, `low-profile`, `sandwich`).
- Custom keycap artwork textures (*Le Chaton Anime Mural* and *Great Wave Kanagawa*) and dual Top-Printed (`wasd.blend` authentic font) vs. Side-Printed keycap legend variations.
- Consolidated single-page Builder workflow in [`src/views/PartsView.vue`](src/views/PartsView.vue) (`/parts`) with automatic `/builder` route redirection, `/parts` direct entry initialization, and "Skip quiz, pick parts myself" quick links.
- Interactive layout selector segmented switcher (`60%` · `75%` · `100%`) in [`src/views/PartsView.vue`](src/views/PartsView.vue) within the `.summary-pills` header bar, allowing instant switching between 60%, 75%, and 100% keyboard layouts without retaking the quiz.
- Exported [`setLayout(layoutCode)`](src/store.js) in [`src/store.js`](src/store.js) dynamically updating layout answer state, recalculating catalog prices, weights, and key counts (61, 84, 104 keys), while preserving customer part selections.
- Reactive `layout` prop on [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) wired to `sceneController.setLayout`, updating 3D form-factor scale and announcing layout changes via `liveStatusText`.
- Integration and E2E tests covering layout switching across 60%, 75%, and 100% and validating keycap legend visibility across artwork keycap sets.
- Google OAuth entry point and a guest-first Profile surface with saved Builds, explicit local guest-draft preservation on sign-out, and clear address/payment availability states.
- Vercel SPA history fallback so direct links such as `/builder` resolve to the app shell.
- Selected-switch Web Audio playback with linked self-recorded samples, mute/volume controls, accessible status and failure reporting (#17).
- Linked dedicated Gazzew Boba recordings to U4 and U4T (#17).
- Architectural Decision Record [`docs/adr/0006-team-recorded-audio-assets.md`](docs/adr/0006-team-recorded-audio-assets.md) documenting self-recorded switch-audio assets, profile coverage, and missing-variant handling (#17).
- Responsive About Us page with keyboard visual, platform story, feature cards, store details, and Keyboard Builder calls to action.
- Architectural Decision Record [`docs/adr/0008-hybrid-six-group-builder-architecture.md`](docs/adr/0008-hybrid-six-group-builder-architecture.md) establishing the 6-group hybrid keyboard builder architecture (Case, Plate, PCB, Switches, Keycaps, Add-ons), 3-layer 3D visual preview boundary, preselected Add-ons, and database-driven compatibility feedback.
- Architectural Decision Record [`docs/adr/0007-temporary-8-part-catalog-schema.md`](docs/adr/0007-temporary-8-part-catalog-schema.md) documenting the temporary retention of the 8-part Supabase catalog schema as technical debt (superseded by ADR-0008).
- Claude agent configuration and entrypoint in [`CLAUDE.md`](CLAUDE.md).
- System architecture documentation, directory outline, and technical seams in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Structured 6-step recipe for implementing new domain and UI features in [`docs/ADDING-A-FEATURE.md`](docs/ADDING-A-FEATURE.md).
- Standardized Architecture Decision Record template in [`docs/adr/ADR-TEMPLATE.md`](docs/adr/ADR-TEMPLATE.md).
- Contributor guidelines and workflow standards in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).
- Pull request template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) with issue closing link, key changes, screenshot section, and verification checklist.
- Repository changelog in [`CHANGELOG.md`](CHANGELOG.md) tracking milestones and unreleased changes following Keep a Changelog 1.1.0.

### Changed
- Switched the frontend and shared switch catalogues to MP3 recordings; removed the M4A originals after verifying all catalogue samples decode and play in Chromium.
- Expanded the switch-audio player with pause/resume, seeking, playback progress, and responsive card controls; linked Gazzew Boba U4 to its dedicated recording (#17).
- Moved the switch-audio card below the Switches description, compacted its controls, and replaced visible status text and the Mute label with accessible status and an icon (#17).
- Moved the `Reset view` button beside the `3D Build Preview` title row in [`src/components/BuildPreviewCanvas.vue`](src/components/BuildPreviewCanvas.vue) and grouped camera preset pills on a single line to prevent 3rd-row wrapping.
- Made `state.build` the authoritative source for the 3D build preview in [`src/views/PartsView.vue`](src/views/PartsView.vue), keeping the domain build store in sync on every Part selection; defensive fallbacks remain in place until the two stores are merged.
- Superseded ADR-0007 with ADR-0008, formalizing team consensus to condense 8 physical layers into 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, Add-ons) to eliminate desktop horizontal scrolling while bundling Foam, Stabilizers, and Cable into preselected Add-ons.
- Aligned `CONTEXT.md`, `docs/specs/keyboard-builder.md`, and `docs/ARCHITECTURE.md` with ADR-0008, updating Build, Part, Barebones kit, Compatibility definitions, 6 Component Groups, 3-layer 3D visual preview boundary (Keycaps, Switches, Base/Case), 2D internal imagery, floating navigation shortcut, and red badge + top warning banner compatibility feedback.
- Documented collaboration conventions, branching strategy, Conventional Commits, dependency management, and environment variable synchronization.
- Standardized code documentation requirements across collaboration guides, mandating JSDoc docstrings for public exports/functions and inline comments for non-obvious logic when agents or contributors write code.

### Fixed
- Restored switch-audio player styling in the active frontend stylesheet so controls render correctly in the builder.
- Made switch-audio load/decode errors visible, guarded late decode results when the selected Part changes, delayed seek restarts until slider adjustment completes, and made the player safe for missing Part data.
- Consolidated switch-audio styling under the governed design tokens, restored the mute control's 44px touch target, and corrected the story-section `.wrap` scope.
- Kept volume changes audible after mute, removed toggle semantics from the changing Play/Pause action, and added the legacy WebKit AudioContext fallback.
- Recreated closed Web Audio contexts, resumed interrupted contexts, kept playback progress out of rapid ARIA updates, and committed keyboard seeks with visible failure handling.
- Removed per-material shader recompiles and the multi-second drop animation stall on software-rendered or weak GPUs in [`src/lib/buildPreviewScene.js`](src/lib/buildPreviewScene.js): switch materials only flag `needsUpdate` when transparency actually changes, and a frame slower than 120 ms snaps the assembly animation to its settled state.
- Kept the procedural 3D Build Preview visible when only the `.glb` fetch fails instead of hiding it behind a false "WebGL could not be initialized" alert, restored the screen-reader live region that announces layout and restore changes, reused the memoised keycap UV projection so part picks no longer re-project every vertex, and repainted keycaps in their colourway colours when an artwork texture fails to load.

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
