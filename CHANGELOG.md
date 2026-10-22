# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Responsive About Us page with keyboard visual, platform story, feature cards, store-details placeholder, and Keyboard Builder calls to action.
- Claude agent configuration and entrypoint in [`CLAUDE.md`](CLAUDE.md).
- System architecture documentation, directory outline, and technical seams in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Structured 6-step recipe for implementing new domain and UI features in [`docs/ADDING-A-FEATURE.md`](docs/ADDING-A-FEATURE.md).
- Standardized Architecture Decision Record template in [`docs/adr/ADR-TEMPLATE.md`](docs/adr/ADR-TEMPLATE.md).
- Contributor guidelines and workflow standards in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).
- Pull request template in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) with issue closing link, key changes, screenshot section, and verification checklist.
- Repository changelog in [`CHANGELOG.md`](CHANGELOG.md) tracking milestones and unreleased changes following Keep a Changelog 1.1.0.

### Changed
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
