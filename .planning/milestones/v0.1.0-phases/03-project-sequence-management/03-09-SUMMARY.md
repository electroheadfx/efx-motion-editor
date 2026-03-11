---
phase: 03-project-sequence-management
plan: 09
subsystem: ui
tags: [preact, sortablejs, drag-and-drop, ux, key-photos]

requires:
  - phase: 03-project-sequence-management
    provides: KeyPhotoStrip component with click-select + arrow key reorder (plan 08)
provides:
  - Repositioned add button at left/start of key photo strip
  - 3-thumbnail visible window without horizontal scrolling
  - Hover-visible left/right move buttons on each card
  - SortableJS drag-and-drop with forceFallback:true for Tauri compatibility
  - Arrow key handlers removed to prevent timeline cursor conflict
affects: [03-project-sequence-management]

tech-stack:
  added: []
  patterns: [sortablejs-forceFallback-drag, hover-move-buttons, dom-revert-preact-pattern]

key-files:
  created: []
  modified:
    - Application/src/components/sequence/KeyPhotoStrip.tsx

key-decisions:
  - "Re-added SortableJS with forceFallback:true after removing it in plan 08 (UAT round 2 gap closure requires drag support)"
  - "Move buttons use absolute-positioned hover-visible pills at left/right center of card"
  - "Compact add button (w-6 pill) at strip start instead of dashed border w-20 at end"
  - "Cards resized from 80px to 72px so 3 fit in 252px inner panel width"

patterns-established:
  - "Hover move buttons: conditional canMoveLeft/canMoveRight with stopPropagation click handlers"
  - "SortableJS horizontal direction with forceFallback for Tauri native DnD bypass"

requirements-completed: [SEQN-02, SEQN-04]

duration: 3min
completed: 2026-03-09
---

# Phase 03 Plan 09: Key Photo Strip Gap Closure Summary

**Repositioned add button to left, resized cards for 3-thumbnail fit, added hover move buttons and SortableJS drag reorder**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T14:38:44Z
- **Completed:** 2026-03-09T14:41:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Add key photo button repositioned to left/start of strip as compact pill (24x56px)
- Cards resized from 80px to 72px so 3 thumbnails fit in visible window without scrolling
- Arrow key handlers removed entirely (no timeline cursor navigation conflict)
- Left/right move buttons appear on hover for each card (conditional on position)
- SortableJS drag-and-drop re-added with forceFallback:true and DOM revert pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Reposition add button and resize cards for 3-thumbnail window** - `12e65b7` (feat)
2. **Task 2: Replace arrow-key reorder with move buttons and SortableJS drag** - `f14a9a4` (feat)

## Files Created/Modified
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Repositioned add button, resized cards, removed selection/arrow-key state, added move buttons, added SortableJS drag

## Decisions Made
- Re-added SortableJS with forceFallback:true (was removed in plan 08 per UAT feedback, but UAT round 2 gap closure requires drag support alongside move buttons)
- Used compact pill-shaped add button (w-6) instead of dashed-border full-width button to maximize space for thumbnails
- Resized cards from 80px to 72px with gap-1 (4px) for exact 3-card fit: 252px - 24px button - 4px gap = 224px = 3x72px + 2x4px
- Move buttons positioned at vertical center (top-1/2 -translate-y-1/2) to avoid conflicting with remove button (top-right) and frames badge (bottom-right)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All UAT round 2 gaps resolved (tests 6 and 7)
- Phase 03 gap closure plans (04-09) complete
- Key photo strip supports: add (left button), remove (hover X), reorder (drag or move buttons), hold frame editing

## Self-Check: PASSED

- Source file exists: KeyPhotoStrip.tsx
- Task 1 commit verified: 12e65b7
- Task 2 commit verified: f14a9a4
- SUMMARY.md created at expected path

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-09*
