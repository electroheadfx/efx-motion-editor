---
phase: 03-brush-system-tools
plan: "02"
subsystem: engine
tags: [canvas-2d, brush-tools, wet-layer, physics, typed-arrays]

requires:
  - phase: 03-01
    provides: sampleBrushGrain, getEffectivePressure, UI with 9 tool buttons, PaintStroke model
provides:
  - 7 new brush functions (erase, water, smear, blend, blow, wet, dry)
  - Pointer event dispatch wiring for all 9 tools
  - Brush grain deposit modulation in paint and smear tools
  - Brush grain emboss effect in compositeWetLayer (D-07)
  - Wet layer undo snapshots via Float32Array .set()
affects: [phase-04, phase-05]

tech-stack:
  added: []
  patterns: [direct-wet-layer-manipulation, real-time-chunk-vs-stroke-completion]

key-files:
  created: []
  modified: [efx-paint-physic-v2.html]

key-decisions:
  - "Real-time tools (erase, smear, blow, wet, dry) use chunk-based dispatch in onPointerMove; stroke-completion tools (water, blend) process full rawPts in onPointerUp"
  - "Brush grain modulates only paint and smear deposits (not water/wet/dry per Pitfall 5)"
  - "Emboss grain uses 0.7 base + 0.3 brushGrain additive alpha modulation in compositeWetLayer"
  - "Applied Float32Array fix to v2 as well (deviation Rule 1) to prevent undo .set() TypeError"

patterns-established:
  - "Direct wet-layer manipulation: all brush tools write to wetR/wetG/wetB/wetAlpha/wetness arrays, never to canvas context X directly"
  - "Wet layer undo: snapshot wet arrays as Float32Array in onPointerDown, restore via .set() in undo handler"

requirements-completed: [BRUSH-01, BRUSH-03]

duration: 4min
completed: 2026-03-30
---

# Plan 03-02: Brush Type Functions Summary

**7 new brush tools (erase, water, smear, blend, blow, wet, dry) as direct wet-layer manipulators with brush grain texture modulation and emboss grain in compositeWetLayer**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-03-30
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments
- All 8 required brush types produce distinct visual output (BRUSH-01 complete)
- Brush grain creates visible bristle-like texture variation in paint and smear deposits (BRUSH-03 deposit modulation)
- Brush grain adds per-stroke emboss grain effect on wet paint surface in compositeWetLayer (D-07)
- Wet layer undo fully functional with Float32Array .set() for all tool types
- Real-time dispatch (erase, smear, blow, wet, dry) and stroke-completion dispatch (water, blend) correctly wired

## Task Commits

1. **Task 1: Implement 6 new brush types, brush grain emboss, wet layer undo** - `5bc4afe` (feat)
2. **Task 2: Visual verification of all 8 brush types** - human-verified, approved

**Deviation fix:** `8b5b1f3` (fix: wet arrays Array to Float32Array)

## Files Created/Modified
- `efx-paint-physic-v2.html` - 7 new brush functions, pointer dispatch wiring, brush grain integration, wet undo snapshots

## Decisions Made
- Real-time vs stroke-completion split matches research recommendations
- Brush grain excluded from water/wet/dry tools per Pitfall 5 guidance
- Emboss grain kept subtle (0.7/0.3 split) to layer with paper texture

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wet arrays: Array to Float32Array for undo .set()**
- **Found during:** Task 1 verification
- **Issue:** Wet layer arrays declared as `new Array(W*H).fill(0)` — `.set()` is TypedArray-only, causing silent TypeError in undo handler
- **Fix:** Changed all 5 declarations to `new Float32Array(W*H)`, optimized clearWetLayer to `.fill(0)`
- **Files modified:** efx-paint-physic-v2.html
- **Committed in:** `8b5b1f3`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for undo correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 brush types functional and verified
- Brush grain texture working in both deposit and emboss modes
- Ready for Phase 4 work

---
*Phase: 03-brush-system-tools*
*Completed: 2026-03-30*
