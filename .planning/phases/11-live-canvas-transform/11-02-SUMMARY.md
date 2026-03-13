---
phase: 11-live-canvas-transform
plan: 02
subsystem: ui
tags: [canvas, coordinate-mapping, hit-testing, transform-handles, bounding-box, geometry]

# Dependency graph
requires:
  - phase: 11-01
    provides: "scaleX/scaleY non-uniform scale on LayerTransform"
provides:
  - "clientToCanvas/canvasToClient coordinate mapping inverting CSS transform chain"
  - "getLayerBounds replicating PreviewRenderer.drawLayer() transform pipeline"
  - "getHandlePositions for 8-handle bounding box (4 corner + 4 edge midpoint)"
  - "hitTestHandles with zoom-independent hit areas"
  - "hitTestLayers with z-order traversal skipping FX layers"
  - "hitTestLayersCycle for Alt+click layer cycling"
  - "pointInPolygon ray-casting for rotated bounding box testing"
  - "getCursorForHandle mapping handle type + rotation to CSS cursors"
  - "getRotationZone detecting hover outside corners"
affects: [11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function coordinate mapping (no signal reads, all params explicit)"
    - "PreviewRenderer transform pipeline replication for bounding box geometry"
    - "Zoom-independent handle hit areas via counter-scaling"

key-files:
  created:
    - Application/src/components/canvas/coordinateMapper.ts
    - Application/src/components/canvas/transformHandles.ts
    - Application/src/components/canvas/hitTest.ts
  modified: []

key-decisions:
  - "All functions are pure -- no signal reads, no side effects, all inputs via parameters"
  - "Bounding-box-only hit testing (no pixel sampling) for initial implementation"
  - "Rotation zone uses corner proximity (15px screen distance) rather than edge proximity"
  - "Crosshair cursor for rotation zone (can be replaced with custom SVG data URL later)"

patterns-established:
  - "Canvas utility module pattern: pure math functions in src/components/canvas/"
  - "Zoom-independent hit areas: screenSize / zoom for counter-scaled clickable regions"

requirements-completed: [XFORM-03, XFORM-04]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 11 Plan 02: Canvas Interaction Utilities Summary

**Pure-math coordinate mapping, bounding box geometry, and hit testing modules for canvas transform overlay**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T16:57:38Z
- **Completed:** 2026-03-13T17:00:17Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Coordinate mapper correctly inverts CSS `scale(zoom) translate(panX, panY)` with center origin, plus the inverse for positioning overlay handles
- Layer bounding box geometry replicates the exact PreviewRenderer.drawLayer() transform pipeline: crop -> aspect-fit -> translate -> scaleX/scaleY -> rotate
- Hit testing traverses layers top-to-bottom, skipping FX/invisible layers, with Alt+click cycling support
- Handle hit testing uses zoom-independent areas and cursor mapping rotated by layer rotation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create coordinateMapper.ts** - `df3dd83` (feat)
2. **Task 2: Create transformHandles.ts and hitTest.ts** - `31d7b98` (feat)

## Files Created/Modified
- `Application/src/components/canvas/coordinateMapper.ts` - Client-to-canvas and canvas-to-client coordinate transforms, screen-to-project distance helper
- `Application/src/components/canvas/transformHandles.ts` - Layer bounding box computation, handle positions, handle/rotation hit testing, cursor mapping, point-in-polygon
- `Application/src/components/canvas/hitTest.ts` - Layer hit testing with z-order traversal and Alt+click cycling

## Decisions Made
- All functions are pure (no signal reads, no side effects) -- they take parameters and return results, keeping them testable and reusable
- Bounding-box-only hit testing for now (no pixel sampling) -- fast and sufficient for most use cases
- Rotation zone detects hover within 15px screen distance of any corner, outside the bounding box polygon
- Crosshair cursor for rotation zone as a simple default (custom SVG rotation cursor can be added as enhancement)
- Removed unused `distToSegment` helper that was dead code after choosing corner-proximity rotation detection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused distToSegment function**
- **Found during:** Task 2 (transformHandles.ts compilation)
- **Issue:** TypeScript error TS6133 -- distToSegment was declared but never read
- **Fix:** Removed the dead code since rotation zone uses corner distance, not edge segment distance
- **Files modified:** Application/src/components/canvas/transformHandles.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 31d7b98 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup of dead code. No scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three utility modules ready for Plan 03 (TransformOverlay component)
- TransformOverlay can import clientToCanvas, getLayerBounds, getHandlePositions, hitTestHandles, hitTestLayers directly
- All functions are pure and accept explicit parameters, ready for integration with Preact signals in the overlay component

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 11-live-canvas-transform*
*Completed: 2026-03-13*
