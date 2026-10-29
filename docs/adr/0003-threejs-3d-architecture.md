# 0003. Three.js and Blender hybrid 3D architecture

**Status**: Accepted

## Context

Lechaton Typers requires 3D visualization across two distinct surfaces: an educational landing experience demonstrating how keyboard layers stack together, and a reactive assembly viewer in the keyboard builder. Raw CAD and unoptimized 3D models typically contain hundreds of thousands of polygons and unbatched meshes that cause performance bottlenecks or WebGL context loss on mobile devices. Conversely, purely procedural Three.js geometry lacks the ergonomic sculpts, fillets, and authentic tactile aesthetic required for realistic keycaps, switches, and cases. A clear architectural separation of 3D responsibilities, geometry budgets, and fallback mechanisms is needed.

## Decision

Adopt a hybrid architecture combining optimized Blender `.glb` assets, procedural Three.js geometry slabs, and strict WebGL lifecycle management, separating the feature set into two isolated 3D surfaces:

1. **Separation of 3D Surfaces**:
   - **Exploded anatomy** (`HomeView.vue`): A fixed, scroll-driven 6-layer visual breakdown (Keycaps, 5-pin Switches, and the Barebones kit's Plate, PCB, Foam, and Case) that showcases how a keyboard stacks together, synchronized with a guided card-by-card educational journey (`anatomyGuide.js`) with active layer isolation and damped camera focus tracking. It operates independently of builder Part pickers.
   - **Build preview** (`PartsView.vue` / `BuildPreviewCanvas.vue`): An interactive 3D assembly with `OrbitControls` that dynamically reacts to the user's selected Parts (Barebones kit, Switches, Keycaps), animating Part insertions and updating materials, colours, and layout across 60%, 75%, and 100% form factors.

2. **Hybrid Blender `.glb` and Procedural Architecture**:
   - High-fidelity exterior meshes (case, keycaps with shine-through legend decals, 4-component switch prototype) are adapted from Blender CAD assets and served from layout-specific GLB models in `public/models/`:
     - `keyboard-60.glb`: 3,777,808 bytes (~3.60 MiB) for the 60% form factor (61 keys).
     - `exploded-keyboard.glb`: 4,096,872 bytes (~3.91 MiB) for the default 75% form factor (81 keys/knob).
     - `keyboard-100.glb`: 5,331,312 bytes (~5.08 MiB) for the full-size 100% form factor (104 keys/numpad).
   - Asset payload budget targets strictly **< 5.5 MB** per layout model (with all assets measured between 3.60 MiB and 5.08 MiB), preserving authentic bevels, dish curvature, and rotary knob chrome finishes without destructive decimation. This cap is justified by:
     - **Lazy per-layout fetch**: Only the `.glb` for the selected form factor is downloaded on demand when the customer switches layouts.
     - **In-memory cache**: Downloaded `ArrayBuffer` payloads are cached client-side in `glbCache`, eliminating repeat downloads on layout toggles.
     - **In-flight deduplication**: Concurrent or rapid layout switches share in-flight promises via `inFlightGlbPromises`.
     - **Zero download on Part swaps**: Changing Part materials, colors, switch stems, or plate finishes modifies Three.js materials in memory without downloading additional `.glb` files.
   - Repeated matrix elements use `THREE.InstancedMesh`, supporting multi-primitive switch prototypes (one `THREE.InstancedMesh` per material primitive: switch bottom housing, translucent polycarbonate top housing, metallic copper pins, and rose stem) scaled to the form factor's switch count (61 instances for 60%, 81 instances for 75%, 104 instances for 100%).
   - Runtime geometry in **hybrid GLB + `THREE.InstancedMesh` mode** scales with layout density:
     - 60% layout: ≈ 255k triangles (~255,000)
     - 75% layout: ≈ 327k triangles (~327,000)
     - 100% layout: ≈ 399k triangles (~399,000)
     Across all layouts, hybrid geometry totals **~255k–400k triangles**, and hybrid draw calls measure **≈19–21**, well within a hard cap of **≤ 25 draw calls**.
   - Studio lighting combines directional keys with `RoomEnvironment` PMREM equirectangular environment mapping and dynamic under-switch RGB backlighting (emissive polycarbonate plate and shine-through legend decals smoothly cycling across cyan/blue/violet).
   - Missing internal planar slabs (`Plate`, `PCB`, `Foam`) bundled inside the Barebones kit are synthesized procedurally in Three.js when running standalone or in fallback mode.
   - A complete **procedural geometry fallback** (< 50,000 triangles, 5–10 draw calls) is guaranteed when `.glb` assets are absent, offline, or loading/parsing fails.

3. **Resilience and Accessibility Invariants**:
   - **WebGL Fallback**: When WebGL is unavailable, render an accessible plain-HTML summary of selected Parts and layer information.
   - **Resource Management**: Automatically dispose of GPU resources (geometries, materials, textures) on component unmount.
   - **Performance Throttling**: Pause rendering when hidden or off-screen using `IntersectionObserver`.
   - **Motion Preference**: Honour `prefers-reduced-motion` by disabling scroll and fit animations in favor of static states.

## Why

This hybrid strategy balances fidelity and performance. Loading sculpted keycap and switch profiles from optimized Blender assets delivers authentic tactile visuals, while instancing and procedural internal slabs keep polygon and draw-call budgets within mobile-safe thresholds (~255k–400k triangles and ≤ 25 draw calls in hybrid GLB+InstancedMesh mode; < 50,000 triangles and 5–10 draw calls in procedural fallback mode). Per-layout GLB payloads remain strictly under 5.5 MB (3.60–5.08 MiB) and are lazy-loaded with in-memory caching and in-flight deduplication so that Part color and material swaps incur zero extra network transfers. Isolating the Exploded anatomy from the reactive Build preview keeps the landing page lightweight and decouples educational storytelling from the reactive state of the Part builder.

## Considered Options

- **Option A (Pure Procedural Three.js Geometry)**: Generate all geometries via Three.js primitives and CSG. Rejected as sole approach due to lower visual fidelity on sculpted keycaps and switches, though retained as an offline/error fallback (< 50,000 triangles, 5–10 draw calls).
- **Option B (Unoptimized Full Static `.glb`)**: Export complete keyboard assemblies directly from CAD or BlenderKit. Rejected because raw CAD/BlenderKit exports have 350k+ polygons and 400+ draw calls that crash mobile WebGL, and downloading unbatched models per Part swap creates massive network payloads.
- **Option C (Hybrid `.glb` + `THREE.InstancedMesh` + Procedural Internal Slabs)**: Blend optimized exterior Blender meshes with procedural internal slabs and GPU instancing across 60%, 75%, and 100% layouts (< 5.5 MB per-layout GLB payload, ~255k–400k runtime triangles, ≤ 25 draw calls). Chosen because it achieves high-craft schematic fidelity where visual nuance matters (without claiming photorealistic, acoustic, or engineering accuracy per spec), maintains strict draw-call and polygon limits, and guarantees full offline fallback resilience (< 50,000 triangles, 5–10 draw calls).
