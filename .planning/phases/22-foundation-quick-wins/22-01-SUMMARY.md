---
phase: 22-foundation-quick-wins
plan: 01
subsystem: paint, canvas
tags: [paint-store, motion-path, undo-redo, sub-frame-sampling, signals]

# Dependency graph
requires: []
provides:
  - "_notifyVisualChange helper for centralized paint mutation notifications"
  - "moveElements* undo/redo with snapshot-based pushAction"
  - "Sub-frame sampling in sampleMotionDots for short sequences"
affects: [paint-properties, stroke-list-panel, motion-path-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_notifyVisualChange centralizes dirty+paintVersion+markProjectDirty triple"
    - "Snapshot-based undo/redo for array reorder operations (copy before/after)"

key-files:
  created:
    - Application/src/stores/paintStore.test.ts
  modified:
    - Application/src/stores/paintStore.ts
    - Application/src/components/canvas/MotionPath.tsx
    - Application/src/components/canvas/motionPath.test.ts

key-decisions:
  - "Snapshot-based undo/redo for moveElements* (simpler than re-executing algorithm)"
  - "vi.mock for projectStore and brushP5Adapter to break circular import in tests"

patterns-established:
  - "_notifyVisualChange: single helper for dirty+paintVersion+markProjectDirty"
  - "Snapshot undo/redo: copy array before/after mutation for clean restore"

requirements-completed: [UXP-03]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 22 Plan 01: Paint Store Bug Fixes & Motion Path Density Summary

**Fixed 4 paintStore moveElements* functions with undo/redo and _notifyVisualChange helper, plus sub-frame motion path sampling for short sequences**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T20:52:42Z
- **Completed:** 2026-03-26T20:59:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed all 4 moveElements* functions: added missing paintVersion++ and pushAction with snapshot-based undo/redo
- Added _notifyVisualChange helper to DRY the dirty+paintVersion+markProjectDirty pattern across 7 methods
- Implemented sub-frame sampling (0.25 step) for motion paths spanning < 30 frames, producing 4x denser dots
- Added 24 paintStore tests and 6 motionPath sub-frame tests, all passing with 0 regressions (274 total tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix paintStore moveElements* bugs (D-12)** - `8a828b9` (test) + `7753774` (fix)
2. **Task 2: Add sub-frame sampling to sampleMotionDots (UXP-03, D-11)** - `0587ccc` (test) + `420ab5b` (feat)

_Note: TDD tasks have RED (test) and GREEN (feat/fix) commits._

## Files Created/Modified
- `Application/src/stores/paintStore.ts` - Added _notifyVisualChange helper, fixed all 4 moveElements* with pushAction undo/redo
- `Application/src/stores/paintStore.test.ts` - New: 24 tests covering all moveElements* functions including undo/redo
- `Application/src/components/canvas/MotionPath.tsx` - Sub-frame sampling with step=0.25 for short sequences
- `Application/src/components/canvas/motionPath.test.ts` - Added 6 sub-frame sampling tests, updated existing tests for new behavior

## Decisions Made
- Used snapshot-based undo/redo (copy array before/after) instead of re-executing the sorting algorithm -- simpler and more reliable
- Used vi.mock for projectStore and brushP5Adapter in paintStore tests to break circular import and DOM dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked projectStore and brushP5Adapter for test isolation**
- **Found during:** Task 1 (paintStore test setup)
- **Issue:** Circular import (paintStore -> projectStore -> paintStore) caused _setPaintMarkDirtyCallback to fail at module load; brushP5Adapter requires DOM canvas APIs
- **Fix:** Added vi.mock for both modules before imports in test file
- **Files modified:** Application/src/stores/paintStore.test.ts
- **Verification:** All 24 tests pass
- **Committed in:** 8a828b9 (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for test execution. No scope creep.

## Issues Encountered
- pnpm install required in worktree (node_modules not shared across git worktrees) -- resolved immediately

## Known Stubs

None -- all functionality is fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Paint store bug fixes (D-12 blocker from STATE.md) now resolved -- subsequent phases can safely use moveElements* with undo/redo
- Motion path density improvement ready for visual verification by user

## Self-Check: PASSED

- All 5 files verified present
- All 4 task commits verified in git log
- All acceptance criteria confirmed via grep

---
*Phase: 22-foundation-quick-wins*
*Completed: 2026-03-26*
