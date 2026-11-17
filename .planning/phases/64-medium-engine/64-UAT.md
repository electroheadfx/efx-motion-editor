---
status: testing
phase: 64-medium-engine
source: [64-VERIFICATION.md]
started: 2026-11-17T17:33:35Z
updated: 2026-11-17T17:33:35Z
---

## Current Test

number: 1
name: Set Viscosity to 100 on a fresh stroke and compare with 0.
expected: |
  Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged.
awaiting: user response

## Tests

### 1. Set Viscosity to 100 on a fresh stroke and compare with 0.
expected: Paint visibly hardens — it stops moving almost immediately and the deposit reads denser — while a neutral (0) watercolor stroke is unchanged.
result: [pending]

### 2. Undo and redo a thick embossed stroke and a covering (Body high) stroke.
expected: Pigment and thickness restore together; redo restores the same eroded/deposited values.
result: [pending]

### 3. Reopen the project and replay without repainting; then switch paint layers with different document lights.
expected: The same relief repaints from script alone; each layer re-shades to its own light.
result: [pending]

### 4. In the Paper & Light tab, drag Azimuth / Elevation / Intensity without painting.
expected: The settled wash re-lights immediately; the tab reads `Paper & Light`; one slider gesture is one undo step that restores the previous light.
result: [pending]

### 5. After a light change, Play (reveal) and Apply/stroke-edit bakes.
expected: The baked frames match the live sheet's new light. The Play-Script dialog bake is a separate declared deferral and is not part of this row.
result: [pending]

### 6. Zoom/pan over a thick embossed stroke; raise Emboss on a thick stroke.
expected: No shimmer or crawl; the paint reads as raised with a lit side and a shadow side.
result: [pending]

### 7. Pick the five mediums and paint five strokes; pick two brushes inside one group after a manual tweak; pick acrylic vs watercolor.
expected: Each stroke keeps its own look on replay; a same-group pick keeps the manual tweak; acrylic reads thick and waterless, watercolor a wash.
result: [pending]

### 8. Body/order and scattering rows: light pigment high Body over a dried dark area; Body 50; dark pigment high Body; water above zero at the border.
expected: High Body reads light with no bleed-through; Body 50 tints without erasing; a dark high-Body stroke covers and stays dark; the border blends when water > 0.
result: [pending]

### 9. Dry, replay, undo/redo, and export in every mode (paper, transparent, white, pigment) after scattering; zoom over a scattered area.
expected: Identical rasters across dry/replay/undo/redo; export matches the screen on every mode; no shimmer.
result: [pending]

### 10. Open the medium dropdown in the Paint tab and inspect the five brush-library sections.
expected: Dropdown shows the selected medium; Watercolor / Gouache / Chalk / Graphite / Acrylic sections are always expanded, with the texture strip above and no filter/search/collapse.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
