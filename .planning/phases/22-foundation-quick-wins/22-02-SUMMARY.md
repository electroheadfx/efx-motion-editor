---
phase: 22-foundation-quick-wins
plan: 02
subsystem: ui
tags: [preact, signals, isolation, layer-creation, menus]

# Dependency graph
requires:
  - phase: none
    provides: isolationStore and sequenceStore already existed
provides:
  - addLayerToSequence(sequenceId, layer) method on sequenceStore with undo/redo
  - targetSequenceId field on AddLayerIntent type
  - Isolation-aware layer creation in both sidebar and timeline menus
  - "Adding to: [name]" visual indicator in both menus
affects: [22-foundation-quick-wins plan 03]

# Tech tracking
tech-stack:
  added: []
  patterns: [isolation-scoped layer creation via addLayerToSequence]

key-files:
  created: []
  modified:
    - Application/src/stores/uiStore.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/sequenceStore.test.ts
    - Application/src/components/layer/AddLayerMenu.tsx
    - Application/src/components/timeline/AddFxMenu.tsx
    - Application/src/components/views/ImportedView.tsx

key-decisions:
  - "Added addLayerToSequence method rather than mutating activeSequenceId to avoid side effects"
  - "Used targetSequenceId in intent for async sidebar flows (ImportedView)"

patterns-established:
  - "Isolation-scoped creation: check isolationStore.isolatedSequenceIds, route to addLayerToSequence if isolated"

requirements-completed: [UXP-02]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 22 Plan 02: Isolation-Aware Layer Creation Summary

**Sequence-scoped layer creation via addLayerToSequence with isolation detection in both sidebar and timeline menus plus "Adding to:" indicator**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T20:52:08Z
- **Completed:** 2026-03-26T20:56:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added addLayerToSequence(sequenceId, layer) to sequenceStore with full undo/redo support
- Extended AddLayerIntent type with optional targetSequenceId field for async intent flows
- Both sidebar (AddLayerMenu) and timeline (AddFxMenu) menus detect isolation and route layer creation to isolated sequence
- Both menus display "Adding to: [Sequence Name]" indicator when a sequence is isolated
- ImportedView handles targetSequenceId for static-image, video, and image-sequence async flows
- Unit tests for addLayerToSequence (positive and negative cases) pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add addLayerToSequence method and extend AddLayerIntent type** - `35fce0f` (feat)
2. **Task 2: Wire isolation-aware creation into both AddLayerMenus and ImportedView** - `a35793b` (feat)

## Files Created/Modified
- `Application/src/stores/uiStore.ts` - Added targetSequenceId to AddLayerIntent type
- `Application/src/stores/sequenceStore.ts` - Added addLayerToSequence method with snapshot/pushAction undo
- `Application/src/stores/sequenceStore.test.ts` - Added 2 tests for addLayerToSequence
- `Application/src/components/layer/AddLayerMenu.tsx` - Isolation detection, targetSequenceId in intents, "Adding to:" indicator
- `Application/src/components/timeline/AddFxMenu.tsx` - Isolation detection, routes FX/paint/content to isolated sequence, "Adding to:" indicator
- `Application/src/components/views/ImportedView.tsx` - Handles targetSequenceId for static-image, video, image-sequence flows

## Decisions Made
- Used addLayerToSequence method rather than changing activeSequenceId to avoid side effects (per research recommendation)
- Passed targetSequenceId through AddLayerIntent for async sidebar flows so ImportedView can route correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree needed pnpm install before tests could run (resolved immediately)

## Known Stubs

None - all data paths are wired and functional.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Isolation-aware layer creation complete, ready for visual verification in Plan 03
- Both menus and ImportedView handle all layer types correctly

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (35fce0f, a35793b) found in git log. 246 tests pass, 0 failures.

---
*Phase: 22-foundation-quick-wins*
*Completed: 2026-03-26*
