---
date: 2026-10-23
adr-number: 0008
status: Accepted
---

# 0008. Hybrid 6-Group Keyboard Builder Architecture

**Status**: Accepted

## Context

In team architecture discussions involving Choo Jian Hao, Lucas Lau Sing Wai, Ian Tan, and the broader team, key architectural challenges were identified regarding builder scope, user experience, visual complexity, and WebGL asset boundaries:

1. **Category Bloat vs. Horizontal Navigation**: The prototype application imported in PR #24 persisted parts across 8 granular physical layers (`case`, `plate`, `pcb`, `switches`, `keycaps`, `stabs`, `foam`, `cable`). Displaying all 8 categories as top-level picker tabs introduced severe horizontal scrolling and visual clutter on standard desktop screens (13–15" laptops), degrading the builder flow. Conversely, restricting the builder to the initial 3-part slot model (`barebones`, `switches`, `keycaps`) oversimplified the custom mechanical keyboard experience and restricted users from personalizing core components such as the mounting plate and PCB.
2. **3D Visual Performance and Mesh Alignment Complexity**: Dynamically loading, animating, and rendering all 8 distinct physical layers in a real-time WebGL canvas created immense technical overhead:
   - Creating 8 high-fidelity 3D assets for every catalog permutation exceeds reasonable file size (≤ 5.0 MB) and triangle budgets (≤ 200,000 tris).
   - Dynamic real-time layering of internal foams, plates, and PCBs introduced mesh-clipping and Z-fighting issues.
   - Mobile and mid-range devices suffered WebGL context thrashing and reduced frame rates.
3. **Compatibility and Accessory Overhead**: Beginners were overwhelmed by having to separately select stabilizers, foam dampeners, and USB cables. Furthermore, physical compatibility (matching layout sizes like 60%, 75%, 100% and ensuring hot-swap switch sockets) required an authoritative, schema-driven validation mechanism with clear, non-destructive user feedback.

A formal architectural consensus was reached to replace the temporary technical debt framing of [ADR-0007](0007-temporary-8-part-catalog-schema.md) with a scalable, hybrid 6-group builder architecture.

## Decision

We adopt the **Hybrid 6-Group Keyboard Builder Architecture**, structured around the following six foundational decisions:

### 1. 6 Component Groups Architecture
The keyboard builder condenses the 8 physical layers into **6 canonical Component Groups**:
1. **Case**: The structural exterior housing of the keyboard, determining layout size and material.
2. **Plate**: The mounting plate supporting the switches.
3. **PCB**: The printed circuit board providing electrical routing, hot-swap sockets, and microcontroller firmware.
4. **Switches**: The mechanical key switches that register keystrokes.
5. **Keycaps**: The sculpted keycaps that mount onto the switch stems.
6. **Add-ons**: The bundled secondary accessory components.

Condensing the categories into 6 groups ensures all primary tabs fit cleanly across desktop viewports without horizontal scrolling or navigation overflow, providing a focused, balanced decision flow.

### 2. Bundled Add-ons Category
Secondary accessory components — **Foam**, **Stabilizers**, and **Cable** — are bundled into a single **Add-ons** category:
- **Preselected Defaults**: When a user enters the builder via direct entry or completes the preference quiz, Add-ons are preselected by default with compatible, high-quality components from the starter build.
- **Agency with Simplicity**: Novice builders can assemble a complete, working keyboard without getting bogged down in stabilizer tuning or foam thickness choices, while enthusiast users retain full agency to swap or customize add-on selections.

### 3. 3-Layer 3D Visual Preview Boundary
We establish a strict architectural boundary for the builder's interactive 3D WebGL canvas:
- The 3D canvas animates and dynamically updates only **3 active visual layers**:
  1. **Keycaps**
  2. **Switches**
  3. **Base (Case)**
- **Internal Component Decoupling**: Selections for internal hardware (Plate, PCB, Foam, Stabilizers) update background reactive state, pricing, and compatibility, but do **NOT** visually alter or mutate 3D model geometry or exploded rendering.
- **Visual Stability**: This boundary eliminates mesh-clipping, Z-fighting, and asset bloat, ensuring 3D rendering stays performant, responsive, and resilient across mobile and desktop devices. (The full 6-layer exploded visualization remains isolated to the educational Exploded Anatomy surface on `/know`, governed by [ADR-0003](0003-threejs-3d-architecture.md)).

### 4. 2D Component Images for Internal Parts
Internal components (Plate, PCB, Foam, Stabilizers) and Cable are visualized using high-fidelity **2D product imagery** and detailed specifications on their respective option cards, ensuring clear visual representation without WebGL performance penalties.

### 5. Database-Driven Compatibility Validation & Feedback
Hardware compatibility is validated against database-driven JSON schema flags:
- **Layout Size**: Verifies that the Case, Plate, and PCB share the identical form factor (e.g., 60%, 75%, 100%).
- **Socket Type**: Verifies that switch pin counts and PCB sockets match (e.g., 5-pin hot-swap).
- **Feedback Mechanism**:
  - Incompatible parts display a prominent **red badge** on their respective selection card.
  - A persistent **top warning banner** renders at the top of the builder view, explaining the specific hardware conflict in plain language.
  - **Progression Blocking**: Incompatible builds cannot proceed to final summary or checkout until the conflict is resolved, preventing users from purchasing non-fitting parts. Selections are preserved so the user can resolve the issue manually.

### 6. Builder Navigation Shortcut
To facilitate rapid switching between the 6 component groups without sequential paging or repetitive clicking, the builder incorporates a **floating navigation shortcut button**:
- Hovering or clicking the button displays a contextual tooltip menu listing all 6 Component Groups with completion indicators.
- Users can jump directly to any group (e.g., jump from Keycaps straight to PCB) in a single interaction.

## Alternatives Considered

- **Strict 3-Slot Model (`barebones`, `switches`, `keycaps`)**:
  - *Description*: Enforce the original minimal model from ADR-0001 / ADR-0007.
  - *Rejected*: Deprives users of customizing plates (brass, FR4, aluminum) and PCBs (ANSI, ISO, hot-swap), which are defining features of custom mechanical keyboards.
- **Full 8-Tab Independent Builder**:
  - *Description*: Maintain 8 separate tabs for every granular layer (`case`, `plate`, `pcb`, `foam`, `switches`, `keycaps`, `stabs`, `cable`).
  - *Rejected*: Causes horizontal tab overflow on standard desktop screens and demands 8 distinct 3D asset layers, causing mobile WebGL stutter and high development overhead.
- **Pure 2D Builder (Removing 3D entirely)**:
  - *Description*: Drop Three.js in favor of static 2D product pictures.
  - *Rejected*: Eliminates the flagship interactive experience of Lechaton Typers; 3D visualization of the exterior keyboard (Case, Switches, Keycaps) is central to the project vision.

## Consequences

- **Positive**:
  - Eliminates horizontal scrolling on desktop displays by fitting all 6 groups cleanly within standard viewports.
  - Balances enthusiast customization (Case, Plate, PCB) with beginner accessibility (preselected Add-ons).
  - Keeps 3D asset budgets and WebGL draw calls low by restricting real-time mesh mutations to exterior layers (Keycaps, Switches, Case).
  - Enforces rock-solid compatibility via schema flags with unmistakable visual cues (red badges and top warning banner).
  - Improves UX speed via the floating navigation shortcut button.
- **Negative / Trade-offs**:
  - Internal parts (Plate, PCB) do not reflect custom geometry in the 3D canvas, relying instead on 2D imagery.
  - The reactive store and catalog schemas require alignment to support 6 component slots and bundled Add-ons defaults.
- **Migration & Implementation Plan**:
  1. **Documentation Alignment**: Update `CONTEXT.md`, `docs/specs/keyboard-builder.md`, `docs/ARCHITECTURE.md`, and superseding notes in `docs/adr/0007-temporary-8-part-catalog-schema.md`.
  2. **Schema & Catalog**: Ensure the catalog layer and Supabase tables support 6 group classifications, Add-ons subcategories (`foam`, `stabs`, `cable`), and compatibility flags (`layout_size`, `socket_type`).
  3. **Domain & Store**: Align `src/domain/` rules and `src/stores/build.js` to manage the 6 Component Groups, compute budget and compatibility against the 6 slots, and seed Add-ons from starter builds.
  4. **Builder UI & 3D Integration**: Update builder tabs to 6 groups, attach 3D canvas rendering strictly to Case, Switches, and Keycaps, and render 2D imagery for internal parts alongside the floating navigation shortcut.
