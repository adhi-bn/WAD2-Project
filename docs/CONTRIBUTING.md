# Contributing to Lechaton Typers

This guide details the standards, development workflows, and conventions for both human contributors and AI agents working on Lechaton Typers.

## Local Development

- For setup prerequisites (native Node 22, npm, Git), installation steps, and daily development commands, refer to [`README.md`](../README.md).
- To understand the system structure and guidelines for implementing new features, consult [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) and [`docs/ADDING-A-FEATURE.md`](ADDING-A-FEATURE.md).

## Issues & Triage

- All issues and specs live in GitHub Issues at [`adhi-bn/WAD2-Project`](https://github.com/adhi-bn/WAD2-Project/issues).
- Use the `gh` CLI commands and wayfinding operations outlined in [`docs/agents/issue-tracker.md`](agents/issue-tracker.md).
- Issues are triaged using the five canonical triage labels documented in [`docs/agents/triage-labels.md`](agents/triage-labels.md).

## Branches

- Always branch from `main` (or the active shared integration branch).
- Use structured branch names corresponding to the nature of the change:
  - `feat/<name>`: New feature or user-facing functionality (e.g., `feat/switches-picker`)
  - `fix/<name>`: Bug fix or defect resolution (e.g., `fix/chat-dark-mode-contrast`)
  - `chore/<name>`: Maintenance, tooling, CI, or scaffolding updates (e.g., `chore/vitest-upgrade`)
  - `docs/<name>`: Documentation additions or revisions (e.g., `docs/contributing-guidelines`)

## Commits

- Format all commits according to [Conventional Commits](https://www.conventionalcommits.org/).
- Allowed commit types: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Format: `<type>(<optional scope>): <description> (#<issue>)` or `<type>: <description> (#<issue>)`.
- Always reference the relevant GitHub issue number `(#N)` in the commit message.
- Examples:
  - `feat: add switches picker option card (#14)`
  - `fix: harden mascot bubble keyboard accessibility (#16)`
  - `docs: add contributing guide and PR template (#18)`
  - `chore: update dependencies and package-lock.json (#20)`

## Changelog

- Every user-visible feature, bugfix, or architectural change must add an entry under `## [Unreleased]` in [`CHANGELOG.md`](../CHANGELOG.md).
- Categorize entries under the appropriate Keep a Changelog subsections:
  - `### Added` for new features or capabilities.
  - `### Changed` for changes in existing functionality.
  - `### Fixed` for any bug fixes.
  - `### Removed` for deprecated or removed features.
- Append the issue or PR reference `(#N)` to each changelog item.

## Pre-PR Verification

Before opening a Pull Request, contributors and agents must run the following verification commands from the repository root:

```bash
npm test
npm run test:e2e
npm run build
```

- `npm test`: Runs Vitest unit and integration test suites (`tests/unit`, `tests/integration`).
- `npm run test:e2e`: Runs Playwright Chromium end-to-end smoke tests (run `npx playwright install chromium` once before running for the first time).
- `npm run build`: Executes the Vite production build to confirm zero compilation errors.

> [!IMPORTANT]
> **Zero `.env` Dependency for Tests**: All tests (`npm test` and `npm run test:e2e`) must pass cleanly **without `.env` credentials**. The app uses null-safe seams (e.g., `src/lib/supabase.js`) so that unconfigured local development and CI runs succeed without secret keys.

On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` directly without changing your system execution policy.

## Domain, Design & Architecture Rules

- **Domain Terms**: Adhere strictly to the domain language and banned synonyms defined in [`CONTEXT.md`](../CONTEXT.md) and [`docs/agents/domain.md`](agents/domain.md). Never substitute synonyms in code, commits, issues, or PRs.
- **Design System**: Follow the visual identity, tokens, and design rules (including Single-Voice Accent, Event Amber Rule, and Mono for Money) defined in [`DESIGN.md`](../DESIGN.md). Styling uses **Bootstrap 5.3.3** for layout utilities plus **custom CSS** (`src/style.css`), per [ADR-0002](adr/0002-bootstrap-styling.md); do not restyle Bootstrap's native component classes or import Tailwind CSS.
- **Architecture Decisions**: Review decisions in [`docs/adr/`](adr/). When proposing new architectural patterns, create an ADR based on [`docs/adr/ADR-TEMPLATE.md`](adr/ADR-TEMPLATE.md) documenting Context, Decision, and Why.

## Adding Dependencies

- Avoid adding unnecessary runtime dependencies; keep the bundle lean and maintainable.
- Prefer standard Web APIs and Vue 3 core capabilities before pulling in external libraries.
- When a dependency is required:
  - Install runtime dependencies with `npm install <package>` or dev dependencies with `npm install -D <package>`.
  - Always commit `package.json` and `package-lock.json` together in the same commit.
  - Teammates and CI install locked dependencies using `npm ci`. Never share or commit `node_modules`.

## Environment Variables

Any new environment variable must follow the 3-place synchronization rule documented in [`AGENTS.md`](../AGENTS.md) (`.env.example`, `src/lib/`, `README.md`).
