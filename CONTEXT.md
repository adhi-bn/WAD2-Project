# Lechaton Typers

Custom mechanical-keyboard builder: users assemble a keyboard from compatible parts against a target budget.

## Language

**Build**:
A user-assembled keyboard made by choosing one Part in each slot.
_Avoid_: Configuration, custom keyboard

**Part**:
One selectable component for a Build, in exactly one of three slots: barebones, switches, keycaps.
*(Note: As documented in [docs/adr/0007-temporary-8-part-catalog-schema.md](docs/adr/0007-temporary-8-part-catalog-schema.md), the backend Supabase catalog temporarily persists 8 granular physical layers — `case`, `plate`, `pcb`, `foam`, `switches`, `keycaps`, `stabs`, `cable` — as technical debt to support the prototype customizer and checkout. The canonical builder domain model targets 3 slots and will not support 8 independent parts; consolidating these layers into Barebones kits is scheduled for a future refactoring milestone).*
_Avoid_: Component, item

**Barebones kit**:
The base unit of a Build, with its case and fixed internals (plate, PCB, foam, stabilizers) bundled and priced as one Part. Switches and keycaps attach to it.
_Avoid_: Base, kit

**Compatibility**:
Whether the chosen switches, keycaps, and barebones for a Build fit together. PCB and foam are not separately customisable in the canonical builder.
_Avoid_: Validity, match

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
