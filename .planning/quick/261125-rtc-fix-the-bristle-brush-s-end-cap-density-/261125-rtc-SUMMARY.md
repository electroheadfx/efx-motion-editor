---
phase: 261125-rtc
plan: 01
subsystem: efx-watercolor medium engine (bristle gather end density)
tags: [probe, bristle-end, end-density, census-anchored-window, measured-stop, sign-verdict]
requires:
  - "quick 261125-kvl: the visible dense end block measured on the real bristle path and the writer-map refutations (catch-up, release pressure, film lerp)"
provides:
  - "a census-anchored, executable end-density bar (window, three metrics, three tolerances, sign rule) over 41 pre captures"
  - "the measured per-series sign verdict: RAW-P UNIFORM +32/-0/0:0, RAW-C OPPOSITE +20/-11/0:1, VIS UNIFORM +32/-0/0:0, OVERALL OPPOSITE"
  - "the measured stop: Task 3's relative law is inadmissible; zero shader, engine, adapter, pin or baseline edits"
affects:
  - "packages/efx-watercolor/probe/medium-engine/probe.ts"
  - "packages/efx-watercolor/probe/medium-engine/end-density.mjs"
  - "packages/efx-watercolor/probe/medium-engine/run.mjs"
  - "packages/efx-watercolor/probe/medium-engine/harness.test.ts"
tech-stack:
  added: []
  patterns:
    - "census-anchored density window: lastTap = endCensus.last40.at(-1).x * dw, r = strokeSize/2, window [lastTap - 2.4r, lastTap + 1.05r] raster-clamped"
    - "three-metric end read: raw pigment zone mean, coverage inked share, visible-composite mean"
    - "per-series sign verdict as a binding admissibility gate for the law task"
key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/end-density.mjs
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
decisions:
  - "the end window is re-declared, anchored to the last recorded census dab; the old window sampled 26.7-48.8 px ahead of the dabs that wrote the block"
  - "the re-measured sign verdict is OPPOSITE on RAW-C (20 positive vs 11 negative cells): Task 3 stops at its admissibility gate and no source, pin or baseline file moves"
  - "VIS equals the raw transparent mean in these captures because the transparent export carries alpha 1 across the mark; the declared endFine.vis reader is implemented verbatim and the raw mean stays a report-only column"
metrics:
  duration: 1h 11m
  completed: 2026-11-25
  tasks: 3
  files: 4
actuals:
  tokens: 18930
  tasks: 3
  commits: 3
plan_head_before: 923ae8ceba25a398c632a76132af4ac60528d573
plan_head_after: a431a7a91308d431f680718f3162ce344fdf4f65
commits: 3
status: complete
---

# Quick 261125-rtc: Bristle End-Cap Density — Re-Declared Bar and Measured Stop

The end-density bar is re-declared on the census-anchored visible block, implemented in the probe and the checker, and re-measured over the full 41-cell pre matrix: the sign verdict is UNIFORM on raw pigment and visible composite but OPPOSITE on the coverage inked share, so Task 3's relative law stopped at its admissibility gate with zero shader, engine, adapter, pin or baseline edits.

## Outcome: MEASURED STOP

Task 3's admissibility gate fired. The frozen rule: UNIFORM admits the one relative law; OPPOSITE on any of RAW-P, RAW-C or VIS stops it. The re-measurement reads:

- RAW-P UNIFORM (+32 / -0 / 0:0)
- RAW-C **OPPOSITE** (+20 / -11 / 0:1)
- VIS UNIFORM (+32 / -0 / 0:0)
- **OVERALL: OPPOSITE**

No shader (`shaders.ts`), engine (`Engine.ts`), adapter (`engineAdapter.ts`), gather constant (`bristles.ts`), pin (`scattering.test.ts`) or baseline (`baselines/edge-layer-neutral.json`) file moved. No row is claimed fixed; there is no UAT hand-off. This is the quick's valid outcome, not a failure of Task 2.

## Frozen pre-declaration (verbatim, from PLAN.md Task 2)

> 1. THE FROZEN PRE-DECLARATION - declared here, before any law, mirrored verbatim into the SUMMARY before the first shader edit, and never tuned after seeing post values:
>    - WINDOW: `lastTap = endCensus.last40.at(-1).x` (the census records stampScripted's x as a document-width fraction - multiply by dw for raster px; the drive's end x 0.85 reads 918 on a 1080 sheet); `r = strokeSize / 2` document px. End window `[lastTap * dw - 2.4r, lastTap * dw + 1.05r]` clamped to `[0, dw - 1]`. Body zone unchanged at `[round(0.40 * dw), round(0.55 * dw)]`. A bristle-end capture with no census tap fails - never a silent fallback to the old window. The anchor is the LAST recorded dab: the catch-up included on the live lanes, the final scripted sample on the bake.
>    - METRICS, each over that window versus the body zone, on every marked row: RAW-P = the pigment zone MEAN, `(255 - mean RGB) / 255` on the pigment raster; RAW-C = the INKED SHARE, the fraction of zone cells with coverage alpha / 255 at least 0.5; VIS = the visible-composite MEAN, `1 - min(r*a + 255*(1-a), g*a + 255*(1-a), b*a + 255*(1-a)) / 255` read per pixel on the transparent raster - exactly the `endFine.vis` reader, the composite over white the eye sees. The raw transparent mean stays a report-only diagnostic column.
>    - TOLERANCES on the 32 MATRIX and RELEASE cells, post-fix: `|RAW-P end - body| <= 0.02`, `|RAW-C end - body| <= 0.03`, `|VIS end - body| <= 0.02`. The lift stays an OBSERVATION cell: its pigment gap may grow by at most 0.01 versus its pre twin, with the VIS gap printed beside it and never asserted.
>    - SIGN RULE: per cell, sign = sign(end - body) on RAW-P, RAW-C and VIS. A series is OPPOSITE when at least one cell reads end > body + 0.001 and at least one reads end < body - 0.001; otherwise it is UNIFORM (zero cells are neutral). The overall verdict is UNIFORM only when all three series are UNIFORM; otherwise OPPOSITE. UNIFORM admits Task 3's relative law; OPPOSITE stops it - a valid outcome, not a failure of this task.
>    - STRUCTURAL BARS unchanged: `BODY_DRIFT_MAX = 0.01`, `START_DRIFT_MAX = 0.01`, `BODY_THICKNESS_DRIFT_MAX = 2` px, `FLAT_PCT_GROWTH_MAX = 5` points, `LONGEST_RUN_MAX_PX = 40`, `START_SHAPE_DRIFT = { flatPct 5, longest 3, spread 3 }`, `BAKE_LIVE_GAP_MAX = 0.02`, the pale-line growth bars (0.5 point ENCLOSED share, 3 px run under the absolute 20 px cap, coherence 0.05 / 0.05, halo 0.05 peak / 2 rows per side, the doc's absolute ENCLOSED target gating only where the pre cell already met it), the census/gather/brush proof on the 33 bristle-end cells, and the determinism pair.

Why the old window was wrong: it sampled `[endMedian - max(30, round(0.25 * thickness)), endMedian - 2]`, which starts 26.7-48.8 document px AHEAD of the last recorded dab in every cell (s100-d70-stop: last tap 917.6, window [958, 995]). The stroke travels +x, so every sampled pixel lay on the LEADING side of the dabs that wrote the block — a trailing-side law is inert there. The re-measurement below uses the frozen anchored window only.

## Re-measured pre matrix (41 cells, sheet 1080, Feather 100)

Captures re-run with the anchored window; they are NOT byte-identical to the first pre set (the probe now writes the new window and metrics). P = RAW-P, C = RAW-C inked share, V = VIS. Values are body / end / delta.

### Bristle-end cells (33)

| cell | drive | scale | lastTap | r | window | P b/e/Δ | C b/e/Δ | V b/e/Δ |
|---|---|---|---|---|---|---|---|---|
| s050-d00-stop | stop | 1.60 | 918.1 | 25.0 | 858-944 | .6446/.6613/+.0167 | .8907/.8944/+.0037 | .6023/.6782/+.0759 |
| s050-d00-bake | bake | 1.60 | 918.1 | 25.0 | 858-944 | .6446/.6607/+.0161 | .8907/.8989/+.0082 | .6023/.6817/+.0794 |
| s050-d70-stop | stop | 1.60 | 918.1 | 25.0 | 858-944 | .6438/.6876/+.0438 | .8981/.8185/−.0796 | .6105/.6154/+.0049 |
| s050-d70-bake | bake | 1.60 | 918.1 | 25.0 | 858-944 | .6438/.6877/+.0439 | .8981/.8205/−.0776 | .6105/.6209/+.0104 |
| s100-d00-stop | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6456/.6633/+.0177 | .8854/.8892/+.0038 | .5932/.6818/+.0886 |
| s100-d00-bake | bake | 2.00 | 918.4 | 50.0 | 798-971 | .6456/.6620/+.0164 | .8854/.8934/+.0080 | .5932/.6836/+.0904 |
| s100-d70-stop | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6398/.6855/+.0457 | .9001/.8208/−.0793 | .6088/.6291/+.0203 |
| s100-d70-bake | bake | 2.00 | 918.4 | 50.0 | 798-971 | .6397/.6841/+.0444 | .9002/.8225/−.0777 | .6089/.6294/+.0205 |
| s150-d00-stop | stop | 3.00 | 916.2 | 75.0 | 736-995 | .6345/.6562/+.0217 | .8790/.8790/0 | .5740/.6733/+.0993 |
| s150-d00-bake | bake | 3.00 | 918.3 | 75.0 | 738-997 | .6345/.6551/+.0206 | .8790/.8805/+.0015 | .5740/.6749/+.1009 |
| s150-d70-stop | stop | 3.00 | 916.2 | 75.0 | 736-995 | .6429/.6893/+.0464 | .8606/.8001/−.0605 | .5697/.6134/+.0437 |
| s150-d70-bake | bake | 3.00 | 918.3 | 75.0 | 738-997 | .6429/.6879/+.0450 | .8606/.8003/−.0603 | .5697/.6137/+.0440 |
| s200-d00-stop | stop | 4.00 | 915.3 | 100.0 | 675-1020 | .6308/.6615/+.0307 | .8344/.8452/+.0108 | .5584/.6488/+.0904 |
| s200-d00-bake | bake | 4.00 | 918.1 | 100.0 | 678-1023 | .6308/.6598/+.0290 | .8344/.8438/+.0094 | .5584/.6507/+.0923 |
| s200-d70-stop | stop | 4.00 | 915.3 | 100.0 | 675-1020 | .6303/.6813/+.0510 | .8562/.8041/−.0521 | .5731/.6177/+.0446 |
| s200-d70-bake | bake | 4.00 | 918.1 | 100.0 | 678-1023 | .6302/.6811/+.0509 | .8561/.8044/−.0517 | .5730/.6186/+.0456 |
| s300-d00-stop | stop | 16.00 | 918.3 | 150.0 | 558-1076 | .5953/.6277/+.0324 | .4164/.8197/+.4033 | .5286/.7209/+.1923 |
| s300-d00-bake | bake | 16.00 | 917.8 | 150.0 | 558-1075 | .5953/.6273/+.0320 | .4164/.8189/+.4025 | .5286/.7221/+.1935 |
| s300-d70-stop | stop | 16.00 | 918.3 | 150.0 | 558-1076 | .6068/.6490/+.0422 | .6374/.7958/+.1584 | .5756/.6587/+.0831 |
| s300-d70-bake | bake | 16.00 | 917.8 | 150.0 | 558-1075 | .6068/.6481/+.0413 | .6373/.8023/+.1650 | .5756/.6691/+.0935 |
| s100-d00-stop-rp10 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6456/.6633/+.0177 | .8854/.8892/+.0038 | .5932/.6818/+.0886 |
| s100-d00-stop-rp50 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6456/.6633/+.0177 | .8854/.8892/+.0038 | .5932/.6818/+.0886 |
| s100-d00-stop-rp90 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6456/.6633/+.0177 | .8854/.8892/+.0038 | .5932/.6818/+.0886 |
| s100-d70-stop-rp10 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6398/.6855/+.0457 | .9001/.8208/−.0793 | .6088/.6291/+.0203 |
| s100-d70-stop-rp50 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6398/.6855/+.0457 | .9001/.8208/−.0793 | .6088/.6291/+.0203 |
| s100-d70-stop-rp90 | stop | 2.00 | 917.6 | 50.0 | 798-970 | .6398/.6855/+.0457 | .9001/.8208/−.0793 | .6088/.6291/+.0203 |
| s300-d00-stop-rp10 | stop | 16.00 | 918.0 | 150.0 | 558-1076 | .5953/.6275/+.0322 | .4164/.8187/+.4023 | .5286/.7201/+.1915 |
| s300-d00-stop-rp50 | stop | 16.00 | 918.0 | 150.0 | 558-1076 | .5953/.6277/+.0324 | .4164/.8187/+.4023 | .5286/.7197/+.1911 |
| s300-d00-stop-rp90 | stop | 16.00 | 918.4 | 150.0 | 558-1076 | .5953/.6253/+.0300 | .4164/.8430/+.4266 | .5286/.7401/+.2115 |
| s300-d70-stop-rp10 | stop | 16.00 | 918.0 | 150.0 | 558-1076 | .6068/.6495/+.0427 | .6374/.7957/+.1583 | .5756/.6627/+.0871 |
| s300-d70-stop-rp50 | stop | 16.00 | 918.0 | 150.0 | 558-1076 | .6068/.6492/+.0424 | .6374/.7957/+.1583 | .5756/.6625/+.0869 |
| s300-d70-stop-rp90 | stop | 16.00 | 918.4 | 150.0 | 558-1076 | .6068/.6382/+.0314 | .6374/.8250/+.1876 | .5756/.6819/+.1063 |
| s100-d70-lift | lift | 2.00 | 899.6 | 50.0 | 780-952 | .6410/.8892/+.2482 | .9001/.2696/−.6305 | .6141/.2037/−.4104 |

### Pale-line cells (8 gates × 3 surfaces)

All 24 surface rows (postApply / postSettle / postFix) are identical within each capture and identical between the bare and `--over` variants: line-s035-mut1 ENCLOSED 3.52% / run 6 / coherence 0.1789 / halo 0.4521 down, 0.4697 up; line-s035-mut2 3.70% / 6 / 0.1753 / 0.3843 / 0.4574; line-s100-mut1 1.48% / 3 / 0.1802 / 0.3707 / 0.4154; line-s100-mut2 7.59% / 9 / 0.1580 / 0.4877 / 0.4958. Pale-line captures emit no endCensus, gather, endMetrics, endSetup or drive, so no end-field assertion applies to them.

## Sign verdict (pre)

Computed by the checker over the 32 matrix and release cells (the lift is the declared observation cell and is excluded from the sign rule). A series is OPPOSITE only when it holds both a > +0.001 cell and a < −0.001 cell; zero cells are neutral.

| series | positive | negative | zero | verdict | extremes |
|---|---|---|---|---|---|
| RAW-P | 32 | 0 | 0 | UNIFORM | max +0.0510 at s200-d70-stop |
| RAW-C | 20 | 11 | 1 | **OPPOSITE** | max +0.4266 at s300-d00-stop-rp90; min −0.0796 at s050-d70-stop |
| VIS | 32 | 0 | 0 | UNIFORM | max +0.2115 at s300-d00-stop-rp90 |

**OVERALL: OPPOSITE.** The 11 negative RAW-C cells are the Dry-70 matrix seats at sizes 50/100/150/200 (stop and bake, −0.0517 .. −0.0796) plus the three s100-d70 release cells (−0.0793 each); the single zero is s150-d00-stop (0.0000). The positive RAW-C seats are Dry 0 at parity-ish small sizes (+0.0015 .. +0.0108), s300 Dry 70 (+0.1583 .. +0.1876) and s300 Dry 0 (+0.4023 .. +0.4266).

The split is the finding: pigment deepens at the end in every cell and the visual composite darkens in every cell, but the coverage inked share moves both ways depending on size and dry — the terminal block is darker where fewer texels carry the pigment at small/medium Dry 70, yet broader at s300 and Dry 0. A single per-stroke normalized fade toward the stroke's own body cannot satisfy all three series in both directions; the measured stop follows by the frozen rule.

## Writer map re-checked (against the new window)

1. **Catch-up dab is not the writer.** Stop and bake pigment deltas match within 0.0017 across all 10 size/dry pairs while capped dabs (`endCaps > 0`) fire in 7 non-bake cells (s050-d00-stop, s050-d70-stop, s100-d70-lift, s300-d00-stop, s300-d00-stop-rp90, s300-d70-stop, s300-d70-stop-rp90) and in 0 bake cells. The bake lane reproduces the stop lane's gap with no catch-up at all. Refuted as the sole writer.
2. **Release pressure is not the lever.** At s100 both drys are bit-identical across rp10 / rp50 / rp90 in pigment body/end and coverage (RAW-P and RAW-C unchanged). At s300 the sweep moves RAW-C slightly (d00: +.4023 at rp10 → +.4266 at rp90; d70: +.1583 → +.1876) without flipping any series sign. Consistent with the 2026-11-23 finding; retained.
3. **Writer = the terminal dab chain's own footprints; channel = carried pigment plus coverage inked share.** Restated on the new window at s100-d70-stop: pigment zone mean rises 0.6398 → 0.6855 (+0.0457) and coverage mean alpha rises 0.6917 → 0.8134 (+0.1217) while the coverage inked share falls 0.9001 → 0.8208 (−0.0793). The end block is fewer-but-denser coverage footprints carrying higher pigment. Coverage mean alpha is higher at the end in all 20 matrix cells (+0.0922 at s050-d70-stop .. +0.3346 at s300-d00-bake). The old window's "inked texels darker at the end" phrasing does not carry over: under the anchored window the pigment raster's inked share reads 1 in both zones and the signature is the mean-alpha rise against the inked-share split above. This intrinsic pigment/coverage split is exactly why the sign verdict is OPPOSITE.

## Lift observation

s100-d70-lift (observation cell, never asserted against the absolute gaps): RAW-P +0.2482 (0.6410 → 0.8892), RAW-C −0.6305 (0.9001 → 0.2696), VIS −0.4104 (0.6141 → 0.2037). Its signs differ from the matrix cells (pigment positive, coverage and visible negative), which is why the frozen declaration excludes it from the sign rule. The observation band (`pigment gap may grow by at most 0.01 versus its pre twin`) is a post-fix comparison and no post twin exists because Task 3 stopped; the cell is reported here and its verdict belongs to the live UAT, as the frozen declaration states.

## Task 3 admissibility gate — STOP

The gate reads the Task 2 verdict: OPPOSITE on RAW-C. Per the plan, no edit was made to `shaders.ts`, `bristles.ts`, `Engine.ts`, `engineAdapter.ts`, `scattering.test.ts` or `baselines/edge-layer-neutral.json`; the window, metrics and tolerances were not retuned; the 2026-11-23 takeoff was not touched. The quick completes as measurement plus stop, with no law, no pin changes, no baseline moves and no row claimed fixed.

## Verification and gates

| Gate | Result |
|---|---|
| `node end-density.mjs --pre /tmp/medium-engine` | PASS — 33 bristle-end + 8 pale-line pre cells; capture integrity only (a pre gap or sign verdict never fails this mode) |
| Harness pins `vitest run harness.test.ts` | 166 passed (no watch mode) |
| `tsc --noEmit` (package) | clean |
| `compare.mjs edge-layer-neutral --edge-structural` | PASS — layerAllocated false, mergeDraws 0 (amount-0 identity holds) |
| `compare.mjs edge-layer-neutral` | PASS — all 12 fields equal; no gather change was made, so no drift was expected or observed |
| Diff-scope gate vs `b12d769b1` | clean — 8 paths, all declared (4 code files + `.planning/` artifacts) |
| Capture determinism | smoke re-run of s100-d70-stop reproduced the same digest (`df184fe7`) |

## Deviations from Plan

**None material.** Two observations recorded:

1. **VIS collapses to the raw transparent mean in these captures.** The transparent export carries alpha 1 across the mark, so the declared `endFine.vis` formula (`1 − min(r*a + 255*(1−a), …)/255`) equals the raw dark mean. The reader is implemented exactly as declared; the raw transparent mean remains a separate report-only column so a future capture with partial alpha keeps the two distinct.

2. **The pre captures were fully re-taken.** As the plan predicted, the 41 pre files are not byte-identical to the first pre set (the probe now writes `density.window` and `density.zones`); capture determinism was re-proven with a smoke re-run rather than assumed.

## Self-Check: PASSED

- Created/modified files present: `probe.ts`, `end-density.mjs`, `run.mjs`, `harness.test.ts`.
- Commits present on HEAD: `d79f9e48a`, `3e1112d69`, `a431a7a91`.
- No stub patterns: the checker throws loudly on a missing window or zones; the probe throws a named error when a bristle-end capture has no census tap. No placeholders, no TODOs.
- No threat-surface flags: probe/checker changes only; no network endpoint, auth path or trust-boundary change.

## Close-out — 2026-11-26 (UAT approved)

The measurement stop was superseded by a direct fix. The terminal density block was the 2026-11-20 trail trim's FILM multiplication: `trailSupport` suppressed the running body's carried film while the terminal band kept its density. Law (`e58497d3b`): the trim stays a coverage/threshold law (the trailing rect opens into pores) and no longer multiplies `featherFade`.

Probe, the same 41-cell set: VIS end−body +0.1923 → −0.0068 at s300-d00-stop, +0.0886 → +0.0069 at s100-d00-stop, +0.0203 → −0.0585 at s100-d70-stop; 0/32 matrix/release cells above +0.02; bake = stop within 0.0016; determinism byte-identical; RAW-C s300-d00 +0.4033 → −0.0091. Accepted costs judged live: the body densifies (up to +0.27 VIS at s300), thin-line halo grew on 4/8 pale-line cells, the Dry-70 s100 start silhouette flattens, the s300 end wall (99.29% flat, 271 px) is pre-existing and unchanged, and the edge-layer-neutral amount-0 baseline was re-captured per the documented procedure. The rejected terminal-normalize pass `885749251` stays reverted (`44ee5308c`).

The artist approved the live UAT on 2026-11-26 ("it worked!").
