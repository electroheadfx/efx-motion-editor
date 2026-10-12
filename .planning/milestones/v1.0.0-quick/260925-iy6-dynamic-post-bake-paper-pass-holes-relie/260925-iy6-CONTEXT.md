# Quick Task 260925-iy6: dynamic post-bake paper pass (holes + relief) - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Task Boundary

Paper texture applied AFTER the paint is baked and AFTER layers are mixed (v1 compositor law), dynamically from the chosen paper and its grain scale. Valleys/tooth show the paper through the paint and darken slightly; peaks/fibers lift (highlight). Applies at 100% paint opacity too. Changing paper or grain scale re-textures already-baked paint immediately — no re-paint, no re-bake — on canvas and in export. Playback stays real-time: no per-frame JS getImageData/pixel-loop/putImageData in the display frame path.

</domain>

<decisions>
## Implementation Decisions

### Hole color semantics — "Paper shows through holes"
- Holes read as the **real paper showing through**, even at 100% paint opacity.
- Implementation model: **paper-tinted modulation map** (NOT alpha-punch, NOT black multiply).
- PIN 0 = 1.0000 intact: never scale depositAlpha / strokeOpacity / body coverage (260924-m7w law).
- Alpha-punch (`destination-out`) is explicitly rejected — it would change paint alpha.
- Raw black multiply is explicitly rejected — at 100% opacity the paper itself would not be visible.
- Valleys still "darken slightly" as the prompt states — the darkening is toward the paper's own tone, not toward black.

### Strength source — wire the existing grain-strength UI
- The grain-strength control already exists and is inert since 9a (260925-dso) — **activate it as the `strength` term** in the signed height model `s = (h - 0.5) * 2 * strength`.
- Grain **scale** stays spatial-only (tile size). Do **not** derive strength from scale — they are independent physical parameters.
- Strength modulates **tooth depth only** — never paint opacity or deposit alpha.
- Wire the existing control **as-is** under the numeric-stepper contract (260924-ffd): integer ±1 + presets / free entry + EU comma. **No new control, no redesign.**
- Hole look remains the paper-tinted map from the decision above.

### Export path contract — share one code path
- Pin 4 = **the exact same routine**. Export calls the same tile + drawImage/GCO paper pass as the canvas.
- Rationale: 9a just deleted a second pixel-loop implementation of this effect (`fillPolyGrain` + `applyPaperEmboss`) because it diverged and cost two synchronous passes. This project has been bitten repeatedly by dual pipelines drifting (bake vs composite, child-realm vs main-realm, mirror vs parent). Summarized visual UAT would not catch subtle drift.
- Guardrails (user-specified):
  - The shared routine takes a **target 2D context + width/height**; it must **never reach for the live canvas**.
  - **Same tile grid, same shared paper texture, same grain scale / Strength params** on both paths.
  - **save/restore globalCompositeOperation** around the call.
  - **No pixel loop** in either path.
  - Parity UAT = exported file compared against a canvas capture of the same frame.

### Claude's Discretion
- Exact GCO recipe (which of multiply / lighten / screen / overlay per pass, pass count 1-2 within the stated budget) — user suggestion is signed height-map encoded into precomputed tile(s), possibly two tiles (multiply map + lighten map). User marked this "suggestion, not mandated".
- Tile cache keying and regeneration triggers (paper id + grain scale + strength + paper-tint inputs).
- Where the pass sits in `_resolveFlattenedFrame` / export pipeline relative to the existing paper fond (fond stays beneath; this pass modulates the mixed paint above it).

</decisions>

<specifics>
## Specific Ideas

- Signed height-map model from the pre-9a `applyPaperEmboss` formula: `s = (h - 0.5) * 2 * strength`, valleys = holes, peaks = relief — **encoded into the precomputed tile(s)**, not evaluated per pixel per frame.
- User warning: "A raw Canvas multiply alone loses the relief; a raw overlay pushes contrast and moves flat colors."
- One paper sheet: grain modulates the **mixed** paint, never per layer — stacking layers must not fill the holes.
- "Premultiplied last" = the paper pass is the last step — do **not** switch to premultiplied-alpha buffers. Straight-alpha law (D-02) holds.
- RED-first pins: (1) full-opacity stroke shows paper holes through the paint; (2) swapping paper after bake re-textures without repaint; (3) display frame path has no per-pixel JS loop for the paper pass; (4) export pixel path honours the same pass.

</specifics>

<canonical_refs>
## Canonical References

- Quick 260925-dso (9a): bake-time grain/emboss deleted; `conditionHeightMap` in `loadPaperTexture`; CR-01 grain-off `''` round-trip.
- Quick 260924-stb (8c): pressure-physics thickness field — preserve.
- Quick 260925-b7c (8d): Spread scale calibration — preserve.
- Numeric-stepper contract 260924-ffd: integer ±1 + fps/value presets, free entry + EU comma.
- v1.0 compositor rendering law (D-09/paper fond): tracks transparent between each other; paper fond beneath the flattened composite in `_resolveFlattenedFrame` (physicPaintStore).
- Straight-alpha law D-02; deposit/opacity law 260924-m7w (never scale depositAlpha / strokeOpacity / body coverage).

</canonical_refs>
