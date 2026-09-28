# Quick Task 260928-dh1: Paint-deposit debug — kill the pixel speckle - Summary

**Status:** automated-ready
**Completed:** 2026-09-28
**Commits:** `329051f1` (Task 1 harness), `05a92f77` (RED pins), `3815e307` (seeded bristle pass), `9c4b6581` (drying de-hardcut)
**Scope-gate base:** `25bd6d87`

## Outcome

The deposit-path rewrite (seeded deposit-time bristle pass + continuous dryStep) is in place with all behavior pins green and the full battery green. **The click-0 metric verdict is NOT MET on this run** — `isolatedPx` reads 912 against a RED baseline of 889 (a wash, not zero), and `edgeCliffs` is flat (21 703 vs 21 702). Native visual UAT at zoom is the oracle for the look and is still pending.

## Manifest parity (RED vs GREEN) — MATCH

| field | verdict |
|---|---|
| `contentSpec` | MATCH (sha `322414db55b3`) |
| `lcgSeed` | MATCH (123456789) |
| `zoom` | MATCH (4) |
| `canvas` | MATCH (1920×1080) |
| `brushSpec` | MATCH |
| `paper` | MATCH (`onKey: canvas1`) |

The comparison is valid. No re-run required on parity grounds.

## RED vs GREEN metrics

| row | iso RED | iso GREEN | Δ | cliffs RED | cliffs GREEN | Δ | mass RED | mass GREEN | Δ |
|---|---|---|---|---|---|---|---|---|---|
| paper-off-clicks-0 | 889 | **912** | +23 | 21 702 | **21 703** | +1 | 11 097 824 | 11 127 979 | +0.3% |
| paper-off-clicks-1 | 218 | 209 | −9 | 14 514 | 13 899 | −615 | 21 104 756 | 21 184 860 | +0.4% |
| paper-off-clicks-2 | 24 | 52 | +28 | 5 052 | 6 039 | +987 | 33 736 278 | 28 732 735 | −14.8% |
| paper-off-clicks-3 | 1 | 8 | +7 | 3 271 | 4 145 | +874 | 36 239 378 | 32 030 887 | −11.6% |
| paper-on-clicks-0 | 868 | 865 | −3 | 21 889 | 21 918 | +29 | 11 113 360 | 11 088 983 | −0.2% |

### Metric verdicts (honest)

| criterion | measured | verdict |
|---|---|---|
| click-0 `isolatedPx == 0` | 912 | **NOT MET** |
| click-0 `edgeCliffs` near 0 | 21 703 | **NOT MET** (flat vs RED) |
| click-0 falloff continuous | 912 isolated px remain | **NOT MET on this metric** |
| clicks 1/2/3 `isolatedPx` not growing | 912 → 209 → 52 → 8 | PASS (monitored) |
| light < heavy / fast < slow mass ordering | visible in PNG lanes (three lanes share one `alphaMass`) | judged at UAT |
| paper pass continuous (paper-on-0 ≈ paper-off-0) | 865/21 918 vs 912/21 703 | PASS (held from RED gate) |

Pixel-level crops (`/tmp/efx-dh1/{red,green}-crop-heavy.png`, `-crop-light.png`) show the click-0 body and edges still carry salt-and-pepper in GREEN, in the same character as RED. Ink bounding boxes are identical RED vs GREEN (x 592–7075, y 548–3735), so the footprint did not move — the change is interior.

`alphaMass` at clicks 2/3 is down 11–15% — consistent with the continuous-transfer change moving less material on each physics pass. **Clicks 1/2/3 are monitored, not claimed.**

## Acceptance framing (user-mandated)

- The deposit fix must make **click 0 clean** (zero isolated pixels, continuous falloff) — **that is the in-scope defect**. This run does not reach it on the metric.
- Click rows 1/2/3 are **monitored, not claimed**. In RED, `isolatedPx` fell 889 → 218 → 24 → 1 while `alphaMass` tripled: the body fills, so neighbours stop reading as isolated. The live captures at clicks 1/2/3 showed a visible degradation (grain → rough → stroke disintegrating into noise) that this metric likely does not count — sparse noisy mass and edge roughness, not hard isolated pixels.
- The physics-button / `savedWet` accumulation item stays **DEFERRED and OPEN**. It must not be closed on `isolatedPx` alone. Native visual UAT remains the oracle for the click-degradation look.
- **RETRACTED reconciliation (user correction 2026-09-28):** an earlier note claimed `DEPOSIT_KEEP_TIER = 70` was compatible with the traces because they are contained. **That was wrong and must not be carried forward.** The brief's hard rule ("no hard alpha/coverage cutoff anywhere in the deposit path") is right in substance: a low-alpha trace field sitting next to an include/exclude threshold manufactures survivors by construction. See the gate-field diagnosis below for what the measurement actually shows.

## Gate-field diagnosis (user-mandated, BEFORE any new deposit code)

`wet-layer.ts` NOT edited. Measurement: `packages/efx-physic-paint/src/core/depositGateFieldMeasurement.test.ts` (extends the 260924-pyp production-AA substrate; real `createPaintStrokeRasterContinuation` + real `transferToWetLayerClipped`; bristles INCLUDED; analytic Canvas2D substitute — no installs). BEFORE = the exact `offData` bytes `transferToWetLayerClipped` gates on. AFTER = binary `a >= 70` on those same bytes. Control = identical run with `ctx.stroke()` a no-op. Artifacts: `/tmp/efx-dh1-gate/`.

| measurement | heavy-slow (p=0.9) | light-slow (p=0.2) |
|---|---|---|
| `crossCheckMismatch` (real transfer vs `a>=70`) | **0** | **0** |
| `isolatedBefore` (continuous field) | 0 | 0 |
| `isolatedAfter` (binary keep-field) | 0 | 0 |
| pixels kept only thanks to bristles | **4** | **0** |
| …isolated among those | 0 | 0 |
| band 1–39 (below tier, dropped) | 70 → **193** with bristles | 16 → **42** with bristles |
| band 40–100 (straddles the tier) | **63** with / 65 without | 31 with / 30 without |
| body plateau | 245 | 245 |

### What the numbers say

1. **The gate is a pure threshold.** `crossCheckMismatch = 0`: the real `transferToWetLayerClipped` deposits exactly the `a >= 70` pixels and drops the rest. Nothing else filters at that seam.
2. **The gate does NOT manufacture lone-pixel speckle in this substrate.** `isolatedBefore = 0` and `isolatedAfter = 0` — neither the rasterized field nor the keep-field has pixels without a same-or-brighter neighbour.
3. **The bristle field does NOT straddle the tier.** It lands almost entirely BELOW it: +123 (heavy) / +26 (light) pixels in the 1–39 band, which the gate drops. Only **4** pixels (heavy) and **0** (light) got pushed across the tier by bristles. The 40–100 straddle band is 63 with bristles vs 65 without — the bristles did not widen it.
4. **The straddling field is the layered-fill AA edge ramp, not the bristles.** Body plateau is a solid 245. The intermediate mass is a 1–2 px noisy fringe at the ribbon boundary (cross-section at x=126: `21:0 22:137 23:245 … 36:245 37:68 38:0`; edge row hex `0012000660352568ce38a244884601b85356716301acb0800`). That fringe is already noisy BEFORE the cut (upstream: deformN + 37 × `fillFlat` AA at `lAlpha=0.08`).
5. **The cut binarizes that noisy ramp into a ragged edge.** The AFTER keep-field boundary rows show broken runs — row 22 `.......##..#.#####.##...####..###.###.#...###.#..`, row 37 `.##.##.#.#.#############...#####....###.#..##....`. That ragged contour is the deposit-side seed of edge salt-and-pepper.

### Verdict — MIXED, leaning upstream-with-cut-amplification

**Not** "smooth before / speckled after" (the gate alone would be the whole story). **Not** purely "speckled before" either. The measured chain is: **upstream layered-fill AA/deformN produces a noisy low-alpha edge ramp → the `a < 70` include/exclude cut turns that ramp into a hard ragged contour.** Per the user's own decision rule the lever is therefore **the field must stop straddling the tier** — and the 260924-m7w law still holds: a continuous-modulation gate is FORBIDDEN, so "softening the gate" is not an option.

**Deposit-side bristle build-up is refuted as the lever** on this measurement: the bristle field is filtered, not straddling (4 / 0 manufactured pixels). The live `+23` (889 → 912) is therefore **not** explained by bristles crossing the tier — that mechanism accounts for 4 pixels here, not 23.

### Metric gap (must not be papered over)

The dh1 `isolatedPx` definition (a pixel with no 8-neighbour at ≥ half its alpha) **under-counts ragged-edge speckle**: every fringe pixel next to the 245 body has the body as a "peer", so a torn contour scores 0. The 889 / 912 live counts are therefore measuring something this substrate does not reproduce. Two candidates, not distinguished by this run *(both confirmed as REAL and DISTINCT — see "Four-seam birthplace measurement" below)*:

- (a) real Canvas2D AA produces sub-pixel polygon spikes in the 70–120 band that the analytic fill substitute does not (substrate fidelity gap — `isolatedBefore` would then be > 0 in vivo);
- (b) the speckle is born **downstream** of the gate — `wetDisplayAlpha` / composite / drying — including the "body" speckle the crops showed (this substrate's body is a solid 245 plateau with no speckle at all).

### Not decided here — STOP

- No new deposit code. No tier change. If the diagnosis points at the gate's tier, reopening 260924-rm2's `DEPOSIT_KEEP_TIER` is a **NEW user decision**, never a silent edit. On this run the tier is implicated only as an *amplifier* of an upstream noisy ramp, not as the originator.
- Native UAT stays deferred (crops already agree with the metric).
- `savedWet` / physics-button accumulation stays DEFERRED and OPEN.

## Four-seam birthplace measurement (live, 2026-09-28) — RESOLVES the metric gap

Harness extension (measurement only, no deposit / display code): `depositSpeckleCapture.ts` four-seam probes + `computeDefectMetrics` (`tornEdge` / `bodyHardJumps` / `bodyHfEnergy`; `isolatedPx` demoted to cross-check). Live run `__EFX_DH1_CAPTURE__('seams')`. Manifest `/tmp/efx-stall-capture-dh1-seams.json`, PNGs `/tmp/efx-dh1/seams/seam-{tag}--{seam}.png`. 28/28 artifacts on disk (user-fixed PNG writer: `export_write_png` now `create_dir_all`s; `writeZoomPng` now checks the `safeInvoke` Result).

### Probe defect — `post-dry` EXCLUDED

The four `*-post-dry.png` are byte-identical (229 518 B) with metrics 0/0/0 (except `click-1`): the post-dry probe captures the wrong region. **Do not read its zeros as clean.** Excluded from the birthplace reading below.

### Seam metrics (acceptance trio; paper-off unless tagged)

| tag | seam | tornEdge | bodyHardJumps | bodyHfEnergy | isolatedPx (x-check) |
|---|---|---|---|---|---|
| heavy-slow | post-raster | **33** | **654** | **144 798** | 0 |
| heavy-slow | post-gate | 38 | 407 | 84 846 | 0 |
| heavy-slow | post-display | **12 282** | 626 | 146 893 | 340 |
| heavy-fast | post-raster | **32** | **716** | **145 539** | 0 |
| heavy-fast | post-gate | 45 | 436 | 80 890 | 0 |
| heavy-fast | post-display | **12 015** | 591 | 134 827 | 324 |
| light-slow | post-raster | 125† | **479** | **90 189** | 0 |
| light-slow | post-gate | 189† | 318 | 58 770 | 0 |
| light-slow | post-display | 5 093† | 434 | 106 937 | 286 |
| paper-on-heavy-slow | post-raster / post-display | 16 / **12 285** | 643 / 667 | 156 964 / 155 677 | 0 / 327 |

† **Metric caveat (honest):** `tornEdge`'s `runLen ≤ 2` fragment rule inflates on thin lines where *every* run is short. The light-slow `post-display` PNG actually looks smooth — its 5 093 is the thin-line artifact, not a torn contour. The heavy-slow / heavy-fast `tornEdge` explosion is valid (thick 16px body, so 1–2px runs really are crumbs).

Row-level (final render surface, `copyLiveAlphaCanvas`):

| row | tornEdge | bodyHardJumps | bodyHfEnergy | isolatedPx (x-check) |
|---|---|---|---|---|
| paper-off-clicks-0 | 29 383 | 1 564 | 361 624 | 912 |
| paper-off-clicks-1 | 12 908 | **40 202** | **7 256 340** | 198 |
| paper-off-clicks-2 | 1 675 | 83 535 | 11 070 560 | 52 |
| paper-off-clicks-3 | 588 | 38 292 | 5 129 063 | 8 |
| paper-on-clicks-0 | 29 611 | 1 659 | 438 779 | 879 |

### Birthplace 1 — body speckle is born at `post-raster` (candidate (a) CONFIRMED)

`bodyHardJumps` 479–716 and `bodyHfEnergy` 90k–157k are **already present in the bytes the gate reads**, and the gate *reduces* them (318–453 / 58k–103k). The vitest substrate's clean 245 plateau does not reproduce this — real Canvas2D AA + the 37 × `fillFlat` layering produce interior high-frequency energy in vivo. Visible in `seam-light-slow--post-raster.png`: the thin light stroke is already dotted/fragmented at raster time.

**Lever for this birthplace: the raster/layering field (paint.ts layered fill + real AA), not the gate, not the display.**

### Birthplace 2 — torn contour / speckle halo is born at `post-display` (`wetDisplayAlpha` / composite)

`tornEdge` explodes **33 → 12 282 (×372)** on heavy-slow, **32 → 12 015 (×375)** on heavy-fast, **16 → 12 285** on paper-on-heavy-slow. `post-raster` and `post-gate` PNGs show a solid stroke with a clean-ish contour; `post-display` shows a solid core wrapped in a salt-and-pepper halo — exactly the live defect in `paper-off-clicks-0.png`. The gate is NOT the originator on this run (post-gate torn 33→38, bodyJ 654→407).

**Lever for this birthplace: `wetDisplayAlpha` / `compositeWetLayer` (compositor.ts) — the display mapping turns a slightly-rough edge into a torn speckled halo.**

### Gate verdict on this run — NOT implicated

`post-gate` is flat-to-cleaner vs `post-raster` on every tag. **`DEPOSIT_KEEP_TIER` reopening (260924-rm2) is NOT triggered.** The earlier substrate diagnosis ("the cut binarizes a noisy ramp") is an analytic-substrate effect; in vivo the display mapping is the contour killer.

### Paper is not the source

paper-on-heavy-slow post-display (torn 12 285 / bodyJ 667) ≈ paper-off heavy-slow (12 282 / 626). Consistent with the earlier paper-on-0 ≈ paper-off-0 finding.

### Clicks 1/2/3 — MONITORED, NOT CLAIMED (`savedWet` stays DEFERRED and OPEN)

clicks-1 `bodyHardJumps` 40 202 and `bodyHfEnergy` 7.26M vs clicks-0 1 564 / 362k — a 25× / 20× explosion in body defect after the first apply-physics click. This is the evidence base for the deferred `savedWet` accumulation item. **Do not close it on `isolatedPx` (which actually falls 912 → 198).** Native visual UAT remains the oracle for the click-degradation look.

### STOP record

- No deposit code. No display code. Named birthplaces only, as instructed.
- `DEPOSIT_KEEP_TIER` not reopened (gate not implicated on this run).
- `savedWet` / physics-button one-shot-vs-dose stays DEFERRED and OPEN.
- Native UAT stays deferred; `tornEdge` / `bodyHardJumps` / `bodyHfEnergy` are now the metric that can see the look.
- mixbox stays REJECTED.

## Lever 1 (revised target) — premultiply round-trip, not the display map

**User decision 2026-09-28:** the torn-contour lever is `fluids.ts` copy-in/copy-back, NOT `wetDisplayAlpha`. The display-mapping pin (`compositor.displayMapping.test.ts`, 7/7) refuted a formula-only fix: clean in → clean out at `po = 1.0` (P3), isolated halo pixels survive the linear map (P6). `compositor.ts` goes back to LOCKED. `fluids.ts` UNLOCKED for the two copy-back blocks only.

**Revised mechanism (read from code, both twins live):** `fluids.ts:541-561` (`fluidPhysicsStep`) and `fluids.ts:745-751` (`createLocalFluidPhysicsContinuation`). Copy-in premultiplies by density-scale `a = wet.alpha`. Copy-back did `if (a > 0.5) { invA = 1/a; r/g/b/so = clamp(premul*invA) }` then ALWAYS wrote `wet.alpha`:

1. **`invA = 1/a` is a noise amplifier** — differential a/premul advection fluctuations multiply into r/g/b and strokeOpacity and clamp at 0/255. The clamped strokeOpacity speckle trips the display's 0.90 branch (P1+P4 → `bodyHardJumps`).
2. **`if (a > 0.5)` is a hard per-pixel branch** (260928-dh1 forbids exactly this). Below the line, r/g/b and strokeOpacity stay STALE while `wet.alpha` is written — advected scattered alpha beside leftover body colour/opacity = isolated parasitic pixels. The torn contour's birthplace.

This revises "likely Stam advection speckle": advection is dissipative and is NOT the tearer. `advect`/`diffuse`/`project`/`velStep`/`densStep` stay LOCKED. `dryStep` is exonerated for the wet field (its paperHeight term modulates only the dry-canvas write).

### Measure-first pin (`fluids.premulRoundTrip.test.ts`) — copy-in → copy-back, advection SKIPPED (dt = 0)

| # | measurement | result |
|---|---|---|
| R1 | pure identity round-trip (no wobble) | no-op — harness sound, `r* a / a = r` |
| R2 | **D2** — two pixels that were body, `a` wobbled to 0.4 / 0.6 | **CONFIRMED** — 0.4 pixel kept stale `r=40`/`so=1`; 0.6 pixel recovered to clamped `r=255`. A 215-unit parasitic colour pair on one scanline |
| R3 | **D1** — uniform-40 body, a-only 50% wobble | **CONFIRMED** — recovered colour no longer uniform (clamped at 255 or shifted) |
| R4 | `dt=0` advect with a live velocity field | identity (max error < 1e-5) — R2/R3 are pure round-trip, zero physics |

**The round-trip is proven as the creator with zero physics involved.**

### The fix — one shared recovery seam

`recoverWetFromPremultiplied` in `fluids.ts`. Both twins call it (260925-iy6 one-seam shape — they cannot drift):

- **Every pixel is written.** The `a > 0.5` gate is gone. No stale colour/opacity beside freshly-written alpha. This is the actual fix: always-write keeps premul consistent across ticks, so the `1/a` amplifier never gets an inconsistent pair to blow up.
- **`inv = 1/sqrt(a² + ε²)`** with `ε = 0.01` wet-density units — smooth in `a`, exact `premul/a` for every visible pixel (ε sits five orders under the ~2882 body plateau and two under the dimmest fringe that clears the ink floor of 40), capping the near-zero gain at 1/ε.
- **Continuous, multiplicative, no cutoff** (260928-dh1 hard rule).

### Fix pins (same file, GREEN against the fix)

| # | pin | verdict |
|---|---|---|
| R1 | identity preserved for `a >= 0.2` | GREEN |
| R2 | no stale pair — both 0.4 and 0.6 pixels written, same recovery | GREEN |
| R3 | 30% a-wobble → 0 clamped speckle pixels | GREEN |
| R5 | source shape: `if (a > 0.5)` gone, `invA = 1.0 / a` gone, one seam × 2 call sites | GREEN |

### Parked (follow-up lever, not this pass)

- **P1** `wetDisplayAlpha` 0.90 hard branch (two formulas, paper modulation silently skipped at `po >= 0.90`) — real measured defect, moves `bodyHardJumps` not `tornEdge`.
- **P2** `compositeWetLayer`'s `po < 0.001` skip — real, but removing it would show MORE pixels.
- Both needed before the pressure-driven spec is judged at partial opacity.

### Rejected again

- **Display despeckle (3×3 median)** — eats the 0.4–2.2px / alpha 0.015–0.06 bristle traces, which ARE the spec's "traces un peu transparente". Also P6b shows the halo is in the input, so a display filter only hides a dirty field the deferred physics button would compound.

### Lever 1 status

Code + pins landed. **Automated-ready.** The live four-seam re-run is the confirmation that `tornEdge` drops at post-display — native UAT stays deferred until lever 2 also lands (acceptance needs BOTH). Lever 2 (body speckle at post-raster, `paint.ts` 37 × `fillFlat` + real Canvas2D AA) stays queued and is not blocked.

## Move 2 pin — extraction is CLEAN (the torn contour is real)

**User call 2026-09-28:** one pin, no fix. Push a CLEAN synthetic dry layer (ideal AA edge, zero speckle) through the REAL `EfxPaintEngine.copyLiveAlphaCanvas` / dry-minus-background and read `tornEdge`. Discriminator: thousands → the ~12 200 post-display `tornEdge` is an ARTIFACT of the extraction and everything folds into lever 2; clean → the remaining interval suspects are real advection and `dryStep`'s `paperHeight` term. Do NOT write a third directed fix before this pin returns.

Pin: `packages/efx-physic-paint/src/engine/copyLiveExtractionTornEdge.test.ts` (4/4). Input control scored `tornEdge = 0` before extraction, so the field really is clean.

| cell | branch | tornEdge | bodyHardJumps | isolatedPx |
|---|---|---|---|---|
| clean AA over paper | background-subtraction | **0** | 0 | 0 |
| paint-only AA ramp | separated | **0** | 0 | 0 |
| paint-only AA ramp | background-subtraction | **0** | 0 | 0 |
| input (pre-extraction) | — | **0** | 0 | 0 |

**VERDICT: CLEAN.** The extraction is exonerated. `copyLiveAlphaCanvas` / dry-minus-background does not manufacture tears from a clean input, in either branch. The ~12 200 post-display `tornEdge` is therefore a REAL defect that arrives already formed at the extraction input. Per the call, the remaining interval suspects are real advection and `dryStep`'s `paperHeight` term — **decide on evidence, no third directed fix written.**

## Lever 2 measure-first — REFUTED: the 37 × `fillFlat` layering is not the manufacturer

**User call 2026-09-28:** code lever 2 (`paint.ts`) now — but measure first, same discipline: pin the 37 × `fillFlat` layering against a single equivalent fill on the 260924-pyp substrate, and **prove the AA layering manufactures the `bodyHardJumps` before changing it. Then the fix.**

Pin: `packages/efx-physic-paint/src/brush/paint.layeringBodyJumps.test.ts` (1/1 measurement). Same deformN ribbon geometry in every cell (the comparison isolates the layering, not the shape). Mass comparable across cells (±2%). Bristles dropped (`stroke = no-op`) so the `fillFlat` schedule is the only contributor.

| cell | what it is | tornEdge | bodyHardJumps | bodyHfEnergy | alphaMass |
|---|---|---|---|---|---|
| SINGLE | one `fillFlat` of the fixed ribbon polygon at `alpha = 1` | 21 | **148** | 41 003 | 546 336 |
| STACKED_SAME | 37 × 0.08 + 7 × 0.02 of that SAME polygon | 26 | **94** | 23 100 | 546 069 |
| STACKED_DEFORM | the production schedule with per-layer `deformScaled` | 27 | **100** | 24 205 | 546 211 |
| PRODUCTION | real `createPaintStrokeRasterContinuation`, bristles dropped | 19 | **114** | 27 757 | 548 830 |

**VERDICT: REFUTED.**

1. The 37 × `fillFlat` layering does **NOT** manufacture `bodyHardJumps`. A single fill scores **more** (148) than the 37 + 7 stack (100) and more than the real continuation (114). Stacking the same coverage field is smooth source-over; per-layer deform adds only +6 over identical-path stacking. If anything the stack *reduces* the jumps versus one fill.
2. The jumps are already in the SINGLE fill of the deformN ribbon: the AA edge of a wiggly polygon at ink-floor 4 counts concave AA pockets as interior hard jumps (`isInterior` accepts any neighbour `>= 4`, so a 1px AA ramp of 255→26 with a fully-enclosed fringe pixel is a `bodyHardJumps` pair).
3. The 260924-pyp analytic AA **under-counts** real Canvas2D AA: live four-seam post-raster `bodyHardJumps` was **654** (heavy-slow), analytic PRODUCTION is **114**. This substrate cannot reproduce the live 654 and cannot prove a manufacturer that lives in real AA.

**The paint.ts fix was NOT written.** The measure-first entry required proof before changing the code, and the proof failed. `paint.ts` stays untouched. A fix now would be a fourth directed change aimed at a mechanism the pixels just refuted.

### What the refutation leaves standing

- **The visible defect is still real and still at post-raster** (live heavy-slow `bodyHardJumps` 654 / `tornEdge` 33 before any physics). Its manufacturer is NOT the 37 × `fillFlat` schedule.
- Candidates the pin did **not** isolate: real Canvas2D AA itself (the pyp substitute under-counts 114 vs 654), the bristle pass (dropped in this pin), and the deformN ribbon's concave AA pockets (already present in SINGLE — but `260927-ton` width-scaled deformN is KEEP UNCHANGED).
- The gate-field diagnosis independently reports **BOTH FIELDS CLEAN at the gate** (`isolatedBefore = 0`, `isolatedAfter = 0`) with bristle tier-straddling confirmed (4 pixels) — a third refutation of "the deposit path sprays salt-and-pepper at the raster/gate seam".
- Torn-contour interval suspects after Move 2's CLEAN verdict: real advection and `dryStep`'s `paperHeight` term. Not opened.

## Recalibration record (Task 2)

`physicsWidthScaling`, `productionAaSettleMeasurement`, `physicsSettledFootprint`, `paint.continuation` — **all green at EXISTING bounds** (W1–W7, PIN 0/0b, envelope ≤ 8, texture d(b) ≥ 1, texture-at-Spread-80). Zero exact-value pins shifted → no re-records performed. No behavioral law bounds edited.

## Behavior pins (Task 2, commit `05a92f77` red → `3815e307`/`9c4b6581` green)

| # | pin | at base | now |
|---|---|---|---|
| 1 | bristleSeed determinism (byte-identical op logs per `mutationId`+curve) | FAIL | GREEN |
| 2 | containment (every bristle vertex within local ribbon half-width incl. endTaper) | FAIL | GREEN |
| 3 | drying continuity (proportional transfer at `sa` below 0.005; no `pixelOpacity < 0.99` cliff) | FAIL | GREEN |
| 4 | fbm shape noise pressure-scaled (v11 limit #2) | FAIL | GREEN |
| 5 | pressure-dependent deformation variance, light/heavy ≤ 0.35 (v11 limit #1; was 0.473) | FAIL | GREEN |
| 6 | pressure/velocity ordering (light < heavy; heavy-fast < heavy-slow) | pass | GREEN |
| 7 | grainRemoval stays green | pass | GREEN |
| 8 | continuation parity | pass | GREEN |

## Resolved open questions

- `DRY_ALPHA_THRESHOLD = 1` stays as the dry-state machine cutoff; only the `sa > 0.005` transfer gates went continuous.
- Tier-70 survival is decided by harness rows, with trace build-up in `paint.ts` as the only lever (`wet-layer.ts` is read-only).

## Regression battery (2026-09-28, after move 1 + move 2 pins)

| gate | result |
|---|---|
| Package vitest (`packages/efx-physic-paint`) | 30 files / 214 passed / 3 skipped / 0 failed |
| App vitest (`app`) | 234 files / 4336 passed / 1 skipped / 101 todo / 0 failed |
| Package `npm run check` (`tsc --noEmit`) | clean |
| App `npm run typecheck` (`tsc --noEmit`) | clean |
| New pins | `compositor.displayMapping.test.ts` 7/7, `fluids.premulRoundTrip.test.ts` 5/5, `depositSpeckleCapture.metrics.test.ts` 14/14, `copyLiveExtractionTornEdge.test.ts` 4/4, `paint.layeringBodyJumps.test.ts` 1/1 (measurement) |
| Existing law pins | `physicsWidthScaling` W1–W7, `physicsSettledFootprint` PIN 0/0b, `productionAaSettleMeasurement`, `drying.continuity`, `fluids.continuation` — **all green at EXISTING bounds** |
| Scope gate | `fluids.ts` (lever 1, copy-back only — COMMITTED `c8a7a073`); 2 new measurement pins (this pass). `paint.ts` **untouched** (measure-first refuted). |
| Locked surfaces touched | **none** — `wet-layer.ts`, `compositor.ts` (production), `paint.ts`, `drying.ts`, app UI, package.json ×3, pnpm-lock all untouched |
| `savedWet` / `startPhysics` / `stopPhysics` | only **call sites** in `depositSpeckleCapture.ts` (Task 1 harness drives the apply-physics clicks). No semantics change. |

Any failure would have been reported as NEW (user-mandated posture). None occurred.

## Commits

| sha | subject |
|---|---|
| `329051f1` | `test(260928-dh1): deposit speckle capture harness + DEV hook (measure-first)` |
| `05a92f77` | `test(260928-dh1): RED — bristleSeed + drying continuity behavior pins` |
| `3815e307` | `feat(260928-dh1): seeded deposit-time bristle pass — single trace generator` |
| `9c4b6581` | `fix(260928-dh1): de-hardcut drying — continuous proportional transfer` |
| `c8a7a073` | `fix(260928-dh1): lever 1 — shared premul recovery kills the a>0.5 stale pair` |

## Native visual UAT (pending — the oracle for the look)

**Blocked.** Acceptance is only met when the defect the user sees is gone and judged on native UAT. Lever 1 (premul recovery) landed but does not move the visible surface on its own. Lever 2's claimed manufacturer (37 × `fillFlat` layering) is REFUTED — `paint.ts` was not changed. The live four-seam re-run after lever 1 is a re-measure, not UAT.

| id | row | verdict |
|---|---|---|
| a | zero isolated pixels at stroke edges in the final render | pending (lever 2) |
| b | falloff continuous, no salt-and-pepper at 0/1/2/3 clicks | pending (lever 2) |
| c | traces fine, contained, semi-transparent, following gesture direction | pending |
| d | light pressure clearly lighter than heavy | pending |
| e | fast stroke clearly more depleted than slow | pending |
| f | regression 260925-iy6 paper tooth unchanged | pending |
| g | regression 260924-stb / 260925-b7c / 260925-dso / 260927-ton unchanged | pending |
| h | Apply/Clear button semantics unchanged (`savedWet` deferred) | pending |

Artifacts for UAT: `/tmp/efx-dh1/red/` vs `/tmp/efx-dh1/green/` (5 PNGs each, zoom 4) and the two manifests in `/tmp/efx-stall-capture-dh1-{red,green}.json`.
