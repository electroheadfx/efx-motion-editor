---
phase: 25-bezier-path-editing
plan: 01
subsystem: paint
tags: [bezier, fit-curve, bezier-js, path-editing, cubic-bezier, paint]

# Dependency graph
requires:
  - phase: 20-paint-layer
    provides: PaintStroke, PaintShape, PaintToolType types and paint rendering pipeline
provides:
  - BezierAnchor data model on PaintStroke
  - bezierPath.ts pure math module with 10 utility functions
  - fit-curve and bezier-js npm dependencies
  - pen tool type in PaintToolType union
affects: [25-02-bezier-renderer, 25-03-pen-tool-ui]

# Tech tracking
tech-stack:
  added: [fit-curve@0.2.0, bezier-js@6.1.4]
  patterns: [freehand-to-bezier-conversion, bezier-anchor-data-model, pure-math-module]

key-files:
  created:
    - Application/src/lib/bezierPath.ts
    - Application/src/types/fit-curve.d.ts
    - Application/src/types/bezier-js.d.ts
  modified:
    - Application/src/types/paint.ts
    - Application/package.json
    - Application/pnpm-lock.yaml

key-decisions:
  - "BezierAnchor uses absolute coordinates for handleIn/handleOut (not relative offsets)"
  - "bezier-js type declaration shim added since library ships JS-only"
  - "Tolerance clamping retries up to 3 times to keep anchor count between 3-40"

patterns-established:
  - "Pure math module pattern: bezierPath.ts has no store imports, no side effects"
  - "Shape rotation baked into anchor positions during conversion"

requirements-completed: [PINT-03, PINT-04]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 25 Plan 01: Bezier Data Model & Math Utilities Summary

**BezierAnchor type model with 10 pure math functions using fit-curve and bezier-js for freehand-to-bezier conversion, shape conversion, path sampling, anchor editing, and hit testing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T08:20:12Z
- **Completed:** 2026-04-03T08:23:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Defined BezierAnchor interface and extended PaintStroke with anchors/closedPath fields
- Created bezierPath.ts with all 10 required utility functions (cubicBezierPoint, pointsToBezierAnchors, shapeToAnchors, sampleBezierPath, insertAnchorOnSegment, deleteAnchor, updateCoupledHandle, dragSegment, findNearestSegment, hitTestAnchor)
- Installed fit-curve and bezier-js with proper TypeScript type declarations
- Added 'pen' to PaintToolType union for Plan 03 pen tool UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and extend paint types** - `6bbb63b` (feat)
2. **Task 2: Create bezierPath.ts utility module** - `2c698c2` (feat)

## Files Created/Modified
- `Application/src/types/paint.ts` - Added BezierAnchor interface, extended PaintStroke, added 'pen' tool type
- `Application/src/lib/bezierPath.ts` - Pure math module with 10 bezier utility functions
- `Application/src/types/fit-curve.d.ts` - TypeScript declaration shim for fit-curve
- `Application/src/types/bezier-js.d.ts` - TypeScript declaration shim for bezier-js
- `Application/package.json` - Added fit-curve and bezier-js dependencies
- `Application/pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used absolute coordinates for handle positions (not relative offsets) to simplify drag math and hit testing
- Created bezier-js type declaration shim since the library ships JS-only without @types package
- Tolerance clamping in pointsToBezierAnchors retries up to 3 times (multiply by 1.5 if >40 anchors, 0.5 if <3 anchors) for optimal anchor density
- Shape rotation is baked into anchor positions during shapeToAnchors conversion rather than stored separately

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added bezier-js type declaration shim**
- **Found during:** Task 2 (bezierPath.ts compilation)
- **Issue:** bezier-js does not ship TypeScript types, causing noImplicitAny errors with strict mode
- **Fix:** Created Application/src/types/bezier-js.d.ts with Bezier class, Point interface, and SplitResult
- **Files modified:** Application/src/types/bezier-js.d.ts
- **Verification:** Full project tsc --noEmit passes with no new errors
- **Committed in:** 2c698c2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type declaration was necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the bezier-js types issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BezierAnchor type and bezierPath.ts math module ready for Plan 02 (bezier renderer)
- PaintToolType includes 'pen' for Plan 03 (pen tool UI)
- All functions compile cleanly and are importable

---
*Phase: 25-bezier-path-editing*
*Completed: 2026-04-03*
