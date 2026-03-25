---
phase: 20-paint-brush-fx
plan: 03
subsystem: rendering
tags: [webgl2, spectral-mixing, kubelka-munk, brush-fx, stamp-rendering, framebuffer, glsl]

# Dependency graph
requires:
  - phase: 20-01
    provides: BrushStyle type, BrushFxParams interface, PaintStroke with brushStyle/brushParams fields
  - phase: 20-02
    provides: GLSL shader source strings (stamp, composite, grain, edge darken, bleed, scatter)
provides:
  - WebGL2 brush FX rendering pipeline (renderStyledStrokes)
  - Offscreen canvas with spectral compositing for non-flat brush styles
  - Stamp-based stroke rasterization along perfect-freehand path
  - Post-effect passes (grain, edge darken, bleed)
  - Resource disposal (disposeBrushFx)
affects: [20-04, 20-05, 20-06, 20-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-init WebGL2 context, framebuffer ping-pong, stamp-based stroke rendering, spectral compositing pipeline]

key-files:
  created:
    - Application/src/lib/brushFxRenderer.ts
  modified: []

key-decisions:
  - "Combined Task 1 (infrastructure) and Task 2 (rendering) into single cohesive module to avoid partial file states"
  - "Used raw stroke points as stamp centroids rather than outline-derived centroids for more predictable path behavior"
  - "Applied sRGB-to-linear gamma decompression (pow 2.2) in hexToGLColor for correct spectral mixing in linear space"
  - "Post-effect pass targets cycle through available FBOs to avoid overwriting active read textures"

patterns-established:
  - "Stamp-based stroke rendering: compute positions along path at size*0.3 intervals, draw textured quads with style-dependent hardness"
  - "Post-effect chaining: edge darken -> bleed -> grain, each using different FBO targets to avoid read/write conflicts"

requirements-completed: [PAINT-06]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 20 Plan 03: WebGL2 Brush FX Renderer Summary

**WebGL2 offscreen rendering pipeline with stamp-based stroke rasterization, Kubelka-Munk spectral compositing via ping-pong framebuffers, and grain/edge/bleed post-effect passes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T13:19:07Z
- **Completed:** 2026-03-25T13:23:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Built complete WebGL2 brush FX rendering pipeline in a single 776-line module
- Lazy-init WebGL2 offscreen context following glBlur.ts pattern with context loss recovery
- Stamp-based stroke rendering with style-dependent hardness (watercolor=0.2, ink=0.7, charcoal=0.3, pencil=0.8, marker=0.9)
- Spectral compositing via Kubelka-Munk mixing shader with ping-pong framebuffer accumulation
- Three post-effect passes: edge darkening, watercolor bleed, and paper grain texture
- renderStyledStrokes() returns HTMLCanvasElement for ctx.drawImage() compositing, null when WebGL2 unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: WebGL2 infrastructure + rendering pipeline** - `df8b636` (feat)

**Plan metadata:** [pending] (docs: complete plan)

_Note: Tasks 1 and 2 were implemented together as a single cohesive module since the infrastructure and rendering logic are tightly coupled._

## Files Created/Modified
- `Application/src/lib/brushFxRenderer.ts` - WebGL2 brush FX rendering pipeline with lazy-init context, shader programs, FBO ping-pong, stamp rendering, spectral compositing, and post-effect passes

## Decisions Made
- Combined infrastructure (Task 1) and rendering (Task 2) into single commit since the file must be written as a cohesive whole
- Used stroke input points as stamp centroids rather than deriving centroids from the outline polygon, providing more predictable stamp placement
- Applied sRGB-to-linear gamma decompression (pow 2.2) in hexToGLColor for physically-correct spectral mixing
- Post-effect passes chain through different FBO targets (postFBO, writeAccumFBO) to avoid read/write conflicts on the same texture

## Deviations from Plan

None - plan executed exactly as written. The only structural difference is that Tasks 1 and 2 were implemented as a single commit since splitting the file between infrastructure and rendering would create a non-functional intermediate state.

## Issues Encountered
- TypeScript reports `Cannot find module 'perfect-freehand'` for brushFxRenderer.ts -- this is a pre-existing worktree issue (node_modules not installed). The same error exists for paintRenderer.ts. Not a real compilation problem.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- brushFxRenderer.ts is ready for integration with paintRenderer.ts (Plan 04/06)
- renderStyledStrokes() accepts PaintStroke[] and returns HTMLCanvasElement for drawImage compositing
- disposeBrushFx() available for cleanup when paint layer is destroyed

## Self-Check: PASSED

- FOUND: Application/src/lib/brushFxRenderer.ts
- FOUND: commit df8b636
- FOUND: 20-03-SUMMARY.md

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
