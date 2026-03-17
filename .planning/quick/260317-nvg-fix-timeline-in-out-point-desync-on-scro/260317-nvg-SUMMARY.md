---
phase: quick
plan: 260317-nvg
subsystem: ui
tags: [canvas, timeline, fx-track, clipping, scroll]

requires:
  - phase: none
    provides: n/a
provides:
  - "Correct FX range bar clipping logic that keeps edge handles aligned during horizontal scroll"
affects: [timeline, fx-track]

tech-stack:
  added: []
  patterns: ["Derive clipped width from raw coordinate boundaries (clippedRight - clippedLeft) instead of raw barW"]

key-files:
  created: []
  modified:
    - Application/src/components/timeline/TimelineRenderer.ts

key-decisions:
  - "Compute clippedRight from barX + barW (raw coordinates) then derive clippedW as clippedRight - clippedLeft"

patterns-established:
  - "Canvas clipping: always derive visible width from boundary coordinates, not raw dimensions"

requirements-completed: [BUG-FIX]

duration: 3min
completed: 2026-03-17
---

# Quick 260317-nvg: Fix Timeline In/Out Point Desync on Scroll Summary

**Fixed FX range bar clippedW calculation to derive width from raw bar boundaries, preventing edge handle desync during horizontal scroll**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T17:15:00Z
- **Completed:** 2026-03-17T17:18:14Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed `clippedW` calculation in `drawFxTrack` to compute from `clippedRight - clippedLeft` instead of using raw `barW`
- FX range bar body right edge now stays aligned with edge handle positions at all scroll offsets
- No regressions in TypeScript compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix FX range bar clippedW calculation in drawFxTrack** - `336c90e` (fix)
2. **Task 2: Verify in/out point markers stay aligned during scroll** - user-approved visual verification (no commit needed)

## Files Created/Modified
- `Application/src/components/timeline/TimelineRenderer.ts` - Fixed clippedW derivation in drawFxTrack: `clippedRight = Math.min(barX + barW, canvasWidth)`, `clippedW = Math.max(0, clippedRight - clippedLeft)`

## Decisions Made
- Compute clippedRight from raw barX + barW boundary, then derive width as difference from clippedLeft -- this ensures the bar body's right edge always matches the right edge handle position regardless of left-side clipping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FX range bar clipping is correct; no further timeline scroll fixes needed
- Edge handles, bar body, and border stroke all remain synchronized

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit 336c90e: FOUND

---
*Phase: quick/260317-nvg*
*Completed: 2026-03-17*
