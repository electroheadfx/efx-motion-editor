---
phase: quick-4
plan: 01
subsystem: ui
tags: [preact, canvas, timeline, fx-layers, sortablejs]

requires:
  - phase: 07-cinematic-fx
    provides: FX sequence model, timeline FX tracks, toggleFxSequenceVisibility
provides:
  - Filtered sidebar list excluding FX sequences
  - Conditional bullet/dot rendering based on FX visibility
  - Click-to-toggle visibility on FX timeline header dot
affects: [timeline, sequence-list, fx-layers]

tech-stack:
  added: []
  patterns: [content-only filtered display with index remapping for SortableJS]

key-files:
  created: []
  modified:
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineInteraction.ts

key-decisions:
  - "Filter FX sequences at render time (not store level) to keep reorder index mapping explicit"
  - "18px hit zone for 6px bullet provides generous click target without overlapping name text"

patterns-established:
  - "Content-only array mapping: filter display array, then map SortableJS indices through content array to full store array by ID"

requirements-completed: [FX-SIDEBAR-HIDE, FX-BULLET-VIS, FX-BULLET-TOGGLE]

duration: 1min
completed: 2026-03-10
---

# Quick Task 4: Fix FX Layers Hide from Sidebar Sequence Summary

**Hide FX sequences from sidebar SEQUENCES panel, conditionally hide timeline bullet on visibility toggle, and add click-to-toggle on FX header dot**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-10T18:55:59Z
- **Completed:** 2026-03-10T18:57:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- FX sequences (kind === 'fx') completely hidden from sidebar SEQUENCES panel
- SortableJS reorder indices correctly mapped through content-only filtered array back to full store array
- Timeline FX track header dot/bullet conditionally hidden when FX sequence has visible === false
- Clicking the leftmost 18px of an FX track header toggles sequence visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Hide FX sequences from sidebar and conditionally render timeline bullet** - `ddf520f` (feat)
2. **Task 2: Add click-to-toggle visibility on FX timeline bullet** - `bc1ce46` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `Application/src/components/sequence/SequenceList.tsx` - Filter FX sequences from display, remap SortableJS indices
- `Application/src/components/timeline/TimelineRenderer.ts` - Conditional dot rendering based on FX visibility
- `Application/src/components/timeline/TimelineInteraction.ts` - Bullet click detection and visibility toggle

## Decisions Made
- Filter FX sequences at render time in SequenceList rather than at the store level, keeping the full array available for index remapping
- 18px wide hit zone for the 6px diameter bullet provides easy click targeting without interfering with the sequence name text area

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three FX layer UX issues resolved
- Content sequence reordering verified to work correctly with filtered list
- No blockers

---
*Quick Task: 4-fix-fx-layers-hide-from-sidebar-sequence*
*Completed: 2026-03-10*
