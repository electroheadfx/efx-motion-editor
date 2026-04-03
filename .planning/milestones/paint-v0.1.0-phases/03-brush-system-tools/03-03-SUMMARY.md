---
phase: 03-brush-system-tools
plan: "03"
subsystem: physics
tags: [typed-arrays, undo, float32array, wet-layer, memcpy]

# Dependency graph
requires:
  - phase: 03-brush-system-tools/01
    provides: "Brush system with wet/dry physics and undo snapshots"
  - phase: 03-brush-system-tools/02
    provides: "Physics rendering pipeline and drying simulation"
provides:
  - "Working undo that fully reverts strokes by restoring both canvas ImageData and wet layer Float32Arrays"
  - "Float32Array-based wet layer for TypedArray .set() compatibility and faster physics"
affects: [brush-tools, undo-redo, physics-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Float32Array for all mutable physics layers (enables .set() memcpy in undo/snapshot)"]

key-files:
  created: []
  modified: ["efx-paint-physic-v3.html"]

key-decisions:
  - "Option A from debug diagnosis: convert wet arrays to Float32Array rather than fixing undo with loop copy"

patterns-established:
  - "All wet layer arrays are Float32Array -- never use regular Array for physics data that needs .set()"
  - "clearWetLayer uses .fill(0) on TypedArrays instead of element-wise loop"

requirements-completed: [BRUSH-01]

# Metrics
duration: 1min
completed: 2026-03-30
---

# Phase 03 Plan 03: Undo Physics Leak Fix Summary

**Convert wet layer arrays from regular JS Arrays to Float32Array, fixing silent .set() TypeError that left ghost paint after undo**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-30T15:23:25Z
- **Completed:** 2026-03-30T15:24:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed root cause of undo ghost paint: wet layer arrays (wetR/G/B/Alpha/wetness) changed from `new Array(W*H)` to `new Float32Array(W*H)`, enabling the `.set()` calls in the undo handler to work correctly
- Optimized clearWetLayer() from an element-wise for-loop to `.fill(0)` on TypedArrays (native memset)
- Undo handler `.set()` calls now execute Float32Array.set(Float32Array) which is a fast native memcpy

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert wet layer arrays to Float32Array and verify undo restore** - `96c677f` (fix)

**Plan metadata:** [pending final commit]

## Files Created/Modified
- `efx-paint-physic-v3.html` - Changed 5 wet layer declarations from regular Array to Float32Array; optimized clearWetLayer() to use .fill(0)

## Decisions Made
- Chose Option A from the debug diagnosis (convert declarations to Float32Array) over Option B (loop copy in undo handler) -- Float32Array is both the correct fix and a performance improvement for physics simulation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None -- all changes are functional, no placeholder code.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Undo system now correctly restores both canvas pixels and wet layer physics state
- Physics simulation no longer re-bakes undone paint onto the restored canvas
- Ready for visual verification (UAT test 11 should now pass)

## Self-Check: PASSED

- FOUND: efx-paint-physic-v3.html
- FOUND: 03-03-SUMMARY.md
- FOUND: commit 96c677f

---
*Phase: 03-brush-system-tools*
*Completed: 2026-03-30*
