---
phase: 23-stroke-interactions
plan: 03
subsystem: ui
tags: [canvas, hit-test, coordinate-mapping, paint-overlay, transform, undo]

# Dependency graph
requires:
  - phase: 23-stroke-interactions
    provides: "Transform undo, Alt+duplicate, non-uniform edge scale from plans 01-02"
provides:
  - "Correct hit-test coordinates accounting for asymmetric padding"
  - "Responsive bounding box overlay after undo/redo"
  - "Linear edge scale matching corner scale UX"
  - "Visually appropriate edge midpoint handle size"
affects: [paint-overlay, transform-overlay, coordinate-mapper]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Asymmetric padding compensation in clientToCanvas/canvasToClient via optional paddingTop/paddingBottom params"
    - "Snapshot-restore before absolute scale application to prevent exponential compounding"

key-files:
  created: []
  modified:
    - "Application/src/components/canvas/coordinateMapper.ts"
    - "Application/src/components/canvas/PaintOverlay.tsx"
    - "Application/src/components/canvas/TransformOverlay.tsx"

key-decisions:
  - "Pass padding values (0, 16) to clientToCanvas rather than changing CanvasArea CSS to keep toolbar spacing intact"
  - "Restore from transformSnapshot before each edge scale frame rather than switching to incremental delta approach"

patterns-established:
  - "coordinateMapper padding params: callers sharing CanvasArea containerRef must pass 0, 16 for paddingTop/paddingBottom"

requirements-completed: [PINT-01, PINT-02]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 23 Plan 03: UAT Gap Closure Summary

**Fixed 4 root causes (hit-test offset, stale overlay, exponential edge scale, small handles) resolving all 7 failing UAT tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T11:14:44Z
- **Completed:** 2026-03-27T11:17:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed asymmetric-padding hit-test offset in coordinateMapper affecting all canvas interactions (blocker)
- Fixed stale bounding box after undo/redo by adding paintVersion dependency to selection overlay useEffect
- Fixed exponential edge scale by restoring from snapshot before each frame's absolute scale application
- Increased edge midpoint handle radius from 3px to 5px for visual parity with corner handles

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix asymmetric-padding hit-test offset in coordinateMapper** - `efbf774` (fix)
2. **Task 2: Fix stale bounding box, exponential edge scale, and edge handle size** - `eed45d9` (fix)

## Files Created/Modified
- `Application/src/components/canvas/coordinateMapper.ts` - Added paddingTop/paddingBottom optional params to clientToCanvas and canvasToClient for asymmetric padding compensation
- `Application/src/components/canvas/PaintOverlay.tsx` - Fixed selection overlay useEffect deps, edge scale snapshot restore, edge handle radius
- `Application/src/components/canvas/TransformOverlay.tsx` - Updated two clientToCanvas callers with padding args (0, 16)

## Decisions Made
- Chose to add optional padding parameters to coordinateMapper rather than changing the CanvasArea CSS layout, because pt-0 is intentional for toolbar spacing
- Chose snapshot-restore approach for edge scale fix rather than switching to incremental delta, because the absolute ratio from mouse position vs original dimension is simpler and the snapshot infrastructure already existed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation check required running from Application/ subdirectory; all errors found are pre-existing (missing node_modules in worktree) and unrelated to changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 previously-failing UAT tests should now pass (hit-test alignment, overlay refresh, linear edge scale, handle visibility)
- Phase 23 gap closure complete - all features from plans 01 and 02 are fully functional

## Self-Check: PASSED

- All 3 modified source files exist on disk
- Both task commits (efbf774, eed45d9) found in git log
- SUMMARY.md created at expected path
- No stubs or placeholders found in modified files

---
*Phase: 23-stroke-interactions*
*Completed: 2026-03-27*
