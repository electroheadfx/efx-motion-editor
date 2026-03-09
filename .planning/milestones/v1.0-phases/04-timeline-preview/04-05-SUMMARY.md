---
phase: 04-timeline-preview
plan: 05
subsystem: ui
tags: [pointer-events, drag, scrubbing, pan, canvas, timeline]

# Dependency graph
requires:
  - phase: 04-timeline-preview
    provides: TimelineInteraction class with mouse event handlers, CanvasArea with mouse pan handlers
provides:
  - Pointer event-based playhead drag scrubbing (replaces broken mouse events)
  - Pointer event-based middle-click preview pan (replaces broken mouse events)
  - Working setPointerCapture/releasePointerCapture with real pointerId values
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PointerEvent over MouseEvent when setPointerCapture is needed (pointerId availability)"

key-files:
  created: []
  modified:
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/layout/CanvasArea.tsx

key-decisions:
  - "Switched from MouseEvent to PointerEvent for timeline and preview interactions to get real pointerId for setPointerCapture"
  - "Widened playhead hit area from 5px to 10px for easier drag targeting"
  - "Kept try/catch safety net around releasePointerCapture despite real pointerId (browser may release early)"

patterns-established:
  - "PointerEvent pattern: use pointerdown/pointermove/pointerup with e.pointerId for any interaction needing setPointerCapture"

requirements-completed: [TIME-02, TIME-03, PREV-04]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 04 Plan 05: Pointer Events Fix Summary

**Switched timeline playhead drag and preview middle-click pan from MouseEvent to PointerEvent, fixing DOMException: InvalidPointerId from setPointerCapture(0)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T17:35:34Z
- **Completed:** 2026-03-09T17:37:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TimelineInteraction now uses pointerdown/pointermove/pointerup with real e.pointerId for setPointerCapture
- CanvasArea middle-click pan uses PointerEvent handlers with proper pointer capture
- Playhead hit area widened from 5px to 10px for easier drag targeting
- All unsafe casts `(e as unknown as PointerEvent).pointerId ?? 0` eliminated

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch TimelineInteraction from mouse to pointer events** - `340a762` (fix)
2. **Task 2: Switch CanvasArea middle-click pan from mouse to pointer events** - `b6a5083` (fix)

## Files Created/Modified
- `Application/src/components/timeline/TimelineInteraction.ts` - Converted all mouse event handlers to pointer events, widened playhead hit area
- `Application/src/components/layout/CanvasArea.tsx` - Converted middle-click pan handlers from mouse to pointer events

## Decisions Made
- Switched from MouseEvent to PointerEvent for all drag interactions that use setPointerCapture (MouseEvent has no pointerId)
- Widened playhead hit area from 5px to 10px to make scrubbing easier to initiate
- Kept try/catch around releasePointerCapture as a safety net even though real pointerId should not throw

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Playhead drag scrubbing and middle-click pan should now work correctly (UAT Tests 6, 8)
- Track header drag-and-drop for sequence reorder continues to work with pointer events
- Remaining gap closure plans (04-04, other pending) can proceed independently

## Self-Check: PASSED

All files exist. All commits verified (340a762, b6a5083).

---
*Phase: 04-timeline-preview*
*Completed: 2026-03-09*
