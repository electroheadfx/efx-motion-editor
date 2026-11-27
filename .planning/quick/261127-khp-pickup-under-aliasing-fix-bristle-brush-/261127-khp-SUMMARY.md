---
phase: 261127-khp
plan: 01
subsystem: probe-harness
tags: [bristle, pickup, under-aliasing, stripe-spectrum, probe, measured-negative]
requires: []
provides:
  - "pickup-under probe scene: the artist's under #1a88ec (bristle-round Size 250 Pigment 100 Pickup 100) and the judged #f9e01c stroke, with --under painted|flat|blurred|none"
  - "run-scale fine 1-3 px stripe RMS (primary) plus a wide 4-32 px diagnostic, body under-share, boundary bleed, replay digests and 1:1 crops"
  - "25-cell RED matrix under /tmp/medium-engine/261127-khp-r-* and the hash-trigger file with apply:false"
affects: [bristle pickup under follow-up law]
tech-stack:
  added: []
  patterns: ["run-scale stripe RMS with a fine primary band and a wide diagnostic band (shareSpectrum, detrend + periodogram)"]
key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
key-decisions:
  - "Measured negative: the artist RED floor is missed (0.04/255 vs >=2.0), so the law is NOT written and Tasks 2-3 do not run"
  - "The defect is a ~23 px dominant stripe; the locked 1.5 px 5-tap mean (3 px support) cannot halve it — structural STOP, independent of the floor miss"
  - "Hash extension not applied (apply:false); every flat Edge-0 size reading sits below its 1.0 bar, and the law it would extend was never written"
requirements-completed: [KHP-READOUT]
actuals:
  tokens: 13451
  tasks: 1
  commits: 1
plan_head_before: d73a60b93730627fcf9d585e6ef18f0a6565d70f
plan_head_after: 2541e9bd3b35fc0f2a282a167e6152556f337dd0
duration: not recorded (continuation after context compaction)
completed_at: 2026-11-27
status: incomplete
coverage:
  - id: D1
    description: "pickup-under probe scene and its stripe/body-share/bleed/replay instruments, pinned by harness tests and exercised by the 25 committed RED captures"
    requirement: KHP-READOUT
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#registers the pickup-under scene, its under operand and its readout (261127-khp task 1)"
        status: pass
      - kind: integration
        ref: "25 x node packages/efx-watercolor/probe/medium-engine/run.mjs --scenario pickup-under --under painted|flat|blurred|none (captures in /tmp/medium-engine/261127-khp-r-*)"
        status: pass
    human_judgment: false
  - id: D2
    description: "the pickup-under mean-preserving law (BRISTLE_PICKUP_UNDER_PX = 1.5, pickupUnderMean, uPickupUnderPx)"
    requirement: KHP-LAW
    verification: []
    human_judgment: true
    rationale: "Not delivered: designed halt on the RED floor. The measured defect is a ~23 px stripe the 1.5 px kernel cannot reach."
---

# Quick task 261127-khp: pickup-under aliasing — Summary

**Pickup-under stripe aliasing reproduced and measured as a negative: the artist cell reads 0.04/255 in the fine 1-3 px band against a >=2.0 floor, and the visible defect lives at a ~23 px dominant stripe the locked 1.5 px law cannot halve — the law was not written and Tasks 2-3 did not run.**

## Outcome: measured negative (designed STOP)

The plan's own instruction and the run constraint agree: *"A missed RED floor is a valid measured negative — stop and record the numbers, do not write the law."* The artist floor is missed by a factor of ~50, and the independent band analysis shows a structural reason on top of the floor miss: the 1-3 px band carries **0.0 %** of the AC power, while the defect sits at a ~23 px dominant stripe (with >90 % of power at even longer wavelengths). The locked kernel (5 taps at ±1.5 px = 3 px support) cannot halve a 23 px stripe. The law was therefore **not written**, and Tasks 2 (GREEN law) and 3 (full GREEN matrix, comparator, five gates) were **not executed**.

- No production file changed: `bristles.ts`, `shaders.ts`, `Engine.ts`, `scattering.test.ts`, `compare.mjs` are untouched.
- Status is `incomplete` by design (the quick did not ship a fix). The probe scene and its instruments are automated-ready and green; the defect itself remains.

## RED matrix (25 cells, /tmp/medium-engine/261127-khp-r-*)

Units: stripe RMS in 0..255; peak in px (station grid 0.5 px); band share is the fraction of detrended AC power inside the band. Wide = the 4-32 px diagnostic band. Body = the stroke body's under-share; bleed in px. The four under kinds: `painted` (bristle-round Size 250 under), `flat` (plain fill with the default round/watercolor stroke), `blurred` (painted under, whole-sheet 5x5 box mean), `none` (bare paper).

| Cell | kind | size | edge | pickup | fine RMS | fine peak | fine share | wide RMS | wide peak | wide share | body share | bleed | replay |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| painted-e0-s40 | painted | 40 | 0 | 100 | 1.71 | 3 | 0.114 | 5.27 | 5 | 0.842 | 0.3436 | 20 | identical (abe61b55) |
| painted-e0-s150 | painted | 150 | 0 | 100 | 0.04 | 3 | 0.000 | 2.14 | 26.5 | 0.359 | 0.1481 | 13 | identical (d6d887b7) |
| painted-e0-s250 | painted | 250 | 0 | 100 | 0.00 | 3 | 0.000 | 2.02 | 29.5 | 0.124 | 0.0526 | 20 | identical (fa0f627a) |
| painted-e0-s400 | painted | 400 | 0 | 100 | 0.00 | 1 | 0.000 | 1.86 | 28.5 | 0.106 | -0.0031 | 13 | identical (5f35d29c) |
| painted-e100-s40 | painted | 40 | 100 | 100 | 0.67 | 2.5 | 0.032 | 4.83 | 7.5 | 0.957 | 0.6068 | 20 | identical (2f35862b) |
| painted-e100-s150 | painted | 150 | 100 | 100 | 0.14 | 1 | 0.000 | 4.34 | 19 | 0.372 | 0.5489 | 12 | identical (c8c54fd8) |
| **painted-e100-s250 (ARTIST)** | painted | 250 | 100 | 100 | **0.04** | 3 | 0.000 | **3.96** | **23** | 0.078 | 0.4142 | 20 | identical (8589297e) |
| painted-e100-s400 | painted | 400 | 100 | 100 | 0.00 | 1 | 0.000 | 5.16 | 17.5 | 0.082 | 0.1983 | 8 | identical (61ddf7b3) |
| p0-e0-s40 | painted | 40 | 0 | 0 | 0.26 | 3 | 0.058 | 1.09 | 7.5 | 0.930 | 0.1696 | 20 | identical (3e59b7f7) |
| p0-e0-s150 | painted | 150 | 0 | 0 | 0.00 | 1 | 0.000 | 2.19 | 27 | 0.375 | 0.1176 | 13 | identical (b5ac4ce9) |
| p0-e0-s250 | painted | 250 | 0 | 0 | 0.00 | 1 | 0.000 | 2.04 | 29 | 0.115 | 0.0308 | 20 | identical (53de4d21) |
| p0-e0-s400 | painted | 400 | 0 | 0 | 0.00 | 1 | 0.000 | 2.03 | 29 | 0.115 | 0.0001 | 13 | identical (88535477) |
| p0-e100-s40 | painted | 40 | 100 | 0 | 0.24 | 3 | 0.004 | 3.95 | 10 | 0.996 | 0.1696 | 20 | identical (db1b3344) |
| p0-e100-s150 | painted | 150 | 100 | 0 | 0.00 | 3 | 0.000 | 2.13 | 29 | 0.018 | 0.1187 | 12 | identical (fbc41cd0) |
| p0-e100-s250 | painted | 250 | 100 | 0 | 0.00 | 1 | 0.000 | 1.00 | 22 | 0.003 | 0.0310 | 12 | identical (ec52755f) |
| p0-e100-s400 | painted | 400 | 100 | 0 | 0.00 | 1 | 0.000 | 1.04 | 27.5 | 0.005 | -0.0004 | 12 | identical (7a214532) |
| flat-e0-s40 | flat | 40 | 0 | 100 | 0.68 | 3 | 0.026 | 4.27 | 8.5 | 0.972 | 0.1983 | 20 | DIFFERS (maxD 156, 26 649 texels) |
| flat-e0-s150 | flat | 150 | 0 | 100 | 0.06 | 3 | 0.000 | 2.11 | 26 | 0.335 | 0.0527 | 13 | DIFFERS (maxD 157, 33 044 texels) |
| flat-e0-s250 | flat | 250 | 0 | 100 | 0.06 | 2.5 | 0.000 | 2.29 | 29 | 0.154 | 0.0282 | 20 | DIFFERS (maxD 187, 27 256 texels) |
| flat-e0-s400 | flat | 400 | 0 | 100 | 0.07 | 1 | 0.000 | 1.89 | 27 | 0.128 | -0.0001 | 13 | DIFFERS (maxD 165, 46 891 texels) |
| flat-e100-s250 | flat | 250 | 100 | 100 | 0.07 | 2.5 | 0.000 | 5.61 | 28.5 | 0.058 | 0.6731 | 20 | DIFFERS (maxD 176, 28 944 texels) |
| blur-e0-s250 | blurred | 250 | 0 | 100 | 0.00 | 1 | 0.000 | 2.03 | 29.5 | 0.128 | 0.0528 | 20 | identical (aecfa7bc) |
| blur-e100-s250 | blurred | 250 | 100 | 100 | 0.04 | 3 | 0.000 | 4.02 | 23 | 0.080 | 0.4164 | 20 | identical (f5192d6d) |
| none-e0-s250 | none | 250 | 0 | 100 | 0.00 | 1 | 0.000 | 2.03 | 29.5 | 0.128 | 0.0000 | 20 | identical (a987bb2c) |
| none-e100-s250 | none | 250 | 100 | 100 | 0.00 | 2.5 | 0.000 | 1.16 | 27 | 0.017 | 0.0000 | 20 | identical (2f67974d) |

Reference colours (artist cell): under ref RGB (30.3, 135.1, 231.7) against `#1a88ec` = (26, 136, 236); judged stroke body ref RGB (78.6, 168.5, 147.3) — the greenish mix that shows the blue being dragged into the yellow.

### RED floors

| Gate | Floor | Reading | Verdict |
|---|---|---|---|
| Artist cell (painted, S250, E100, P100) `pickupUnderStripeRms` | >= 2.0/255 | **0.04/255** | **MISSED** (50x under) |
| Artist cell vs its Pickup-0 control (>= 3x) | >= 3 x 0.00 | 0.04 vs 0.00 | vacuously "passes" only because the control reads exactly 0.00 — no discrimination |
| Edge-0 twin (painted, S250, E0, P100) | >= 1.5/255 | **0.00/255** | **MISSED** |
| Edge-0 twin vs its control (>= 2x) | >= 2 x 0.00 | 0.00 vs 0.00 | no discrimination |
| Every Pickup-0 control | <= 1.0/255 | max 0.26 (p0-e0-s40) | PASS |

The visual defect the artist reported **does reproduce** — the 1:1 crops (`/tmp/medium-engine/261127-khp-r-*-mid.png`) show the exact longitudinal yellow/green stripes over blue at Edge 100, and the greenish mixer at the Edge-100 fade at Pickup 0, and a smooth yellow over paper. The commit only shows it in a band the plan's fine readout does not measure (see below).

## Dominant stripe wavelength and band distribution

Probe readout, artist cell: fine band (1-3 px) peak 3 px with **band share 0.000** (0.0 % of power); wide band (4-32 px) **peak 23 px**, share 0.078 (7.8 %); total AC RMS 14.2. The Pickup-0 control at the same cell has a **higher** total AC (19.84) with the same zero fine-band share — the fine criterion cannot discriminate this defect at all.

Independent PNG decode of `261127-khp-r-painted-e100-s250-transparent.png` at the probe's three x stations (0.45 / 0.55 / 0.65), bottom-up doc coordinates, 0.5 px stations:

| Station | fine 1-3 px | wide 4-32 px (peak) | > 32 px | dominant all-band |
|---|---|---|---|---|
| x = 0.45 | 0.0 % | 4.5 % (14.5 px) | 95.4 % | 52 px |
| x = 0.55 | 0.0 % | 9.4 % (23 px) | 90.2 % | 57 px |
| x = 0.65 | 0.0 % | 9.8 % (29.5 px) | 90.2 % | 35.5 px |

The defect is a **~23 px** longitudinal stripe riding on the stroke's own >32 px cross-section envelope. A 5-tap mean with ±1.5 px corners (3 px support) attenuates wavelengths near and below ~3 px only; it cannot halve a 23 px dominant band. This is a **structural STOP**, independent of the floor miss.

## Wide-band RED-only contrast (no GREEN exists)

No law was written, so there is **no GREEN matrix and no RED-to-GREEN ratio**. For the follow-up record, the wide diagnostic band gives this RED-only contrast:

- Artist (painted, E100, S250): wide RMS 3.96 vs its Pickup-0 control 1.00 → **3.96x**.
- Edge-0 twin: wide RMS 2.02 vs control 2.04 → **0.99x** (no discrimination at Edge 0).
- The wide band also carries the judged stroke's own longitudinal run structure: none-e0-s250 = 2.03, blur-e0-s250 = 2.03, flat-e0-s250 = 2.29. Only the Edge-100 painted pair separates cleanly (3.96 vs 1.00), matching where the visual stripes are strongest.

The fine band (1-3 px) does not improve because nothing was changed; had the law been written, it would have moved a band that holds 0.0 % of the power — the "fine improves, wide does not" outcome the run constraint warned against is the structural default here, not a surprise.

## Hash-trigger decision: NOT APPLIED

`/tmp/medium-engine/261127-khp-hash-extension.json` → `apply: false`. The trigger compares each judged size's flat-under Edge-0 reading against that size's painted Edge-0 GREEN bar `max(1.0, half the painted RED)`:

| Size | flat (Edge-0) | painted Edge-0 RED | bar | triggers |
|---|---|---|---|---|
| 40 | 0.68 | 1.71 | 1.0 (0.855 floored) | no |
| 150 | 0.06 | 0.04 | 1.0 | no |
| 250 | 0.06 | 0.00 | 1.0 | no |
| 400 | 0.07 | 0.00 | 1.0 | no |

No row triggers; the failed install would also have extended a law that was never written. The hash arm (`smearWeight`'s `uSmearSmoothBig` blend) was left verbatim.

## Pickup-0 digest identity and determinism / replay verdicts

- **All Pickup-0 controls**: fine stripe RMS <= 0.26/255 (<= 1.0 bar) — PASS in RED. Their GREEN digest comparison was not run (Task 2 not reached), and could not be: no law exists to change them.
- **Replay identity**: 20 of 25 cells are byte-identical across visit / one-shot `applyStroke` / split `renderPartialStrokes` (maxDelta 0, 0 diff texels). The five `flat` cells DIFFER (maxDelta 156-187, 26 649-46 891 texels). This is a **pre-existing instrument limitation, not a regression from this quick**: the flat under is the only non-bristle (default round/watercolor) stroke in the script, and `adapter.applyStroke` round-trips the stroke through the payload codec (`acceptEvent` → `cloneStrokeForWire`) which clamps `cuisson`/`diffusionFrames`, while `renderPartialStrokes` uses the raw stroke — a watercolor-path replay divergence that predates this task. A bounded hypothesis test (adding an `exportCanvas('transparent')` between replay entries to mirror the visit's read) changed nothing; the edit was reverted exactly. Out of scope to fix here.
- The two independent visits of the flat under are themselves deterministic (visit digest 098bcba9 repeated), so the flat cells are stable across runs; only the visit-vs-replay comparison diverges.
- Determinism of the scene itself: all bristle cells and all under kinds are reproducible across separate captures (the visit digests are stable; the RED matrix was produced from the committed code).

## The one law: NOT WRITTEN

The planned law was `BRISTLE_PICKUP_UNDER_PX = 1.5` in `bristles.ts`, a `pickupUnderMean(sampler2D, vec2)` helper and `uPickupUnderPx` in `BRISTLE_GATHER` (`shaders.ts`), two calls inside the existing `if (uSmear > 0.0)` guard in `bristleDepositFS` (on `uSnapA` and `uSnapB.xyz`, with `snapB.a` left pointwise for the solid-under gate), and an unconditional `bindGather` bind in `Engine.ts` (plus the conditional n20 hash extension). **None of it was implemented.** The Pickup-0 guards remain untouched, so the shipping deposit is byte-identical by construction.

## Committed gates and five gates

| Gate | Result |
|---|---|
| `pnpm --dir packages/efx-watercolor exec vitest run` | PASS — 44 files, 1164 passed, 8 skipped |
| `pnpm --dir packages/efx-watercolor check` (tsc) | PASS — clean |
| `pnpm --dir packages/efx-watercolor run build` | NOT RUN (Task 3 not reached) |
| `pnpm --dir app exec vitest run` | NOT RUN (Task 3 not reached) |
| `pnpm --dir app exec tsc --noEmit` | NOT RUN (Task 3 not reached) |
| Committed `edge-layer-neutral` (+ `--edge-structural`) re-compare | NOT RUN (Task 3 not reached; no production law touched, so nothing to regress) |
| Committed `neutral-identity` re-compare | NOT RUN (same reason) |

## Bake cost

Artist RED cell `bakeMs` = **477 ms** (painted-e100-s250); Pickup-0 control 441 ms; blurred under 2140 ms (extra whole-sheet blur pass); flat under 156 ms; Size-400 captures 2270-2408 ms. There is no GREEN cost to compare (no law). Budget note for any future law: the 25 %-over-RED bar would have allowed up to ~596 ms at the artist cell.

## Files

| File | Change | Role |
|---|---|---|
| `packages/efx-watercolor/probe/medium-engine/probe.ts` | +624 / -20 | the scene, four under kinds, stripe/body-share/bleed/replay instruments, blur helper, crops |
| `packages/efx-watercolor/probe/medium-engine/run.mjs` | +52 / -9 | `--under` operand, scene registration, refuse messages, query append |
| `packages/efx-watercolor/probe/medium-engine/harness.test.ts` | +59 / -8 | scene/operand/readout pins (207 harness tests green) |

Crops: 25 `-mid.png` 1:1 crossing crops plus 25 `-transparent.png` full sheets under `/tmp/medium-engine/261127-khp-r-*`; the trigger file at `/tmp/medium-engine/261127-khp-hash-extension.json`. Nothing outside the three probe files changed; nothing was pushed; no dev server was started.

## Deviations from Plan

### Auto-fixed Issues

None — no bug in the committed probe code required a Rule 1-3 fix.

### Designed halt (not a deviation)

Task 1's own instruction: *"If the artist floor is unmet, write the measured numbers into the summary inputs and STOP — a measured negative is a valid Task 1 outcome, and the law must not be written."* The halt is exactly that.

### Issues Encountered

1. **Flat-cell replay divergence aborted the RED verify chain before the trigger step.** Investigated across all 25 captures: only the five `flat` cells (the only watercolor-under strokes) diverge; root cause is the pre-existing `applyStroke` payload-codec clamp vs raw `renderPartialStrokes` in `engineAdapter.ts`, outside this quick's scope and files. The trigger file was therefore computed with the plan's exact formula (`max(1.0, 0.5 x painted RED)` per size) and written manually; the RED capture set itself is complete.
2. **Diagnostic capture pollution removed.** Two ad-hoc diagnostic captures (`261127-khp-test-flat-e0-s250*`, `261127-khp-r-flat-e0-s250-r2*`) were deleted so the RED crop inventory is exactly 25 as the verify chain expects.

## UNCLAIMED live UAT rows

No fix shipped, so **nothing here can be claimed or is pending verification of this run**. These are the acceptance surfaces any future law (one that can address the ~23 px band) must be judged on, and every row remains UNCLAIMED:

1. Artist live: blue `#1a88ec` under, then `#f9e01c` Pickup 100 over it — the longitudinal stripes gone at Edge 100, Sizes 40 / 150 / 250 / 400. — UNCLAIMED
2. The same after settle (the committed surface, not just live). — UNCLAIMED
3. Leave / reopen the key plus a forced re-render: stripes stay gone on the re-baked sheet. — UNCLAIMED
4. Undo / Redo of the judged stroke. — UNCLAIMED
5. Edge 0, Pickup 100 over the painted under. — UNCLAIMED
6. The Pickup-0 control: no visible change, byte-identical. — UNCLAIMED
7. The stroke over bare paper: no new band or edge. — UNCLAIMED
8. The green pickup mean preserved: the body still drags the under's colour, no darker/lighter body. — UNCLAIMED
9. The same pair at the artist's 150 px judged size. — UNCLAIMED

## Next Phase Readiness

The probe scene, the fine/wide readout and the RED matrix are ready for a follow-up that targets the measured defect: any next law must be sized to the **~23 px dominant band** (and record the wide-band ratio per cell, since the fine band is blind to it), and should account for the Edge-0 wide-band ambiguity (painted 2.02 vs control 2.04) before claiming an Edge-0 fix. The `flat`-under replay divergence in `renderPartialStrokes` vs `applyStroke` is a real instrument limitation to resolve before any watercolor-path replay identity is trusted.

---
*Quick task: 261127-khp*
*Completed: 2026-11-27 (measured negative, status incomplete by design)*

## Self-Check: PASSED

- FOUND: packages/efx-watercolor/probe/medium-engine/probe.ts
- FOUND: packages/efx-watercolor/probe/medium-engine/run.mjs
- FOUND: packages/efx-watercolor/probe/medium-engine/harness.test.ts
- FOUND: .planning/quick/261127-khp-pickup-under-aliasing-fix-bristle-brush-/261127-khp-SUMMARY.md
- FOUND: 2541e9bd3 (Task 1 commit, ancestor of HEAD)
