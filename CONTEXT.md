# Lechaton Typers

Custom mechanical-keyboard builder: users assemble a keyboard from compatible parts against a target budget.

## Language

**Build**:
A user-assembled keyboard made by choosing one Part in each of the 6 Component Groups (Case, Plate, PCB, Switches, Keycaps, and Add-ons), governed by [docs/adr/0008-hybrid-six-group-builder-architecture.md](docs/adr/0008-hybrid-six-group-builder-architecture.md).
_Avoid_: Configuration, custom keyboard

**Part**:
One selectable component for a Build, belonging to exactly one of the 6 Component Groups: Case, Plate, PCB, Switches, Keycaps, or Add-ons.
*(Note: As documented in [docs/adr/0008-hybrid-six-group-builder-architecture.md](docs/adr/0008-hybrid-six-group-builder-architecture.md), which supersedes [docs/adr/0007-temporary-8-part-catalog-schema.md](docs/adr/0007-temporary-8-part-catalog-schema.md), the builder architecture establishes a 6-group hybrid model condensing the physical layers to eliminate horizontal scrolling on desktop while preserving user agency).*
_Avoid_: Component, item

**Barebones kit**:
The base physical assembly of a Build. In the 6-group builder architecture, the structural foundation is customized across Case, Plate, and PCB, while secondary accessory components (Foam, Stabilizers, Cable) are bundled under Add-ons.
_Avoid_: Base, kit

**Component Groups**:
The 6 canonical builder selection categories:
1. **Case**: The structural exterior housing of the keyboard, determining layout size and material.
2. **Plate**: The mounting plate supporting the switches.
3. **PCB**: The printed circuit board providing electrical connections and hot-swap sockets.
4. **Switches**: The mechanical key switches that register keystrokes.
5. **Keycaps**: The sculpted caps that sit on switch stems.
6. **Add-ons**: The bundled secondary accessories (Foam, Stabilizers, Cable).
This 6-group configuration condenses the previous 8 granular layers to fit standard desktop displays without horizontal navigation overflow.
_Avoid_: Categories, tabs

**Add-ons**:
Secondary accessory components bundling Foam, Stabilizers, and Cable into a single category. Add-ons are preselected by default from the starter build or preference quiz recommendations, simplifying assembly for newcomers while allowing customization for enthusiasts.
_Avoid_: Extras, accessories, miscellaneous

**Compatibility**:
Whether the chosen components for a Build fit together physically and electrically. Validated against database-driven JSON schema flags for layout size (e.g., 60%, 75%, 100%) and socket type (e.g., hot-swap).
_Avoid_: Validity, match

**Incompatibility Badge / Banner**:
The visual and behavioral feedback shown when a component violates hardware compatibility rules (layout size: 60%/75%/100%, socket type: hot-swap) validated against schema flags. Incompatible components display a red badge on their option card and a top warning banner across the builder view, explaining the conflict and blocking progression/checkout until resolved.
_Avoid_: Error popup, blocker alert

**3D Build Preview Boundary**:
The architectural boundary governing the builder's interactive 3D canvas. The 3D view in the builder statically displays and updates only 3 active visual layers: Keycaps, Switches, and Base (Case). Internal components (PCB, Plate, Foam, Stabilizers) do NOT visually alter or mutate the 3D model geometry or exploded rendering, but register selection state and present high-fidelity 2D product imagery.
_Avoid_: Full 3D rendering, interior 3D view

**Budget**:
The user's target spend for a Build, compared against the total price of its selected Parts.
_Avoid_: Price, cost

**Saved build**:
A named Build retained in its owner's account for later editing, including unfinished drafts.
_Avoid_: Preset

**Lucky draw**:
A one-time per-account prize draw in the Helper mascot widget that may award a Voucher.

**Voucher**:
A time-limited percentage or fixed-amount discount awarded by the Lucky draw.
_Avoid_: Coupon

**Exploded anatomy**:
The fixed, scroll-driven visual breakdown (accessible via `/know` or the home surface) showing how Keycaps, Switches, and the Barebones kit's bundled internals (plate, PCB, foam, case) stack together in a guided sequence with synchronized 3D layer highlighting and facts.
_Avoid_: Live preview, customiser preview

**Helper**:
The conversational mascot assistant (Biscuit) that provides guidance on keyboard mechanics, Lucky Draw rewards, and switch recommendations.
_Avoid_: Chatbot, AI agent, wizard

**Prefilled build**:
A Build whose Part slots are populated upon entering the builder via recommendation links or starter selections (such as ready-made FATKEY keyboards), without replacing existing user selections without consent.
_Avoid_: Preset, template

**Sandbox checkout**:
A demonstration payment flow using HitPay Sandbox to simulate purchasing a complete Build at the net price (after Voucher discount) without real-money fulfillment.
_Avoid_: Payment gateway, real checkout
