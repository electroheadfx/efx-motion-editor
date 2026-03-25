---
phase: 20-paint-brush-fx
plan: 05
subsystem: rendering
tags: [webgl2, brush-styles, flow-field, stamp-rendering, noise, ink, charcoal, pencil, marker]

# Dependency graph
requires:
  - phase: 20-03
    provides: WebGL2 brush FX rendering pipeline (renderStyledStrokes), stamp-based stroke rasterization, post-effect passes
provides:
  - 2D flow field module for organic stroke distortion (createFlowField, sampleField, applyFlowField, getFlowField)
  - Per-style rendering configuration (StyleConfig) with distinct parameters for ink, charcoal, pencil, marker, watercolor
  - Flow field integration in stamp position computation
  - Style-aware post-effect aggregation (only applies effects declared per-style)
affects: [20-06, 20-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [hash-based 2D noise flow field, style config lookup with per-style stamp parameters, flow field point displacement]

key-files:
  created:
    - Application/src/lib/brushFlowField.ts
  modified:
    - Application/src/lib/brushFxRenderer.ts

key-decisions:
  - "Used hash-based 2D noise (not Perlin/Simplex) for flow field angles -- simpler, no dependency, deterministic, sufficient for organic stroke distortion"
  - "STYLE_CONFIGS uses Record<string, StyleConfig> (not Record<BrushStyle, ...>) for flexible lookup with fallback to ink defaults"
  - "Flow field applied after stamp position resampling but before rendering, preserving pressure values from original path"

patterns-established:
  - "Style config pattern: STYLE_CONFIGS dict with getStyleConfig() fallback, replaces hardcoded STYLE_HARDNESS"
  - "Flow field caching: module-level singleton regenerated only on dimension change"

requirements-completed: [PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-09]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 20 Plan 05: Brush Styles & Flow Field Summary

**Per-style stamp configs (ink/charcoal/pencil/marker) with distinct hardness/spacing/opacity and 2D hash-noise flow field for organic stroke path distortion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T17:00:56Z
- **Completed:** 2026-03-25T17:05:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created flow field module with deterministic 2D hash-noise angle grid, nearest-cell sampling, and point displacement for organic brush paths
- Added StyleConfig system with 6 style entries (flat, ink, charcoal, pencil, marker, watercolor) each with distinct hardness, stampSpacing, opacityMultiplier, useScatterShader, and postEffects
- Integrated flow field into computeStampPositions -- displaces stamps when fieldStrength > 0.01 using cached flow field singleton
- Updated aggregatePostEffectParams to respect per-style postEffects arrays (ink=edgeDarken, charcoal/pencil=grain, marker=none, watercolor=bleed+grain)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create flow field module for organic stroke distortion** - `61c502b` (feat)
2. **Task 2: Add per-style rendering configuration and integrate flow field** - `2922fa6` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `Application/src/lib/brushFlowField.ts` - 2D flow field with hash-noise grid, sampleField, applyFlowField, cached getFlowField
- `Application/src/lib/brushFxRenderer.ts` - StyleConfig interface, STYLE_CONFIGS record, getStyleConfig(), flow field integration in computeStampPositions, style-aware aggregatePostEffectParams

## Decisions Made
- Used hash-based 2D noise for flow field angles: simpler than Perlin/Simplex, no external dependency, deterministic, sufficient quality for stroke displacement
- Changed STYLE_CONFIGS to Record<string, StyleConfig> with fallback to ink defaults, dropping the BrushStyle import since the Record key type is more flexible
- Flow field displacement is applied after stamp position resampling, preserving the original pressure values while displacing spatial coordinates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused BrushStyle import to fix TS6196**
- **Found during:** Task 2 (style config integration)
- **Issue:** Replacing STYLE_HARDNESS (Record<BrushStyle, number>) with STYLE_CONFIGS (Record<string, StyleConfig>) left BrushStyle as unused import
- **Fix:** Removed BrushStyle from the import statement
- **Files modified:** Application/src/lib/brushFxRenderer.ts
- **Verification:** TypeScript compiles clean (no TS6196)
- **Committed in:** 2922fa6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup, no scope change.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- brushFlowField.ts ready for any future module that needs organic distortion
- brushFxRenderer.ts StyleConfig system ready for watercolor integration (Plan 06)
- All 4 non-watercolor styles have distinct visual parameters configured
- Flow field works with any style that sets fieldStrength > 0 in brushParams

## Known Stubs
None - all modules are fully wired with no placeholder data.

## Self-Check: PASSED

- FOUND: Application/src/lib/brushFlowField.ts
- FOUND: Application/src/lib/brushFxRenderer.ts
- FOUND: .planning/phases/20-paint-brush-fx/20-05-SUMMARY.md
- FOUND: commit 61c502b
- FOUND: commit 2922fa6

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
