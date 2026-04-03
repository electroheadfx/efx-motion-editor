---
phase: 23-stroke-interactions
plan: 01
subsystem: ui
tags: [paint, undo-redo, transforms, preact, typescript, canvas]

# Dependency graph
requires:
  - phase: 22-foundation-quick-wins
    provides: moveElements undo/redo bug fixes and paintVersion++ patterns
provides:
  - Transform undo infrastructure via snapshot-before/commit-on-release pattern
  - Generalized element handling for PaintStroke, PaintShape, PaintFill in all selection/transform code
  - captureElementSnapshot/restoreElementSnapshot helpers for deep-clone undo snapshots
  - transformSnapshot, transformLayerId, transformFrame refs for gesture undo
affects: [23-02-plan, any paint overlay interaction plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot-before/commit-on-release undo: capture deep clone of elements on pointerdown, push single undo entry on pointerup"
    - "structuredClone for deep snapshot: captureElementSnapshot/restoreElementSnapshot use structuredClone for safe deep copy"
    - "Gesture undo refs: transformSnapshot + transformLayerId + transformFrame capture full undo context on gesture start"

key-files:
  created: []
  modified:
    - Application/src/components/canvas/PaintOverlay.tsx

key-decisions:
  - "Snapshot size guard: only push pushAction if snapshot.size > 0, preventing empty undo entries from click-without-move"
  - "Separate transformLayerId/transformFrame refs: avoids stale closure captures by reading layer/frame at gesture start rather than at pointerup"
  - "4 remaining el.tool !== brush checks are all FX-only (syncStyleToSelection + 3 FX application effects), not transform/bounds code"

patterns-established:
  - "Undo snapshot pattern: capture before gesture, commit after release, 1 entry per gesture"
  - "Element generalization: handle PaintStroke/eraser, PaintShape (line/rect/ellipse), PaintFill in findElementAtPoint, getSelectionBounds, transform loops, bounding box rendering"

requirements-completed: [PINT-01, PINT-02]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 23 Plan 01: Stroke Interactions Foundation Summary

**Undo/redo for all three transform gestures (drag-move, rotate, uniform scale) via snapshot-before/commit-on-release pattern, plus element handling generalized to PaintStroke, PaintShape, and PaintFill**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-27T09:29:55Z
- **Completed:** 2026-03-27T09:33:15Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Renamed `findStrokeAtPoint` to `findElementAtPoint` with shape (bounding box) and fill (10px circle) hit testing
- Generalized `getSelectionBounds`, all three transform loops (rotate/scale/drag), and individual element bounding box rendering to handle all PaintElement types
- Added `captureElementSnapshot`/`restoreElementSnapshot` helper functions using structuredClone
- Added `transformSnapshot`, `transformLayerId`, `transformFrame` refs to component
- Snapshot captured on gesture start for all three gestures in `handleSelectPointerDown`
- Single `pushAction` undo entry committed on gesture end in `handlePointerUp` for both transform and drag paths
- Both undo and redo closures call `markDirty` + `paintVersion.value++` + `invalidateFrameFxCache`

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize element handling functions beyond brush-only** - `eb3d30d` (feat)
2. **Task 2: Add snapshot-before/commit-on-release undo for all existing transforms** - `4a634e4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `Application/src/components/canvas/PaintOverlay.tsx` - Generalized element handling and added transform undo infrastructure

## Decisions Made

- Snapshot size guard (`snapshot.size > 0`) before pushAction prevents empty undo entries from user clicks that don't result in movement
- Separate `transformLayerId`/`transformFrame` refs rather than reading from store at pointerup avoids stale closure captures when frame changes during gesture
- The 4 remaining `el.tool !== 'brush'` checks (line 580, 1241, 1263, 1300) are all legitimately brush-only: `syncStyleToSelection` and the 3 FX application effects — plan expected "3 or fewer" but 4 is correct since all are FX-adjacent, not transform/bounds code

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already partially implemented when execution began (the generalization code was present in the working tree), so it was committed as Task 1. Task 2 was then implemented to complete the undo infrastructure.

## Issues Encountered

The file already had Task 1 changes (element generalization, helper functions, imports) implemented in the working tree before this plan ran. This was valid work toward the plan objectives. Committed Task 1 as-is, then implemented Task 2 on top.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three existing transform gestures now have undo/redo support
- Plan 02 can add Alt+duplicate and non-uniform scale gestures on top of this undo infrastructure
- `captureElementSnapshot`/`restoreElementSnapshot` are reusable for Plan 02's new gestures
- TypeScript compiles cleanly for PaintOverlay.tsx (4 pre-existing errors in other files remain)

---
*Phase: 23-stroke-interactions*
*Completed: 2026-03-27*
