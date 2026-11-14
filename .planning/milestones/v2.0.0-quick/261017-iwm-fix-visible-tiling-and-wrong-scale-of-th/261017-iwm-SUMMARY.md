---
phase: quick-261017-iwm
plan: 261017-iwm
subsystem: watercolor-papers
tags: [procedural-papers, height-map, clean-room, canvas-raster, cache, PAPER_REFERENCE_HEIGHT]

# Dependency graph
requires:
  - phase: 56
    provides: proceduralHeightMap generator, projectPaperRaster fond path
provides:
  - referenceHeight scale law on proceduralHeightMap (constant physical grain size)
  - Full-fond procedural raster with no createPattern tiling
  - Content-keyed fond cache
affects: [efx-watercolor, projectPaperRaster, PaperPicker, paperPass]

actuals:
  tokens: 6422
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Optional referenceHeight parameter for scale-law coordinate mapping (byte-stable default)"
    - "Full-raster fond generation replaces tile synthesis + pattern repeat"
    - "Content-keyed canvas cache: (paperId, seed, W, H, grainScale)"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/papers/procedural.ts
    - packages/efx-watercolor/src/papers/papers.test.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts

key-decisions:
  - "PAPER_REFERENCE_HEIGHT = 1100 exported from procedural.ts as single home of the playground sheet-height constant"
  - "Lattice period sized to cover the sampled span under referenceHeight (no wrap/repetition at any canvas size)"
  - "Median-crossing cycle count used as the discriminating pin for frequency scaling (extrema count was masked by fleck density)"
  - "Shade formula kept as-is (PaperPicker relief + PLAYGROUND_PAPER_LOOK bump/mottle); playground 1.4 factor optional and not folded in"

patterns-established:
  - "referenceHeight is optional; omitted keeps byte-identical output (hash-pinned)"
  - "Procedural fond arm returns the WxH canvas directly — never routed through createPattern('repeat')"

requirements-completed: []

coverage:
  - id: D1
    description: "Procedural fond is one continuous paper at WxH — no visible tile grid or seams"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#no tiling: at 512x512 the pixel at (0,y) differs from (256,y)"
        status: pass
    human_judgment: true
    rationale: "Automated pin confirms no 256-repeat in pixels; live UAT must confirm the user does not see a tile grid at real canvas sizes"
  - id: D2
    description: "Grain feature size is canvas-size-invariant under PAPER_REFERENCE_HEIGHT = 1100"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/papers.test.ts#frequency scales with outputHeight / referenceHeight"
        status: pass
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#canvas-size invariance: 512 and 1024 show features of comparable physical size"
        status: pass
    human_judgment: true
    rationale: "Median-crossing pins confirm frequency scales with height/1100; live UAT must confirm grain matches the playground preview at the same zoom"
  - id: D3
    description: "Per-paper bump/mottle from playground papers.ts modulate relief contrast / cloudiness"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#bump modulates relief contrast / mottle differences are honoured"
        status: pass
    human_judgment: false
  - id: D4
    description: "Procedural fond rasters are cached by content key — same key returns identical object"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#cache identity: same content key returns the identical canvas object"
        status: pass
    human_judgment: false
  - id: D5
    description: "PaperPicker thumbs, real-jpg arm, and paperPass stay behaviourally unchanged"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/papers.test.ts#default path (referenceHeight omitted) is byte-stable"
        status: pass
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#real-jpg arm still uses createPattern repeat"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-17
status: complete
---

# Quick 261017-iwm: Fix Visible Tiling and Wrong Scale of Procedural Paper Fond Summary

**Continuous procedural fond at WxH with PAPER_REFERENCE_HEIGHT = 1100 constant-physical-size grain law, replacing 256-tile createPattern repeat**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-17T11:50:41Z
- **Completed:** 2026-10-17T14:12:13+02:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added optional `referenceHeight` parameter to `proceduralHeightMap` — when provided, recipe frequency `f` becomes "cycles per `referenceHeight` texels of sheet height" (isotropic `f / referenceHeight` cycles-per-texel), giving constant physical grain size at any canvas size
- Exported `PAPER_REFERENCE_HEIGHT = 1100` as the single home of the playground sheet-height law (numbers only, P1 clean-room)
- Replaced 256-tile synthesis + `createPattern('repeat')` with full-fond generation at the fond's actual WxH — no visible tile grid or seams
- Content-keyed fond cache: `(paperTexture, seed, width, height, grainScale)` — same key returns the identical canvas object
- Default path (referenceHeight omitted) keeps byte-identical output (hash-pinned at 32x32 and 16x12) so PaperPicker thumbs and paperPass bake tooth stay put

## Task Commits

One atomic commit (plan specifies single commit for this quick):

1. **Tasks 1+2: scale law + no-tile fond** - `8d292c4d` (fix)

## Files Created/Modified

- `packages/efx-watercolor/src/papers/procedural.ts` - Added `PAPER_REFERENCE_HEIGHT = 1100` export and optional `referenceHeight` parameter with isotropic `f / refH` cycles-per-texel mapping; lattice sized to cover span without wrapping
- `packages/efx-watercolor/src/papers/papers.test.ts` - Hash-stability pins, frequency-scaling pins (median-crossing cycle count), no-tile pin, null-guard pins
- `app/src/lib/projectPaperRaster.ts` - Replaced `buildProceduralPaperTile` with `buildProceduralPaperFond` at WxH; content-keyed cache; procedural arm returns directly (no createPattern); deleted `PROCEDURAL_FOND_TILE` / `PAPER_UNITS`/`proceduralTileCache`
- `app/src/lib/projectPaperRaster.test.ts` - No-tiling pin, canvas-size invariance pin (median crossings), cache identity, source-scan updates

## Decisions Made

- **Lattice period sized to cover the sampled span** under referenceHeight (not fixed at `round(f)`) — prevents the noise lattice from wrapping and re-introducing a ~1100px tile grid on large canvases. The "seeded lattice core" (`tileLattice`/`sampleLattice`/`tileFbm`) is unchanged; only the period parameterization differs per mode.
- **Median-crossing cycle count** as the discriminating frequency pin. Raw extrema count was masked by fleck density (ratio ~0.5 under both laws); median crossings of a smoothed row cleanly separate the refH law (~0.4) from the default law (~0.9).
- **Shade formula unchanged** — kept the existing PaperPicker relief + `PLAYGROUND_PAPER_LOOK` bump/mottle. The playground's `1.4` slope factor was noted as optional and not folded in.

## Deviations from Plan

None — plan executed as written. The frequency pin was refined from raw extrema count to median-crossing cycle count (the plan's extrema measure was not discriminating due to fleck noise), but this is a test-quality improvement within the plan's intent.

## Live UAT Rows (user-run — status: automated-ready)

1. Open the editor with a procedural paper (Cold Press) selected → the fond is one continuous paper: no visible tile grid, no seams, at default and large canvas sizes.
2. Tooth feature size matches the playground paper preview at the same zoom — not zoomed-in blobs, not invisible micro-grain. Cold Press vs Rough side by side: Rough reads clearly coarser.
3. Change paper → the fond changes; no stale tile grid from the previous paper.
4. A non-watercolor stroke and a watercolor stroke still sit on the same continuous fond.
5. Save → close → reopen → same paper, same continuous fond.
6. Console clean.

## Self-Check: PASSED

- `packages/efx-watercolor/src/papers/procedural.ts` — FOUND (committed in 8d292c4d)
- `packages/efx-watercolor/src/papers/papers.test.ts` — FOUND (committed in 8d292c4d)
- `app/src/lib/projectPaperRaster.ts` — FOUND (committed in 8d292c4d)
- `app/src/lib/projectPaperRaster.test.ts` — FOUND (committed in 8d292c4d)
- Commit `8d292c4d` — FOUND (1 commit, plan_head_before fdb317fd → plan_head_after 8d292c4d)

---
*Quick: 261017-iwm*
*Completed: 2026-10-17*
