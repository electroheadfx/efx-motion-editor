---
phase: 02-rendering-pipeline
plan: "01"
subsystem: rendering
tags: [beer-lambert, transparency, density-alpha, flow-physics, watercolor]

# Dependency graph
requires:
  - phase: 01-algorithm-port-foundation
    provides: working wet/dry paint physics with wetAlpha, wetness, and flow arrays
provides:
  - Beer-Lambert density-weighted transparency in compositeWetLayer
  - Strengthened flow/diffusion parameters for visible spreading and dripping
  - Fixed wetAlpha cap mismatch between deposit (200000) and flow (was 3000, now 200000)
affects: [02-rendering-pipeline plan 02, paper-texture-decoupling]

# Tech tracking
tech-stack:
  added: []
  patterns: [beer-lambert-absorption, density-weighted-alpha]

key-files:
  created: []
  modified: [efx-paint-physic-v2.html]

key-decisions:
  - "DENSITY_K=3.5 chosen as balance between gradual washes and fast buildup"
  - "MAX_DISPLAY_ALPHA=245 to maintain watercolor feel (never fully opaque)"
  - "FLOW_FRACTION=0.06 for ~60% spread per second -- visible but not instant"

patterns-established:
  - "Beer-Lambert absorption: alpha = 255 * (1 - exp(-K * density)) for all paint transparency"
  - "Density normalization: wetAlpha divided by DENSITY_NORM (3000) before absorption calculation"

requirements-completed: [RENDER-02]

# Metrics
duration: 2min
completed: 2026-03-29
---

# Phase 02 Plan 01: Density-Weighted Transparency Summary

**Beer-Lambert density-weighted alpha replaces linear mapping; flow parameters strengthened for visible spreading and dripping**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T17:17:42Z
- **Completed:** 2026-03-29T17:20:20Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced linear wetAlpha/2000*240 mapping with Beer-Lambert absorption curve (1 - exp(-DENSITY_K * density)) for realistic watercolor transparency
- Light strokes now produce translucent washes where paper/background shows through, while overlapping strokes progressively build opacity up to MAX_DISPLAY_ALPHA=245
- Fixed critical wetAlpha cap mismatch in flowStep (was 3000, now 200000) that prevented paint mass conservation during diffusion
- Strengthened flow parameters (FLOW_THRESHOLD=8, FLOW_FRACTION=0.06, GRAVITY_BIAS=0.06) for visible spreading and downward dripping

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace linear alpha with Beer-Lambert density-weighted transparency** - `4928b2d` (feat)
2. **Task 2: Fix flow visibility -- strengthen parameters and fix wetAlpha cap mismatch** - `6b2c2d4` (fix)

## Files Created/Modified
- `efx-paint-physic-v2.html` - Added DENSITY_K/DENSITY_NORM/MAX_DISPLAY_ALPHA constants, replaced linear alpha with Beer-Lambert curve in compositeWetLayer, strengthened flow params, fixed wetAlpha flow cap

## Decisions Made
- DENSITY_K=3.5 balances gradual washes (low density) with fast buildup (high density) -- can be tuned later via UI slider
- MAX_DISPLAY_ALPHA=245 ensures paint never becomes fully opaque, preserving watercolor translucency feel
- FLOW_FRACTION=0.06 gives ~60% spread per second at full wetness -- visible spreading without instant dissipation
- Did not re-enable velocity-based transport per transport-velocity-bug debug history

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Density-weighted compositing is live -- Plan 02 (paper texture decoupling) can now work with proper transparency values
- The flow system conserves paint mass correctly with the 200000 cap fix, enabling reliable flow visualization in future plans
- ensureHeightMap and procedural noise were intentionally left untouched for Plan 02

## Self-Check: PASSED

- efx-paint-physic-v2.html: FOUND
- 02-01-SUMMARY.md: FOUND
- Commit 4928b2d (Task 1): FOUND
- Commit 6b2c2d4 (Task 2): FOUND

---
*Phase: 02-rendering-pipeline*
*Completed: 2026-03-29*
