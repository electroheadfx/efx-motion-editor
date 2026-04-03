---
phase: 23-stroke-interactions
plan: 02
subsystem: ui
tags: [paint, undo-redo, transforms, alt-duplicate, non-uniform-scale, preact, typescript, canvas]

# Dependency graph
requires:
  - phase: 23-stroke-interactions
    plan: 01
    provides: captureElementSnapshot/restoreElementSnapshot, transformSnapshot/transformLayerId/transformFrame refs, undo infrastructure
provides:
  - Alt+drag duplicate for all paint element types (PaintStroke, PaintShape, PaintFill)
  - Non-uniform single-axis scale via 4 edge midpoint handles (t/r/b/l)
  - cursorForHandle helper for resize cursor feedback
affects: [PaintOverlay.tsx, any plan building on paint interaction gestures]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alt+drag duplicate: structuredClone all selected elements on altKey pointerdown, switch selection to clones, commit single undo entry that removes clones on undo and re-adds structuredClone on redo"
    - "Edge handle scale: capture anchor + original dimension once on pointerdown, compute scaleX/scaleY relative to anchor on each pointermove (Pitfall 4: no re-capture per frame)"
    - "Handle disambiguation: hitTestHandle returns 2-letter string for corner (uniform), 1-letter for edge (non-uniform); transformCorner.current.length === 1 distinguishes at runtime"

key-files:
  created: []
  modified:
    - Application/src/components/canvas/PaintOverlay.tsx

key-decisions:
  - "Single undo entry for Alt+drag: undo closure filters out all clones by ID set (f.elements.filter(!cloneIdSet)), redo re-adds via structuredClone to avoid reference sharing across redo calls"
  - "Edge anchor captured once on pointerdown: edgeAnchorX/Y and edgeOriginalWidth/Height refs set at gesture start and unchanged during gesture, preventing floating-point drift from per-frame recapture"
  - "Brush size stays fixed during edge scale (D-06): only stroke.points coordinates are transformed; stroke.size is NOT modified unlike uniform corner scale"
  - "cursorForHandle added as module-level function (not inside component) to avoid re-creation on every render"

patterns-established:
  - "Alt+duplicate pattern: clone→push→switch-selection→drag, commit undo as element removal/re-addition (not position restore)"
  - "Non-uniform scale: anchor opposite edge, scale one axis only, do not touch brush size"

requirements-completed: [PINT-01, PINT-02]

# Metrics
duration: ~7min
completed: 2026-03-27
---

# Phase 23 Plan 02: Alt+Duplicate and Non-Uniform Edge Scale Summary

**Alt+drag duplicate for all element types and non-uniform edge-handle scale with 4 circular midpoint handles — both with single-entry undo/redo**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-27T09:34:00Z
- **Completed:** 2026-03-27T09:41:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `isDuplicating` and `duplicateCloneIds` refs for Alt+drag duplicate tracking
- Alt+drag clones all selected elements with new `crypto.randomUUID()` IDs and starts drag of clones; originals stay in place
- Selection switches to clone IDs immediately so user drags clones, not originals
- Single `pushAction` undo entry: undo removes all clones by ID set filter; redo re-adds via `structuredClone` per clone to prevent reference sharing across multiple redo calls
- Added `edgeAnchorX`, `edgeAnchorY`, `edgeOriginalWidth`, `edgeOriginalHeight` refs, all captured once on pointerdown
- Extended `hitTestHandle` to return single-letter edge handles (`t`, `r`, `b`, `l`) alongside existing two-letter corner handles
- Added `cursorForHandle` helper returning `ns-resize`, `ew-resize`, `nwse-resize`, `nesw-resize` per handle
- Cursor feedback in `handlePointerMove` on hover over handles (when not in a gesture)
- Edge scale in `handlePointerMove`: `transformCorner.current.length === 1` distinguishes edge from corner; horizontal scale only moves X coordinates, vertical only moves Y; `stroke.size` is NOT scaled (D-06)
- Edge midpoint handles rendered as circles at bounding box midpoints (white fill, blue stroke, radius 3)
- Total handles: 4 corner squares + 4 edge circles + 1 rotate handle = 9 handles

## Task Commits

Each task was committed atomically:

1. **Task 1: Alt+drag duplicate with batch undo** - `4660445` (feat)
2. **Task 2: Non-uniform edge-handle scale with undo** - `7701992` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `Application/src/components/canvas/PaintOverlay.tsx` - Alt+drag duplicate, edge midpoint handles, non-uniform edge scale, cursor feedback

## Decisions Made

- Single undo entry for Alt+drag removes clones entirely (`f.elements.filter(!cloneIdSet)`) rather than restoring positions — this ensures Ctrl+Z returns to exact pre-duplicate state with no orphaned elements
- Edge anchor + original dimension captured once on pointerdown and held fixed for gesture duration — prevents floating-point drift from recomputing bounds from already-transformed elements each frame
- Brush size fixed during edge scale (`stroke.size` not touched) — non-uniform scale only repositions points; uniform corner scale continues to scale brush size proportionally
- `cursorForHandle` defined as module-level function (outside component) — avoids recreation on render cycles

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented per specification with all acceptance criteria met.

## Known Stubs

None - all features fully wired with live data.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 23 complete: both PINT-01 (Alt+duplicate) and PINT-02 (non-uniform scale) requirements fulfilled
- TypeScript compiles cleanly for PaintOverlay.tsx (5 pre-existing errors in other files unchanged)
- Foundation for future paint interactions: `hitTestHandle` is extensible, edge/corner disambiguation pattern established

---
*Phase: 23-stroke-interactions*
*Completed: 2026-03-27*
