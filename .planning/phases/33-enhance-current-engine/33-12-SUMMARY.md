---
phase: 33-enhance-current-engine
plan: 12
subsystem: paint
tags: [preact-signals, paint-mode, brush-style, fx-conversion, per-layer-mode]

# Dependency graph
requires:
  - phase: 33-enhance-current-engine
    provides: paintStore with brushStyle/brushFxParams signals, renderFrameFx FX cache pipeline
provides:
  - PaintMode type ('flat' | 'fx-paint') for per-layer mode management
  - setActivePaintMode() with automatic brushStyle reset on mode change
  - getFrameMode() inference from frame stroke content
  - PaintModeSelector component with flat-to-FX stroke batch conversion
  - handleAddPaintLayer auto-enters paint mode with correct brush for frame content
affects: [paint-workflow, brush-selection, fx-rendering, paint-layer-creation]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-layer-mode-inference, brush-reset-on-mode-switch, stroke-batch-conversion]

key-files:
  created:
    - app/src/components/sidebar/PaintModeSelector.tsx
  modified:
    - app/src/stores/paintStore.ts
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/types/paint.ts

key-decisions:
  - "PaintMode is per-layer inferred from frame content, not persisted globally"
  - "setActivePaintMode resets brushStyle to match mode (flat->flat brush, fx-paint->watercolor if currently flat)"
  - "convertFrame updates stroke brushStyle/brushParams/fxState in-place, then markDirty + invalidate + refresh cache"

patterns-established:
  - "Per-layer mode inference: getFrameMode scans stroke brushStyle to determine flat vs fx-paint"
  - "Mode switch brush reset: setActivePaintMode always syncs brush tool to mode"

requirements-completed: [ECUR-05, ECUR-09]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 33 Plan 12: Per-Layer Paint Mode Summary

**Per-layer paint mode with brushStyle reset on mode switch, frame content inference, and flat-to-FX stroke batch conversion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T14:01:58Z
- **Completed:** 2026-04-05T14:05:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added PaintMode type and activePaintMode signal for per-layer mode tracking
- setActivePaintMode() resets brushStyle/brushFxParams to match mode (flat brush for flat mode, watercolor for FX if coming from flat)
- getFrameMode() infers mode from frame stroke content (any non-flat brushStyle = fx-paint)
- handleAddPaintLayer in AddFxMenu now enters paint mode and sets correct brush based on frame content
- PaintModeSelector component provides flat-to-FX and FX-to-flat stroke batch conversion with full cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix setActivePaintMode to reset brushStyle and fix auto-enter per-layer logic** - `6952d6c` (feat)
2. **Task 2: Fix flat-to-FX conversion to update stroke brushStyle and invalidate cache** - `eea5c53` (feat)

## Files Created/Modified
- `app/src/types/paint.ts` - Added PaintMode type ('flat' | 'fx-paint')
- `app/src/stores/paintStore.ts` - Added activePaintMode signal, setActivePaintMode() with brush reset, getFrameMode() inference
- `app/src/components/timeline/AddFxMenu.tsx` - Updated handleAddPaintLayer to enter paint mode and infer correct mode
- `app/src/components/sidebar/PaintModeSelector.tsx` - New component with convertFrame/handleConvert for mode conversion

## Decisions Made
- PaintMode is per-layer, inferred from frame content via getFrameMode(), not persisted globally -- mode should match what strokes are on the frame
- setActivePaintMode resets brushStyle: flat mode always gets flat brush, fx-paint gets watercolor if currently flat (keeps current FX style if already non-flat)
- Mode is NOT saved via savePaintMode -- this was deliberately omitted because mode is per-layer, not a global preference

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created PaintModeSelector.tsx as new file instead of modifying existing**
- **Found during:** Task 2
- **Issue:** Plan referenced PaintModeSelector.tsx at specific line numbers (48-73, 75-89) as if it already existed, but the file did not exist in the codebase
- **Fix:** Created the component from scratch with convertFrame() and handleConvert() functions matching the plan's requirements
- **Files modified:** app/src/components/sidebar/PaintModeSelector.tsx (created)
- **Verification:** grep confirms markDirty, paintVersion.value++, setBrushStyle all present
- **Committed in:** eea5c53

**2. [Rule 2 - Missing Critical] Created setActivePaintMode and getFrameMode as new functions**
- **Found during:** Task 1
- **Issue:** Plan referenced setActivePaintMode at line 532 and initFromPreferences at line 538 as existing functions to modify, but neither existed. The important_context note about duplicate removal was misleading for this worktree state.
- **Fix:** Created both functions fresh in paintStore.ts, along with the PaintMode type and activePaintMode signal
- **Files modified:** app/src/stores/paintStore.ts, app/src/types/paint.ts
- **Verification:** grep confirms brushStyle.value = 'flat' present, no savePaintMode calls, getFrameMode in AddFxMenu
- **Committed in:** 6952d6c

---

**Total deviations:** 2 auto-fixed (2 missing critical -- functions/files referenced by plan did not exist)
**Impact on plan:** Both deviations were necessary to implement the plan's objective. All acceptance criteria met despite file/function references being incorrect.

## Issues Encountered
- Plan referenced specific line numbers and existing functions (setActivePaintMode, initFromPreferences, PaintModeSelector.tsx) that did not exist in the current codebase state. Created them fresh to match the plan's behavioral requirements.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PaintModeSelector component is exported and ready to be integrated into PaintProperties sidebar
- setActivePaintMode and getFrameMode are available on paintStore for any component that needs mode-aware behavior
- handleConvert is exported from PaintModeSelector for programmatic mode conversion

## Self-Check: PASSED

- All 4 source files FOUND
- SUMMARY.md FOUND
- Commit 6952d6c FOUND
- Commit eea5c53 FOUND

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
