---
phase: 05-library-demo-polish
plan: 02
subsystem: engine
tags: [typescript, physics, wet-layer, diffusion, drying, paper, brush, stroke, watercolor]

# Dependency graph
requires:
  - phase: 05-01
    provides: types.ts, util/math.ts, util/noise.ts, util/color.ts
provides:
  - "8 typed TypeScript modules with 54 exported physics and brush functions"
  - "core/wet-layer.ts: buffer factories and wet paint deposit operations"
  - "core/diffusion.ts: FBM-displaced height-gradient flow diffusion"
  - "core/drying.ts: LUT-driven wet-to-dry transfer with sacred /800 formula"
  - "core/paper.ts: paper texture loading, brush grain, height sampling"
  - "brush/stroke.ts: stroke processing pipeline (smooth, resample, ribbon, deform)"
  - "brush/paint.ts: full paint stroke rendering with polygon layering and bristle traces"
  - "brush/erase.ts: polygon-masked erase with background restoration"
  - "brush/water.ts: water/smear/blend/blow/wet/dry tool implementations"
affects: [05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-functional-modules, buffers-as-arguments, no-module-level-state]

key-files:
  created:
    - paint-rebelle-new/src/core/wet-layer.ts
    - paint-rebelle-new/src/core/diffusion.ts
    - paint-rebelle-new/src/core/drying.ts
    - paint-rebelle-new/src/core/paper.ts
    - paint-rebelle-new/src/brush/stroke.ts
    - paint-rebelle-new/src/brush/paint.ts
    - paint-rebelle-new/src/brush/erase.ts
    - paint-rebelle-new/src/brush/water.ts
  modified: []

key-decisions:
  - "All physics/brush modules receive buffers as function arguments -- no module-level mutable state"
  - "Only paper.ts loadPaperTexture touches DOM (Image/canvas for async pixel data extraction)"
  - "sampleBrushGrain takes Uint8Array param and divides by 255 (v3 uses Float32Array); matches createMirroredBrushGrain output type"
  - "diffuseStep takes sampleHFn callback to decouple from paper module -- enables future test injection"
  - "ribbon takes explicit hasPenInput param instead of reading global -- enables deterministic replay"

patterns-established:
  - "Pure functional physics: all engine state passed via typed arguments, never stored in module scope"
  - "Height sampling callback: physics functions accept (x,y)=>number for paper height, decoupled from paper module"
  - "Brush grain Uint8Array: grain stored as 0-255 bytes, sampled as 0-1 float via /255 division"

requirements-completed: [LIB-02]

# Metrics
duration: 9min
completed: 2026-03-31
---

# Phase 05 Plan 02: Core Physics & Brush Module Extraction Summary

**54 physics and brush functions extracted from v3.html into 8 typed TypeScript modules with zero module-level state and full tsc compliance**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T16:10:39Z
- **Completed:** 2026-03-31T16:19:47Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- Extracted all core physics modules: wet-layer (8 funcs), diffusion (6 funcs), drying (3 funcs), paper (6 funcs)
- Extracted all brush modules: stroke (9 funcs), paint (10 funcs), erase (1 func), water (11 funcs)
- Every function has explicit TypeScript signatures with typed buffer parameters
- Zero module-level mutable state -- all buffers passed as arguments for testability and thread safety
- tsc --noEmit passes with zero errors after both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract core physics modules (wet-layer, diffusion, drying, paper)** - `60bd20a` (feat)
2. **Task 2: Extract brush modules (stroke, paint, erase, water stubs)** - `d9d1b99` (feat)

## Files Created/Modified
- `paint-rebelle-new/src/core/wet-layer.ts` - Wet layer buffer factories and deposit/transfer operations
- `paint-rebelle-new/src/core/diffusion.ts` - FBM-displaced darken-flood diffusion and physicsStep orchestrator
- `paint-rebelle-new/src/core/drying.ts` - LUT-driven drying with sacred /800 opacity formula
- `paint-rebelle-new/src/core/paper.ts` - Paper texture loading, mirrored brush grain, height sampling
- `paint-rebelle-new/src/brush/stroke.ts` - Stroke processing: smooth, resample, ribbon, deform, pen data interpolation
- `paint-rebelle-new/src/brush/paint.ts` - Paint brush rendering: polygon layering, bristle traces, pickup color mixing
- `paint-rebelle-new/src/brush/erase.ts` - Polygon-masked erase with background restoration
- `paint-rebelle-new/src/brush/water.ts` - Water/smear/blend/blow/wet/dry implementations (complete, not stubs)

## Decisions Made
- All physics/brush modules receive buffers as function arguments -- no module-level mutable state, enabling future testing and worker isolation
- Only paper.ts loadPaperTexture accesses DOM (Image + canvas for async pixel data extraction) -- all other core/ and brush/ modules are DOM-free
- diffuseStep accepts sampleHFn callback `(x: number, y: number) => number` to decouple from paper module
- ribbon accepts explicit `hasPenInput` boolean parameter instead of reading a global variable
- sampleBrushGrain output type is Uint8Array (0-255) divided by 255 at sample time, matching createMirroredBrushGrain output

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all 54 functions contain complete implementations extracted from v3.html. The water.ts functions (applyWaterStroke, applySmearChunk, etc.) are fully implemented algorithms; they are only "stubs" in the sense that the engine won't wire them to tool dispatch until a future plan enables them.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 core + brush modules ready for plan 03 (engine facade / integration layer)
- Types from plan 01 + modules from plan 02 form the complete engine internals
- No blocking issues for downstream plans

---
*Phase: 05-library-demo-polish*
*Completed: 2026-03-31*

## Self-Check: PASSED
- All 8 files created: FOUND
- Commit 60bd20a (Task 1): FOUND
- Commit d9d1b99 (Task 2): FOUND
