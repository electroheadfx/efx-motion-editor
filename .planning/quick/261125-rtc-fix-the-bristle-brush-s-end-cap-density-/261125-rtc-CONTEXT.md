# Quick Task 261125-rtc: Bristle end-cap density block at Edge transparency 0 - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Task Boundary

Fix the bristle brush's end-cap density block at Edge transparency 0 (Spec 10 off, amount-0
bypass). Artist UAT 2026-11-25 (during the 261125-kvl Edge-transparency UAT): Gouache bag
(Pickup 100, Feather 100), Dry 0 and Dry 70, Sizes 50/100/150/200/300 px, press-move-release;
the stroke's end is a dark full-width block whose area grows with brush size, while the body
reads lighter.

At Dry 0 the cap transition is floored at 0.12 (`BRISTLE_DRY_CAP_FLOOR`); at Dry 70 the block
persists and is darker. The artist's suspects, both size-scaled: the release catch-up dab's
DEPOSIT density (`uEndCap`) for the dark end, and the landing ramp (`exposedTrail`) for the
light body — not the cap silhouette width.

This is the residual terminal density block the 2026-11-23 end-cap debug recorded and left to
live UAT (`.planning/debug/resolved/acrylic-stroke-end-cap.md`: pigment ~0.62-0.68 vs body
0.55-0.60, present in every end path including the approved lift and the bake).

At Edge transparency 0 the Spec 10 layer is bypassed and the shipped bristle path runs
byte-identically to `d509a886d`; this defect lives in the shipped path, not in the layer.

</domain>

<decisions>
## Implementation Decisions

### Probe size matrix
- Sizes (canonical px): **50, 100, 150, 200, 300** — the artist's own sweep (five sizes stepping
  by 50). Note `BRISTLE_SAMPLE_TABLE` supersampling changes across these cells (50 -> 1x,
  100 -> 2x, 200 -> 4x, 300 -> 16x), so the probe must record the effective sample factor.
- Dry: **0 and 70** (the two artist cells; 70 is the acrylic/Gouache default).
- Brush bag: Gouache (the `acrylic` record) with **Pickup 100, Feather 100**.
- Release pressure is a probe axis: the reproduction must cover the release catch-up at its
  actual pressure, not only a scripted constant.

### Target end look
- **End density matches body density.** The terminal block fades until the stroke's end reads
  at the body's density — as if the stroke kept going — with the end's ragged silhouette
  preserved.
- The start / landing-ramp texture is **untouched**: the body is the reference, not something
  to darken.

### Fix mechanism
- **Measure first, then ONE law.** The probe must bisect the density writers (release catch-up
  deposit / release pressure / trailing rect) at the 5 sizes x Dry 0/70 before any law changes,
  and the fix must be one law proven on pixels.
- **Bake parity is mandatory**: the bake path has no catch-up dab (2026-11-23 evidence), so a
  catch-up-only patch cannot be the fix. The law must make the bake's end match its body too.
- Depth-fade caution: lateral depth fades have written pale lanes before, and the film lerp
  holds committed film wherever `a` is small. Any density law must prove no lane returns.

### Claude's Discretion
- Probe scenario shape and naming (extend `bristle-end` or add a size x dry x pressure matrix),
  the exact metric definitions for "end density vs body density", and the law choice after the
  measurement.

### Off-limits (from the brief)
- No changes to the Spec 10 layer code (deposit routing, lateral field, merge, display branch,
  encoder — FROZEN per 261125-kvl), the edge params (`edgeFade`/`edgeFalloff`), or the
  composite law.

</decisions>

<specifics>
## Specific Ideas

- Reproduce in `packages/efx-watercolor/probe/medium-engine` (real engine, headless Chrome
  harness): size x dry x release pressure, measure the final dab's deposit density vs the
  body's, then fix and UAT the five sizes at Dry 0 and 70.
- The artist's phrasing: "fade the deposit at the cap (or treat the release pressure)" — both
  remain candidate laws; the measurement decides.
- Gates: `pnpm --dir packages/efx-watercolor exec vitest run`, `pnpm --dir app exec vitest run`,
  `pnpm --dir app exec tsc --noEmit`, and the probe scene.
- No server start, no vitest watch, no push, no stroke replay.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/debug/resolved/acrylic-stroke-end-cap.md` — the 2026-11-23 takeoff fix, the
  measured residual terminal block, and the refuted writers (catch-up as silhouette writer;
  simPressure saturation; trailSupport as shape writer).
- `packages/efx-watercolor/src/playground/shaders.ts` — `gatherBristle` (`uEndCap`,
  `exposedTrail`, `dryCap`/`capW`, `alongFade`, `trailSupport`, `takeoff`, coverage).
- `packages/efx-watercolor/src/playground/bristles.ts` — `BRISTLE_DRY_CAP_FLOOR` (0.12),
  `BRISTLE_DRY_CAP_FULL` (0.7), `BRISTLE_FEATHER_CAP`, `BRISTLE_CAP_GAIN`,
  `BRISTLE_TAKEOFF_SHIFT` (1.1), `BRISTLE_SAMPLE_TABLE`.
- `packages/efx-watercolor/src/playground/Engine.ts` — stroke processing/trace, the catch-up
  dab (`bristleEndCap`), release paths, `pressureOf`/`simPressure`, gather uniforms.
- `packages/efx-watercolor/probe/medium-engine/` — `probe.ts` (`bristle-end`, drives, end
  metrics), `run.mjs`, `compare.mjs`, baselines.
- `packages/efx-watercolor/src/playground/mediums.ts` — the Gouache (`acrylic`) record.
- Skill `efx-studio-paint` and Skill `spike-findings-efx-motion-editor` — the compositing
  laws, debugging discipline and probe gates.
- `.planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-SUMMARY.md`
  — the frozen Spec 10 layer (do not touch) and the amount-0 bypass identity.

</canonical_refs>
