---
phase: 33-enhance-current-engine
plan: 01
subsystem: paint
tags: [undo-redo, fx-brush, p5-brush, paint-mode, sidebar-ux]

requires: []
provides:
  - "Fixed undo/redo closures with _notifyVisualChange and FX cache invalidation"
  - "FX brush style applied at stroke creation time"
  - "Auto-enter paint mode on paint layer creation"
  - "Confirmation-free clear brush"
  - "Orange pulsate exit button"
  - "STROKES section before SELECTION in sidebar"
affects: [33-02, 33-03, 33-04]

tech-stack:
  added: []
  patterns:
    - "All undo/redo closures must call _notifyVisualChange + invalidateFrameFxCache + refreshFrameFx"
    - "Stroke objects capture brushStyle at creation time from paintStore.brushStyle.peek()"

key-files:
  created: []
  modified:
    - app/src/stores/paintStore.ts
    - app/src/components/canvas/PaintOverlay.tsx
    - app/src/components/sidebar/PaintProperties.tsx
    - app/src/components/timeline/AddFxMenu.tsx

key-decisions:
  - "Strokes now capture brushStyle at creation time instead of always 'flat' -- enables immediate FX drawing"
  - "All move element undo/redo closures get FX cache invalidation for spectral mixing correctness"

patterns-established:
  - "Every undo/redo closure that modifies f.elements must call _notifyVisualChange + FX cache invalidation"

requirements-completed: [ECUR-01, ECUR-02, ECUR-05, ECUR-06]

duration: 5min
completed: 2026-04-05
---

# Phase 33 Plan 01: Undo/Redo Fixes and UX Quick Wins Summary

**Fixed all undo/redo rendering bugs with _notifyVisualChange + FX cache invalidation, enabled immediate FX brush drawing, and implemented 4 UX quick wins (auto-enter paint mode, no-confirm clear, orange exit button, sidebar reorder)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T09:44:14Z
- **Completed:** 2026-04-05T09:49:53Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Every undo/redo closure in paintStore now calls _notifyVisualChange and invalidates FX cache, ensuring Cmd+Z always re-renders correctly
- FX brush style is captured on the stroke object at creation time, so drawing with watercolor/ink/charcoal immediately renders in that style
- Creating a paint layer auto-enters paint mode, Clear Brush works instantly without confirmation, Exit Paint Mode button is orange with pulsate animation, STROKES panel appears before SELECTION

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix undo/redo rendering bugs in paintStore** - `efbe3f7` (fix)
2. **Task 2: Fix FX brush style not applying during drawing** - `968fb24` (fix)
3. **Task 3: UX quick wins** - `1a14d40` (feat)

## Files Created/Modified
- `app/src/stores/paintStore.ts` - Fixed all undo/redo closures with _notifyVisualChange and FX cache invalidation
- `app/src/components/canvas/PaintOverlay.tsx` - Set brushStyle from current signal at stroke creation, trigger FX refresh
- `app/src/components/sidebar/PaintProperties.tsx` - Remove confirmClear, orange pulsate exit button, move STROKES before SELECTION
- `app/src/components/timeline/AddFxMenu.tsx` - Auto-enter paint mode on paint layer creation

## Decisions Made
- Changed stroke creation from always-flat to using current brushStyle -- enables immediate FX drawing workflow alongside the existing select-and-apply workflow
- Added FX cache invalidation to moveForward/Backward/ToFront/ToBack undo/redo closures (plan only specified addElement and clearFrame, but reordering affects spectral mixing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added FX cache invalidation to element move undo/redo closures**
- **Found during:** Task 1 (undo audit)
- **Issue:** moveElementsForward/Backward/ToFront/ToBack undo/redo closures had _notifyVisualChange but no FX cache invalidation -- reordering FX strokes changes spectral mixing order
- **Fix:** Added invalidateFrameFxCache + refreshFrameFx to all 8 closures (4 methods x undo+redo)
- **Files modified:** app/src/stores/paintStore.ts
- **Verification:** All undo/redo closures now have consistent FX cache invalidation
- **Committed in:** efbe3f7 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added FX cache invalidation to removeElement redo closure**
- **Found during:** Task 1 (undo audit)
- **Issue:** removeElement redo closure used paintStore.markDirty instead of _notifyVisualChange and had no FX cache handling
- **Fix:** Replaced with _notifyVisualChange + invalidateFrameFxCache + refreshFrameFx
- **Files modified:** app/src/stores/paintStore.ts
- **Committed in:** efbe3f7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes necessary for correctness -- element reorder and removal must invalidate FX cache for correct spectral mixing. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all functionality is fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Undo/redo is now robust for both flat and FX strokes
- FX brush drawing works immediately without requiring select-and-apply
- UX improvements ready for user testing
- Ready for 33-02 (next plan in wave 1)

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
