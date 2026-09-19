---
status: passed
phase: 50-photo-reference-track
source: [50-VERIFICATION.md]
started: 2026-09-01T20:10:00Z
updated: 2026-09-01T21:00:40Z
closed: 2026-09-01T21:00:40Z
---

## Tests

### 1. Import a reference source via the strip camera icon → Photo Reference dialog → Import
expected: Open the EFX Physic Paint Studio, click the strip camera icon (between the Tracks title and the + button), pick a source in the dialog's Import button, and confirm the reference draws as a ghost on the canvas
result: passed — import and replace both work; the ghost renders; replacing swaps the source cleanly (D-03)

### 2. Confirm the ghost overlay draws over the composite while painting
expected: The reference draws as a semi-transparent ghost at 50% opacity by default, transformed by the display transform
result: passed — ghost draws on top of the composite (monitor paint only), 50% default, transform-driven

### 3. Switch the Mode control between Reference / Reveal / Masked
expected: The active segment changes; the ghost looks identical (flag-only, no compositor change)
result: passed — active segment changes; ghost identical in all three modes (D-06 flag-only)

### 4. Drag the Overlay opacity slider
expected: Live preview during drag, commit on release; the value persists
result: passed — live preview during drag, commit on release, persisted in the dialog

### 5. Unlock the reference transform, drag/scale/rotate the overlay, then Escape / re-lock
expected: Drag moves, corner handles scale, the visible rotation handle rotates; Escape (or the Lock toggle) re-locks and painting works normally
result: passed — drag moves, corner handles scale, rotation handle rotates (added per UAT round 2), Escape re-locks, and painting resumes normally (the overlay passes pointer events through when locked)

### 6. Save the project, close, and reopen
expected: The source, mode, opacity, transform, and lock state are all restored
result: passed — reference source bytes now hydrate on the Physic Paint reopen path (launch-path hydration bug fixed per UAT round 2); source, mode, opacity, transform, and lock state are restored without a manual Replace

### 7. Confirm the reference NEVER appears in flattened output or export in any mode
expected: No reference pixels leak into the flattened raster, main preview, or export
result: passed — ghost is monitor paint only; the D-06 structural exclusion (compositor/cache/preview/export token scan) holds and the reference is visually confirmed as an editing aid only

## Issues Found & Fixed During UAT

1. **Painting blocked (2 rounds).** The reference-transform overlay WRAPPER was pointer-events auto over the whole canvas region and swallowed every gesture — even with no reference. Fixed: wrapper is pointer-events none; only the grab children (bounds, rotation zones, handles) capture. Painting works normally when locked.
2. **One-way Lock/Visible toggles.** The controls committed from a stale render closure. Fixed: they now invert from the LIVE document at click time.
3. **Reference lost on reopen.** `registerDocument` on launch never hydrated reference source bytes (the background path did). Fixed: the launch path now runs `hydrateReferenceSourceImagesFromLibrary` alongside the background hydration.
4. **Missing visible rotation handle (D-13 spec).** The overlay had only invisible corner hit-zones. Fixed: a visible stem + knob above the top edge, a direct rotate drag target.

## Summary

total: 7
passed: 7
issues: 4 (all fixed and re-validated)
pending: 0
skipped: 0
blocked: 0

## Gaps

None. Reveal source (Phase 52) and the masked-transform workflow remain flag-only by design (D-06 HARD LOCK) and are deferred to their roadmap phases.
