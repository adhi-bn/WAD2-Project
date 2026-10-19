# Architecture

This document outlines the technical architecture, directory structure, data flow, styling system, and testing strategy for **Lechaton Typers**.

For domain terminology and concepts, refer to [CONTEXT.md](../CONTEXT.md). For visual tokens, typography, and color rules, refer to [DESIGN.md](../DESIGN.md).

---

## Stack

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| **Framework** | Vue 3 SPA (plain JS ESM) + Vue Router 5 | Single-page application using Vue 3 Composition API (`<script setup>`) with HTML5 history mode routing (`createWebHistory`). Standard ECMAScript modules without TypeScript. |
| **Build** | Vite 8 (`@vitejs/plugin-vue`) | Lightning-fast native ESM dev server with optimized production bundling. |
| **Styling** | Bootstrap 5.3.3 + Custom CSS (`src/style.css`) | Bootstrap 5 grid layout and utility classes paired with custom brand classes and tokens (`.brand`, `.navlink`, `.ui-btn`, `.scard`, `.lct-*`) adhering to `DESIGN.md`. No conflicting utility frameworks (Tailwind was removed in #8). |
| **Backend Seam** | `@supabase/supabase-js` + `src/lib/http.js` | Lazy, null-safe Supabase client (`src/lib/supabase.js`) returning `null` when credentials are absent, guaranteeing offline/guest workflows never crash. A lightweight JSON fetch wrapper (`src/lib/http.js`) handles async REST calls. |
| **Unit & Integration Tests** | Vitest 5 + `@vue/test-utils` + `jsdom` | Vitest leverages the Vite configuration directly. Pure domain unit tests run without DOM overhead; component and store integration tests run in `jsdom`. |
| **E2E Tests** | Playwright (Desktop Chromium) | End-to-end browser tests asserting real DOM rendering, navigation, and user flows against the Vite dev server. |
| **Deployment** | Vercel SPA | Static site hosting configured with client-side history route rewrites. |

---

## Directory Layout

```
.
├── docs/{adr,agents,specs}/         # Architecture Decision Records, agent guides, and product specs
├── src/
│   ├── components/                  # Reusable UI components
│   ├── domain/                      # Pure, framework-agnostic business logic
│   ├── lib/                         # External seams and API wrappers (supabase.js, http.js)
│   ├── router/                      # Vue Router configuration and route declarations
│   ├── stores/                      # Reactive state singletons
│   └── views/                       # Route views
└── tests/{unit,integration,e2e}/    # Pure domain unit, component integration, and Playwright E2E suites
```

---

## Data Flow & Module Boundaries

Lechaton Typers enforces a strict unidirectional data flow:

```
Vue Router (URL) ──> Views (src/views/)
                          │
                          ▼
                  Components (src/components/)
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
   Reactive Store (src/stores/)   Pure Domain (src/domain/)
           │                             ▲
           │                             │ (pure calculations)
           ▼                             │
  External Seams (src/lib/) ─────────────┘
```

### Module Boundaries

1. **Pure Domain Logic (`src/domain/`)**:
   - Framework-agnostic plain JavaScript functions (e.g., `checkCompatibility`, `computeBudget`).
   - Zero dependencies on Vue, the DOM, or external packages.
   - **Integer-Cent Currency Math**: Currency calculations operate strictly in integer cents using canonical decimal string parsing (`toCents`) to eliminate IEEE-754 floating-point inaccuracies. Price limits and sums must safely round-trip between numbers and integer cents.
   - Domain functions return descriptive diagnostic objects (e.g., `{ compatible, reasons, incomplete, incompatible }` and `{ total, withinBudget, error }`) instead of raising UI exceptions.

2. **Reactive Stores (`src/stores/`)**:
   - Module-level reactive singletons using Vue's `reactive()` and `computed()`.
   - Store state manages user selections across the three Part slots: `barebones`, `switches`, and `keycaps`, plus the target `limit`.
   - Derived values (`compatibility`, `budget`) are computed by invoking the pure domain functions, preventing UI components from reimplementing business rules.
   - State modifications occur via designated updater functions (e.g., `setSlot`, `setLimit`).

3. **Views & Components (`src/views/`, `src/components/`)**:
   - `src/views/` correspond to top-level routes declared in `src/router/index.js`.
   - Components read from reactive stores and dispatch actions via store helpers or router navigation.
   - UI components never execute domain math or validation directly; they consume store computed properties.

4. **Null-Safe External Seams (`src/lib/`)**:
   - `src/lib/supabase.js` exports `getSupabase()` (and `createSupabaseClient(url, key)`), which lazily instantiates the Supabase client. If environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are missing, `getSupabase()` returns `null`.
   - Consumers (such as the Biscuit demo chat and future persistence handlers) must always check `if (!supabase)` and provide full fallback functionality (e.g., local state persistence, clear status messaging). The application never crashes when running without cloud credentials.
   - `src/lib/http.js` provides `fetchJson()`, a minimal wrapper around `window.fetch` that handles response status validation and JSON parsing.

---

## Styling Architecture

The styling system combines standard Bootstrap utilities for structure with a dedicated custom class namespace for brand expression, governed by [DESIGN.md](../DESIGN.md) and [docs/adr/0002-bootstrap-styling.md](adr/0002-bootstrap-styling.md):

1. **Bootstrap 5.3.3**:
   - Used strictly for responsive layout grids (`container`, `row`, `col-*`), flexbox layout, and common utility spacing (`py-*`, `mb-*`).
   - Imported once globally in `src/main.js` via `bootstrap/dist/css/bootstrap.min.css`.
   - Bootstrap's default component classes (`.btn`, `.card`, `.modal`) are **not** customized or overridden directly to avoid framework coupling and selector specificity wars.

2. **Custom Class Namespace (`src/style.css`)**:
   - Brand components use explicit custom class prefixes: `.brand`, `.navlink`, `.ui-btn`, `.scard`, `.wrap`, and `.lct-*`.
   - Design tokens from `DESIGN.md` are mapped to CSS custom properties on `:root` (e.g., `--lct-accent-indigo`, `--lct-card-surface`, `--lct-radius-card`).

3. **Theme & Dark Mode Support**:
   - The palette responds to the user's OS preference via `@media (prefers-color-scheme: dark)`.
   - An explicit override hook is supported via `:root[data-theme="dark"]` and `:root[data-theme="light"]`.

4. **Brand Rules**:
   - Visual design rules (Single-Voice Accent, Event Amber Rule, Mono for Money, and accessibility status indicators) are defined authoritatively in [DESIGN.md](../DESIGN.md). All components and styles must adhere to these tokens and conventions rather than defining duplicate rules.

---

## Testing Architecture

The codebase maintains a three-tiered testing strategy:

```
┌────────────────────────────────────────────────────────┐
│  Tier 3: E2E Tests (Playwright Chromium)               │
│  - Full browser automation, routing, hydration smoke   │
├────────────────────────────────────────────────────────┤
│  Tier 2: Integration Tests (Vitest + jsdom + VTU)      │
│  - Component mounting, store wiring, keyboard/focus,   │
│    null-safe seam fallback behaviors                   │
├────────────────────────────────────────────────────────┤
│  Tier 1: Unit Tests (Vitest, pure Node.js)             │
│  - Pure domain rules, integer-cent money safety,       │
│    compatibility validation matrices                   │
└────────────────────────────────────────────────────────┘
```

### 1. Unit Tests (`tests/unit/`)
- **Scope**: Pure logic in `src/domain/` (e.g., [`tests/unit/build.test.js`](../tests/unit/build.test.js)).
- **Environment**: Vitest with Node.js runtime (no DOM required).
- **Focus**: Thorough verification of business rules: slot compatibility, missing vs incompatible distinction, 5-pin switch enforcement, integer-cent parsing, price boundary limits, and decimal safety.
- **Run**: `npm test`

### 2. Integration Tests (`tests/integration/`)
- **Scope**: Components (`src/components/`), views (`src/views/`), reactive stores (`src/stores/`), and seams (`src/lib/`).
- **Environment**: Vitest + `jsdom` + `@vue/test-utils`.
- **Focus**: Interaction testing, reactive state updates, dialog accessibility (focus trapping, Escape to close, focus return), and verifying that external seams behave safely when credentials are null or missing (`chat-nullsafe.test.js`, `seams.test.js`).
- **Run**: `npm test`

### 3. End-to-End Tests (`tests/e2e/`)
- **Scope**: The complete assembled application running against a live local server (`http://localhost:5173`).
- **Environment**: Playwright with Desktop Chromium.
- **Focus**: Smoke verification that the application bootstraps in a real browser engine, HTML head/title loads, router links navigate between views (`/` to `/builder`), and DOM elements render without fatal console errors.
- **Run**: `npm run test:e2e`
