---
phase: 33-enhance-current-engine
plan: 17
subsystem: paint
tags: [paint-persistence, background-color, fx-mode, signals, sidecar-json]

# Dependency graph
requires:
  - phase: 33-12
    provides: "3-mode paint system with setActivePaintMode and activePaintMode signal"
  - phase: 33-15
    provides: "FX canvas refresh on color change with paintVersion bumping"
provides:
  - "Auto-set white background on FX mode switch"
  - "Per-frame bgColor persistence in paint sidecar JSON"
  - "bgColor restoration on project load with FX stroke inference fallback"
affects: [paint-rendering, project-persistence, paint-mode-switching]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-frame bgColor in PaintFrame sidecar JSON", "FX stroke inference for bgColor fallback"]

key-files:
  created: []
  modified:
    - app/src/stores/paintStore.ts
    - app/src/types/paint.ts
    - app/src/lib/paintPersistence.ts

key-decisions:
  - "bgColor inferred from FX stroke presence during save rather than reading current signal value"
  - "Fallback inference on load checks both fxState and brushStyle for backward compat with older saves"

patterns-established:
  - "Per-frame metadata in PaintFrame interface (bgColor) for sidecar persistence"

requirements-completed: [ECUR-09]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 33 Plan 17: FX White Background Persistence Summary

**Auto-set white bg on FX mode switch with per-frame bgColor persistence in paint sidecar JSON**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T16:12:05Z
- **Completed:** 2026-04-05T16:16:27Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- FX mode now auto-sets white background when switching via setActivePaintMode
- Flat mode auto-sets transparent background on mode switch
- bgColor field added to PaintFrame interface for per-frame persistence
- Save pipeline infers and writes bgColor for frames containing FX strokes
- Load pipeline restores bgColor from sidecar JSON with fallback inference from FX stroke presence

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-set white bg on FX mode and add bgColor to PaintFrame persistence** - `2b23056` (feat)

## Files Created/Modified
- `app/src/stores/paintStore.ts` - Added paintBgColor switching in setActivePaintMode; fixed duplicate activePaintMode signal declarations and duplicate setActivePaintMode methods
- `app/src/types/paint.ts` - Added optional bgColor field to PaintFrame interface
- `app/src/lib/paintPersistence.ts` - Added bgColor inference on save and bgColor restoration on load with FX stroke fallback

## Decisions Made
- Infer bgColor from FX stroke presence during save rather than reading the current paintBgColor signal, ensuring the saved value accurately reflects frame content regardless of UI state
- Fallback inference on load checks both fxState === 'fx-applied' and brushStyle !== 'flat' for backward compatibility with older saved frames that may not have bgColor field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate activePaintMode signal declarations and duplicate setActivePaintMode methods**
- **Found during:** Task 1 (reading paintStore.ts before modification)
- **Issue:** Plans 12 and earlier had left duplicate `const activePaintMode = signal<PaintMode>('flat')` declarations (lines 28 and 35), duplicate `activePaintMode` entries in the export object, duplicate `activePaintMode.value = 'flat'` resets in `reset()`, and two competing `setActivePaintMode` method definitions (one from old Plan 12 with savePaintMode persistence, one from newer Plan 12 rewrite without persistence)
- **Fix:** Removed duplicate signal declaration (kept first), removed duplicate export entry, removed duplicate reset lines, removed the older less-complete setActivePaintMode method (kept the newer version which correctly resets brushFxParams)
- **Files modified:** app/src/stores/paintStore.ts
- **Verification:** grep confirms single activePaintMode declaration and single setActivePaintMode method
- **Committed in:** 2b23056 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary for correctness -- duplicate const declarations would cause runtime errors. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FX white background now persists across save/load cycles
- Mode switching correctly sets background color in both directions

## Self-Check: PASSED

All created/modified files verified present. All commit hashes verified in git log.

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
