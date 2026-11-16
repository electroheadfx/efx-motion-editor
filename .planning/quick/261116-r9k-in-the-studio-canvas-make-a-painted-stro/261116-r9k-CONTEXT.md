# Quick Task 261116-r9k: Studio painted-stroke conversion follows the curve - Context

**Gathered:** 2026-11-16
**Status:** Ready — UAT approved 2026-11-16

<domain>
## Task Boundary

A painted stroke converted to a vector path must render along the fitted curve
instead of a coarse polyline, without the conversion moving the stroke's shape
and without the document gaining vertices for the user to edit.

</domain>

<decisions>
## Decision revision

### D-08 is NOT amended — the conversion-seam exception was withdrawn

The first attempt re-stationed the stroke's stored replay points at conversion,
up to 3x the recorded count. It was reverted before UAT for two reasons:

- The extra stations were written to the DOCUMENT. Sampling belongs to the
  render, not the geometry: the user saw a path covered in vertices.
- Sample count is the wet lifetime, so a longer stored station list changed the
  wash as a side effect of what should have been a rendering concern.

D-08 therefore stands exactly as written in the 62 phase: every path write,
the conversion included, preserves the stroke's recorded sample count.

### What the outcome actually is

Two changes, neither touching the stroke's stored geometry:

1. **Render-side tessellation.** `withAquarelleReplayGrid`
   (app/src/components/physic-paint/roto/aquarelleReplayGrid.ts) derives a
   vector stroke's replay grid from its ANCHORS at the bake seam
   (`applyAquarelleTimeline`), through `resampleVectorPaintPoints` — the same
   paint cadence a stroke drawn as a vector gets. Pressure is remapped by arc
   fraction; an all-sentinel source stays all-sentinel. Hand-painted strokes
   (no anchors) pass through untouched.

   The geometry walk's 0.002 uv rate is deliberately NOT used for the paint:
   `vectorPathHandles.ts:711-724` records it as measured at 230-700 samples and
   a 4-24 s wash "that spread into the broad, even cloud a hand never paints".

2. **Shape-bounded anchor simplification.**
   `simplifyVectorPathAnchors` (view/vectorPathSimplify.ts) runs after the fit
   at the conversion and removes an interior anchor only while the EVALUATED
   SPLINE stays within `VECTOR_PATH_SIMPLIFY_BUDGET_UV` (0.006 uv) of every
   recorded sample. Measured on a 24-sample hand stroke: 18 anchors → 11.

### The rejected lever, recorded so it is not retried

Widening the fit's own `VECTOR_PATH_FIT_TOLERANCE_UV` (0.002 → 0.01) was tried
and reverted after UAT rejected it: the conversion visibly changed the shape.
The reason is structural — the fit's tolerance bounds how far a dropped sample
sits from the CHORD behind it, which says nothing about where the spline through
the remaining anchors lands. A chord budget cannot serve as a shape budget. The
fit stays at 0.002 uv; shape is bounded by the simplify pass, which measures the
curve itself.

</decisions>

## Kept laws

- The recorded pressure is remapped by arc fraction, both ends pinned, so a
  reshape slides the profile instead of resetting it.
- An all-sentinel stroke stays all-sentinel — the engine still owns its
  pressure, exactly as at draw time.
- The conversion remains ONE write at the SAME timeline index, with one
  revision bump per gesture and one `aquarelle-script` ledger entry per gesture.
- `pointTicks` stays dropped: the converted sample array no longer describes the
  raw trace's ticks.
- Every later edit (anchor drag, width/colour commit) and every curve-mode
  switch preserves the count the conversion minted.

## Non-goals

- The draw-time mint's own geometry (`resampleVectorPaintPoints` is REUSED as
  the replay sampler, never modified).
- `VECTOR_PATH_FIT_TOLERANCE_UV` — restored to its shipped 0.002 uv.
- `VectorPathOverlay` marker rendering.
- The watercolor adapter and engine (`engineAdapter.ts`, `Engine.ts`).
- Roto preview and export.

## Historical artifacts

Per the 261116-qhm precedent, historical phase artifacts are **not edited**:
`.planning/milestones/v2.1.0-phases/62-painted-stroke-curve-editing/62-CONTEXT.md`
keeps D-08's original wording, which this task leaves in force.
