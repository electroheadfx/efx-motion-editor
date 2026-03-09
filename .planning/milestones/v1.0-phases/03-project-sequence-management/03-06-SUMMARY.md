---
phase: 03-project-sequence-management
plan: 06
subsystem: ui
tags: [sortablejs, preact, drag-reorder, dom-revert, key-photos, sequences]

requires:
  - phase: 03-project-sequence-management
    provides: "SortableJS sequence and key photo reorder, image picker popover (03-03, 03-04)"
provides:
  - "SequenceList SortableJS with proper deps and DOM revert for drag reorder"
  - "KeyPhotoStrip SortableJS with DOM revert, add button outside overflow container"
  - "Reliable sequence delete on 3rd+ items via instance recreation"
affects: []

tech-stack:
  added: []
  patterns:
    - "SortableJS DOM revert pattern: removeChild + insertBefore before signal update so Preact vDOM diff works"
    - "SortableJS useEffect deps on collection.length to recreate instance on add/remove"

key-files:
  created: []
  modified:
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/sequence/KeyPhotoStrip.tsx

key-decisions:
  - "Use removeChild+insertBefore DOM revert in SortableJS onEnd before store update for correct Preact re-render"
  - "Depend on collection.length (not full array) to avoid unnecessary SortableJS recreation on edits"
  - "Move AddKeyPhotoButton outside overflow-x-auto sortable container to prevent popover clipping and click interception"

patterns-established:
  - "SortableJS + Preact DOM revert: always revert SortableJS DOM mutations before triggering signal updates"
  - "SortableJS instance lifecycle: useEffect deps on item count ensures fresh DOM refs after add/remove"

requirements-completed: [SEQN-01, SEQN-02, SEQN-03, SEQN-04]

duration: 1min
completed: 2026-03-09
---

# Phase 03 Plan 06: SortableJS Bug Fixes Summary

**Fixed four SortableJS integration bugs using DOM revert pattern and proper useEffect deps for sequence and key photo drag reorder, delete, and add button**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T12:09:35Z
- **Completed:** 2026-03-09T12:10:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Sequence drag reorder now persists correctly (DOM revert before Preact signal update)
- Sequence delete works on 3rd+ items (SortableJS instance recreated via sequences.length dep)
- Key photo drag reorder now persists correctly (same DOM revert pattern)
- Add key photo button always works (moved outside sortable overflow container)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix SequenceList SortableJS -- add deps and DOM revert** - `3a3ba99` (fix)
2. **Task 2: Fix KeyPhotoStrip SortableJS -- DOM revert, add button extraction, deps** - `0d916a9` (fix)

## Files Created/Modified
- `Application/src/components/sequence/SequenceList.tsx` - SortableJS DOM revert in onEnd, sequences.length useEffect dep
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - SortableJS DOM revert in onEnd, AddKeyPhotoButton moved outside overflow container, keyPhotos.length added to useEffect deps

## Decisions Made
- **DOM revert pattern:** Use `from.removeChild(item)` then `from.insertBefore(item, from.children[oldIndex])` before updating the store signal. This restores the DOM to pre-drag state so Preact's virtual DOM diff sees the original order and correctly applies the new order from the signal.
- **Dep on collection.length:** Using `.length` instead of the full array avoids destroying/recreating the SortableJS instance on every rename or hold-frame edit. Instance only recreates when items are added or removed.
- **Button outside sortable container:** Moving AddKeyPhotoButton to a sibling div outside the `overflow-x-auto` sortable container eliminates both popover clipping and SortableJS click interception without needing a `filter` option.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four SortableJS bugs fixed (sequence delete 3rd+, sequence drag reorder, key photo add button, key photo drag reorder)
- Phase 03 gap closure plans (05, 06) address all remaining UAT failures
- Ready for UAT re-verification

## Self-Check: PASSED

All files exist. All commits verified (3a3ba99, 0d916a9).

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-09*
