---
status: complete
phase: 64-medium-engine
source: [64-VERIFICATION.md]
started: 2026-11-17T17:33:35Z
updated: 2026-11-22T19:33:05.570Z
---

## Current Test

[testing complete]

## Tests

### 1. Set Viscosity to 100 on a fresh stroke and compare with 0.
expected: Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged.
result: pass

### 2. Undo and redo a thick embossed stroke and a covering (Body high) stroke.
expected: Pigment, thickness and coverage restore together; redo restores the same values, and the covered underlayer disappears again with the coverage — an undo that leaves a stale cover channel would show through as a hole in the restored paint.
result: pass

### 3. Reopen the project and replay without repainting; then switch paint layers with different document lights.
expected: The same relief repaints from script alone; each layer re-shades to its own light.
result: pass

### 4. In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting.
expected: The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step that restores the previous light.
result: pass

### 5. After a light change, Play (reveal) and Apply/stroke-edit bakes.
expected: The baked frames match the live sheet's new light. The Play-Script dialog bake is a separate declared deferral and is not part of this row.
result: pass

### 6. Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke.
expected: No shimmer or crawl; the paint reads as raised with a lit side and a shadow side.
result: pass

### 7. Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor.
expected: Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads as opaque coverage — it hides the paint under it and keeps its own colour — watercolor a wash that does not cover.
result: pass

### 8. Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border.
expected: High Body covers the dried dark area by compositing — light, with no bleed-through and no paper-white; Body 50 partly covers and lightens without destroying the underlayer; a dark high-Body stroke hides the underlayer and stays its own dark colour; the border blends when water > 0.
result: pass
note: "Body was removed from the UI control in a direct change/quick; it now sits at 0 — the row's Body-knob premise no longer applies. Artist passed the row."

### 9. Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area.
expected: Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer.
result: pass

### 10. Open the medium dropdown in the Paint tab and inspect the five brush-library sections.
expected: Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse.
result: pass

### 11. Acrylic Bristle Round and Bristle Flat, Feather 100 and Pickup 100.
expected: The stroke reads as loaded paint — distinguishable hairs, colour dragged from the canvas, a feathered edge — and the two controls visibly change the result as they move.
result: pass

### 12. Body as a mixer with the background (SPECS/v2.2.0-medium-engine/better-acrylic.md, request 1: "Blend instead transparence").
expected: Body 100 % acts as a full mixer with the underlying paint, Body 0 % mixes nothing, and the rim carries its own blend falloff rather than a hard line.
result: pass
note: "Body was suppressed from the UI control and now sits at 0, no longer used — the row's premise no longer applies. Artist passed the row."

### 13. Edge anti-aliasing and acrylic water (spec requests 2 and 3).
expected: A directional smooth on the stroke edges (no aliasing on the border or inside), watery irregular edges that are not ruler-straight, and the wet control stopping edge mixing with Feather setting how much edge mixing happens.
result: pass

### 14. Same stroke with a texture tip bound versus the default bristle tip.
expected: The bristle engine composites with a texture tip and the result is at least as good as either path alone.
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

<!-- Rows 11–14 were reset to pending on 2026-11-22: this UAT file was never
run through /gsd-verify-work and the recorded failures were ruled
non-authoritative (deferred-items.md, artist ruling 2026-11-22). This session
is the authoritative round. -->

