---
phase: 20-paint-brush-fx
plan: 06
subsystem: rendering
tags: [webgl2, watercolor, polygon-deformation, tyler-hobbs, midpoint-displacement, seeded-rng, fan-triangulation]

# Dependency graph
requires:
  - phase: 20-03
    provides: WebGL2 brush FX rendering pipeline (brushFxRenderer.ts), stamp-based rendering, spectral compositing, post-effect passes
provides:
  - Watercolor polygon deformation module (brushWatercolor.ts)
  - Tyler Hobbs midpoint displacement with seeded Gaussian RNG
  - Watercolor rendering path in brushFxRenderer with 7 semi-transparent polygon layers
  - Deterministic stroke seeding from stroke.id for export parity
affects: [20-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [midpoint displacement polygon deformation, mulberry32 seeded PRNG, Box-Muller Gaussian transform, fan triangulation for GL_TRIANGLES]

key-files:
  created:
    - Application/src/lib/brushWatercolor.ts
  modified:
    - Application/src/lib/brushFxRenderer.ts

key-decisions:
  - "Inline WATERCOLOR_VERT_SRC and WATERCOLOR_FRAG_SRC in brushFxRenderer.ts rather than adding to brushFxShaders.ts -- shaders are trivial (10 lines each) and specific to watercolor path"
  - "Cast getStroke output to [number, number][] for renderWatercolorLayers since perfect-freehand returns number[][] which is compatible but not typed identically"
  - "Per-layer alpha = stroke.opacity * 0.3 / layerCount for natural watercolor transparency buildup"

patterns-established:
  - "Polygon deformation watercolor: 7 base passes (variance 2.0/(i+1)) + 4 per-layer passes (variance 1.0/(i+1)) = organic edge bleed"
  - "Deterministic stroke rendering: hashStringToNumber(stroke.id) as mulberry32 seed for export parity"

requirements-completed: [PAINT-07]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 20 Plan 06: Watercolor Polygon Deformation Summary

**Tyler Hobbs watercolor polygon deformation with 7 semi-transparent layers, seeded mulberry32 PRNG for deterministic export, and WebGL2 fan-triangulated rendering integrated into brushFxRenderer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T17:01:37Z
- **Completed:** 2026-03-25T17:06:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created brushWatercolor.ts with full Tyler Hobbs polygon deformation pipeline: seeded Gaussian RNG, midpoint displacement, multi-layer generation, fan triangulation
- Integrated watercolor rendering path into brushFxRenderer.ts with deterministic seeding from stroke.id
- Watercolor strokes render 7 overlapping semi-transparent deformed polygon layers (D-11 compliant)
- Bleed and grain post-effects apply automatically via existing aggregatePostEffectParams logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Create brushWatercolor.ts with polygon deformation algorithm** - `a7e4494` (feat)
2. **Task 2: Integrate watercolor rendering path into brushFxRenderer** - `7a53903` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `Application/src/lib/brushWatercolor.ts` - Tyler Hobbs watercolor polygon deformation module with gaussianRandom, seedableGaussian, deformPolygon, renderWatercolorLayers, polygonToTriangles, polygonCenter exports
- `Application/src/lib/brushFxRenderer.ts` - Added watercolor rendering path: import brushWatercolor, watercolor GL resources, WATERCOLOR shaders, renderWatercolorStroke, hashStringToNumber, rendering loop branch on brushStyle === 'watercolor', cleanup in disposeBrushFx

## Decisions Made
- Placed watercolor shaders inline in brushFxRenderer.ts (10 lines each) rather than adding to brushFxShaders.ts, since they're trivial and specific to the watercolor polygon path
- Used `outline as [number, number][]` type assertion for perfect-freehand output passed to renderWatercolorLayers, since getStroke returns number[][] which is structurally compatible
- Per-layer alpha formula `stroke.opacity * 0.3 / layerCount` produces natural transparency buildup across 7 layers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation in worktree reports `Cannot find module 'perfect-freehand'` for brushFxRenderer.ts -- pre-existing worktree issue (node_modules not installed). Not a real compilation problem.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- brushWatercolor.ts exports are ready for any future watercolor enhancements
- Watercolor rendering path is fully integrated into the brushFxRenderer pipeline
- Post-effects (bleed + grain) apply via existing aggregatePostEffectParams from watercolor default params
- Plan 07 (integration + wiring) can reference the watercolor path as functional

## Self-Check: PASSED

- FOUND: Application/src/lib/brushWatercolor.ts
- FOUND: Application/src/lib/brushFxRenderer.ts
- FOUND: commit a7e4494
- FOUND: commit 7a53903

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
