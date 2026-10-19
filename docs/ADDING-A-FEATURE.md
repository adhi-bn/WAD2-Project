# Adding a Feature

This guide provides a structured 6-step workflow for implementing new features in **Lechaton Typers**. Following this order guarantees that domain boundaries remain clean, UI logic remains thin, accessibility and styling standards are respected, and test coverage is comprehensive.

---

## 1. Domain Vocabulary & Pure Logic (CONTEXT.md + src/domain/)

Before writing any UI code, ground the feature in the project's domain vocabulary and implement the core business logic as pure functions.

1. **Check Canonical Vocabulary**:
   - Consult [CONTEXT.md](../CONTEXT.md) and [docs/agents/domain.md](agents/domain.md) for canonical terms and banned synonyms. Propose additions in `CONTEXT.md` first before introducing new vocabulary in code.

2. **Implement Pure Logic in `src/domain/`**:
   - Keep functions completely framework-agnostic (zero imports from Vue, DOM, or external packages).
   - **Integer-Cent Currency Math**: Always represent money in integer cents using canonical decimal string parsing to avoid floating-point errors (see `toCents()` in `src/domain/build.js`).
   - Return descriptive, structured result objects (e.g., `{ compatible, reasons, incomplete, incompatible }`). Avoid throwing errors for standard business rule failures.
   - **Document Pure Functions**: Add JSDoc docstrings specifying purpose, input shapes (e.g., `{ price }`), and returned structures. Use inline comments to explain non-obvious algorithms, edge cases, and integer-cent conversions.

3. **Write Domain Unit Tests**:
   - Add unit tests in `tests/unit/<feature>.test.js`.
   - Test edge cases: missing inputs, boundary values, invalid types, and incompatible states.
   - Run tests:
     ```powershell
     npm test
     ```

---

## 2. Reactive State & Backend Seam (src/stores/ + src/lib/)

Bridge your pure domain logic with reactive application state and external services.

1. **Create or Extend Reactive Stores in `src/stores/`**:
   - Stores are module-level reactive singletons (plain ESM, no Pinia).
   - Derive state by invoking pure domain functions within `computed()` wrappers rather than duplicating domain rules.
   - Expose explicit updater functions (e.g., `setSlot()`, `setLimit()`) rather than mutating reactive state directly in views.
   - **Document Store State & Actions**: Include JSDoc headers on store updaters and inline comments on reactive triggers or side-effects.

2. **Interface with External Seams (`src/lib/`)**:
   - **Supabase Seam (`src/lib/supabase.js`)**: Always use `getSupabase()`. Remember that it returns `null` when environment variables are unset. Features must gracefully degrade to offline or guest operation when `getSupabase()` is `null`.
   - **HTTP Client (`src/lib/http.js`)**: Use `fetchJson(url, options)` for REST calls to remote APIs.
   - Add JSDoc docstrings and comments detailing expected network shapes and null-safe fallback handling.
   - Write integration tests in `tests/integration/` verifying both connected and disconnected/null-client scenarios.

---

## 3. Routes, Views & Components (src/router/, src/views/, src/components/)

Assemble the user interface using views and modular components.

1. **Declare Routes (`src/router/index.js`)**:
   - Add new page routes using `createWebHistory()`.
   - Keep route configurations declarative and lazy-load views if appropriate:
     ```javascript
     { path: '/my-feature', name: 'my-feature', component: MyFeatureView }
     ```

2. **Implement Views (`src/views/`)**:
   - Create route-level views in `src/views/` using `<script setup>`.
   - Connect views to the reactive store (`src/stores/`). Views orchestrate layout, page headings, and top-level user actions.

3. **Build Modular Components (`src/components/`)**:
   - Break complex interfaces into focused components in `src/components/`.
   - Use props for input data and `defineEmits` for events, or bind directly to store singletons where global synchronization is required.
   - Provide clear loading, error, and empty states.

---

## 4. Styling & Accessibility (DESIGN.md + Bootstrap 5 + src/style.css)

Style the feature according to the design system in [DESIGN.md](../DESIGN.md) and [docs/adr/0002-bootstrap-styling.md](adr/0002-bootstrap-styling.md).

1. **Bootstrap 5 for Layout**:
   - Use Bootstrap's responsive grid system (`container`, `row`, `col-12`, `col-md-*`) and utility classes (`d-flex`, `align-items-center`, `gap-*`, `py-*`).
   - Do not override Bootstrap's native `.btn`, `.card`, or `.modal` classes.

2. **Custom Namespace for Brand Styles (`src/style.css`)**:
   - Use custom component classes: `.brand`, `.navlink`, `.ui-btn`, `.scard`, `.lct-*`.
   - Use CSS custom properties for colors and radii (e.g., `var(--lct-accent-indigo)`, `var(--lct-radius-card)`).
   - Ensure the new UI looks correct in both light and dark modes (`prefers-color-scheme: dark` and `[data-theme="dark"]`).

3. **Design System & Typography Tokens**:
   - Refer directly to [DESIGN.md](../DESIGN.md) for typography hierarchy, font pairings, and color tokens (including Single-Voice Accent, Event Amber Rule, and Mono for Money). Avoid defining ad-hoc styling rules.

4. **Accessibility (a11y)**:
   - Provide visible focus indicators (`:focus-visible`).
   - Ensure modals trap focus, close on <kbd>Escape</kbd>, and return focus to the trigger on close.
   - For status indicators (e.g., compatibility or budget limits), pair color with text and icons—never communicate state with color alone.
   - Respect `prefers-reduced-motion` for animations.

---

## 5. Tiered Tests (tests/unit/, tests/integration/, tests/e2e/)

Validate the feature across all three test tiers before opening a pull request.

1. **Unit Tests (`tests/unit/`)**:
   - Verify all pure functions in `src/domain/` with Vitest:
     ```powershell
     npx vitest run tests/unit/<feature>.test.js
     ```

2. **Integration Tests (`tests/integration/`)**:
   - Test component rendering, store reactivity, user interactions, and seam fallbacks with `@vue/test-utils` and `jsdom`:
     ```powershell
     npx vitest run tests/integration/<feature>.test.js
     ```

3. **End-to-End Tests (`tests/e2e/`)**:
   - Add or update Playwright tests in `tests/e2e/` to verify user navigation, URL changes, and critical workflows in a real browser:
     ```powershell
     npm run test:e2e
     ```

4. **Run Full Verification**:
   - Verify that the entire test suite, build, and typecheck pass cleanly:
     ```powershell
     npm test
     npm run test:e2e
     npm run build
     ```

---

## 6. Changelog & Documentation (CHANGELOG.md + ADRs if applicable)

Ensure the feature is documented and recorded for teammates and users.

1. **Update `CHANGELOG.md`**:
   - Record the feature under the `[Unreleased]` section following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standards (`Added`, `Changed`, `Fixed`, `Removed`).
   - Include the pull request or issue reference (e.g., `- Add 5-pin switch compatibility validation (#12)`).

2. **Architecture Decision Records (ADRs)**:
   - If the feature introduces a new architectural pattern, changes a foundation dependency, or alters a system-wide boundary, create an ADR in `docs/adr/` using [docs/adr/ADR-TEMPLATE.md](adr/ADR-TEMPLATE.md).

3. **Specifications & Guides**:
   - Update `docs/specs/` or `docs/ARCHITECTURE.md` if routes, component trees, or external interfaces were altered.
