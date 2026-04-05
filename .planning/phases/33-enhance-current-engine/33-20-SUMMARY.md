---
phase: 33-enhance-current-engine
plan: 20
subsystem: ui
tags: [paint, hit-testing, wireframe, selection, canvas]

# Dependency graph
requires:
  - phase: 33-06
    provides: FX stroke wireframe overlay and expanded hit testing
  - phase: 33-16
    provides: Cursor centering fix using overlayRef
provides:
  - Bounding-box hit testing for all brush strokes (flat and FX)
  - Wireframe overlay renders for all selected brush strokes regardless of brushStyle
affects: [paint-overlay, stroke-selection]

# Tech tracking
tech-stack:
  added: []
  patterns: [bbox-only-hit-testing]

key-files:
  created: []
  modified:
    - app/src/components/canvas/PaintOverlay.tsx

key-decisions:
  - "Bbox-only hit testing: removed fine-check proximity testing in favor of bounding-box-only selection for all brush strokes"
  - "Removed unused sampleBezierPath import after simplifying hit testing"

patterns-established:
  - "Bbox hit testing: brush/eraser strokes use bounding box padding (size/2 + 5) for selection, no path proximity required"

requirements-completed: [ECUR-12]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 33 Plan 20: Wireframe and Hit Testing for All Brush Strokes Summary

**Simplified brush stroke hit testing to bbox-only selection and verified wireframe renders for all brush types**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T16:00:51Z
- **Completed:** 2026-04-05T16:04:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Simplified hit testing from fine-check proximity (sampling bezier paths and checking individual points) to bounding-box-only selection for all brush strokes
- Verified wireframe overlay already renders for all selected brush strokes (flat and FX) without brushStyle filter
- Removed unused sampleBezierPath import after eliminating the fine-check code path

## Task Commits

Each task was committed atomically:

1. **Task 1: Show wireframe for all brush strokes and relax hit testing for flat** - `9c6bac6` (feat)

## Files Created/Modified
- `app/src/components/canvas/PaintOverlay.tsx` - Simplified findElementAtPoint() hit testing to use bbox-only selection; removed fine-check proximity testing and unused sampleBezierPath import

## Decisions Made
- Used bounding-box-only hit testing (removing fine-check proximity) since the bbox already includes stroke size padding (size/2 + 5px), making it sufficiently precise for brush stroke selection while being more user-friendly
- Wireframe rendering was already working for all brush strokes (condition checks `el.tool === 'brush'` not `brushStyle !== 'flat'`), so no wireframe code changes were needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused sampleBezierPath import**
- **Found during:** Task 1 (hit testing simplification)
- **Issue:** After removing the fine-check code that called sampleBezierPath, the import became unused
- **Fix:** Removed sampleBezierPath from the bezierPath import statement
- **Files modified:** app/src/components/canvas/PaintOverlay.tsx
- **Verification:** Grep confirmed no remaining references to sampleBezierPath in file
- **Committed in:** 9c6bac6 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug/cleanup)
**Impact on plan:** Necessary cleanup to avoid unused import warnings. No scope creep.

## Issues Encountered
- The `brushStyle !== 'flat'` condition referenced in the plan no longer existed in the codebase -- the wireframe rendering code (line 715) already used `el.tool === 'brush' || el.tool === 'eraser'` without filtering by brushStyle. Only the hit testing simplification was needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All brush strokes (flat, FX, eraser) now use consistent bounding-box hit testing
- Wireframe overlay renders for all selected brush strokes

## Self-Check: PASSED

- FOUND: app/src/components/canvas/PaintOverlay.tsx
- FOUND: commit 9c6bac6
- FOUND: 33-20-SUMMARY.md

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
