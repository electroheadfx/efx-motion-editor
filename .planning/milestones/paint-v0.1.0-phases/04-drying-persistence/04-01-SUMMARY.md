---
phase: 04-drying-persistence
plan: "01"
subsystem: physics
tags: [drying-lut, s-curve, rebelle-algorithm, typed-arrays, wet-dry-physics]

# Dependency graph
requires:
  - phase: 03-brush-tools
    provides: "Brush tool framework (applyDryChunk, applyWetChunk, rehydrate)"
provides:
  - "LUT-driven drying system (dryLUT, invLUT, dryPos arrays)"
  - "S-curve wet-to-dry transfer replacing linear DRY_DRAIN"
  - "Per-pixel drying position tracking"
  - "Drying speed slider (5-50 LUT positions/tick)"
  - "Dry/wet tool LUT integration"
affects: [04-02-stroke-persistence, rendering-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [lut-driven-drying, per-pixel-drypos-tracking, cumulative-exponential-curve]

key-files:
  created: []
  modified: [efx-paint-physic-v3.html]

key-decisions:
  - "LUT_SIZE=3000 matching Rebelle's cT constant for smooth S-curve resolution"
  - "drySpeed=20 default for ~15s full dry cycle (3000/150 ticks at 10fps)"
  - "Slider range 5-50 for drySpeed giving ~6s to ~60s drying range"
  - "Dry tool uses inc=dryAmount*3 for visibly accelerated LUT traversal"
  - "Wet tool reverses dryPos by waterAmount*2, additive to existing wetness logic"

patterns-established:
  - "LUT-driven physics: advance dryPos per tick, compute fractional transfer via dryLUT delta"
  - "dryPos lifecycle: 0=freshly wet, advances toward LUT_SIZE=fully dry, resets to 0 after transfer"
  - "All drying paths (dryStep, forceDryAll, clearWetLayer, undo, dry tool) manage dryPos consistently"

requirements-completed: [PHYS-04]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 04 Plan 01: Drying LUT System Summary

**Rebelle-style S-curve drying via two-table LUT system (dryLUT/invLUT) with per-pixel position tracking and drying speed slider**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T16:21:33Z
- **Completed:** 2026-03-30T16:25:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced linear DRY_DRAIN percentage drain with Rebelle's two-table LUT system producing natural S-curve drying (slow initial, accelerating, plateau)
- Per-pixel dryPos tracking enables dry/wet tools to manipulate drying position directly via LUT traversal
- Drying speed slider maps 0-100 to 5-50 LUT positions per tick, giving user control from ~6s to ~60s full drying time
- Dry tool uses accelerated LUT advancement (dryAmount*3 positions per chunk) for visible fast-drying
- Wet tool reverses dryPos while retaining wetness addition, simulating rehydration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add LUT arrays, initDryingLUT(), dryPos, replace dryStep** - `152584e` (feat)
2. **Task 2: Integrate dry/wet brush tools with LUT system** - `783aefe` (feat)

## Files Created/Modified
- `efx-paint-physic-v3.html` - Added dryLUT/invLUT/dryPos arrays, initDryingLUT(), LUT-driven dryStep, updated forceDryAll/clearWetLayer/undo, rewrote applyDryChunk/applyWetChunk for LUT integration, added drying speed slider listener

## Decisions Made
- LUT_SIZE=3000 matches Rebelle's cT constant for sufficient S-curve resolution
- drySpeed default 20 = 3000 positions / (150 ticks = 15s at 10fps) for natural-feeling default drying
- Slider range 5-50 covers ~6s fast drying to ~60s slow drying
- Dry tool multiplier (dryAmount*3) chosen to make tool visibly faster than ambient drying
- Wet tool reversal (waterAmount*2) is additive to wetness manipulation, not a replacement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- LUT system complete and integrated with all drying paths
- invLUT available for future inverse lookup needs (e.g., converting opacity back to LUT position)
- Ready for 04-02 stroke persistence plan

## Self-Check: PASSED

- efx-paint-physic-v3.html: FOUND
- 04-01-SUMMARY.md: FOUND
- Commit 152584e: FOUND
- Commit 783aefe: FOUND

---
*Phase: 04-drying-persistence*
*Completed: 2026-03-30*
