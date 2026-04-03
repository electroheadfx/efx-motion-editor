---
phase: 01-algorithm-port-foundation
plan: "02"
status: complete
started: 2026-03-29
completed: 2026-03-29
---

## Summary

Redesigned the rendering flow in efx-paint-physic-v2.html (iterated from v1) so all 5 physics features work together correctly. Paint now deposits to wet layer only, wet compositing is the primary display, drying transfers to canvas over time, and flow spreads paint with gravity bias.

## What Was Built

- **Wet-layer-only painting**: `renderPaintStroke` renders brush texture to offscreen canvas, then `transferToWetLayerClipped` deposits into wet arrays. No direct canvas rendering from paint strokes.
- **Continuous physics loop**: `setInterval(physicsStep, 100)` runs drying + flow at 10fps automatically.
- **Gravity-biased flow**: GRAVITY_BIAS=0.04, upward flow nearly blocked (0.05x), horizontal reduced (0.6x). Paint drips downward visibly.
- **Clipped offscreen rendering**: Offscreen canvas sized to stroke bounding box (not full 1000x650). 10-50x fewer pixels processed per stroke.
- **Brush cursor preview**: Dashed dual-ring circle shows brush size, visible on any background.
- **Stroke preview**: Marching-ants outline of ribbon polygon shape during drag — matches final brush shape.
- **Wet/Dry paper toggle**: Replaces Quick/Gentle/Flow/Drip buttons. Wet mode enables physics, Dry mode renders directly to canvas.
- **Physics indicator**: Green pulsing button when wet paint exists, click to force-dry.
- **Undo fix**: Force-dry before snapshot so undo restores fully-resolved canvas state, clear wet layer on undo.

## Key Decisions

- D-01: Iterated on v2.html instead of v1 (user request — preserve v1 as reference)
- D-02: Restored full brush rendering pipeline (fillPolyGrain, fillFlat, drawBristleTraces) — plan's simplified depositToWetLayer lost brush character
- D-03: No procedural noise on white/transparent backgrounds — only paper texture backgrounds get height-map modulation
- D-04: Preview uses ribbon polygon outline (marching ants) not filled shape — user preferred outline with inverted visibility
- D-05: Snapshot-based undo with forceDryAll before snapshot — ensures pixel-perfect restoration

## Deviations from Plan

- Created `depositToWetLayer`/`depositToWetLayerWithColors` then restored original offscreen canvas pipeline — plan assumed simplified deposit would preserve brush character
- Added continuous physics loop (was missing from codebase)
- Added `curveBounds`, `transferToWetLayerClipped`, `applyWetCompositeClipped`, `applyPaperEmboss(ctx, bounds)` for clipped rendering optimization
- Replaced dry buttons UI with wet/dry paper toggle + physics indicator
- Multiple undo iterations: replay-based → snapshot + clearWetLayer + forceDryAll

## Key Files

### Created
- `efx-paint-physic-v2.html` — Complete rendering flow redesign with wet physics

### Modified
- None (all work in new v2 file)

## Self-Check: PASSED

- [x] Paint deposits to wet layer ONLY (via offscreen canvas → transferToWetLayerClipped)
- [x] Wet compositing is PRIMARY display (compositeWetLayer rAF loop)
- [x] Drying transfers to canvas gradually
- [x] Flow spreads wet paint with gravity bias
- [x] Paper texture modulates wet display and drying
- [x] Brush cursor shows size preview
- [x] Stroke preview shows ribbon shape outline
- [x] Wet/dry paper toggle works
- [x] Undo works correctly (force-dry + snapshot + clearWetLayer)
- [x] All 4 tools function
- [x] Human verification: APPROVED
