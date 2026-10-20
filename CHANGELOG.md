# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Guided card-by-card 6-layer educational journey (`src/lib/anatomyGuide.js`) on `HomeView` (#15, `T8a`) with synchronized 3D layer highlighting, camera focus tracking (`setFocusLayer`), and interactive chip navigation.
- Computed plate center and case bounding box parameters in `KEYBOARD_DIMENSIONS` ensuring procedural PCB and foam layers sit aligned inside the case enclosure in the assembled state and clear top-row cutouts without overhang.
- `explosionFactor` readout in `getStats()` and `window.__EXPLODED_ANATOMY__` DEV controller seam for test automation and screenshot verification.
- High-fidelity 156,874-triangle Blender `.glb` export for Attack Shark X85 (#15, `T8a`) with 81 shine-through keycap legend decals offset against dishes to prevent Z-fighting, 6 original PBT keycap colorways, translucent polycarbonate switch top housing, metallic copper pins, rose stem, brushed chrome rotary encoder knob, and RGB-backlit plate within a 3.91 MB payload ([ADR-0003](docs/adr/0003-threejs-3d-architecture.md)).
- Studio `RoomEnvironment` PMREM equirectangular lighting and dynamic under-switch RGB glow controller smoothly cycling across cyan/blue/violet on `Layer_Plate` and keycap engraving decals.
- Multi-primitive `THREE.InstancedMesh` matrix instancing in `explodedAnatomyScene.js` supporting multi-material switch prototypes across 81 matrix coordinates while reporting 81 switch positions in scene statistics.
- Educational 3D exploded keyboard anatomy section on `HomeView` (#15, `T8a`) visualizing the 6 physical layers (`Keycaps`, `5-pin Switches`, and `Barebones kit` bundled internals: `Plate`, `PCB`, `Foam`, `Case`) powered by Three.js and scroll-driven hermite interpolation.
- Hybrid Blender and Three.js 3D architecture combining Blender-sculpted keycaps, plate, and case assets with procedural 81-position switch matrix instancing and gasket acoustic stack layers ([ADR-0003](docs/adr/0003-threejs-3d-architecture.md)).
- Procedural fallback engine guaranteeing `< 40,000` triangles and `≤ 8` draw calls with zero external network or model loading dependencies.
- Resilient accessibility features including plain-HTML layer breakdown fallback, screen reader `aria-live` polite status announcements, interactive keyboard chip controls with `aria-pressed`, and static non-zero factor support for `prefers-reduced-motion`.
- Claude agent configuration and entrypoint in [`CLAUDE.md`](CLAUDE.md).
- System architecture documentation, directory outline, and technical seams in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Structured 6-step recipe for implementing new domain and UI features in [`docs/ADDING-A-FEATURE.md`](docs/ADDING-A-FEATURE.md).
- Standardized Architecture Decision Record template in [`docs/adr/ADR-TEMPLATE.md`](docs/adr/ADR-TEMPLATE.md).
- Contributor guidelines and workflow standards in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).
- Pull request template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) with issue closing link, key changes, screenshot section, and verification checklist.
- Repository changelog in [`CHANGELOG.md`](CHANGELOG.md) tracking milestones and unreleased changes following Keep a Changelog 1.1.0.

### Changed
- Tilted procedural PCB and gasket acoustic foam sheets by -KEYBOARD_DIMENSIONS.slopeRad centered at plateCenter, eliminating procedural layer overhang and ensuring internal layers remain concealed within the case when assembled.
- Paused continuous requestAnimationFrame render loop under prefers-reduced-motion in favor of single on-demand frame rendering, added finite number guards, and restored depthWrite on layer unhighlighting.
- Shifted desktop 3D model framing to preserve headline and copy legibility in the hero section and alongside guided layer inspection cards.
- Optimized exploded keyboard 3D model asset (`public/models/exploded-keyboard.glb`) by skipping SUBSURF on switch parts and lightly decimating the switch bottom housing via planar dissolve to reduce Switch_Prototype geometry from 7,160 to 2,106 triangles (~2.3k tris/switch, ~325k total runtime triangles with 81 instances), refined PBR materials with proper sRGB-to-linear color space conversions, calibrated keycap roughness to 0.7, tuned translucent switch top housing (#cfd6e0, alpha 0.78), set warm nylon bottom housing (#9a958c), rose switch stem (#D9468F), and balanced plate backlight emission strength to 0.35 ([ADR-0003](docs/adr/0003-threejs-3d-architecture.md)).
- Documented collaboration conventions, branching strategy, Conventional Commits, dependency management, and environment variable synchronization.
- Standardized code documentation requirements across collaboration guides, mandating JSDoc docstrings for public exports/functions and inline comments for non-obvious logic when agents or contributors write code.

### Fixed

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
