# Quick Task 260925-dso: kill the bake-time visual grain and condition the physics height field - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Task Boundary

Remove bake-time visual grain/emboss modulation from stroke raster (the source of ragged edges and per-pixel noise), and condition the physics height field to be flat when no paper is selected and detail-normalized when a paper is selected. Interim state accepted: no paper tooth in the paint body until 9b.

</domain>

<decisions>
## Implementation Decisions

### Height normalization parameters
- Mean-centre the paper height map to 0.5, then clamp contrast to +/-0.40 (moderate range).
- This gives noticeable tooth in deposit adsorption without pixel jitter.

### Texture-load failure fallback
- When a paper IS selected but its texture fails to load, physics height is flat (null / 0.5).
- No procedural fbm ever — `ensureHeightMap` is never used as a stand-in for missing paper or failed texture load.

### Code deletion vs. parameter zeroing
- Delete dead code: remove the grain alpha modulation from `fillPolyGrain` and delete `applyPaperEmboss` entirely.
- Clean codebase so 9b starts fresh. No dead parameter-zeroing paths left behind.

### Claude's Discretion
- Exact implementation of the normalization pass (single-pass mean + clamp vs. two-pass).
- How to structure the height-map conditioning in `core/paper.ts` (inline in `setPaperGrain` vs. separate function).
- Whether the `grain` parameter on `fillPolyGrain` is removed entirely or kept at 0 for the emboss parameter (which is already hardcoded to 0).

</decisions>

<specifics>
## Specific Ideas

- Three RED test pins must pass before implementation is considered done:
  1. Baked stroke silhouette edge is clean (no noise-carved alpha); stroke path runs no grain/emboss pixel pass.
  2. With NO paper selected, stroke body has no per-pixel deposit noise (physics height is flat).
  3. With a paper selected, height map is detail-normalized (not raw photo red channel).
- Keep paper height map for physics (wet diffusion, deposit adsorption, compositeWetLayer) — that is simulation, not visual grain.
- Do NOT build the new composite paper pass here — that is 9b.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
