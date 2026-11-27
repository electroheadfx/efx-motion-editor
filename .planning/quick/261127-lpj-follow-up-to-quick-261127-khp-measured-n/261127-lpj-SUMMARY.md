---
phase: 261127-lpj
plan: 01
subsystem: probe/medium-engine
tags: [probe, pickup-under, measured-negative, watercolor, bristle, boundary]
requires: [quick 261127-khp RED matrix, the pickup-under scene]
provides:
  - transitionWidthPx — the pure 10-90 percent edge-width detector (blend.ts)
  - the 4-40 px dominant-band stripe readout on the pickup-under scene
  - the under-boundary sharpness instrument (three y bands, 0.5 px stations)
  - the --under constant control and its diagnostic capture
  - the frozen RED re-baseline at /tmp/medium-engine/261127-lpj-red.json
affects: none — no production engine, shader, medium-record or UI file changed
tech-stack:
  added: []
  patterns: [pure probe detector in blend.ts, source-scan pins in harness.test.ts]
key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/blend.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
decisions:
  - Measured negative — the frozen boundary floor misses (valid 1/1/2), so per the plan's floor law no law may be written and Tasks 2 and 3 did not run
  - The boundary anchor x = 0.35*w sits INSIDE the under's round cap, so both plateau windows sample under paint; the instrument reads texture scale, never an edge
  - The constant-under cell's replay diverges (maxDelta 241) and is recorded as diagnostic/exempt, per the plan's own rule
metrics:
  duration: ~11 min (plan commit 15:50 to task commit 16:01, +01:00)
  completed: 2026-11-27
  tasks: 1/3
  files: 4
  commits: 1
actuals:
  tokens: 8700
  tasks: 1
  commits: 1
  plan_head_before: c138865fd809180fdd19068fbd79fd842d07cfbf
  plan_head_after: d7c7aec02
status: incomplete
---

# Phase 261127-lpj Plan 01: pickup-under stripe follow-up Summary

**Probe-first re-baseline of the pickup-under stripes: the new 4-40 px dominant and boundary instruments are shipped and the khp wide readings reproduce, but the frozen boundary floor misses — the nominal boundary anchor sits inside the under's round cap, so the edge instrument cannot measure an edge. Measured negative: no law was written, no production file changed, Tasks 2 and 3 did not run.**

## What was done (Task 1, `type="tracer" tdd="true"`)

- `blend.ts`: added the pure, exported `transitionWidthPx(profile, stepPx, loPct = 0.1, hiPct = 0.9)` — 10-90 percent transition width with median plateaus (first/last 20 percent), `round2`, and `null` for too-few samples, a flat profile, a bad step or a missing crossing. Unit-tested on a linear ramp (8 px for a 10 px 0→1 rise), a falling dyadic ramp (5 px, mirror-equal), a hard step (1 step) and every null path.
- `probe.ts`: the 4-40 px DOMINANT band on the committed station series (`pickupUnderStripeDominantRms` = mean of `acRms * sqrt(bandShare)`, plus `DominantAc`, `DominantPeakPx`, `DominantBandShare`); the NEW under-boundary 10-90 width `pickupUnderBoundarySharp(data, w, h, centreDocY, strokeSize)` (boundary `Math.round(0.35 * w)`, three y bands inside the judged body, 0.5 px x stations over ±40 px, in/out windows +8..+20 and −20..−8, composite-on-white visible RGB, 6/255 plateau skip, projection before the pure detector; nulls for `--under none`); the `constant` under kind and `constantUnder(engine, sheet)` (capture the sheet, channel-wise median of `inkA+fixedA` and `inkB+fixedB` over the covered texels, write fixed = median, ink = 0, cover = 1, leave wet/relief/lastTouch untouched, restore). The fill is applied on the visit (inside `captureMs`) and re-applied on both replays.
- `run.mjs`: `constant` added to the `--under` closed literal, both usage strings, the refusal message and the documentation comment.
- `harness.test.ts`: pins for the dominant fields, the boundary constants/fields, `function constantUnder(`, the drive and replay hooks, the `constant` kind in both closed lists and both refusal messages; the two stale pinned messages updated; the `transitionWidthPx` unit tests. 212 harness tests pass.

## The RED matrix (13 cells, no engine or shader change)

Captured with `/tmp/medium-engine/261127-lpj-red-*`; table at `/tmp/medium-engine/261127-lpj-red.json`.

| Cell | dom RMS | dom peak | dom band share | wide RMS | body share | boundary px (mean/worst) | valid/skip | replay | bake ms |
|---|---|---|---|---|---|---|---|---|---|
| painted-e100-s400 | 7.47 | 39 | 0.16 | 5.16 | 0.1983 | 40.5 / 40.5 | 1/2 | identical | 2289 |
| painted-e100-s250 | 5.68 | 35.5 | 0.1628 | 3.96 | 0.4142 | 0.5 / 0.5 | 1/2 | identical | 477 |
| painted-e100-s150 | 5.01 | 19 | 0.5018 | 4.34 | 0.5489 | 29 / 57 | 2/1 | identical | 410 |
| painted-e0-s400 | 2.32 | 32 | 0.168 | 1.86 | −0.0031 | 20.5 / 20.5 | 1/2 | identical | 2431 |
| painted-e0-s250 | 3.02 | 36 | 0.2503 | 2.02 | 0.0526 | 20.5 / 20.5 | 1/2 | identical | 498 |
| painted-e0-s150 | 2.62 | 27 | 0.5295 | 2.14 | 0.1481 | 0.5 / 0.5 | 1/2 | identical | 401 |
| p0-e100-s400 | 1.82 | 36 | 0.0158 | 1.04 | −0.0004 | 0.5 / 0.5 | 1/2 | identical | 1552 |
| p0-e100-s250 | 1.94 | 36 | 0.0097 | 1.00 | 0.031 | 0.5 / 0.5 | 1/2 | identical | 461 |
| p0-e0-s250 | 2.94 | 35.5 | 0.2226 | 2.04 | 0.0308 | 20.5 / 20.5 | 1/2 | identical | 439 |
| none-e100-s400 | 1.95 | 36.5 | 0.1195 | 1.35 | 0 | null / null | 0/0 | identical | 2728 |
| none-e0-s250 | 3.03 | 36 | 0.2561 | 2.03 | 0 | null / null | 0/0 | identical | 497 |
| const-e100-s400 | 8.42 | 33 | 0.2396 | 6.03 | 0.12 | 37.5 / 37.5 | 1/2 | DIVERGED (exempt) | 3125 |
| const-e100-s250 | 5.36 | 35.5 | 0.1686 | 3.70 | 0.3576 | 20.5 / 20.5 | 1/2 | DIVERGED (exempt) | 833 |

### Frozen floors (judged exactly as Task 1's verify)

- **khp reproduction — PASS**: wide RMS 5.16 (s400), 3.96 (s250), 4.34 (s150), 1.00 (p0-e100-s250), each within 0.02 of quick 261127-khp. The scene and the committed instruments are unchanged.
- **Dominant band — PASS**: artist s400 7.47 ≥ 1.5 and ≥ 2 × its Pickup-0 control 1.82 (3.64); artist s250 5.68 ≥ 1.5 and ≥ 2 × its control 1.94 (3.88). The 4-40 px band is alive and separates the defect from its control.
- **Boundary measurable (valid ≥ 2 on all three artist cells) — MISS**: valid = s400: 1, s250: 1, s150: 2.

## The boundary verdict (why the quick stops)

The frozen anchor `x = Math.round(0.35 * w)` lies INSIDE the under's round cap, not at its visible leading edge: a Size-250 bristle mark centred on x = 0.35 extends roughly a footprint radius to the left. Direct pixel evidence from the RED `painted-e100-s250` transparent export: the centre-row colour at `boundary − 200` (x = 517) is already 38,150,199 — blue under paint — and the exported mid crop (which starts at `boundary − 40`) is painted blue at its left edge. Both plateau windows (−20..−8 and +8..+20) therefore sample under pigment on the same side of any edge, and the 6/255 plateau gate skips 2 of the 3 bands on s400 and s250. The surviving "valid" readings (0.5 px at s250, 40.5 px at s400, 29/57 px at s150) are under-texture scale, not an edge width — they cannot anchor a "+2 px" bar, and the plan's GREEN check (valid ≥ 2 at GREEN) could never be satisfied at s400/s250. The instrument is faithfully implemented to the plan's own spec; the spec's anchor is what is wrong for this scene.

Per the plan's floor law — "A miss is a measured negative: print the numbers and STOP — no law may be written" — Task 1 ends the quick here.

## The constant-under diagnostic

With the painted under replaced by its own channel-wise median pigment (cover 1, uniform rect), the dominant-band RMS INCREASES rather than vanishing: 8.42 (s400) vs 7.47 painted, 5.36 (s250) vs 5.68 painted — the stripes survive, and the s400 body under-share drops to 0.12 (painted 0.1983) while s250 moves to 0.3576 (painted 0.4142). **Verdict (caveated): the RED stripe energy is not explained by the under's per-bristle texture alone.** The cell is diagnostic, never gated, because its replay DIVERGES: `pickupUnderReplayIdentical false`, max delta 241, 123,071 differing texels at s400 and 122,270 at s250 (the painted, Pickup-0 and bare-paper cells replay byte-identically with max delta 0). The planned law's prognosis is therefore mixed and unjudged; the constant fill itself is a harness control, not a shipped path.

## Tasks 2 and 3: not executed

- **The 9-variant sweep (Task 2): NOT RUN.** The tracer gate failed before any law. No sweep table exists; no variant was ranked; the constants `BRISTLE_PICKUP_UNDER_PX` / `BRISTLE_PICKUP_UNDER_GATE` were never introduced, so the production default stays pointwise (equivalent to px 0 / gate 0). `/tmp/medium-engine/261127-lpj-variant.json` does not exist.
- **The GREEN matrix (Task 3): NOT RUN.** No GREEN cells, no RED/GREEN ratios, no production-equals-chosen proof, no determinism re-run, no committed-gate (`edge-layer-neutral` / `neutral-identity`) captures, no comparator registration, no tap count: the planned law would have been 18 snapshot fetches per fragment (9 taps × 2 references, 16 more than RED), but none were added.
- **Gates actually run (Task 1's chain):** package vitest — PASS (44 files, 1169 passed, 8 skipped; `harness.test.ts` 212 passed); package `check` (tsc) — PASS. The package build, the app suite and the app typecheck are Task 3 scope and were not run.
- **RED bake cost (recorded for a future cost bar):** painted e100 2289 ms (s400) / 477 (s250) / 410 (s150); `none` s400 2728 ms; `const` s400 3125 ms.

## The one-law statement (unshipped)

The planned ONE mean-preserving law — the pickup's under reference (`uSnapA`, `uSnapB.xyz`) as a 9-tap square-ring mean at an integer document-texel radius, centre weight 1, chroma-gated by the 7-vector cosine with a paper zero guard, inside the existing `uSmear > 0` guard, with `snapB.a` pointwise — was NOT written. `shaders.ts`, `Engine.ts`, `bristles.ts` and `scattering.test.ts` are untouched; the one-lerp deposit, the lateral alpha law, the medium records and every UI file are byte-identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's verify script ordered the constant-cell replay check before its own documented exemption**
- **Found during:** Task 1 judging
- **Issue:** The plan states the `constant` cell is diagnostic and its replay divergence "recorded and exempt", but the verify script's `E()` helper threw `replay not identical` for `constant` before reaching its own exemption line.
- **Fix:** Judged with the exemption ordered as the plan's stated behavior requires (`kind !== 'none' && kind !== 'constant'` for the replay-identity throw; the constant divergence printed and recorded in `261127-lpj-red.json` under `constReplayExempt`).
- **Files modified:** none (judgment script only); the evidence JSON carries the exemption block.
- **Commit:** n/a (no source change).

### Measured negative (not an auto-fix)

**2. The frozen boundary floor misses — the boundary anchor is inside the under's round cap.**
- **Found during:** Task 1's RED judgment
- **Issue:** valid bands 1/1/2 against the floor's ≥ 2 on all three artist cells; the plateau windows both sample under paint because `x = 0.35 * w` is not the under's visible leading edge.
- **Action:** STOP, per the plan's floor law. No instrument retune after seeing RED (probe-first). The numbers are recorded here and in the RED JSON; a follow-up plan should either anchor the boundary at the under's measured visible leading edge (and prove it below 6/255-free plateaus) or drop the boundary bar.

**3. The constant-under cell's replay diverges (max delta 241, ~123k texels).**
- Recorded as diagnostic and exempt, per the plan's explicit rule; the constant-under verdict above is stated with that caveat.

## Threat Flags

None — probe-only code; no endpoint, auth path, file-access pattern or schema change.

## Known Stubs

None in the shipped probe code. The dominant/boundary instruments and the constant control are fully wired on the real engine.

## Files

- Modified: `packages/efx-watercolor/probe/medium-engine/blend.ts`, `probe.ts`, `run.mjs`, `harness.test.ts`
- Evidence: `/tmp/medium-engine/261127-lpj-red.json`; the 13 `261127-lpj-red-*` JSONs and their extracted `-mid.png` / `-transparent.png` crops (the artist s400 pair and the const s400 transparent crop verified present).
- Commit: `d7c7aec02` — `feat(quick/261127-lpj): re-baseline pickup-under on the 4-40 px band and the boundary width`

## Live UAT rows — ALL UNCLAIMED (no law shipped)

The code is automated-ready for a hand-off only in the negative sense: **no production behaviour changed, so there is nothing live to verify yet.** These eight rows are retained UNCLAIMED, exactly as the plan's hand-off requires; none is claimed as passed, and none is applicable until a law ships.

1. Edge 100, Pickup 100, Size 400: blue #1a88ec under (Size 250) then the yellow #f9e01c stroke — the wide wavy longitudinal stripes are gone; the body still drags the under's blue. **UNCLAIMED — not applicable (no law).** 
2. The same pair at Sizes 250 and 150. **UNCLAIMED — not applicable (no law).**
3. Edge 0, Pickup 100 over the painted under at Size 250 — no stripes and no regression. **UNCLAIMED — not applicable (no law).**
4. Pickup 0 control — no visible change anywhere. **UNCLAIMED — not applicable (no law).**
5. The judged stroke over bare paper — no new band, no edge artifact, no body shift. **UNCLAIMED — not applicable (no law).**
6. The under's leading edge where the stroke enters it stays a crisp transition; the stroke's silhouette, lateral edge and tip are unchanged. **UNCLAIMED — not applicable (no law).** (The RED camera confirms this row is the exact surface the frozen boundary anchor fails to measure.)
7. After settle; after reopening the Studio plus a forced re-render; and after Undo/Redo — the same clean result. **UNCLAIMED — not applicable (no law).**
8. The green pickup mean and the under's boundary at each size, judged against the RED crop. **UNCLAIMED — not applicable (no law).** Full-resolution reference crop: `/tmp/medium-engine/261127-lpj-red-painted-e100-s400-mid.png`.

## Self-Check: PASSED

- Modified files exist: `blend.ts`, `probe.ts`, `run.mjs`, `harness.test.ts` — present.
- Commit `d7c7aec02` is an ancestor of HEAD (the task commit itself); working tree clean.
- Evidence: `/tmp/medium-engine/261127-lpj-red.json` and the 13 capture JSONs written; the required crops exist.
