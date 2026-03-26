---
phase: 20-paint-brush-fx
plan: 01
subsystem: paint
tags: [p5.brush, spectral-mixing, kubelka-munk, preact-signals, per-frame-cache]

# Dependency graph
requires: []
provides:
  - "PaintStroke.fxState field (flat/fx-applied/flattened) for FX workflow state tracking"
  - "StrokeFxState type for three-state FX lifecycle"
  - "PaintToolType 'select' for stroke selection"
  - "paintStore.frameFxCache Map for per-frame raster cache"
  - "paintStore.paintBgColor signal for solid paint background"
  - "paintStore.selectedStrokeIds signal for stroke selection"
  - "renderFrameFx() in brushP5Adapter for per-frame batch rendering with spectral mixing"
  - "DEFAULT_PAINT_BG_COLOR constant"
affects: [20-02, 20-03, 20-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-frame-fx-cache, stroke-fx-state-machine, batch-spectral-rendering]

key-files:
  created: []
  modified:
    - Application/src/types/paint.ts
    - Application/src/stores/paintStore.ts
    - Application/src/lib/brushP5Adapter.ts
    - Application/src/types/paint.test.ts
    - Application/src/lib/brushFxDefaults.test.ts

key-decisions:
  - "Per-frame caching (not per-stroke) ensures spectral mixing via shared p5.brush canvas"
  - "fxState on PaintStroke tracks flat/fx-applied/flattened lifecycle without per-stroke canvas"
  - "renderFrameFx copies to new canvas for cache -- shared singleton canvas reused between calls"

patterns-established:
  - "Per-frame FX cache: Map<'layerId:frame', HTMLCanvasElement> in paintStore"
  - "Stroke selection via selectedStrokeIds signal with immutable Set updates"
  - "renderFrameFx filters by fxState==='fx-applied' before batch rendering"

requirements-completed: [PAINT-01, PAINT-06, PAINT-08, PAINT-11, PAINT-13]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 20 Plan 01: Types, Store & Adapter Foundation Summary

**Extended PaintStroke with fxState field, added per-frame FX cache to paintStore, and renderFrameFx() to brushP5Adapter for Kubelka-Munk spectral batch rendering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T08:17:50Z
- **Completed:** 2026-03-26T08:23:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PaintStroke type extended with fxState (flat/fx-applied/flattened) for FX lifecycle tracking, plus StrokeFxState type and 'select' in PaintToolType
- paintStore now has paintBgColor signal, selectedStrokeIds signal with manipulation methods, and frameFxCache Map with get/set/invalidate/clearAll -- all reset-safe
- brushP5Adapter exports renderFrameFx() that batch-renders all FX-applied strokes on a single p5.brush canvas for spectral mixing, returning a new cached canvas
- All 19 test stubs filled (12 in paint.test.ts, 7 in brushFxDefaults.test.ts) with real assertions, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types and store for per-frame FX caching workflow** - `2b47b99` (feat)
2. **Task 2: Add renderFrameFx() to brushP5Adapter for per-frame batch rendering** - `009d66a` (feat)

## Files Created/Modified
- `Application/src/types/paint.ts` - Added StrokeFxState type, 'select' tool, fxState field on PaintStroke, DEFAULT_PAINT_BG_COLOR constant
- `Application/src/stores/paintStore.ts` - Added paintBgColor, selectedStrokeIds signals, frameFxCache Map with CRUD methods, stroke selection methods, reset additions
- `Application/src/lib/brushP5Adapter.ts` - Added renderFrameFx() for per-frame batch rendering with spectral mixing
- `Application/src/types/paint.test.ts` - Replaced 10 it.todo stubs with real test implementations plus 2 new tests
- `Application/src/lib/brushFxDefaults.test.ts` - Replaced 7 it.todo stubs with real test implementations

## Decisions Made
- Per-frame caching (not per-stroke): All FX strokes on a frame render together on one p5.brush canvas before a single brush.render() call, enabling Kubelka-Munk spectral blending (blue+yellow=green)
- No fxCachedCanvas on PaintStroke: Cache lives at frame level in paintStore._frameFxCache Map, keyed by "layerId:frame"
- renderFrameFx copies result to new canvas: The shared singleton _canvas is reused between calls, so frame caches get independent canvas copies via drawImage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Types, store, and adapter foundation ready for Plan 02 (select tool and FX application workflow)
- renderFrameFx() ready to be called from previewRenderer.ts paint layer compositing path
- frameFxCache ready to receive cached canvases from FX application trigger
- No blockers or concerns

## Self-Check: PASSED

All 5 modified files exist. Both task commits verified (2b47b99, 009d66a). 19/19 tests passing.

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-26*
