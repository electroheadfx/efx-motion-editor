---
phase: 20-paint-brush-fx
plan: 02
subsystem: paint
tags: [canvas2d, webgl2, paint-renderer, p5-brush, fx-cache, color-picker]

# Dependency graph
requires:
  - phase: 20-paint-brush-fx plan 01
    provides: "paintBgColor signal, getFrameFxCache method, StrokeFxState type"
provides:
  - "renderPaintFrameWithBg() for solid background + frame-level FX cache compositing"
  - "renderFlatElements() for rendering non-FX elements when cache exists"
  - "PAINT BACKGROUND color picker section in PaintProperties"
affects: [20-paint-brush-fx plan 03, 20-paint-brush-fx plan 04, previewRenderer integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["frame-level FX cache compositing via single drawImage()", "solid paint background fill before stroke rendering"]

key-files:
  created:
    - "Application/src/lib/paintRenderer.test.ts"
  modified:
    - "Application/src/lib/paintRenderer.ts"
    - "Application/src/stores/paintStore.ts"
    - "Application/src/types/paint.ts"
    - "Application/src/components/sidebar/PaintProperties.tsx"

key-decisions:
  - "Added Plan 01 prerequisite types/signals inline (Rule 3) since parallel execution requires self-contained changes"
  - "Used existing collapsible section pattern (Tablet/Onion Skin) for PAINT BACKGROUND section"
  - "ColorPickerModal for bg color uses onLiveChange+onCommit matching brush color picker pattern"

patterns-established:
  - "renderPaintFrameWithBg: solid bg fill then flat elements then FX cache overlay"
  - "renderFlatElements: skip elements with fxState 'fx-applied' or 'flattened'"

requirements-completed: [PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-07, PAINT-10, PAINT-11]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 20 Plan 02: Paint Renderer Solid Background & FX Cache Summary

**renderPaintFrameWithBg() with solid background fill, frame-level FX cache compositing via drawImage, and PAINT BACKGROUND color picker in PaintProperties**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T08:19:49Z
- **Completed:** 2026-03-26T08:27:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `renderPaintFrameWithBg()` export that fills solid background (D-11), renders flat elements, and composites frame-level FX cache via single `drawImage()`
- Added `renderFlatElements()` internal function that skips FX-applied/flattened strokes when frame cache exists
- Created PAINT BACKGROUND collapsible section in PaintProperties with color swatch, ColorPickerModal, and reset button
- All 9 paintRenderer tests passing with zero `it.todo` stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Update paintRenderer for solid background and frame-level FX cache compositing** - `144144f` (feat)
2. **Task 2: Add paint background color picker to PaintProperties** - `6ac6ae8` (feat)

## Files Created/Modified
- `Application/src/lib/paintRenderer.ts` - Added renderPaintFrameWithBg() and renderFlatElements()
- `Application/src/lib/paintRenderer.test.ts` - 9 tests for routing logic and fxState filtering
- `Application/src/stores/paintStore.ts` - Added paintBgColor signal, frameFxCache Map, get/set/invalidate methods
- `Application/src/types/paint.ts` - Added StrokeFxState, BrushStyle, BrushFxParams types, DEFAULT_PAINT_BG_COLOR
- `Application/src/components/sidebar/PaintProperties.tsx` - PAINT BACKGROUND collapsible section with color picker

## Decisions Made
- Added Plan 01 prerequisite types/signals (paintBgColor, getFrameFxCache, StrokeFxState, BrushStyle, BrushFxParams) directly since parallel execution means Plan 01 changes are not yet merged
- Used `DEFAULT_PAINT_BG_COLOR` constant for reset comparison instead of hardcoded '#FFFFFF'
- Matched ColorPickerModal pattern (onLiveChange + onCommit) from existing brush color picker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Plan 01 prerequisite types and store signals**
- **Found during:** Task 1 (paintRenderer update)
- **Issue:** Plan 02 references paintStore.paintBgColor, paintStore.getFrameFxCache, StrokeFxState, BrushStyle, BrushFxParams, and DEFAULT_PAINT_BG_COLOR which are Plan 01 deliverables not yet in codebase (parallel execution)
- **Fix:** Added StrokeFxState, BrushStyle, BrushFxParams types and DEFAULT_PAINT_BG_COLOR to paint.ts; Added paintBgColor signal, selectedStrokeIds signal, frameFxCache Map with get/set/invalidate/clearAll methods, setPaintBgColor method, and reset cleanup to paintStore.ts
- **Files modified:** Application/src/types/paint.ts, Application/src/stores/paintStore.ts
- **Verification:** TypeScript compiles cleanly, all 9 tests pass
- **Committed in:** 144144f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Prerequisite types/signals added inline for parallel execution. Plan 01 agent will add the same or compatible changes; merge will resolve any overlapping additions. No scope creep.

## Issues Encountered
- Worktree lacked node_modules; resolved by symlinking from main repo's Application/node_modules
- Pre-existing TypeScript errors in SidebarProperties.tsx (unused `isOnKf`) and glslRuntime.test.ts (unused `expect` import) -- not caused by this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- renderPaintFrameWithBg() ready for previewRenderer integration (Plan 03 will wire it)
- Frame-level FX cache infrastructure in place for brushP5Adapter.renderFrameFx() to populate
- PAINT BACKGROUND section visible in PaintProperties panel

## Self-Check: PASSED

All files exist, all commits verified (144144f, 6ac6ae8).

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-26*
