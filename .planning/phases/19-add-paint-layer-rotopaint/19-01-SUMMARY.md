---
phase: 19-add-paint-layer-rotopaint
plan: 01
subsystem: paint
tags: [perfect-freehand, canvas-2d, paint, rotopaint, preact-signals]

# Dependency graph
requires: []
provides:
  - PaintStroke, PaintShape, PaintFill, PaintElement, PaintFrame type definitions
  - PaintToolType union for all paint tools
  - paintStore with per-frame element storage, undo integration, onion skin signals
  - paintRenderer with perfect-freehand stroke-to-Path2D and shape rendering
  - LayerType and LayerSourceData extended with 'paint' variant
affects: [19-02, 19-03, 19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: [perfect-freehand@1.2.3]
  patterns: [per-frame-paint-data-map, element-union-dispatch, path2d-stroke-rendering]

key-files:
  created:
    - Application/src/types/paint.ts
    - Application/src/stores/paintStore.ts
    - Application/src/lib/paintRenderer.ts
  modified:
    - Application/src/types/layer.ts
    - Application/package.json
    - Application/pnpm-lock.yaml

key-decisions:
  - "Map<string, Map<number, PaintFrame>> for per-layer per-frame storage instead of flat array"
  - "HistoryEntry includes id/description/timestamp fields matching existing convention"
  - "PaintFill rendering deferred to Plan 06 (pre-rasterized ImageData approach)"

patterns-established:
  - "Paint element union dispatch: switch on element.tool for type-narrowed rendering"
  - "Dirty frame tracking: Set<string> with layerId:frameNum keys for persistence"

requirements-completed: [PAINT-01, PAINT-02, PAINT-03]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 19 Plan 01: Paint Layer Foundation Summary

**Paint type system, per-frame paintStore with undo, and perfect-freehand stroke renderer for Canvas 2D**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T20:11:35Z
- **Completed:** 2026-03-24T20:14:56Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Complete paint type system: PaintStroke, PaintShape, PaintFill, PaintElement, PaintFrame, PaintToolType with default constants
- paintStore with layerId->frame->PaintFrame storage, full undo/redo via pushAction, onion skin signals, dirty tracking for persistence
- paintRenderer converts stroke points to Path2D outlines via perfect-freehand, renders shapes (line/rect/ellipse), handles eraser via destination-out compositing
- LayerType and LayerSourceData extended with 'paint' variant

## Task Commits

Each task was committed atomically:

1. **Task 1: Install perfect-freehand and create paint types** - `146292d` (feat)
2. **Task 2: Create paintStore for per-frame stroke management** - `2bfa2dc` (feat)
3. **Task 3: Create paintRenderer for stroke-to-canvas rendering** - `047b2b3` (feat)

## Files Created/Modified
- `Application/src/types/paint.ts` - Paint element types, tool types, default constants
- `Application/src/stores/paintStore.ts` - Paint mode state, per-frame element storage, undo integration
- `Application/src/lib/paintRenderer.ts` - Stroke-to-Path2D via perfect-freehand, shape rendering, eraser compositing
- `Application/src/types/layer.ts` - Extended LayerType and LayerSourceData with paint variant
- `Application/package.json` - Added perfect-freehand dependency
- `Application/pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used Map<string, Map<number, PaintFrame>> for per-layer per-frame storage (matches plan's nested map approach, efficient for sparse frame data)
- HistoryEntry fields include id, description, timestamp (matching existing convention in audioStore/sequenceStore, not the minimal interface from plan context)
- PaintFill rendering deferred to Plan 06 (fill elements will be pre-rasterized as ImageData)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HistoryEntry interface requires additional fields**
- **Found during:** Task 2 (paintStore creation)
- **Issue:** Plan's undo snippets only showed undo/redo closures, but actual HistoryEntry interface requires id, description, and timestamp fields
- **Fix:** Added crypto.randomUUID() for id, descriptive string, and Date.now() timestamp to all pushAction calls
- **Files modified:** Application/src/stores/paintStore.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 2bfa2dc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All paint types, store, and renderer ready for Plan 02 (canvas toolbar and paint mode UI)
- paintStore.getFrame/addElement/removeElement API ready for pointer input integration
- renderPaintFrame/strokeToPath ready for PreviewRenderer integration
- No blockers

## Self-Check: PASSED

All 4 created/modified source files verified on disk. All 3 task commit hashes verified in git log.

---
*Phase: 19-add-paint-layer-rotopaint*
*Completed: 2026-03-24*
