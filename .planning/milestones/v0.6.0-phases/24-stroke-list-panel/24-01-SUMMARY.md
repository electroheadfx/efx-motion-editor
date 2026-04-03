---
phase: 24-stroke-list-panel
plan: "01"
subsystem: paint
tags: [paint, visibility, undo-redo, canvas-rendering]

# Dependency graph
requires:
  - phase: 23-stroke-interactions
    provides: "PaintElement types, paintStore structure, selectedStrokeIds, moveElements* methods"
provides:
  - "visible?: boolean field on PaintStroke, PaintShape, PaintFill"
  - "reorderElements() with full undo/redo including FX cache refresh"
  - "setElementVisibility() with full undo/redo"
  - "Visibility filtering in renderPaintFrame and renderFlatElements"
  - "Visibility filtering in findElementAtPoint (canvas hit-testing)"
  - "Visibility filtering in reRenderFrameFx (FX cache rendering)"
affects: [24-stroke-list-panel/02, 26-bezier-path-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "visibility as optional boolean (undefined=visible, false=hidden) for backward compat"
    - "snapshot-based undo with pushAction pattern"
    - "FX cache refresh in both forward path AND undo/redo closures"

key-files:
  created: []
  modified:
    - "Application/src/types/paint.ts"
    - "Application/src/stores/paintStore.ts"
    - "Application/src/lib/paintRenderer.ts"
    - "Application/src/components/canvas/PaintOverlay.tsx"

key-decisions:
  - "Visibility stored as optional boolean (D-05): undefined means visible (backward compat), false means hidden. Always check === false never === true."
  - "reorderElements uses array splice for direct move with old/new index snapshot"
  - "setElementVisibility stores undefined for true (saves space), false for hidden"
  - "Both undo closures call paintStore.refreshFrameFx to re-render FX cache after undo/redo"

patterns-established:
  - "Optional field pattern for backward-compatible extensions"
  - "Full undo/redo with snapshot-and-restore including side effects (FX cache)"

requirements-completed: [STRK-02, STRK-05]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 24 Plan 01 Summary

**Added visible field to PaintElement types with reorderElements and setElementVisibility store methods, and wired visibility filtering into the render pipeline and canvas hit-testing.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T15:24:37Z
- **Completed:** 2026-03-27T15:27:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `visible?: boolean` optional field to PaintStroke, PaintShape, and PaintFill interfaces (backward compatible - undefined = visible)
- Added `reorderElements(layerId, frame, oldIndex, newIndex)` with full undo/redo including FX cache refresh on forward path AND in both undo/redo closures
- Added `setElementVisibility(layerId, frame, elementId, visible)` with full undo/redo
- Hidden elements (visible === false) are skipped in renderPaintFrame and renderFlatElements
- Hidden elements cannot be selected via canvas click (findElementAtPoint skips hidden)
- reRenderFrameFx filters out hidden brush strokes when rendering FX cache

## Task Commits

Each task was committed atomically:

1. **Task 1: Add visible field to types and store methods** - `757fd01` (feat)
2. **Task 2: Wire visibility filtering into render pipeline and hit-testing** - `4345e3a` (feat)

**Plan metadata:** `757fd01` (docs: complete plan)

## Files Created/Modified

- `Application/src/types/paint.ts` - Added `visible?: boolean` to PaintStroke (line 54), PaintShape (line 85), PaintFill (line 96)
- `Application/src/stores/paintStore.ts` - Added `reorderElements()` method (line 273) and `setElementVisibility()` method (line 304)
- `Application/src/lib/paintRenderer.ts` - Added `if (element.visible === false) continue` in `renderPaintFrame` (line 176) and `renderFlatElements` (line 244)
- `Application/src/components/canvas/PaintOverlay.tsx` - Added `if (el.visible === false) continue` in `findElementAtPoint` (line 61) and updated brushStrokes filter in `reRenderFrameFx` (line 300)

## Decisions Made

- Visibility stored as optional boolean: undefined means visible (backward compatible with existing data), false means hidden. Always check `=== false`, never `=== true`.
- `reorderElements` calls `refreshFrameFx` on forward path AND in both undo/redo closures to ensure FX cache is re-rendered after any reorder operation
- `setElementVisibility` stores `undefined` for true state (backward compat) and `false` for hidden

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 02 (StrokeList UI component) has the full data model and store methods ready to use
- Visibility filtering is wired end-to-end from types through rendering to hit-testing

---
*Phase: 24-stroke-list-panel/01*
*Completed: 2026-03-27*
