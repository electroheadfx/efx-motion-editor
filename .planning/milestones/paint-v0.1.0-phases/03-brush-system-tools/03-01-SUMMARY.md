---
phase: 03-brush-system-tools
plan: "01"
subsystem: brush-system
tags: [canvas2d, brush-texture, paintstroke, pressure, ui, wet-layer]

# Dependency graph
requires:
  - phase: 02-rendering-pipeline
    provides: wet layer arrays, compositeWetLayer, transferToWetLayer, paper texture emboss
provides:
  - PaintStroke recording format in allActions[] with timestamp
  - getEffectivePressure() multiplier model for pen/mouse
  - sampleBrushGrain() and createMirroredBrushGrain() for brush texture sampling
  - 9-tool button bar (paint, erase, water, smear, blend, blow, wet, dry, liquify)
  - Universal sliders (size, opacity, water, dry, pressure) and contextual slider system
  - Clean codebase with smudge/mix/strokeEdge removed
affects: [03-02-PLAN, brush-types, stroke-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns: [PaintStroke unified recording, brush grain quadrant mirroring, pressure multiplier model, contextual slider UI]

key-files:
  created: []
  modified: [efx-paint-physic-v2.html]

key-decisions:
  - "Backward-compatible param destructuring: opts.size||opts.radius for replay of old stored actions"
  - "Fixed polygon layer count (+2) to compensate for removed strokeEdge definition"
  - "Brush grain mirroring at load time (256x256 pre-computed) for O(1) per-pixel sampling"
  - "Edge slider removed entirely with fixed variance=1.0 (was default edgeMul value)"

patterns-established:
  - "PaintStroke format: {tool, points, color, params, timestamp} for all tool recordings"
  - "Contextual slider pattern: #ctxOpts container with .ctx-[tool] class visibility toggle"
  - "getOpts() returns universal params: size, opacity, pressure, waterAmount, dryAmount, pickup"

requirements-completed: [STROKE-01, STROKE-02, BRUSH-02, BRUSH-03]

# Metrics
duration: 10min
completed: 2026-03-30
---

# Phase 03 Plan 01: Brush Foundation Summary

**PaintStroke recording format, mirrored brush grain (256x256), pressure multiplier model, 9-tool UI with universal/contextual sliders, strokeEdge/smudge/mix cleanup**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T11:28:36Z
- **Completed:** 2026-03-30T11:38:54Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Unified PaintStroke recording format across all tools in allActions[] with timestamp, compatible with efx-motion-editor
- Brush grain quadrant mirroring at load time (128x128 -> 256x256) with sampleBrushGrain() for per-pixel lookup
- Pressure multiplier model: getEffectivePressure(penPoint, sliderValue) = slider * penPressure for pen, slider for mouse
- 9 tool buttons (paint, erase, water, smear, blend, blow, wet, dry, liquify) with smudge/mix removed
- Universal sliders (size, opacity, water, dry, pressure) always visible; contextual pickup slider for paint only
- Removed strokeEdge() artifacts by deleting function and calls, increased polygon layers to compensate

## Task Commits

Each task was committed atomically:

1. **Task 1: PaintStroke type, allActions refactor, pressure model, brush grain mirroring** - `3bc2345` (feat)
2. **Task 2: UI reorganization, strokeEdge fix, smudge removal, mix merger** - `542fd4f` (feat)

## Files Created/Modified
- `efx-paint-physic-v2.html` - PaintStroke type definition, mirrored brush grain, getEffectivePressure, getOpts refactor, 9-tool UI, universal + contextual sliders, strokeEdge/smudge/mix removal

## Decisions Made
- Used backward-compatible destructuring (opts.size||opts.radius) so old stored actions in allActions[] can still be replayed via redrawAll()
- Fixed edge variance at 1.0 (the default edgeMul when edge slider was at 50) rather than making it configurable -- edge definition now comes purely from layered polygon fills
- Increased polygon layer count by 2 (20->22 base) to compensate for removed strokeEdge definition per Pitfall 6 from RESEARCH.md
- Brush grain mirroring done at load time (pre-computed 256x256 Float32Array) rather than at sample time, for O(1) per-pixel lookup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken DOM references to removed slider elements**
- **Found during:** Task 2 (UI reorganization)
- **Issue:** After removing #we (wetness) and #ed (edge) slider elements from HTML, 4 references to getElementById('we') and 1 reference to getElementById('ed') in the JavaScript remained, which would cause runtime null pointer errors
- **Fix:** Updated all getElementById('we') to getElementById('wa') (new water amount slider); replaced edgeMul calculation with fixed variance
- **Files modified:** efx-paint-physic-v2.html
- **Verification:** grep confirms zero remaining references to removed element IDs
- **Committed in:** 542fd4f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness -- without the fix, all paint strokes would crash on null element access. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation is complete for Plan 02 brush type implementations
- sampleBrushGrain() ready for paint and smear brush grain modulation
- getEffectivePressure() ready for all brush types to use pressure multiplier
- PaintStroke format established -- all new brush types will record in correct format from day one
- 6 new brush types (erase, water, smear, blend, blow, wet/dry) are stub tool buttons awaiting implementation in Plan 02

---
## Self-Check: PASSED

- efx-paint-physic-v2.html: FOUND
- 03-01-SUMMARY.md: FOUND
- Commit 3bc2345 (Task 1): FOUND
- Commit 542fd4f (Task 2): FOUND

---
*Phase: 03-brush-system-tools*
*Completed: 2026-03-30*
