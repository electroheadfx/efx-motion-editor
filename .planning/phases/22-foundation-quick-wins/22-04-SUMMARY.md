---
phase: 22-foundation-quick-wins
plan: 04
subsystem: ui
tags: [motion-path, preact, svg, sub-frame-sampling, canvas]

# Dependency graph
requires:
  - phase: 22-foundation-quick-wins/01
    provides: sampleMotionDots sub-frame sampling implementation
provides:
  - Sub-frame dot rendering with fractional frame precision
  - Index-based Preact keys preventing circle deduplication
  - Math.round-based playhead highlight lookup for fractional dots
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Index-based keys for sub-frame SVG circles (key={index} not key={dot.frame})"
    - "Math.round for integer-to-fractional frame lookups in motion path"

key-files:
  created: []
  modified:
    - Application/src/components/canvas/MotionPath.tsx
    - Application/src/components/canvas/motionPath.test.ts

key-decisions:
  - "Store raw fractional frame values instead of Math.round to preserve sub-frame precision"

patterns-established:
  - "Sub-frame data should preserve full precision; rounding only at consumption points (e.g., playhead lookup)"

requirements-completed: [UXP-03]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 22 Plan 04: Motion Path Sub-Frame Dot Density Fix Summary

**Fixed two bugs silently discarding ~75% of sub-frame motion path dots: Math.round collapsing fractional frames and duplicate Preact keys causing circle deduplication**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T23:19:57Z
- **Completed:** 2026-03-26T23:22:28Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Sub-frame dots now store fractional frame values (0, 0.25, 0.5, 0.75, ...) instead of collapsed integers
- Preact rendering uses sequential index keys so all 21 dots for a 5-frame span are rendered (was rendering only 6)
- Current-dot playhead highlight uses Math.round for integer matching against fractional frame values
- Tests updated: 17 tests pass including 2 new tests verifying fractional frames and unique dot values

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for sub-frame density** - `0c301aa` (test)
2. **Task 1 (GREEN): Fix sub-frame dot storage and rendering keys** - `6dcbd3b` (fix)

_TDD task with RED/GREEN commits._

## Files Created/Modified
- `Application/src/components/canvas/MotionPath.tsx` - Removed Math.round(f) in sampleMotionDots, changed key={dot.frame} to key={index}, added Math.round in currentDot lookup
- `Application/src/components/canvas/motionPath.test.ts` - Updated test to verify fractional frames, added uniqueness test for 21 sub-frame dots

## Decisions Made
- Store raw fractional frame values in dot objects; only round at consumption points (playhead highlight lookup) -- maintains precision throughout the pipeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Motion path sub-frame density bug is resolved
- Short sequences (< 30 frames) now visually display 4x denser dots as originally intended in 22-01
- No blockers for subsequent plans

## Self-Check: PASSED

- FOUND: Application/src/components/canvas/MotionPath.tsx
- FOUND: Application/src/components/canvas/motionPath.test.ts
- FOUND: .planning/phases/22-foundation-quick-wins/22-04-SUMMARY.md
- FOUND: 0c301aa (RED commit)
- FOUND: 6dcbd3b (GREEN commit)

---
*Phase: 22-foundation-quick-wins*
*Completed: 2026-03-27*
