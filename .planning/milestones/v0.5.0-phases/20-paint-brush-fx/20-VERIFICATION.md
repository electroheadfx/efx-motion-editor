---
status: gaps_found
phase: 20-paint-brush-fx
verified: 2026-03-25
verifier: manual
score: 3/13
---

# Phase 20 Verification: Paint Brush FX

## Summary

Phase 20 attempted a custom WebGL2 brush rendering pipeline (stamp-based, spectral compositing, polygon deformation). After 6+ rounds of tuning, the visual quality is far below acceptable — individual stamps visible, wrong colors, broken watercolor. The rendering architecture was a mistake: should have used p5.brush (MIT, standalone adapter) instead of building from scratch.

## What Passed

- [x] PAINT-01: BrushStyle type system and defaults — types/paint.ts works correctly
- [x] PAINT-02: Reactive state (paintStore signals) — brushStyle/brushFxParams signals work
- [x] PAINT-04: Brush style selector UI — PaintProperties sidebar panel works

## What Failed (Gaps)

### GAP-1: Brush stroke rendering quality (PAINT-03, PAINT-05, PAINT-06, PAINT-07, PAINT-08)
**Severity:** critical
**Description:** Custom WebGL stamp renderer produces visible individual stamps, wrong colors, broken blending. Quality is unacceptable compared to reference (p5.brush). All non-flat brush styles (ink, charcoal, pencil, marker, watercolor) fail to render at acceptable quality.
**Root cause:** Custom reimplementation of brush rendering from scratch instead of using p5.brush library.
**Fix:** Replace custom rendering files (brushFxShaders.ts, brushFxRenderer.ts, brushFlowField.ts, brushWatercolor.ts) with p5.brush standalone integration.

### GAP-2: Spectral color mixing broken (PAINT-09)
**Severity:** critical
**Description:** Spectral compositing shader produces muddy/wrong colors. hexToGLColor gamma decompression darkens colors incorrectly.
**Root cause:** Complex GLSL spectral mixing implementation is incorrect.
**Fix:** Use p5.brush's built-in blend mode (which handles color mixing correctly).

### GAP-3: Watercolor rendering oversized and wrong (PAINT-10)
**Severity:** critical
**Description:** Watercolor polygon deformation creates blobs much larger than the original stroke. No resemblance to natural watercolor.
**Root cause:** Custom Tyler Hobbs implementation with wrong variance scaling.
**Fix:** Use p5.brush's fill/bleed system for watercolor effects.

### GAP-4: Integration wiring incomplete (PAINT-11, PAINT-12, PAINT-13)
**Severity:** major
**Description:** paintRenderer.ts wiring to custom renderer needs replacement. Export parity not verified.
**Fix:** Wire paintRenderer.ts to p5.brush standalone output canvas instead.

## Files to Replace

These files contain the broken custom rendering and should be deleted/replaced:
- `Application/src/lib/brushFxShaders.ts` — custom GLSL shaders
- `Application/src/lib/brushFxRenderer.ts` — custom WebGL2 pipeline
- `Application/src/lib/brushFlowField.ts` — custom flow field
- `Application/src/lib/brushWatercolor.ts` — custom watercolor polygon deformation
- `Application/src/lib/spectralMix.test.ts` — test for unused spectral module

## Files to Keep

- `Application/src/types/paint.ts` — BrushStyle types, BRUSH_FX_DEFAULTS
- `Application/src/stores/paintStore.ts` — reactive state
- `Application/src/components/sidebar/PaintProperties.tsx` — UI
- `Application/src/lib/brushPreviewData.ts` — SVG preview thumbnails
- `Application/src/components/canvas/PaintOverlay.tsx` — stroke commit wiring

## Recommended Approach for Gap Closure

Install `p5.brush` as npm dependency. Use standalone adapter to initialize on offscreen WebGL canvas. For each styled stroke, translate our PaintStroke data to p5.brush API calls (brush.set, brush.line/stroke). Composite p5.brush output onto main Canvas2D. This gives immediate access to p5.brush's battle-tested rendering quality.

## Human Verification Items

1. All brush styles render at p5.brush-level quality
2. Watercolor shows natural bleed edges
3. Spectral color mixing works (blue + yellow = green)
4. Export parity: styled strokes render identically in export
