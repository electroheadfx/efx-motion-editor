---
phase: 24-stroke-list-panel
plan: "02"
subsystem: paint
tags: [paint, sortablejs, stroke-list, undo-redo, multi-select]

# Dependency graph
requires:
  - phase: 24-stroke-list-panel/01
    provides: "visible?: boolean field, reorderElements(), setElementVisibility() store methods"
provides:
  - "StrokeList component with SortableJS drag reorder, visibility toggle, delete, multi-select (Cmd+click/Shift+click), auto-scroll"
  - "STROKES CollapsibleSection at top of PaintProperties select mode"
  - "Bidirectional selection sync between stroke list and canvas"
affects: [26-bezier-path-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SortableJS DOM revert pattern for Preact compatibility"
    - "Reversed display order matching LayerList convention (front-most at top)"
    - "selectionAnchor ref for Shift+click range selection"

key-files:
  created:
    - "Application/src/components/sidebar/StrokeList.tsx"
  modified:
    - "Application/src/components/sidebar/PaintProperties.tsx"

key-decisions:
  - "Reversed display: displayElements = [...elements].reverse() so front-most element (last in array) appears at top of list, matching LayerList convention"
  - "Label index math: labelIndex = totalElements - 1 - i ensures front-most gets highest number, back-most gets 1"
  - "SortableJS index conversion: fromIdx = totalElements - 1 - oldIndex, toIdx = totalElements - 1 - newIndex to map reversed visual indices back to array indices"

patterns-established:
  - "SortableJS with forceFallback:true for drag reorder in sidebar lists"
  - "CollapsibleSection with useSignal(false) for collapsed state"
  - "Multi-select via selectionAnchor ref tracking last clicked index for Shift+click range"

requirements-completed: [STRK-01, STRK-02, STRK-03, STRK-04, STRK-05]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 24 Plan 02 Summary

**Created StrokeList component with SortableJS drag reorder, visibility toggles, delete, multi-select (Cmd+click/Shift+click), auto-scroll, and integrated it as STROKES CollapsibleSection at top of PaintProperties select mode.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T16:40:00Z
- **Completed:** 2026-03-27T16:42:00Z
- **Tasks:** 3 (2 auto tasks already completed, 1 human verification checkpoint)
- **Files modified:** 2

## Accomplishments

- StrokeList component renders all paint elements (brush, eraser, line, rect, ellipse, fill) for the current frame in select tool mode
- SortableJS drag-and-drop reorder with correct index mapping (reversed display, front-most at top)
- Visibility toggle per element with undo support via setElementVisibility
- Delete button per row with undo support via removeElement
- Multi-select: plain click clears and selects, Cmd+click toggles, Shift+click range selects
- Auto-scroll to selected stroke when canvas selection changes
- STROKES CollapsibleSection at top of PaintProperties showing element count
- Bidirectional selection sync: selecting in list updates canvas, selecting on canvas highlights list rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StrokeList component** - `c55bbc8` (feat)
2. **Task 2: Integrate StrokeList into PaintProperties** - `393e2b9` (feat)
3. **Task 3: Human verification** - Pending user confirmation

**Plan metadata:** `4499119` (docs: complete plan)

## Files Created/Modified

- `Application/src/components/sidebar/StrokeList.tsx` - New component with SortableJS, visibility toggle, delete, multi-select, auto-scroll (194 lines)
- `Application/src/components/sidebar/PaintProperties.tsx` - Added StrokeList import and STROKES CollapsibleSection at top of select mode, updated Select All to select all element types

## Decisions Made

- Reversed display order matches LayerList convention: last element (front-most) at top of list
- Label math: `totalElements - 1 - i` ensures correct 1-based numbering where front-most = highest number
- SortableJS uses `forceFallback:true` (matching LayerList/SequenceList pattern) for reliable drag in Tauri environment

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were completed in prior session (commits c55bbc8 and 393e2b9) and verified during this execution pass.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 03 (gap closure - key override fix) is ready to execute
- Stroke list panel fully operational, ready for user verification
- All STRK requirements (STRK-01 through STRK-05) complete pending human verification

---
*Phase: 24-stroke-list-panel/02*
*Completed: 2026-03-27*
