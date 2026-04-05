---
phase: 33-enhance-current-engine
plan: 07
subsystem: ui
tags: [paint, animation, stroke-distribution, undo]

requires:
  - phase: 33-04
    provides: PaintMode type, activePaintMode signal, paint mode infrastructure
provides:
  - Speed-based stroke point distribution algorithm (distributeStrokeBySpeed)
  - Animate button and modal dialog in PaintProperties
  - Atomic batch undo for multi-frame stroke animation
  - Public _getOrCreateFrame accessor on paintStore
affects: [paint-workflow, stroke-animation, undo-system]

tech-stack:
  added: []
  patterns: [speed-based-point-distribution, atomic-batch-undo-via-direct-frame-mutation]

key-files:
  created:
    - app/src/lib/strokeAnimation.ts
  modified:
    - app/src/components/sidebar/PaintProperties.tsx
    - app/src/stores/paintStore.ts

key-decisions:
  - "Exposed _getOrCreateFrame on paintStore for external batch mutations to avoid individual undo entries"
  - "Used inverse distance weighting for speed-based distribution -- slow segments get more frames, fast segments fewer"

patterns-established:
  - "Atomic batch undo: snapshot before-state, mutate directly, push single pushAction with full restore"
  - "Frame range calculation from fxTrackLayouts/trackLayouts -- no hardcoded frame counts"

requirements-completed: [ECUR-13]

duration: 3min
completed: 2026-04-05
---

# Phase 33 Plan 07: Stroke Draw-Reveal Animation Summary

**Speed-based stroke animation distributing points across frames with inverse distance weighting and atomic single-Cmd+Z undo**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T10:07:32Z
- **Completed:** 2026-04-05T10:10:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created distributeStrokeBySpeed algorithm using inverse distance weighting for natural draw-reveal
- Added Animate button next to Copy to Next Frame with modal offering layer/sequence target options
- Implemented atomic batch undo -- entire multi-frame animation undone with single Cmd+Z
- Frame ranges derived from real timeline data (fxTrackLayouts/trackLayouts), no hardcoded constants

## Task Commits

Each task was committed atomically:

1. **Task 1: Create strokeAnimation.ts with speed-based point distribution** - `e88bacc` (feat)
2. **Task 2: Add Animate button and modal to PaintProperties, wire to paintStore with atomic undo** - `1698b6a` (feat)

## Files Created/Modified
- `app/src/lib/strokeAnimation.ts` - Speed-based point distribution algorithm (distributeStrokeBySpeed)
- `app/src/components/sidebar/PaintProperties.tsx` - Animate button, modal dialog, handleAnimate with atomic undo
- `app/src/stores/paintStore.ts` - Exposed _getOrCreateFrame for external batch frame mutations

## Decisions Made
- Exposed `_getOrCreateFrame` on paintStore to allow batch mutations without triggering individual undo entries from `addElement`
- Used inverse distance weighting: slow drawing (small point distances) = more frames allocated, fast drawing = fewer frames

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Stroke animation feature complete and ready for user testing
- Atomic undo pattern established for future multi-frame operations

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
