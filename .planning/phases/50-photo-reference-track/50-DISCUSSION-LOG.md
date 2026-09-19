# Phase 50: Photo/Reference Track - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 50-photo-reference-track
**Areas discussed:** Source import & sequence, Mode switching & behavior, Reference overlay look, Frame alignment law

---

## Source import & sequence

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse asset-picker (Rec.) | Reuse the Phase 49 asset-picker variant (BackgroundAssetPickerView) — images-only, multi-select, Confirm/Cancel, full-area swap. | ✓ |
| Single image only | A single-image picker only — the reference is one still photo. | |
| Dedicated picker | A dedicated reference-source surface distinct from the Background picker. | |

**User's choice:** Reuse asset-picker (Rec.)
**Notes:** Consistent with Background, minimal new surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Still + sequence (Rec.) | One still image OR one ordered sequence (natural filename sort). A single image is a cycle of length 1. | ✓ |
| Still only | Only a single still image can be the reference. | |

**User's choice:** Still + sequence (Rec.)
**Notes:** A sequence enables frame-aligned resolution over time (Pitfall M5).

| Option | Description | Selected |
|--------|-------------|----------|
| Replaceable, row control (Rec.) | Row Import control; re-opening the picker REPLACES the source; replacement bumps the source revision (REF-04). | ✓ |
| Set once, no replace | Source set once at creation, cannot be replaced. | |
| Replace via right panel | Source set once, 'Change source' action in the right panel. | |

**User's choice:** Replaceable, row control (Rec.)
**Notes:** One source at a time.

| Option | Description | Selected |
|--------|-------------|----------|
| Replace flow recovers (Rec.) | Missing asset renders reference absent + status-capsule red warning; user re-opens the picker to re-select/re-link. | ✓ |
| Fail-closed only | Fail-closed only in Phase 50; re-link deferred to a later phase. | |
| Dedicated relink UI | A dedicated 'Source missing — relink' banner/button. | |

**User's choice:** Replace flow recovers (Rec.)
**Notes:** No separate recovery surface.

---

## Mode switching & behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented/dropdown (Rec.) | Segmented control or dropdown on the photo/reference row (or right panel) with the three modes. | ✓ |
| Cycle button | A cycle button on the row that steps through the three modes. | |
| Set at creation only | Mode set once at source creation and cannot change later. | |

**User's choice:** Segmented/dropdown (Rec.)
**Notes:** Switching is instant and undoable.

| Option | Description | Selected |
|--------|-------------|----------|
| Flag only, same overlay (Rec.) | All three modes show the reference overlay identically; the mode is a persisted flag for Phase 52. | ✓ |
| Distinct per-mode look | reveal-source mode dims or labels the overlay differently. | |
| Gate future modes | reveal-source and masked-transform-source show a 'coming in a later phase' hint. | |

**User's choice:** Flag only, same overlay (Rec.) — with an added hard lock.
**Notes:** In ALL THREE modes, reference pixels NEVER reach the flattened raster, main preview, or export — the mode only changes the persisted flag. Reference leaking into output before Phase 52 exists would be an unguarded regression.

| Option | Description | Selected |
|--------|-------------|----------|
| Undoable + revision bump (Rec.) | Mode switch is one undoable document mutation and bumps the photo/reference track revision. | ✓ |
| Session-only | Mode switch is session-only, resets to reference-only on reopen. | |

**User's choice:** Undoable + revision bump (Rec.)
**Notes:** Consistent with every other track mutation.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer 'photo' fond (Rec.) | The fond selector's 'photo' mode stays absent in Phase 50. | ✓ |
| Studio-only 'photo' fond | Wire 'photo' as a Studio-only fond display that never enters the flattened raster. | |

**User's choice:** Defer 'photo' fond (Rec.)
**Notes:** Wiring it would draw reference pixels as the document fallback — part of the flattened output — violating the exclusion lock.

---

## Reference overlay look

| Option | Description | Selected |
|--------|-------------|----------|
| Ghost overlay + toggle (Rec.) | Semi-transparent ghost on top of the composite while painting, with a Studio-only toggle. | ✓ |
| Full-opacity overlay | Reference draws at full opacity on top of the composite. | |
| Separate pane | Reference shows only in a separate preview pane. | |

**User's choice:** Ghost overlay + toggle (Rec.)
**Notes:** Never part of the flattened raster.

| Option | Description | Selected |
|--------|-------------|----------|
| Independent of hide/solo (Rec.) | Overlay stays visible while painting regardless of hidden/soloed Paint tracks, controlled only by its own toggle. | ✓ |
| Hidden on solo | Overlay hides when a Paint track is soloed. | |

**User's choice:** Independent of hide/solo (Rec.)
**Notes:** Matches the Background rule (Phase 48 D-04).

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted (Rec.) | Overlay toggle persisted in the document (`visibleInStudio`), survives save/reopen. | ✓ |
| Session-only | Overlay toggle resets to visible on reopen. | |

**User's choice:** Persisted (Rec.)

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed default (Rec.) | Fixed default opacity (~50%) with no user control. | |
| Adjustable slider | User-adjustable opacity slider in the right panel. | ✓ |

**User's choice:** Adjustable slider — with added locks.
**Notes:** The slider drives the Studio-only ghost overlay opacity (live preview as you drag, commit on release — same release-commit pattern as track opacity, Phase 48). It is a persisted display preference on the photo/reference track (survives save/reopen alongside visibleInStudio), NOT an undoable document mutation, and never touches the flattened raster.

---

## Frame alignment law

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 from frame 0, clamp (Rec.) | Application frame N → source frame N, 1:1 from frame 0, clamped at the sequence end. | ✓ |
| Start-frame offset | Application frame N → source frame N with a user-set start-frame offset. | |
| Modulo loop | Application frame N → source frame (N mod cycleLength). | |

**User's choice:** 1:1 from frame 0, clamp — with added scope.
**Notes:** ADDED SCOPE — reference display transform with direct canvas manipulation: position X/Y, scale X/Y, rotation, manipulated DIRECTLY on the canvas (drag to move, corner handles to scale, rotation handle), because a source image rarely arrives at the exact framing needed. PLUS a lock toggle: once adjusted, the user locks the overlay so canvas gestures can no longer touch it; unlocking re-enables the handles. Locks: default = centered at natural size, no rotation; transform + lock state persist on the photo/reference track (display properties, same class as the opacity slider — not undoable document mutations); identical transform in all three modes so what you align is what Reveal will reveal; NEVER affects the flattened raster or export.

| Option | Description | Selected |
|--------|-------------|----------|
| Locked by default (Rec.) | Overlay locked by default (painting works normally); user unlocks to enter reference-transform mode. | ✓ |
| Unlocked by default | Handles always visible; canvas drags move the reference until locked. | |

**User's choice:** Locked by default (Rec.)
**Notes:** No accidental moves while painting.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse TransformOverlay (Rec.) | Reuse the main editor's TransformOverlay pattern (drag move, corner scale, rotation handle). | ✓ |
| Simpler custom handles | A simpler custom handle set (move + uniform scale only, no rotation). | |

**User's choice:** Reuse TransformOverlay (Rec.)

| Option | Description | Selected |
|--------|-------------|----------|
| Painting only (Rec.) | Overlay shows only while painting/editing on the active track; hides during playback and export. | ✓ |
| Also during playback | Overlay also shows during playback as a ghost. | |

**User's choice:** Painting only (Rec.)
**Notes:** Matches onion-skin behavior (Phase 48 D-06).

---

## Claude's Discretion

- Exact store/function shape for the photo/reference track CRUD ops, the source revision bump, and the reference overlay draw path.
- Exact segmented-control/dropdown placement (row vs right panel) and copy (English).
- Exact TransformOverlay reuse shape for the reference transform (how the display transform is applied when drawing the ghost).
- Whether the photo/reference row's own `visible` toggle is surfaced in Phase 50 (the overlay toggle covers it).

## Deferred Ideas

- `'photo'` fond mode wiring — deferred to a later phase (would draw reference pixels as the document fallback, part of flattened output).
- Reveal compositing — Phase 52 (RVL); consumes the `reveal-source` mode and the frame-aligned source resolution.
- Masked-transform workflow — future accepted local transformation result consumes the `masked-transform-source` mode.
