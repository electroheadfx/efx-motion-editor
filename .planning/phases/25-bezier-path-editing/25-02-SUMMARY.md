---
phase: 25-bezier-path-editing
plan: 02
subsystem: paint
tags: [bezier, rendering, persistence, pen-tool, toolbar, paintStore]

# Dependency graph
requires:
  - phase: 25-bezier-path-editing
    plan: 01
    provides: BezierAnchor type, bezierPath.ts math utilities, pen tool type
provides:
  - Bezier-aware stroke rendering via sampleBezierPath in paintRenderer
  - Pen tool button in PaintToolbar
  - convertToBezier and convertShapeToBezier store methods
  - PaintOverlay bezier-aware hit testing and bounding box
affects: [25-03-pen-tool-overlay]

# Tech tracking
tech-stack:
  added: []
  patterns: [bezier-aware-rendering, anchor-based-hit-testing]

key-files:
  created: []
  modified:
    - Application/src/lib/paintRenderer.ts
    - Application/src/stores/paintStore.ts
    - Application/src/components/overlay/PaintToolbar.tsx
    - Application/src/components/canvas/PaintOverlay.tsx

key-decisions:
  - "Persistence requires no code changes -- JSON.stringify/parse handles optional anchors/closedPath automatically"
  - "Pen tool placed between Select and Brush in toolbar for discoverability"
  - "convertShapeToBezier creates PaintStroke with empty points array -- rendering uses anchors exclusively"

patterns-established:
  - "Bezier rendering: check element.anchors, sample to points, feed through existing strokeToPath"
  - "Store conversion methods mutate in-place and call _notifyVisualChange"

requirements-completed: [PINT-03]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 25 Plan 02: Bezier Renderer, Persistence, Pen Tool & Store Methods Summary

**Bezier-aware rendering pipeline wired into paintRenderer with sampleBezierPath, pen tool button in toolbar, convertToBezier/convertShapeToBezier store methods, and PaintOverlay anchor-based hit testing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T08:26:38Z
- **Completed:** 2026-04-03T08:30:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- paintRenderer.ts now checks for bezier anchors and re-samples via sampleBezierPath before feeding to perfect-freehand, with full backward compat for non-bezier strokes
- Pen tool button added to PaintToolbar between Select and Brush with PenTool lucide icon
- paintStore gained convertToBezier (freehand points to bezier anchors) and convertShapeToBezier (shape to stroke with anchors)
- PaintOverlay updated with pen tool cursor, anchor-based bounding box in findElementAtPoint and getSelectionBounds, and pen tool early return in pointerdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Bezier-aware rendering and persistence** - `b65bb11` (feat)
2. **Task 2: Pen tool button, store methods, and cursor/hit-test integration** - `d4d341b` (feat)

## Files Created/Modified
- `Application/src/lib/paintRenderer.ts` - Added sampleBezierPath import, bezier-aware renderStroke with fallback
- `Application/src/stores/paintStore.ts` - Added convertToBezier, convertShapeToBezier methods with bezierPath imports
- `Application/src/components/overlay/PaintToolbar.tsx` - Added PenTool icon import and pen tool entry in TOOLS array
- `Application/src/components/canvas/PaintOverlay.tsx` - Pen cursor, anchor-based hit testing, pen tool early return

## Decisions Made
- Persistence verified to need no code changes: JSON.stringify/parse handles optional fields automatically
- Pen tool positioned between Select and Brush for workflow proximity (select stroke -> edit path)
- convertShapeToBezier sets `points: []` since rendering uses anchors exclusively when present

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All bezier rendering, persistence, toolbar, and store methods in place
- Plan 03 can now add the interactive pen tool overlay for anchor/handle dragging
- PaintOverlay pen tool pointerdown returns early as placeholder for Plan 03 interaction code

---
*Phase: 25-bezier-path-editing*
*Completed: 2026-04-03*
