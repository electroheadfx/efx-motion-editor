# Phase 63: Brush Tip Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-15
**Phase:** 63-Brush Tip Pipeline
**Areas discussed:** Import surface, Shipped textures, Storage fork, Async + failure UX

---

## Scouting finding (raised before the area selection)

`BrushesDocker.tsx` — which both specs treat as the import surface and the registry feed — is mounted nowhere in production. The live Studio brush UI is `PhysicsPaintBrushMenu` (top-bar popover) and `PhysicsPaintBrushModal` → `WatercolorBrushLibrary` (floating sheet, also mounted in `RightPanelBrushTab`), and both list `BRUSH_PRESETS` engine ids (`chalk`, `sponge`, `stipple`…), not the `wc/*` `TIPS` catalog. Strokes record the preset ids as `brushId`. This reframed TIP-06/13/16/17's "docker" vocabulary and was carried into every area.

---

## Import surface

### Where should the Import PNG/JPG affordance live?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal header button | Toolbar button in the floating modal header; BrushesDocker stays unmounted | |
| Re-mount BrushesDocker | Replace `WatercolorBrushLibrary` with the category/search/Custom docker | |
| Both modal + popover | Two entry points to maintain | |
| Settings modal | Import row under a Brushes section in Studio Settings | |

**User's choice:** *(free text)* — a toolbar row **inside `WatercolorBrushLibrary`, above the grid**. That component is the live catalog shared by the floating modal and the right-panel Brush tab, so one change covers both and the imported tip lands directly below the control.
**Notes:** BrushesDocker must not be re-mounted: it is unmounted, its catalog is the `wc/` TIPS list rather than the `BRUSH_PRESETS` ids strokes record, and reviving it would swap the live catalog and change `brushId` semantics. Recorded as a phase finding: TIP-06/TIP-13's "docker" means the import/list surface, not `BrushesDocker.tsx`; `resetBrushesDockerUi()` stays unused; project-open scoping targets the library catalog and the mask registry.

### Which list do imported and built-in textured tips join?

| Option | Description | Selected |
|--------|-------------|----------|
| Section under presets | Shipped presets first, then a Texture/Custom section; `brushId` records whatever was picked | ✓ |
| Merge into preset rows | Flat grid; the lift popover reads the same list and would show imported tips | |
| Separate docker catalog | Imported tips only in a re-mounted docker | |

**User's choice:** Sectioned grid — shipped `BRUSH_PRESETS`, then `Texture` (`wc/builtin-*`), then `Custom` (imports). No id translation, so existing projects replay untouched; the lift popover stays preset-only.
**Notes:** *(from the follow-up section question)* "Texture" holds the three built-ins, "Custom" holds project imports — mirrors the existing `category` field and keeps app-owned art visibly distinct from project-owned imports. Two extra headers accepted.

### Should an imported textured tip also be pickable as the eraser (lift) shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Brush pick only | Lift popover keeps shipped presets | ✓ |
| Also as eraser shape | Same catalog feeds the lift popover | |

**User's choice:** Brush pick only.
**Notes:** A project-scoped mask never enters an erase stroke, so opening a project never has to resolve a missing mask just to draw an erase footprint, and the TIP-06/TIP-10 ghost-mask fallback stays simple.

---

## Shipped textures

### Where do the three built-in mask textures come from?

| Option | Description | Selected |
|--------|-------------|----------|
| You supply 3 PNGs | User authors the sources; Claude bakes to compile-time constants | ✓ |
| Claude generates, you review | Procedural masks judged in UAT | |
| Runtime noise, no bytes | Deterministic generator functions instead of embedded bytes | |

**User's choice:** *(free text)* — user supplies three grayscale sources; bake them into compile-time constants under the `wc/builtin-*` ids and pin that no source file is a runtime input. Runtime generators rejected: they would revise TIP-13's compile-time-constants law and let the texture drift. Tradeoff accepted: the three source images are a prerequisite for execution. **Delivered at `SPECS/v2.2.0-brush-tips/assets/` — three 1024×1024 JPEGs, white-on-black (light-on-dark stamps), not the PNG names given.**

### Polarity — the sources are white-on-black but TIP-03 inverts luminance

| Option | Description | Selected |
|--------|-------------|----------|
| Built-ins bake separately | One-off authoring conversion; import law untouched | |
| Auto-detect polarity at import | Two-branch law for opaque images by mean luminance | ✓ |
| Re-supply dark-on-light | Round-trip to the artist | |

**User's choice:** Auto-detect polarity. Pin a two-branch law for opaque images: alpha branch unchanged (any alpha < 250 → alpha mask); otherwise mean luminance over opaque pixels — mean < 128 → `mask = luminance` (light-on-dark stamp), else `mask = 255 − luminance`. Amend TIP-03, document in the module header, cover BOTH branches with tests, and have the built-in bake call the same derivation function — no private one-off conversion.

### Which source maps to which shipped tip?

| Option | Description | Selected |
|--------|-------------|----------|
| As guessed | `sb4tebyp`→bristle, `sb5qdgop`→chalk, `scmeagrp`→sponge | ✓ |
| Swap chalk and sponge | `sb5qdgop`→sponge, `scmeagrp`→chalk | |
| I'll name them | Record verbatim | |

**User's choice:** As guessed. The torn layered drag reads as dry chalk and the granular spatter as sponge. Low risk: a swap is one manifest line.

### Bake-time cleanup on the 1024→192 downscale?

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize contrast | Stretch to 0–255 after the high-quality downscale | ✓ |
| Raw downscale | Store exactly what the resample produces | |
| Normalize + mild denoise | Stretch and suppress JPEG speckle | |

**User's choice:** Normalize contrast, no denoise, no blur. Normalization is bake-only (curated built-ins); imported tips stay faithful to the user's file. Tradeoff accepted: source absolute luminance is discarded so `tipMean` deposits with real punch.

### What does a mask-backed card show as its thumbnail?

| Option | Description | Selected |
|--------|-------------|----------|
| Painted stroke | Same painted-stroke thumb as every card, cached per tip | ✓ |
| The mask itself | Show the 192×192 mask square | |
| Imported mask / built-in stroke | Two conventions in one grid | |

**User's choice:** Painted stroke for every mask-backed card, generated once per tip from the mask, cached under a per-tip key (tip id + mask, not preset id). Tradeoff accepted: the raw mask shape is not shown.

---

## Storage fork

### How should the encoded mask travel? (spec 02 left this open until measured)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline always | Base64 in the `.mce` root; ~8 KiB per tip | |
| Measure, then decide | Build a 20-tip project, record the delta, fall back only if bad | |
| Sub-file from the start | `brushes/<id>.png` via the staging transaction | |
| *(written in)* Lossless WebP package asset | `brushes/<sha256>.webp`, content-addressed, package-relative ref | ✓ |

**User's choice:** *(free text)* — **NOT inline base64.** Each imported mask is a lossless WebP asset inside the package at `brushes/<sha256>.webp`, content-addressed with a fixed hex name (imported ids never appear in a path). The root `brushPack` entry carries a package-relative asset ref, not mask bytes. Reuse `WebPLosslessCodec` (`frame_codec.rs`, lossless + `config_exact` alpha) with a one-off higher-effort profile since a mask is encoded exactly once; save copies stored bytes and never re-encodes, so save → reopen stays byte-identical.
**Notes:** Add a sibling `brushes/<64-hex>.webp` branch to the write path, read path, bound-path guard and static scans; do not widen the `frames/` MEDIA lock. All package IO in Rust. Add asset bytes to the transaction file set and to the copy-to-fresh-profile round-trip. No stale-file pruning this milestone. Roto scripts (TIP-14) carry the mask as a base64 WebP data URL, validated with the same payload-dimension check as thumbnails. Amendments required to TIP-08, TIP-11, TIP-15, TIP-16, TIP-10, the delivery law, and the `project.ts`/`project.rs` model comments.

### Is importing a tip an undoable edit?

| Option | Description | Selected |
|--------|-------------|----------|
| Not undoable | Catalog mutation; marks dirty; no history entry | ✓ |
| Undoable via history | Cmd+Z removes the tip and its mask | |

**User's choice:** Not undoable. The undo ledger stays a paint/document ledger; making it undoable would create the tip-delete path TIP-F01 deferred and orphan strokes that fall back to round. Tradeoff accepted: a mis-import stays until TIP-F01 ships delete.

---

## Async + failure UX

### What happens if the user paints before mask registration completes? (TIP-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Decode joins the open await | Registration completes inside project open, before hydrate/replay | ✓ |
| Open now, gate painting | Canvas refuses paint until a ready flag flips | |
| Open now, round fallback | Painting starts on round and upgrades live | |

**User's choice:** Decode joins the open await — the paint surface never exists half-registered, so there is no painting-before-ready case to define. Cost accepted: a handful of 192×192 lossless WebP decodes, well under hydrate/replay cost; prefer one Rust call that reads/decodes the whole brush set over N IPC round-trips. Per-tip failure never aborts the open.

### Where does TIP-10's "exactly one named warning" appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in the library | Persistent named line next to the greyed card | ✓ |
| Apply-message capsule | Existing one-shot Studio capsule | |
| Top-bar status pill | Reuse the Engine ready/fail pill | |

**User's choice:** Inline in the brush library. Not the capsule (one-shot, unrelated to any user action), not the engine pill (that signal means "engine alive"). The library is shared by the modal and the right-panel tab, so the warning sits wherever the catalog is.

### If several tips fail on one open, how many warnings?

| Option | Description | Selected |
|--------|-------------|----------|
| One aggregate line | "N brush tips unavailable in this project", cards marked individually | ✓ |
| One per failed tip | A line per tip | |

**User's choice:** One aggregate line per open, each affected card greyed and named. TIP-10's "exactly one warning" stays literal. The warning is one state per open; each mounted library surface renders it, and tests assert one warning state, not a DOM-node count.

---

## Follow-up amendments (recorded at the final check)

The user extended the amendment list at the close of discussion:

- **TIP-06** — "fed by the docker" / "clearing the docker" → the brush library import surface.
- **TIP-13** — "listed in the docker" → brush library.
- **TIP-16** — "identical docker listing" → identical brush library listing.
- **TIP-17** — drop the `resetBrushesDockerUi()` reference; extend it: closing the project or starting a New Project resets the catalog and mask registry to the three built-ins so no stale custom id resolves.
- **Phase 63 success criteria 2/4** — "docker" wording replaced.
- **Model comments** in `app/src/types/project.ts` and `app/src-tauri/src/models/project.rs` — the D-23 "inline data, never a file reference" exception is retired; spec 02 updated too.

Additional records:

- **(a)** Re-importing identical bytes still yields a distinct catalog entry (existing `importTip` law) while the content-addressed `brushes/<sha256>.webp` dedupes to one asset.
- **(b)** Imports are never contrast-normalized — normalization is bake-only, so a faint user stamp stays faint and the engine's `tipMean` is the only compensation.
- **(c)** The D-23 inline exception is retired; package-internal `brushes/` assets only.
- **(d)** TIP-12's painting-before-ready case is defined as impossible — decode + registration completes inside the project-open await, before hydrate/replay.
- **Mask × response composition** — a mask-backed tip is the STAMP, not a response mode. Masked tips build from `CUSTOM_BASE` with their mask, and the eight `toolOverrides` multipliers still apply on top, identically live/bake/replay; `buildBrushForStroke` stays the only mapping. Do not gate the mask by the selected preset or any response mode, and do not bypass multipliers for masked tips — that would create a second path and leave the Settings response sliders inert for the new brushes. "No texture, as before" is not a toggle: it is the existing `BRUSH_PRESETS` catalog, which stays maskless. The eraser/lift popover stays preset-only.

---

## Claude's Discretion

- Rust command shape for the one-call brush-set decode.
- The 64-hex digest function wiring and the higher-effort WebP profile values.
- Base64 payload-dimension validation helper reuse for the roto carrier.
- Literal warning copy.

## Deferred Ideas

- **TIP-F01** — Tip delete and garbage-collection UI, including pruning orphaned `brushes/*.webp` assets (deliberately not done this milestone).
- **TIP-F02** — Package/type/signal/`BRUSH_PACK_KIND` rename to a medium-neutral vocabulary; a dedicated format-break pass.
- Reviewed new todo only: `261024-frame-fade-compositing.md` (keyword match, score 0.6) — unrelated, not folded.
