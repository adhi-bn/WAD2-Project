# 0003. Three.js and Blender hybrid 3D architecture

**Status**: Accepted

## Context

Lechaton Typers requires 3D visualization across two distinct surfaces: an educational landing experience demonstrating how keyboard layers stack together, and a reactive assembly viewer in the keyboard builder. Raw CAD and unoptimized 3D models typically contain hundreds of thousands of polygons and unbatched meshes that cause performance bottlenecks or WebGL context loss on mobile devices. Conversely, purely procedural Three.js geometry lacks the ergonomic sculpts, fillets, and authentic tactile aesthetic required for realistic keycaps, switches, and cases. A clear architectural separation of 3D responsibilities, geometry budgets, and fallback mechanisms is needed.

## Decision

Adopt a hybrid architecture combining optimized Blender `.glb` assets, procedural Three.js geometry slabs, and strict WebGL lifecycle management, separating the feature set into two isolated 3D surfaces:

1. **Separation of 3D Surfaces**:
   - **Exploded anatomy** (`HomeView.vue`): A fixed, scroll-driven 6-layer visual breakdown (Keycaps, 5-pin Switches, and the Barebones kit's Plate, PCB, Foam, and Case) that showcases how a keyboard stacks together, synchronized with a guided card-by-card educational journey (`anatomyGuide.js`) with active layer isolation and damped camera focus tracking. It operates independently of builder Part pickers.
   - **Build preview** (`BuilderView.vue`): An interactive 3D assembly with `OrbitControls` that dynamically reacts to the user's selected Parts (Barebones kit, Switches, Keycaps), animating Part insertions and updating materials, colours, and layout.

2. **Hybrid Blender `.glb` and Procedural Architecture**:
   - High-fidelity exterior meshes (case, keycaps with shine-through legend decals, 4-component switch prototype) are adapted from Blender CAD assets and served from `public/models/exploded-keyboard.glb`.
   - Asset budgets target **100,000–200,000 triangles** in the `.glb` (Attack Shark X85 export: 156,874 triangles, switch prototype simplified to 2,106 tris/switch, ~2.3k) and a payload size strictly under **5.0 MB** (3.91 MB / 4,096,872 bytes payload), preserving authentic bevels, dish curvature, and rotary knob chrome finishes without destructive decimation.
   - Repeated matrix elements use `THREE.InstancedMesh` (81 instances), supporting multi-primitive switch prototypes (one 81-instance `THREE.InstancedMesh` per material primitive: switch bottom housing, translucent polycarbonate top housing, metallic copper pins, and rose stem) with runtime geometry totaling ≈ 325,354 triangles (within 300k–380k budget in hybrid mode) while maintaining ≤ 15–20 draw calls.
   - Studio lighting combines directional keys with `RoomEnvironment` PMREM equirectangular environment mapping and dynamic under-switch RGB backlighting (emissive polycarbonate plate and shine-through legend decals smoothly cycling across cyan/blue/violet).
   - Missing internal planar slabs (`Plate`, `PCB`, `Foam`) bundled inside the Barebones kit are synthesized procedurally in Three.js when running standalone or in fallback mode.
   - A complete procedural geometry fallback (< 40,000 triangles, ≤ 8 draw calls) is guaranteed when the `.glb` asset is absent, offline, or loading fails.

3. **Resilience and Accessibility Invariants**:
   - **WebGL Fallback**: When WebGL is unavailable, render an accessible plain-HTML summary of selected Parts and layer information.
   - **Resource Management**: Automatically dispose of GPU resources (geometries, materials, textures) on component unmount.
   - **Performance Throttling**: Pause rendering when hidden or off-screen using `IntersectionObserver`.
   - **Motion Preference**: Honour `prefers-reduced-motion` by disabling scroll and fit animations in favor of static states.

## Why

This hybrid strategy balances fidelity and performance. Loading sculpted keycap and switch profiles from optimized Blender assets delivers authentic tactile visuals, while instancing and procedural internal slabs keep polygon and draw-call budgets within mobile-safe thresholds (≤ 10 draw calls, ≤ 50,000 triangles). Isolating the Exploded anatomy from the reactive Build preview keeps the landing page lightweight and decouples educational storytelling from the reactive state of the Part builder.

## Considered Options

- **Option A (Pure Procedural Three.js Geometry)**: Generate all geometries via Three.js primitives and CSG. Rejected as sole approach due to lower visual fidelity on sculpted keycaps and switches, though retained as an offline/error fallback.
- **Option B (Unoptimized Full Static `.glb`)**: Export complete keyboard assemblies directly from CAD or BlenderKit. Rejected because raw CAD/BlenderKit exports have 350k+ polygons and 400+ draw calls that crash mobile WebGL.
- **Option C (Hybrid `.glb` + `THREE.InstancedMesh` + Procedural Internal Slabs)**: Blend optimized exterior Blender meshes with procedural internal slabs and GPU instancing. Chosen because it achieves high-craft schematic fidelity where visual nuance matters (without claiming photorealistic, acoustic, or engineering accuracy per spec), maintains strict draw-call and polygon limits, and guarantees full offline fallback resilience.
