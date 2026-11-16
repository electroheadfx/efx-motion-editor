# Quick Task 261116-r9k: Studio painted-stroke conversion re-samples its replay spine at up to 3x - Context

**Gathered:** 2026-11-16
**Status:** Ready

<domain>
## Task Boundary

At the painted-to-vector CONVERSION seam only, an anchorless hand-painted
stroke's first path-edit write re-stations its replay spine at up to 3x the
recorded sample count so the paint follows the fitted curve instead of a coarse
polyline. The count law is
`clamp(ceil(spineLength / VECTOR_CONVERSION_SAMPLE_STEP_UV), sourceCount, VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER × sourceCount)`
stations, evenly by arc length, both ends pinned to the evaluated curve's own
ends. The step and the multiplier are exported named constants. Later anchor
drags and curve-mode switches never pass a target count, so counts never
compound.

</domain>

<decisions>
## Decision revision

### D-08 is AMENDED for the conversion seam only

> **D-08 (amended, quick 261116-r9k):** Every path EDIT preserves the stroke's sample count. The painted→vector CONVERSION seam is the ONE exception: the first write on an anchorless hand-painted stroke re-stations its replay spine at `clamp(ceil(spineLength / VECTOR_CONVERSION_SAMPLE_STEP_UV), sourceCount, VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER × sourceCount)` stations, evenly by arc length, both ends pinned to the evaluated curve's own ends. Reason: the recorded count is a hand cadence, not a resolution — at conversion it under-samples the curve the user is about to edit, so the paint (and every replay and outline that reads `points`) shows corners the overlay does not. Later anchor edits and curve-mode switches keep whatever count the conversion minted, so counts never compound. Trade-off accepted and UAT-judged: more stations = more engine ticks = a wetter, wider wash; the cap is one exported constant, so 2x is one production-code line plus its pinned literals (the 3, the 15/9 station pins and the pressure indices that ride them) — no re-plan.

</decisions>

## Kept laws

- The recorded pressure is remapped along the ORIGINAL source polyline's arc
  length, linear in between, with both ends pinned to the recorded readings.
- An all-sentinel stroke stays all-sentinel across the larger station count —
  the engine still owns that stroke's pressure.
- The conversion remains ONE write at the SAME timeline index, with one
  revision bump per gesture and one `aquarelle-script` ledger entry per gesture.
- `pointTicks` stays dropped: the raw trace's ticks no longer describe the
  re-stationed sample array.
- Every later edit (anchor drag, width/colour commit) and every curve-mode
  switch preserves the count the conversion minted.

## Non-goals

- The draw-time mint (`resampleVectorPaintPoints`, `buildVectorStroke`) and
  `VECTOR_PAINT_SAMPLE_STEP_UV`.
- `fitVectorPathAnchors` / `vectorPathFit.ts`.
- `VectorPathOverlay` and its test.
- `PhysicsPaintStudio.tsx` (its converting branch and byte-pinned literals
  stay as-is).
- The watercolor adapter and engine (`engineAdapter.ts`, `Engine.ts`).
- Roto preview and export.

## Historical artifacts

Per the 261116-qhm precedent, historical phase artifacts are **not edited**:
`.planning/milestones/v2.1.0-phases/62-painted-stroke-curve-editing/62-CONTEXT.md`
keeps D-08's original wording. This record supersedes D-08 for the conversion
seam only; the EDIT law's wording is unchanged.
