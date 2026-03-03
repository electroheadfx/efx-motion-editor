---
phase: 05-editing-infrastructure
plan: 01
subsystem: infra
tags: [preact-signals, tauri-dialog, store-lifecycle, unsaved-changes]

# Dependency graph
requires:
  - phase: 04-timeline
    provides: timelineStore, playbackEngine, autoSave used by closeProject lifecycle
provides:
  - Fixed closeProject() with full store/engine reset (no data bleed between projects)
  - guardUnsavedChanges() module for native macOS Save/Don't Save/Cancel dialog
  - Window close intercept preventing accidental data loss
  - Idempotent startAutoSave() preventing timer accumulation
affects: [05-editing-infrastructure, 06-layer-system]

# Tech tracking
tech-stack:
  added: []
  patterns: [store-lifecycle-reset, unsaved-changes-guard, window-close-intercept]

key-files:
  created:
    - Application/src/lib/unsavedGuard.ts
  modified:
    - Application/src/stores/projectStore.ts
    - Application/src/lib/autoSave.ts
    - Application/src/components/layout/Toolbar.tsx
    - Application/src/main.tsx

key-decisions:
  - "guardUnsavedChanges() returns GuardResult union type for clean caller control flow"
  - "closeProject() stops engines/timers before resetting stores to prevent orphaned operations"
  - "createProject() and openProject() both call closeProject() first for guaranteed clean state"

patterns-established:
  - "Store lifecycle reset: stopAutoSave -> playbackEngine.stop -> batch(projectStore reset) -> sequenceStore.reset -> imageStore.reset -> uiStore.reset -> timelineStore.reset -> layerStore.reset -> historyStore clear"
  - "Unsaved guard pattern: check isDirty, show native 3-button dialog, handle Save/Don't Save/Cancel with Save As fallback for unsaved projects"
  - "Window close intercept: getCurrentWindow().onCloseRequested with event.preventDefault() on cancel"

requirements-completed: [INFRA-01, INFRA-02, KEY-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 5 Plan 1: Store Lifecycle Fix + Unsaved Changes Guard Summary

**Fixed closeProject() to reset all 7 stores and stop playback/auto-save engines, plus native macOS unsaved-changes dialog on New/Open/window-close paths**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T17:10:36Z
- **Completed:** 2026-03-03T17:12:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed closeProject() to reset ALL stores (project, sequence, image, ui, timeline, layer, history) and stop playback engine + auto-save timer -- eliminates data bleed between projects (INT-01, INT-02, INT-03)
- Created unsavedGuard.ts with native macOS "Save / Don't Save / Cancel" dialog using @tauri-apps/plugin-dialog message() with YesNoCancel buttons
- Wired unsaved-changes guards on Toolbar New button, Open button, and window close event
- Made startAutoSave() idempotent to prevent duplicate timer accumulation on repeated calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix closeProject() lifecycle and wire unsaved-changes guard** - `3285b6d` (fix)
2. **Task 2: Wire unsaved-changes guards into Toolbar and window close** - `4ff609a` (feat)

## Files Created/Modified
- `Application/src/lib/unsavedGuard.ts` - New module exporting guardUnsavedChanges() with native 3-button dialog
- `Application/src/stores/projectStore.ts` - Fixed closeProject() with full reset chain; createProject()/openProject() call closeProject() first then startAutoSave() after
- `Application/src/lib/autoSave.ts` - Made startAutoSave() idempotent with existing-watcher guard
- `Application/src/components/layout/Toolbar.tsx` - New handleNew() with guard; handleOpen() with guard before file picker
- `Application/src/main.tsx` - Window close intercept via onCloseRequested with guardUnsavedChanges()

## Decisions Made
- guardUnsavedChanges() returns a union type `'saved' | 'discarded' | 'cancelled'` rather than boolean, giving callers precise control over each outcome
- closeProject() stops engines/timers BEFORE resetting stores to guarantee no orphaned operations write stale data
- Both createProject() and openProject() call closeProject() as first step, ensuring clean state regardless of previous project state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- guardUnsavedChanges() is ready for reuse by Plan 03 (keyboard shortcuts: Cmd+S/N/O)
- closeProject() lifecycle is complete -- safe foundation for undo/redo (Plan 02) which needs historyStore.reset() in the chain
- All stores properly reset on project switch -- ready for layer system (Phase 6)

## Self-Check: PASSED

All 5 files verified present. Both task commits (3285b6d, 4ff609a) verified in git log.

---
*Phase: 05-editing-infrastructure*
*Completed: 2026-03-03*
