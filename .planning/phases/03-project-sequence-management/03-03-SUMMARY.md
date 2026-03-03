---
phase: 03-project-sequence-management
plan: 03
subsystem: ui, state
tags: [preact, sortablejs, signals, drag-drop, sequence-management, key-photos]

# Dependency graph
requires:
  - phase: 03-project-sequence-management/01
    provides: "Sequence/KeyPhoto types with imageId, sequenceStore basics, sortablejs installed"
  - phase: 02-ui-shell-image-pipeline
    provides: "imageStore with getDisplayUrl, assetUrl helper, ImportGrid, LeftPanel shell"
provides:
  - "Full sequence CRUD: create, rename, duplicate, delete, reorder via drag-and-drop"
  - "Full key photo CRUD: add from imported images, remove, reorder via drag-and-drop, edit hold frames"
  - "SequenceList component with SortableJS integration"
  - "KeyPhotoStrip component with horizontal SortableJS integration"
  - "Per-sequence fps toggle (15/24) and resolution dropdown"
  - "markDirty callback pattern for auto-save integration"
affects: [03-02-PLAN, 04-timeline, 05-fx-layers, 08-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [sortablejs-preact-integration, callback-pattern-circular-import-avoidance, inline-editing-pattern]

key-files:
  created:
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/sequence/KeyPhotoStrip.tsx
  modified:
    - Application/src/stores/sequenceStore.ts
    - Application/src/components/layout/LeftPanel.tsx

key-decisions:
  - "markDirty callback pattern avoids circular import between sequenceStore and projectStore"
  - "SortableJS onEnd updates store signal (new array reference), Preact re-renders with correct order"
  - "Layer mock data kept in LeftPanel with Phase 5 TODO comment for visual completeness"
  - "Per-sequence resolution uses dropdown with common presets rather than freeform input"

patterns-established:
  - "SortableJS + Preact: create instance in useEffect, destroy on cleanup, recreate on key dependency changes"
  - "Inline editing: click/double-click triggers input, Enter/Escape/blur commits or cancels"
  - "Context menu: absolute positioned div toggled by state, closed on click-outside via document listener"
  - "Callback registration: export _setMarkDirtyCallback() for cross-module hooks without circular imports"

requirements-completed: [SEQN-01, SEQN-02, SEQN-03, SEQN-04, SEQN-05]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 03 Plan 03: Sequence Management UI Summary

**Full sequence and key photo CRUD with SortableJS drag-and-drop reordering, inline editing, per-sequence fps/resolution settings, and LeftPanel integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T10:35:47Z
- **Completed:** 2026-03-03T10:39:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Enhanced sequenceStore with 12 new methods: createSequence, duplicate, reorderSequences, rename, setSequenceFps, setSequenceResolution, addKeyPhoto, removeKeyPhoto, reorderKeyPhotos, updateHoldFrames, getActiveSequence, plus markDirty callback pattern
- Built SequenceList component with SortableJS drag reorder, drag handles, inline rename (double-click), context menu (Rename/Duplicate/Delete with confirmation), and first key photo thumbnail display
- Built KeyPhotoStrip component with horizontal SortableJS drag reorder, thumbnail display from imageStore, inline hold frame editing, remove button on hover, and image picker popover for adding new key photos
- Updated LeftPanel to use real components, removed sequence mock data, added per-sequence settings (FPS toggle 15/24, resolution dropdown)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance sequenceStore with full CRUD and reorder operations** - `802ad06` (feat)
2. **Task 2: Build SequenceList, KeyPhotoStrip, update LeftPanel** - `d80caab` (feat)

## Files Created/Modified
- `Application/src/stores/sequenceStore.ts` - Full CRUD for sequences and key photos, markDirty callback pattern
- `Application/src/components/sequence/SequenceList.tsx` - Sortable sequence list with context actions and inline rename
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Sortable horizontal key photo strip with thumbnails, hold frame editing, add/remove
- `Application/src/components/layout/LeftPanel.tsx` - Uses SequenceList and KeyPhotoStrip, removed sequence mock data, added SequenceSettings

## Decisions Made
- markDirty callback registration pattern (`_setMarkDirtyCallback`) avoids circular import between sequenceStore and projectStore; Plan 03-02 will wire the callback when it implements projectStore.markDirty()
- SortableJS DOM mutations are naturally overwritten by Preact's render cycle since store updates create new array references
- Kept layer mock data in LeftPanel with explicit Phase 5 TODO comment for visual completeness during development
- Per-sequence resolution uses a dropdown with common presets (1920x1080, 1280x720, 3840x2160) rather than freeform input for simplicity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sequence management UI fully operational for Plan 03-02 (project save/load will persist sequences)
- markDirty callback pattern ready for Plan 03-02 to wire up auto-save integration
- SortableJS patterns established for reuse in timeline (Phase 4) and layer management (Phase 5)
- Key photo thumbnails display correctly when images are imported via the existing pipeline

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-03*
