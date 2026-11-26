---
phase: 261126-hgl
plan: 01
subsystem: paint engine / per-stroke layer compositing
tags: [webgl2, shader, probe, fringe, halo, stroke-layer, occupancy, presence, headless-chrome]
requires:
  - phase: 261125-kvl
    provides: the per-stroke translucent stroke layer (layerInk / layerFilm / layerRelief, merge inside the stroke's undo step)
  - phase: 261126-hgl (Task 1, commit 027a26a6d)
    provides: the --feather operand on the layer scenes and the edgeFringeDipPaper/Under readout on both lateral axes
provides:
  - "the artist's exact reproduction recipe as a probe scene: `edge-rim` (blue #1469e8 272 px Gouache wash, edge 0 / falloff 50; yellow #f9e01c 100 px Gouache stroke, feather 100, dry 0, pigment 100) with pickup / falloff / feather / edge operands"
  - "the rim instrument: lateral + tip profiles, lightness AND chroma, committed AND live, with the bare-under/core references, a 5-station box smooth and a >= 2-station coherent-run guard"
  - "the `--feather` operand on the layer scenes and the edgeFringeDipPaper/Under diagnostic readout on both lateral axes"
withdrawn:
  - "d14b986dc — occupancy-normalized layer film in the merge and displayLayerFS; moved the fringe <1/255 and cost a presence lane"
  - "0f19b29ff — occupancy-normalized pickup reference; closed the tip rim (46.68 -> 4.81/255) but lightened the lateral fringe (0.805 -> 0.880 at station -166 vs the sheet path's 0.786)"
  - "both withdrawn in a81d874d8; engine source is byte-identical to a96602803"
affects: [the fringe-halo re-plan — the probe now has the artist's exact surface, recipe and controls; no fix is shipped]
actuals:
  tokens: 33182
  tasks: 4
  commits: 6
tech-stack:
  added: []
  patterns:
    - "Occupancy normalization: the layer film is stored premultiplied by its union presence, so the composite weight is aEff / presence and the two weights total exactly 1"
    - "One shared snippet (STROKE_LAYER_ALPHA) carries layerPresence / layerFilmWeight to the merge, both union passes and the live display; the cover pass carries neither"
key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/shaders.test.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
key-decisions:
  - "The GREEN fringe bar is UNMET (7 of 9 under readings 1.32-11.21/255 > 1/255): the law is committed because it is correct and exact where it applies, and the run HALTS on the bar rather than widening it or adding a second law"
  - "Task 3 STOP (measured, no law): the layer arm reproduces a coherent rim (best 60.5/255, lateral light) but the --edge 0 sheet-path control reads 3.41 / 8.98 light and 9.93 / 21.70 chroma (bar 1/255), so on this scene/metric the rim is not attributable to the layer path — reported, not worked around"
  - "Instrument correction: the continuity envelope and the recovered mid alpha use L/presence (the merge's layer ENDPOINT), not aEff/presence (the merge weight) — the plan's item 8(f) literal instruction made all six captures fail continuity (77-92 stations); the corrected model returns continuity to 0/0 and midAlpha to strict ordering"
  - "status is `halted` at top level, not `complete`: the plan's own halt clause applies (the law genuinely cannot meet the bar) and HGL-LAW's fringe truth is not claimed"
  - "The ring is sheet-side: the law's largest per-station display change is 1.12-3.67/255 while the residual dip is 7.02-11.21/255; at the artist's dip station (offset +44, p100-f100) the law moves the display 97.3 -> 97.7/255 against a 7.02/255 dip"
  - "Task 4 (0f19b29ff): the one law closes the TIP on every arm (f100 46.68 -> 4.81, now BELOW the sheet's own 8.98) but the LATERAL parity bar stays unmet (light 54.56 / 32.63 / 9.36 vs the control's 3.41 at falloff 0/50/100). The flagged run sits at layer cover 0.9994 INSIDE the plateau (~35 px past the full-cover boundary), scales with the falloff bias while the sheet control is falloff-inert, and needs pickup (2.06 at pickup 0): it is the lateral weight's colour coupling, not the fringe reference dilution the law targets. A second law would be required — the run HALTS; the bar is not widened"
requirements-completed: [HGL-READOUT, HGL-IDENTITY, HGL-PARITY, HGL-DETERMINISM]
coverage:
  - id: D1
    description: "--feather rides the layer scenes; edgeFringeDipPaper/Under emitted on every layer capture (Task 1)"
    requirement: HGL-READOUT
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#accepts --feather on the two layer scenes and reads the fringe dip (261126-hgl)"
        status: pass
      - kind: integration
        ref: "six Task 1 captures + two falloff sweeps (both axes recorded on every capture)"
        status: pass
    human_judgment: false
  - id: D2
    description: "the occupancy-normalized law in the merge and the live display through one shared snippet; layerFilm attachment 0 RG16F (R = cover_L, G = presence); film accounted at 42 B/px"
    requirement: HGL-LAW
    verification:
      - kind: unit
        ref: "shaders.test.ts (law/endpoint/display pins), coverageLifecycle.test.ts (allocation literal), harness.test.ts (memory fixture 42 B/px, dip rejection)"
        status: pass
      - kind: integration
        ref: "nine layer captures: encode max 1 / p95 0 / over 0, continuity 0/0, core <= 1/255, midAlpha in range, cover rows, lateral saturation, solid band; amount-0 identity; determinism pair"
        status: pass
    human_judgment: false
  - id: D3
    description: "the law's purpose: edgeFringeDipPaper and edgeFringeDipUnder <= 1/255 on all nine layer captures (six artist cells + three record-feather cells)"
    requirement: HGL-LAW
    verification:
      - kind: integration
        ref: "nine GREEN captures + three falloff sweeps: 7 of 9 under readings over 1/255 (1.32 / 11.21 / 7.69 / 7.02 / 11.07 / 7.45 / 7.57); the only failure lines in every compare are the fringe bar"
        status: fail
      - kind: integration
        ref: "per-station diagnostic (hgl-diag*.json): presence = 1.000 in the plateau; at the artist's dip station presence 0.189, aEff 0.0395, law moves the display +0.49/255 vs a 7.02/255 dip"
        status: fail
    human_judgment: true
    rationale: "The law shipped and is internally exact, but it cannot remove the ring: the dip is the sheet's own committed under profile, not the premultiplied-film leak. Halted, not re-scoped."
  - id: D4
    description: "amount 0 byte-identical: four export digests equal the committed baseline with zero drift; structurally bypassed (no layer allocated, no merge draw)"
    requirement: HGL-IDENTITY
    verification:
      - kind: integration
        ref: "compare.mjs edge-layer-neutral: PASS, all 12 fields equal; --edge-structural: PASS (amount 0, layerAllocated false, mergeDraws 0, first 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "live/committed parity through the same shared snippet: edgeEncode max/p95/over within 2/1/0 and edgePolishP95 <= 1 on every capture"
    requirement: HGL-PARITY
    verification:
      - kind: integration
        ref: "nine captures: encode 1/0/0 everywhere; polish p95 0-1 everywhere"
        status: pass
    human_judgment: false
  - id: D6
    description: "two identical captures of the canonical recipe compare field-identical in --other mode"
    requirement: HGL-DETERMINISM
    verification:
      - kind: integration
        ref: "compare.mjs hgl-default --other hgl-default-r2: 0 differing fields, 0 missing fields (the pair's only failure line is the fringe invariant both captures share)"
        status: pass
    human_judgment: false
  - id: D7
    description: "the artist's green-over-blue recipe reads clean live and committed — handed over as a live UAT row, never claimed here"
    requirement: HGL-UAT
    verification: []
    human_judgment: true
    status: fail
    rationale: "No UAT row can be green: the committed fringe still reads 7.02-11.21/255 on the artist arm. The hand-off below records what the artist can confirm for the re-plan."
  - id: D8
    description: "the rim bar: every layer arm's eight rim readings (light/chroma x lateral/tip x committed/live) <= its same-recipe --edge 0 control + 1/255 at falloff 0/50/100 and pickup 0"
    requirement: HGL-LAW
    verification:
      - kind: integration
        ref: "rim2-p100-{f0,f50,f100} vs rim2-ctl-{f0,f50,f100} and rim2-p0-f100 vs rim2-ctl0-f100: 22 of 32 readings within the bar. TIP clean on every arm (4.89 / 4.80 / 4.81 light vs the control's 8.98; chroma 1.98 / 2.98 / 8.24 vs 21.70); pickup-0 arm clean 8/8. LATERAL over: light at f0 54.56, f50 32.63, f100 9.36 (bar 4.41); chroma at f0 49.96, f50 21.61 (bar 10.93) — committed and live alike"
        status: fail
    human_judgment: true
    rationale: "The rim bar is sheet-path parity by the plan's own re-scope. The tip half is met and improved; the lateral half is not reachable by the pickup-reference law — measured diagnosis in the Task 4 section. Halted, not re-scoped."
duration: 95min
completed: 2026-11-26
status: halted
plan_head_before: 741e40a1cb8953813c31fb355c03f5501a9ee483
plan_head_after: 0f19b29ff6a7874d1bbe75f88166b165a5587017
---

# Quick 261126-hgl: Fix the subtle white halo at the bristle fringe — Summary

**The ONE law shipped — the layer film now composites as `(1 - aEff)·F_S + aEff·(F_L / presence)` in the merge and the live display (presence lane, one shared snippet, 42 B/px) and is verified exact where it applies (encode 1/0/0, continuity 0/0, amount-0 byte-identical, determinism field-identical) — but the GREEN fringe bar is NOT met: the artist arm still reads 7.02–11.21/255 on the under axis (bar 1/255). The per-station diagnostic proves the ring is the sheet's own committed under profile, not the premultiplied-film leak, so the run HALTS at that bar with the law committed and the evidence handed to a re-plan.**

## Revision R1 (orchestrator, commit 3167c0c8d)

The Task 1 RED floor was re-scoped from the Pickup-0 control arm (halo-free by design, max 1.32/255) to the artist's Pickup-100 arm: RED = `edgeFringeDipUnder >= 3/255` → **MET** at 6.89–11.23/255. Task 1 was not re-run. The GREEN bars were left unchanged: both axes ≤ 1/255 on all nine layer captures. The halt below is NOT at the RED gate — it is at the GREEN fringe bar.

## Performance

- **Duration:** ~14 min (Task 1 ~6 min ending 027a26a6d; Task 2 ~8 min, captures 13:23–13:28 local, law committed 13:31:09 +01:00)
- **Started:** 2026-11-26T12:06:25Z (Task 1) — Task 2 window 12:23–12:31Z
- **Tasks:** 2 of 2 executed (Task 2 executed to its measured halt)
- **Files modified:** 8 (7 in the Task 2 commit, 3 in the Task 1 commit; probe.ts and harness.test.ts appear in both)

## RED — measured before the law (Task 1, commit 027a26a6d)

Feather 100 / Edge 100 / 2048², 1/255, committed display profile of each lateral axis:

| gate | pickup | falloff | edgeFringeDipPaper | edgeFringeDipUnder |
|---|---|---|---|---|
| hgl-p0-f0 | 0 | 0 | 0 | 0.16 |
| hgl-p0-f50 | 0 | 50 | 0 | 0.26 |
| hgl-p0-f100 | 0 | 100 | 0.69 | 1.32 |
| hgl-p100-f0 | 100 | 0 | 0 | **11.23** |
| hgl-p100-f50 | 100 | 50 | 0 | **7.73** |
| hgl-p100-f100 | 100 | 100 | 0.69 | **6.89** |

**RED verdict: MET** on the artist's arm (6.89–11.23/255). The Pickup-0 control stays ≤ 1.32 and is halo-free by design.

## GREEN — measured after the law (this run, commit d14b986dc)

Nine layer captures at 2048² / Edge 100 (six artist cells at `--feather 100` on pickup 0/100 × falloff 0/50/100, three record-feather cells with no `--feather`, i.e. Feather 85 / canonical pickup 100):

| gate | feather | pickup | falloff | edgeFringeDipPaper | edgeFringeDipUnder | under vs 1/255 bar |
|---|---|---|---|---|---|---|
| hgl-p0-f0 | 100 | 0 | 0 | 0 | 0.14 | ok |
| hgl-p0-f50 | 100 | 0 | 50 | 0 | 0.2 | ok |
| hgl-p0-f100 | 100 | 0 | 100 | 0.69 | 1.32 | **OVER** |
| hgl-p100-f0 | 100 | 100 | 0 | 0 | 11.21 | **OVER** |
| hgl-p100-f50 | 100 | 100 | 50 | 0 | 7.69 | **OVER** |
| hgl-p100-f100 | 100 | 100 | 100 | 0.69 | 7.02 | **OVER** |
| hgl-default-f0 | record 85 | default 100 | 0 | 0 | 11.07 | **OVER** |
| hgl-default | record 85 | default 100 | 50 | 0 | 7.45 | **OVER** |
| hgl-default-f100 | record 85 | default 100 | 100 | 0.69 | 7.57 | **OVER** |

**GREEN verdict: FAIL on the under axis — 7 of 9 captures over 1/255.** The paper axis is clean on every capture (0, 0, 0.69). The law did not worsen the Pickup-0 control (0.16 → 0.14, 0.26 → 0.20, 1.32 → 1.32) and left the artist arm unchanged within a display step (11.23 → 11.21, 7.73 → 7.69, 6.89 → 7.02). The exact assertion the plan prescribed printed `Error: 7 fringe-dip reading(s) over 1/255 — the ring survives the law`.

Record cells: `edgeFeatherControl` / `edgePickupControl` read `null` on the three `hgl-default-*` captures — the canonical defaults are pickup 100 (shader default) and the acrylic record's Feather 85, so those cells are on the artist's pickup arm. The six artist cells all record `edgeFeatherControl: 100` / `edgePickupControl: 0` or `100` as prescribed.

## The law as shipped (one law, one commit — d14b986dc)

1. **Presence lane.** `layerFilm` attachment 0 becomes RG16F; `bristleCoverLayerFS` writes `o0 = vec4(target, a, 0.0, a);` so R accumulates `cover_L` and G accumulates the deposit's union presence `1 - prod(1 - a_i)` under the same (ONE, ONE_MINUS_SRC_ALPHA) blend. The clear pass already zeroes both lanes.
2. **One shared snippet.** `STROKE_LAYER_ALPHA` declares `layerPresence(uv) = clamp(texture(uCoverL, uv).y, 0.0, 1.0)` and `layerFilmWeight(uv) = layerAEff(uv) / max(layerPresence(uv), 1e-4)`; the merge, both union passes and `displayLayerFS` carry it verbatim; the cover pass carries neither.
3. **Merge.** `float wl = layerFilmWeight(uv); oA = (inkA + fixedA) * (1.0 - aEff) + layerA * wl - fixedA;` with the B vec4 analog and the S floor. The two exact endpoints and both union passes are byte-identical on `layerAEff`. The two weights total exactly 1: the layer's storage is premultiplied by presence, so mixing `aEff / presence` of `F_L = presence · C` yields `aEff · C` — the sheet side keeps `1 - aEff` of its own film.
4. **Live display.** The same normalization in `displaySource(layer)`: `layerPresence = max(texture(uLayerCover, uv).y, 1e-4); layerW = layerAeff / layerPresence;` then the three coefficient lines with `layerW`. `reliefAt` / `coverRead` still use `layerAeff`; ONE reconstruction; the shipped `displayFS` carries no layer needle.
5. **Accounting.** The film is 6 B/texel (RG16F 4 + R16F 2); the layer set is 42 B/px; `Engine.ts` docstrings and the `coverageLifecycle.test.ts` allocation pin follow.

Where the law applies it is exact: the encode residual (committed bytes vs the pointwise normalized-mix prediction through the display's own k) reads max 1 / p95 0 / over 0 on all nine captures, and presence = 1.000 across the painted plateau makes the law byte-identical to the shipped mix there by construction.

## Why the bar is unmet — measured diagnosis

A temporary per-station diagnostic (reverted exactly after use; the captures remain at `/tmp/medium-engine/hgl-diag-p100f100.json`, `hgl-diag-p0f100.json`, `hgl-diag.json`, each row carrying `o / presence / cover / lat / aEff / f / darkOld / darkNew / darkCom / darkMeas`) measured why the law cannot close the ring:

- **Presence is 1.000 across the painted plateau on every arm** — the law is a literal no-op there.
- **At the artist's dip station** on `hgl-p100-f100` (offset +44 — the 1.5 % dark lane identified in Task 1: darkness 0.3825 vs 0.391–0.405 inside and 0.398–0.432 outside): presence 0.189, `cover_L` 0.174, `aEff` 0.0395. Normalization raises the layer's colour weight from 3.95 % to 20.9 %, but the layer's colour there is within half a display step of the under sheet's, so the committed display darkness moves 97.3 → 97.7/255 (**+0.49/255**) against a **7.02/255** dip.
- **Across all stations of all three diagnostic captures the law's largest display change is 1.12–3.67/255** (at the shoulder where `aEff` is largest); the ring it must remove is 7.02–11.21/255. The law is first-order too small by the measured margin.
- **Therefore the dip is the sheet's own committed under profile** — the under carrier shaped by the pickup laws (539160b0b / 9f8c0fe4a) and the under compositing — not the premultiplication leak the law removes. Those laws are explicitly out of scope, and a second law was forbidden; the run halts here with the numbers.

## Amount-0 identity (PASS)

`run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` then `compare.mjs edge-layer-neutral`:
four digests **82374ed4 / 83f54524 / 8aad7f58 / 8a347e61**, all 12 fields equal to `baselines/edge-layer-neutral.json`, zero drift. The new fringe fields read `null` at amount 0 (absent, never a fabricated zero). `--edge-structural`: **PASS** — amount 0, layerAllocated false, mergeDraws 0, first 0.

## Determinism (PASS as determinism)

`compare.mjs hgl-default --other hgl-default-r2`: **0 differing fields, 0 missing fields**, all four digests equal (including `digestTransparent 13278930`), every memory/lifecycle field equal. The pair's overall `RESULT: FAIL` is caused solely by the fringe scenario invariant both captures share (`edgeFringeDipUnder 7.45`), not by any instability. Every GREEN capture is also internally replay-identical: `edgeReplayDigest === edgeReplaySplitDigest === edgeReplayVisitDigest` and `edgeCaptureRoundTrip: true`.

## Parity and the pre-existing bars (PASS on every capture)

Encode is max/p95/over (bar 2/1/0); polish is max/p95 (p95 bar 1, max/over reported); continuity, core, midAlpha, midCover, coverHalf, coverReach, lateralSat, solid and print read paper/under.

| gate | encode | polish | continuity | core | midAlpha | midCover | coverHalf | coverReach | latSat | solid | print |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p0-f0 | 1/0/0 | 21/0 | 0/0 | null/null | 0.6307/0.4578 | 1/1 | 36/36 | 44/45 | 48/46 | 0/0 | 0/0.2623 |
| p0-f50 | 1/0/0 | 37/1 | 0/0 | 0/null | 0.8254/0.6193 | 1/1 | 36/36 | 44/45 | 48/46 | 4/4 | 0/0.5082 |
| p0-f100 | 1/0/0 | 58/1 | 0/0 | 0/1 | 0.9427/0.7801 | 1/1 | 36/36 | 44/45 | 48/46 | 15/15 | 0.8043/0.6721 |
| p100-f0 | 1/0/0 | 21/1 | 0/0 | null/null | 0.6307/0.4265 | 1/0.8228 | 36/37 | 44/46 | 48/47 | 0/0 | 0/0.2787 |
| p100-f50 | 1/0/0 | 37/1 | 0/0 | 0/null | 0.8254/0.591 | 1/0.8012 | 36/37 | 44/46 | 48/47 | 4/0 | 0/0.5164 |
| p100-f100 | 1/0/0 | 58/1 | 0/0 | 0/null | 0.9427/0.7605 | 1/0.8433 | 36/37 | 44/46 | 48/47 | 15/0 | 0.8043/0.5656 |
| default-f0 | 1/0/0 | 20/1 | 0/0 | null/null | 0.6307/0.4256 | 1/0.8227 | 39/40 | 44/46 | 48/49 | 0/0 | 0/0.2213 |
| default | 1/0/0 | 36/1 | 0/0 | 0/null | 0.8254/0.5896 | 1/0.8011 | 39/40 | 44/47 | 48/49 | 4/0 | 0/0.4754 |
| default-f100 | 1/0/0 | 57/1 | 0/0 | 0/null | 0.9427/0.7582 | 1/0.8411 | 39/40 | 44/47 | 48/49 | 15/0 | 0.6636/0.5656 |

No invariant line other than the fringe was printed by any compare or sweep. Additional sweep evidence (measured directly from the captures; the automated ordering block skips once the fringe bar fails):

- The layer's own paper `cover_L` rows are **identical** across the three falloffs on all three arms: 0.000000 max delta over all 281 stations per arm.
- `midAlpha` is strictly increasing broad < linear < rim on both sides on all three arms: paper 0.6307 / 0.8254 / 0.9427; under p0 0.4578 / 0.6193 / 0.7801, p100 0.4265 / 0.591 / 0.7605, default 0.4256 / 0.5896 / 0.7582.
- `solidHalfPaper` is strictly increasing 0 / 4 / 15 px on every arm. The under cover-row drift is the printed scene diagnostic (p0 0/0, p100 0.0789/0.1329, default 0.0681/0.1108 at 4 dp) — reported, not barred.

## Film memory (measured)

**42 B/texel**: layer set 168 MiB at 2048² (`layerInkRead` 64 + `layerInkWrite` 64 + `layerFilm` 24 + `layerRelief` 8 + `mergeRelief` 8 MiB = 176160768 B). 4K clamp row 168.16 MiB; raw 4096² 672 MiB. Merge cost 0.1–0.2 ms (max 0.2). The Task 1 pre-law 40 B/px row is retired.

## Gates

| Gate | Command | Result |
|---|---|---|
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | **PASS** — 43 files, 1102 passed, 8 skipped (re-run on the committed tree) |
| Package typecheck | `pnpm --dir packages/efx-watercolor check` | **PASS** — clean |
| App suite | `pnpm --dir app exec vitest run` | 1 failure in `src/lib/physicPaintBridge.test.ts` (20 s bounded-wait); that file passes in isolation (2.3 s) twice, a rerun fails a different test in it — load-induced flake in an unrelated bridge file, out of scope, documented not fixed |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | **PASS** — clean |
| Fringe bar (artist cells) | six captures at `--edge 100 --feather 100` + sweeps | **FAIL** — under 1.32 / 11.21 / 7.69 / 7.02; paper ≤ 0.69 |
| Fringe bar (record cells) | `hgl-default-f0` / `hgl-default` / `hgl-default-f100` | **FAIL** — under 11.07 / 7.45 / 7.57 |
| Amount-0 identity | `compare.mjs edge-layer-neutral` | **PASS** — 12 fields equal, four digests, zero drift |
| Amount-0 structural | `compare.mjs edge-layer-neutral --edge-structural` | **PASS** — layerAllocated false, mergeDraws 0, first 0 |
| Determinism | `compare.mjs hgl-default --other hgl-default-r2` | **PASS as determinism** — 0 differing / 0 missing fields; the pair's RESULT fails only the shared fringe invariant |
| Falloff sweeps | three `--falloff-sweep` runs | **FAIL solely on the fringe bar** — every other per-capture bar passed; the layer's paper cover rows are identical across falloffs |

## Files Created/Modified

- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/shaders.ts` — the law: presence functions in `STROKE_LAYER_ALPHA`, the merge mix, the display mix, the `vec4(target, a, 0.0, a)` write
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/shaders.test.ts` — the law/endpoint/display pins; ordering anchor moved to the normalized display mix
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts` — `[HALF_FLOAT_RG, HALF_FLOAT_R]` layerFilm, 42 B/px docstrings
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/coverageLifecycle.test.ts` — allocation literal pin
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/probe.ts` — presence readback, `edgeLayerFilmWeight`, normalized expectation kernel, 6 B/texel accounting (Task 1 also added the feather operand and the dip kernel)
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/run.mjs` — `--feather` on the layer scenes (Task 1)
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/compare.mjs` — `EDGE_FRINGE_DIP_MAX = 1`, the two required readings, the both-sides bar, the print line
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/harness.test.ts` — fringe fields, 42 B/px fixture, dip rejection test, law pins

## Decisions Made

- **Halt at the GREEN fringe bar.** The law is committed because it is correct and exact where it applies, and the ring is proven sheet-side with measured numbers; per the plan, no second law, no falloff/pickup retune, no bar widening.
- **Instrument correction (in-law):** the continuity envelope and recovered mid alpha use `L / presence` — the merge's layer ENDPOINT — not `aEff / presence`. The committed coefficients are a convex mix of the sheet film and the layer colour with weights `(1 - aEff, aEff)`; scaling the layer endpoint by the merge weight put it at `aEff · C`, a dimmer appearance than the committed output legitimately reaches. See Deviations.
- **`status: halted`.** Template rule #2830 marks a designed stop as `halted` (machine-read; dependents are not offered the plan). `complete` would assert a fringe truth that does not hold.
- **Record cells use the canonical defaults.** `hgl-default-*` carries no `--feather` / `--pickup`: pickup defaults to 100 (shader), Feather to the acrylic record's 85 — both on the artist's arm, as the plan specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan item 8(f) made the continuity envelope use the merge weight instead of the layer endpoint**
- **Found during:** Task 2, first nine-capture run after the literal implementation
- **Issue:** item 8(f) literally says compute `bands_l = edgeScaledBands(..., filmWeight)` with `filmWeight = aEff / presence` and use it for the continuity envelope and the recovered mid alpha. That encodes the layer endpoint as `aEff · C`, but the committed merge's layer endpoint is `C = L / presence` (the two weights total 1: `(1-aEff)·F_S + aEff·C`). Result: continuity failed on all six captures (77–92 stations per under profile) and the midAlpha ordering broke on the p100 arm — an instrument defect, not an engine defect.
- **Fix:** scale the normalized layer bands by `1 / presence` (the endpoint); keep `filmWeight` only for `edgeMixedBands` (the merge's true weights). This matches item 8(e) and the behavior bullet ("the continuity envelope and the recovered mid alpha use the NORMALIZED layer bands"); `coreExact` keeps the raw endpoint storage.
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/probe.ts`
- **Verification:** continuity back to 0/0 on all captures; midAlpha strict ordering restored on both sides of all three arms; encode 1/0/0.
- **Commit:** d14b986dc

### Designed stop (not a Rule 1-4 auto-fix)

**2. [Plan halt clause] The GREEN fringe bar is unmet — the law cannot remove the ring**
- **Found during:** Task 2, after the nine captures and the three-arm sweeps
- **Fact:** 7 of 9 under readings over 1/255 (artist arm 11.21 / 7.69 / 7.02; record cells 11.07 / 7.45 / 7.57; control f100 1.32). The law's largest display change anywhere is 1.12–3.67/255; at the artist's dip station it is +0.49/255.
- **Action:** the law is committed (it is exact and removes the premultiplication leak), the bar is kept at 1/255, and the run halts with the measured numbers. No second law, no retune.

**3. [Output-spec deviation] `status: halted` instead of `complete`; no automated-ready claim**
- **Reason:** the plan's done criteria explicitly include "at the artist's recipe the fringe dip is at most 1/255 on both axes", which does not hold. Per the halt clause and #2830, the summary records the halt; the RED gate is not the cause and R1's re-scope is met.

**4. [Scope] App-suite failure left unfixed**
- **Reason:** the failing test is in `src/lib/physicPaintBridge.test.ts`, unrelated to this plan's files, passes in isolation, and the failing test changes between runs — a load-induced flake. Scope boundary: documented, not fixed.

## Issues Encountered

- The premise of the law (premultiplied layer film → pale ring at the fringe) is real algebraically but second-order on this scene: presence is 1.000 in the plateau, and the ring lives where the sheet's own under film is lightest. The instrument is sound (the encode residual proves the committed bytes match the normalized-law prediction at every station; the feather operand was verified to reach the engine in Task 1), so the negative result is the finding, not a defect.
- The app-suite flake described above.

## Live UAT Hand-off (halt, not acceptance)

No fringe UAT row is green. For the re-plan, the artist can confirm on their machine:

1. The fringe halo appears with **Pickup 100** (probe: 7.02–11.21/255 on the under axis) and is absent with **Pickup 0** (≤ 1.32/255) — two green strokes over a different-colour under, Edge 100, noise Feather.
2. The live surface now uses the normalized mix through the same snippet, so live-vs-committed settle should be unchanged (polish p95 ≤ 1/255); the fringe band moves by at most ~1/255, so the live preview should look the same as before this change.

This is a re-plan input, not an acceptance claim.

## Next Phase Readiness

- **Shipped and stable:** the occupancy-normalized film is in the merge and the live display (one shared snippet), the presence lane is read back, the film is accounted at 42 B/px, amount 0 is byte-identical, and determinism is field-identical.
- **Blocker:** the fringe halo itself. The measured evidence says a re-plan must target the **sheet's own committed under profile** — the pickup laws' fringe dilution (539160b0b / 9f8c0fe4a) or the under carrier's `wetAt → pickup → load → body → coverage` chain — not the layer composite. Candidate first step: quantify the sheet-side under profile at the same six stations without the layer merge, then re-specify the RED floor on that surface before any second law is written.
- **Reusable instrument:** the nine gate names, `--feather` on the layer scenes, `edgeFringeDipPaper/Under`, and the 1/255 bar stay valid for the re-plan (the six artist captures can be re-run unchanged).

## Self-Check: PASSED

- Commit `d14b986dc` exists and is HEAD; 7 files, 289 insertions, 79 deletions — FOUND (`git show --stat`).
- Task 1 commit `027a26a6d` and the R1 docs commit `3167c0c8d` are ancestors of HEAD — FOUND.
- Nine GREEN captures, `hgl-default-r2`, `edge-layer-neutral` and the three diagnostic captures present under `/tmp/medium-engine` — FOUND.
- Package suite 43 files / 1102 passed / 8 skipped and package check clean, re-run on the committed tree — FOUND.

---

## Task 3 — the artist's surface (RED)

**STOP verdict: the layer path reproduces a coherent rim (best 60.5/255), but the `--edge 0` sheet-path control is NOT clean — 3.41 / 8.98 light and 9.93 / 21.70 chroma against the 1/255 control bar — so the plan's two-clause STOP gate fails on its control clause and the run STOPS here. The measurement work is kept and committed (`366c9fd0d`, probe files only); no law was started, no engine/shader/app surface changed, and the Task 2 occupancy law (`d14b986dc`) is untouched. The finding: on this recipe the probe's rim metric cannot attribute the coherent trough to the edge-transparency layer path — the sheet-path stroke over the same wash produces the same class of trough.**

### The recipe as run (user-pasted 2026-11-26 — exact)

| | background wash | foreground stroke |
|---|---|---|
| brush | `bristle-round` (Gouache) | `bristle-round` (Gouache) |
| colour | `#1469e8` (blue) | `#f9e01c` (yellow) |
| size | 272 | 100 |
| Pigment (`load`) | 100 | 100 |
| Pickup | 100 | 100 (and the 0 control) |
| Dry speed (`dry`) | 0 | 0 |
| Feather | 100 | 100 |
| Edge transparency (`edgeFade`) | 0 (sheet path) | 100 (and the 0 control) |
| Edge falloff (`edgeFalloff`) | 50 | swept 0 / 50 / 100 |

Both bags come from `bristleLineParams(100, size, { dry: 0, feather: 100, edge, falloff, pickup })` with `load: 100` set explicitly. The wash is a sheet-path stroke (edge 0 — no layer, no merge). The foreground is a SHORT stroke with a tip: uv (0.455,0.545) → (0.545,0.455), a ~250 px path drawn down-and-right inside the wash. Script points are normalized uv through the adapter; the export is opaque transmittance and flips rows. The two bands: **lateral** = stations along `p = (1,1)/√2` at mid-length (rows along `d`), −260..+260 px; **tip** = stations along `d = (1,−1)/√2` past the end cap (rows along `p`), −60..+430 px.

### The five captures (2048², sequential)

| gate | command operands | `edgeAmount` | `edgeFalloff` | `edgePickupControl` | `edgeFeatherControl` |
|---|---|---|---|---|---|
| rim-p100-f0 | `--pickup 100 --falloff 0` | 100 | 0 | 100 | 100 |
| rim-p100-f50 | `--pickup 100 --falloff 50` | 100 | 50 | 100 | 100 |
| rim-p100-f100 | `--pickup 100 --falloff 100` | 100 | 100 | 100 | 100 |
| rim-p0-f100 | `--pickup 0 --falloff 100` | 100 | 100 | 0 | 100 |
| rim-edge0 | `--edge 0 --pickup 100 --falloff 100` | 0 | 100 | 100 | 100 |

Every capture echoes its four operands, so a stale file fails by name. Captures under `/tmp/medium-engine/rim-*.json`, with each transparent export written beside it as `rim-*-transparent.png`.

### Every rim number (1/255; committed | live)

| gate | light lat C | light tip C | chroma lat C | chroma tip C | light lat L | light tip L | chroma lat L | chroma tip L |
|---|---|---|---|---|---|---|---|---|
| rim-p100-f0 | **60.36** | 15.65 | **54.59** | 1.76 | **60.5** | 16.04 | **54.68** | 1.82 |
| rim-p100-f50 | 32.3 | 34.52 | 22.31 | 8.56 | 32.37 | 35.12 | 22.35 | 8.42 |
| rim-p100-f100 | 10.58 | **46.68** | 5.79 | 17.19 | 10.5 | **46.7** | 5.75 | 16.29 |
| rim-p0-f100 | 2.06 | 12.55 | 9.99 | **44.71** | 2.12 | 9.28 | 9.99 | 35.46 |
| rim-edge0 (control) | 3.41 | 8.98 | 9.93 | 21.7 | null | null | null | null |

Live tracks committed within 0.9/255 on the three pickup-100 arms (largest gap: tip chroma 16.29 vs 17.19 at falloff 100). On the pickup-0 arm the live tip reads lower than the committed export: light 9.28 vs 12.55, chroma 35.46 vs 44.71. The control's live halves are null by construction (no layer, no live composite).

### Winning bands (5-station smoothed, >= 2-station run; station / run / bare-under / core / target)

Committed surface; the live bands land on the same station ±2 with runs ±3 (full arrays in the JSONs).

| gate | axis · channel | station | run | bare | core | target |
|---|---|---|---|---|---|---|
| rim-p100-f0 | lateral · light | −28 | 108 | 0.892 | 0.7741 | 0.7741 |
| rim-p100-f0 | lateral · chroma | −29 | 106 | 0.7879 | 0.4475 | 0.4475 |
| rim-p100-f0 | tip · light | 202 | 143 | 0.8925 | 0.6588 | 0.6588 |
| rim-p100-f0 | tip · chroma | 28 | 85 | 0.7702 | 0.3162 | 0.3162 |
| rim-p100-f50 | lateral · light | 36 | 105 | 0.8919 | 0.6735 | 0.6735 |
| rim-p100-f50 | lateral · chroma | −79 | 41 | 0.7879 | 0.3015 | 0.3015 |
| rim-p100-f50 | tip · light | 204 | 236 | 0.8925 | 0.6099 | 0.6099 |
| rim-p100-f50 | tip · chroma | 178 | 243 | 0.7702 | 0.2968 | 0.2968 |
| rim-p100-f100 | lateral · light | −111 | 25 | 0.8919 | 0.5855 | 0.5855 |
| rim-p100-f100 | lateral · chroma | −114 | 8 | 0.7878 | 0.2545 | 0.2545 |
| rim-p100-f100 | tip · light | 204 | 243 | 0.8925 | 0.6022 | 0.6022 |
| rim-p100-f100 | tip · chroma | 204 | 250 | 0.7702 | 0.3121 | 0.3121 |
| rim-p0-f100 | lateral · light | −137 | 7 | 0.8918 | 0.5535 | 0.5535 |
| rim-p0-f100 | lateral · chroma | −141 | 13 | 0.7892 | 0.2735 | 0.2735 |
| rim-p0-f100 | tip · light | 225 | 135 | 0.8924 | 0.7874 | 0.7874 |
| rim-p0-f100 | tip · chroma | 228 | 152 | 0.77 | 0.7297 | 0.7297 |
| rim-edge0 | lateral · light | −13 | 6 | 0.8908 | 0.5876 | 0.5876 |
| rim-edge0 | lateral · chroma | −68 | 7 | 0.7805 | 0.2979 | 0.2979 |
| rim-edge0 | tip · light | 130 | 180 | 0.8899 | 0.643 | 0.643 |
| rim-edge0 | tip · chroma | 176 | 261 | 0.7647 | 0.4237 | 0.4237 |

Core selection: the layer path's core station is the max-cover station (f0/f50/f100 lateral +75 with 120 bare stations, tip −53 with 170; p0-f100 lateral −133 / 133, tip −60 / 171); the sheet-path control has no layer, so its core is the geometric midpoint (0) and its bare window is geometric (lateral |station| >= 208, tip >= 400). Every sampled station carries a nonzero texel count; unsampled stations are null, never 0.

### The edge-0 control — why the gate fails

The control paints the same foreground stroke through the sheet path (edge 0): no layer, no edge fade, no live composite. It still reads coherent troughs on all four committed fields: light 3.41 (lateral, station −13, run 6) and 8.98 (tip, station 130, run 180); chroma 9.93 (lateral, station −68, run 7) and 21.70 (tip, station 176, run 261). Direct pixel sampling of the control's own PNG at the flagged stations confirms real paint (e.g. tip 130 = rgb(118,174,114), dark 0.5529, chroma 0.2353), and every station's texel count is nonzero — the troughs are the scene, not the instrument.

The tip chroma trough is not layer-specific at all: the control's 21.70/255 EXCEEDS the artist arm's 17.19 at the same falloff 100. The lateral bands are the reverse ordering (artist f0 54.59 vs control 9.93; artist f100 5.79 vs control 9.93 at chroma). The physical reading: the yellow/blue pigment boundary produces a low-chroma (muddy) crossing and a pale feathered tip on the sheet path as well, so the metric as specified flags both paths. Separating the layer's contribution from that sheet-side trough requires a re-spec (e.g. a same-geometry sheet-path baseline subtracted per station, or a layer-only control at identical deposit) — which is a Task 4/re-plan decision, not this executor's.

### STOP-gate verdict

- **Layer-path floor** (`rimLight >= 3` OR `rimChroma >= 3`, one axis/surface): **MET** — lateral light 60.36 / chroma 54.59 committed at falloff 0; 32.3 / 22.31 at falloff 50; tip light 46.68 at falloff 100; pickup-0 tip chroma 44.71.
- **Control clause** (every rim field <= 1/255): **FAILED** — 3.41 / 8.98 light, 9.93 / 21.70 chroma.
- The plan's `node -e` assertion exits 1 with `Error: sheet-path control reads 3.41/255 on edgeRimLightLateralCommitted — the rim is not layer-specific`.
- Per the gate: STOP, keep the measurement work, report every number. **No law was started; nothing was retuned to force the control clean.**

### Gates

| Gate | Command | Result |
|---|---|---|
| Five captures | sequential `run.mjs --scenario edge-rim ...` (2048²) | **PASS** — five JSONs + five transparent PNGs under `/tmp/medium-engine` |
| STOP-gate assertion | plan's `node -e` block | **FAIL** — sheet-path control 3.41/255 on `edgeRimLightLateralCommitted`, exit 1 |
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | **PASS** — 43 files, 1103 passed, 8 skipped (before and after the commit) |
| Package typecheck | `pnpm --dir packages/efx-watercolor check` | **PASS** — clean |
| Probe commit | `366c9fd0d` — 4 probe files, code only | **PASS** — no `.planning/` artifact, no engine/shader/app change |

### Deviations

**1. [Prompt] The plan has no `<revision id="R3">` block.** Only R2 (line 96) and R1 (line 108) exist in `261126-hgl-PLAN.md`; Task 3 was executed from its own text plus R2.

**2. [Rule 1 - Bug] The tip band's rect used a symmetric y window; the tip axis runs toward decreasing doc y.** A point is `centre + (a·X + b·Y)`: lateral is `X = p, Y = d` (symmetric bbox) but tip is `X = d, Y = p` (mirrored y). The symmetric form left every tip station past ~182 unsampled (pushed as fabricated 0.0000 readings while real paint sat unread — verified by decoding the emitted PNG). Fixed to `y ∈ [−aMax − rowHalf, −aMin + rowHalf]/√2`; stations now sample 70–169 texels each. Same commit.

**3. [Metric] The light target is `min(bare, core)` — R2's "lighter than BOTH" — not the bare-under-only formula in Task 3 line 306.** The plan's parenthetical ("the stroke is darker than the wash, so 'lighter than both' is 'lighter than the bare under'") is false for this pair: the yellow-over-blue composite core is LIGHTER than the blue wash (min-channel dark 0.532 vs 0.892), so a bare-only target flags the core itself (an earlier run of the same capture read 90.41/255 lateral committed). The control's light fields read 3.41 / 8.98 under the two-sided rule and would be far larger under the one-sided one — **the STOP verdict does not depend on this reading** (the chroma clause fails on the plan's own formula either way).

**4. [Instrument] Unsampled stations are NaN/null and never enter the metric.** The band reading skips zero-count stations in the references, the 5-station smoothing and the run scan, so a sampling hole can never read as a maximal rim.

**5. [STOP gate] The control clause fails — reported, not worked around.** No retune of the scene, no metric widening, no second law. The probe code is committed as the measurement instrument; the Task 2 occupancy law is untouched.

### Reading of the numbers (bounds of the claim)

- The artist arm's lateral band is strong and falloff-coherent (light 60.36 → 32.3 → 10.58; chroma 54.59 → 22.31 → 5.79 as falloff rises). The tip light band is strongest at falloff 100 (46.68); the pickup-0 arm is strongest on tip chroma (44.71).
- The control's 21.70 tip chroma exceeds the artist arm's 17.19 at the same falloff, and its 9.93 lateral chroma sits between the artist arm's 54.59 (falloff 0) and 5.79 (falloff 100).
- So the coherent trough exists (RED floor met), but this scene/metric cannot show it is produced by the edge-transparency layer path: the sheet-path stroke over the same wash reproduces the same class of trough.
- Live/committed parity is tight on the three pickup-100 arms (max gap 0.90/255, tip chroma at falloff 100). The pickup-0 arm's live tip reads materially lower than its committed export (light 9.28 vs 12.55, chroma 35.46 vs 44.71) — recorded as a measurement fact, not judged here.

### Self-Check (Task 3): PASSED

- Five captures present with their transparent PNGs (`/tmp/medium-engine/rim-{p100-f0,p100-f50,p100-f100,p0-f100,edge0}.json` + `-transparent.png`) — FOUND.
- Probe commit `366c9fd0d` exists and is HEAD; 4 probe files only, 738 insertions / 87 deletions, no `.planning/` artifact and no engine/shader/app change — FOUND.
- Plan-head ledger: `741e40a1c..HEAD` = 4 commits at Task 3's close (5 at Task 4's close, measured); `plan_head_before` / `plan_head_after` recorded above.
- Package suite 43 files / 1103 passed / 8 skipped and package typecheck clean, before and after the commit — FOUND.
- STOP-gate assertion re-run and failing on the control clause (exit 1) — FOUND.

## Task 4 — the law (GREEN)

**Verdict: HALTED at the rim bar — 22 of 32 parity readings pass.** The ONE law is implemented, pinned and committed (`0f19b29ff`); it closes the tip halo on every arm (now reading BELOW the accepted sheet's own residual) but leaves the lateral pale band over the bar. No second knob, no parameter retune, no bar widening. The measured numbers below are the deliverable.

### The Task 3 STOP-gate re-scope (why the bar is parity, not zero)

Task 3 halted because its control clause required `--edge 0` rim fields <= 1/255, and the control itself reads coherent troughs (light 3.41 lateral / 8.98 tip; chroma 9.93 / 21.70). That control is the artist's ACCEPTED Amount-0 surface — the same scene, colours, stroke and recipe minus the edge layer — and the yellow-over-blue crossing pales by construction. A zero-rim control cannot exist, so the Task 3 clause was unsatisfiable for any layer implementation. The plan's re-scope therefore makes the bar **sheet-path parity**: every layer reading <= its same-recipe `--edge 0` control + 1/255, per axis (lateral, tip) and per surface (Committed, Live). The control is the accepted baseline, not an absence of rim.

The pre-fix gap against that baseline is real and layer-specific: at falloff 100 the layer read 10.58 lateral / 46.68 tip light vs the control's 3.41 / 8.98; 60.36 lateral light at falloff 0; the lateral light rim is pickup-dependent (2.06 at pickup 0).

### The law as shipped (one law, one commit — 0f19b29ff)

Inside `bristleDepositFS`'s `if (uSmear > 0.0)` → `if (uSmearSmooth > 0.5)` branch only:

- **`uPrevPresence`** — `layerFilm` attachment 0's G lane (the union presence from Task 2), 5-tap averaged at the same ±1.5 px offsets as `uPrevA`/`uPrevB`; bound to texture unit 10 in `bristleLayerInk` beside units 8/9.
- **The reference is the layer's own film divided by its own occupancy:** `prevDen = max(prevPresence, 1e-4)`, `prevA = (5-tap uPrevA) / prevDen`, `prevB = (5-tap uPrevB) / prevDen`.
- **The sheet fallback is gated on landed presence:** `prevW = smoothstep(1e-6, 1e-3, prevPresence)`. Where the layer has landed, the reference is its own normalized colour at every occupancy; the raw sheet enters only at first contact, never at the feathered fringe. `prev2` (the absorbance-magnitude gate) is deleted.
- **Unchanged:** `snapB.a` stays the SHEET's (the wet/solid gate); the sheet path (`uSmearSmooth = 0`), the carrier's pickup, the Task 2 occupancy law, the presence G lane, the one deposit law, the falloff family, the end-density envelope, cap close-out `e58497d3b`, pickup laws `539160b0b` / `9f8c0fe4a`, and every UI surface.
- **At presence 1 the reference is byte-identical to the shipped one**; the tip's partial-coverage texels are where the law acts.

### The rim pairs (1/255; control = same-recipe `--edge 0`; control Live reads its Committed twin by construction)

**Arm p100 · falloff 0** — control `rim2-ctl-f0` (3.41 / 8.98 light, 9.93 / 21.70 chroma):

| axis · surface | layer committed | layer live | control | bar | verdict |
|---|---|---|---|---|---|
| lateral · light | 54.56 | 54.65 | 3.41 | 4.41 | **FAIL** +51.15 |
| tip · light | 4.89 | 4.88 | 8.98 | 9.98 | pass −4.09 |
| lateral · chroma | 49.96 | 50.08 | 9.93 | 10.93 | **FAIL** +40.03 |
| tip · chroma | 1.98 | 1.95 | 21.70 | 22.70 | pass −19.72 |

**Arm p100 · falloff 50** — control `rim2-ctl-f50` (same control readings; the sheet path is falloff-inert):

| axis · surface | layer committed | layer live | control | bar | verdict |
|---|---|---|---|---|---|
| lateral · light | 32.63 | 32.69 | 3.41 | 4.41 | **FAIL** +29.22 |
| tip · light | 4.80 | 4.85 | 8.98 | 9.98 | pass −4.18 |
| lateral · chroma | 21.61 | 21.60 | 9.93 | 10.93 | **FAIL** +11.68 |
| tip · chroma | 2.98 | 3.11 | 21.70 | 22.70 | pass −18.72 |

**Arm p100 · falloff 100** — control `rim2-ctl-f100`:

| axis · surface | layer committed | layer live | control | bar | verdict |
|---|---|---|---|---|---|
| lateral · light | 9.36 | 9.30 | 3.41 | 4.41 | **FAIL** +5.95 |
| tip · light | 4.81 | 4.84 | 8.98 | 9.98 | pass −4.17 |
| lateral · chroma | 5.45 | 5.49 | 9.93 | 10.93 | pass −4.48 |
| tip · chroma | 8.24 | 8.32 | 21.70 | 22.70 | pass −13.46 |

**Arm p0 · falloff 100** — control `rim2-ctl0-f100` (17.78 / 14.11 light, 59.51 / 47.59 chroma):

| axis · surface | layer committed | layer live | control | bar | verdict |
|---|---|---|---|---|---|
| lateral · light | 2.06 | 2.12 | 17.78 | 18.78 | pass −15.72 |
| tip · light | 12.55 | 9.28 | 14.11 | 15.11 | pass −1.56 |
| lateral · chroma | 9.99 | 9.99 | 59.51 | 60.51 | pass −49.52 |
| tip · chroma | 44.71 | 35.46 | 47.59 | 48.59 | pass −2.88 |

**22 of 32 readings within +1/255.** Every tip reading passes on every arm (12/12) and is BELOW the accepted sheet's own residual (tip light 4.80–4.89 vs the control's 8.98; tip chroma 1.95–8.32 vs 21.70). The pickup-0 arm passes 8/8. The 10 failures are all lateral: light at falloff 0/50/100 and chroma at falloff 0/50, committed and live alike.

### The closed gap (pre-law `rim-*` → post-law `rim2-*`, committed, same recipe echoes)

| arm | lat light | tip light | lat chroma | tip chroma |
|---|---|---|---|---|
| p100-f0 | 60.36 → 54.56 (−5.80) | 15.65 → 4.89 (−10.76) | 54.59 → 49.96 (−4.63) | 1.76 → 1.98 (+0.22) |
| p100-f50 | 32.30 → 32.63 (+0.33) | 34.52 → 4.80 (−29.72) | 22.31 → 21.61 (−0.70) | 8.56 → 2.98 (−5.58) |
| p100-f100 | 10.58 → 9.36 (−1.22) | 46.68 → 4.81 (−41.87) | 5.79 → 5.45 (−0.34) | 17.19 → 8.24 (−8.95) |
| p0-f100 | 2.06 → 2.06 (0) | 12.55 → 12.55 (0) | 9.99 → 9.99 (0) | 44.71 → 44.71 (0) |

The tip half of the artist's report is closed on every arm (largest single win 46.68 → 4.81 at falloff 100). The lateral half is not: it moves by at most 5.80 and is unchanged at pickup 0, where the law is inert (no smear term).

### Why the lateral band is out of this law's reach (measured)

- **The flagged lateral station sits at full layer coverage.** On `rim2-p100-f100` the light trough is station −110, run 27, with `cover_L` 0.9994 (the first cover ≥ 0.9 is at −147); on `rim2-p100-f0` it is station 10, run 107, cover 0.9994. The law acts only where the layer's presence is partial — the tip — and is literally the shipped reference where presence = 1.
- **The band's depth scales with the falloff knob and needs pickup:** lateral light 54.56 / 32.63 / 9.36 at falloff 0 / 50 / 100, and 2.06 at pickup 0. The sheet control is falloff-inert (3.41 at every falloff; falloff is an edge-layer knob and `--edge 0` has no layer). The pale band is therefore produced by the layer's falloff weighting mixing the sheet's own feathered body, not by the pickup reference.
- **The law changes the lateral profile substantially but not this band's depth:** per-station |Δdark| on the committed lateral profile averages 5.53/255 (worst 50.06/255 at station 149, in the stroke body), while the flagged depth moves by at most 5.80/255. A reference leak would move the trough itself.
- **Conclusion:** closing the lateral band requires changing the falloff weight's colour coupling (a second law, explicitly forbidden) or retuning the falloff/pickup family (also forbidden). The run halts with the numbers; the artist's left-edge observation stands as the re-plan target.

### Amount-0 identity (PASS)

`run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` then `compare.mjs edge-layer-neutral`: four digests **82374ed4 / 83f54524 / 8aad7f58 / 8a347e61**, all 12 fields equal to the committed baseline, **zero drift**. `--edge-structural`: **PASS** — amount 0, `layerAllocated false`, `mergeDraws 0`, `first 0`. The law has no amount-0 path.

### Determinism (PASS)

- `compare.mjs rim2-p100-f50 --other rim2-p100-f50-r2`: **0 differing fields, 0 missing fields**, all eight rim readings equal (32.63 / 4.8 / 21.61 / 2.98 / 32.69 / 4.85 / 21.6 / 3.11) and all four digests equal. The pair's overall `RESULT: FAIL` is solely the same lateral parity scenario invariant both captures share — the instability count is zero.
- `compare.mjs hgl-law-layer --other hgl-law-layer-r2` (extra `edge-layer` pair at Edge 100 / falloff 50 / feather 100): **PASS** — every compared field equal (the four digests, the core fields, and the full memory/lifecycle/G1/G2/undo/redo/abort/restore/resize/create state), scenario invariants hold (continuity 0/0, encode max 1 / p95 0 / over 0, polish p95 1, round trip true, replay identical true, max delta 0, diff texels 0). The pre-existing `edge-layer` bars stay green under the law.

### Film memory (measured — unchanged)

**42 B/texel layer set** (`layerInkRead` 64 + `layerInkWrite` 64 + `layerFilm` 24 + `layerRelief` 8 + `mergeRelief` 8 MiB = 176,160,768 B = 168 MiB at 2048²); `layerFilm` 6 B/texel (RG16F + R16F). The law adds no storage — the G lane and the RG16F format are Task 2's; texture unit 10 is free (the gather path binds 0–9; WebGL2 guarantees ≥ 16 units). 4K clamp 168.16 MiB, raw 4096² 672 MiB.

### Gates

| Gate | Command | Result |
|---|---|---|
| Package build | `pnpm --dir packages/efx-watercolor build` | **PASS** (rebuilt before the app gates; the engine/GLSL surface changed) |
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | **PASS** — 43 files, 1,111 passed, 8 skipped (includes the new law pins and the six executed rim-bar tests) |
| Package typecheck | `pnpm --dir packages/efx-watercolor check` | **PASS** — clean |
| App suite | `pnpm --dir app exec vitest run` | **PASS** — clean full re-run, 467 test files, 9,876 passed, 4 skipped, 96 todo; the first run's single `src/lib/physicPaintBridge.test.ts` failure is a load flake (see Deviations) |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | **PASS** — exit 0 |

### Captures (all 2048², sequential)

Eight rim captures — `rim2-p100-{f0,f50,f100}` (edge 100 / pickup 100 / falloff 0/50/100), `rim2-ctl-{f0,f50,f100}` (edge 0, same pickup/falloff), `rim2-p0-f100` (edge 100 / pickup 0 / falloff 100), `rim2-ctl0-f100` (edge 0 / pickup 0 / falloff 100) — plus the `rim2-p100-f50-r2` determinism twin, `edge-layer-neutral` (amount-0), and the `hgl-law-layer` / `hgl-law-layer-r2` pair. Every capture carries its recipe echoes (`edgeFeatherControl 100`, `edgePickupControl` 100/0, `edgeFalloff`, `edgeAmount`); the comparator fails by name on a missing or mismatched control.

### Live UAT hand-off (not an acceptance claim)

The fixture-level surface is measured; the artist's eye is the acceptance surface. On their machine, with the same blue wash:

1. **Pickup 100, Edge 100, noise Feather 100** — two yellow Gouache strokes: watch the **left lateral edge** live while painting. Measured expectation: the lateral pale band persists (9.36–54.56/255 over the sheet control at falloff 0/50/100) — this is the re-plan input, not a claimed fix.
2. **Same strokes, bottom tip** — the tip should read cleaner than before the law and at least as clean as an Edge-0 stroke (tip light 4.80–4.89/255 vs the sheet's 8.98; tip chroma 1.95–8.32 vs 21.70).
3. **Pickup 0 control** — the same two strokes with Pickup 0: halo-free by design (all eight readings below the same-recipe control), the artist's comparison arm.
4. **Live vs committed** — the live preview and the settled/committed render should match within a display step on both surfaces (polish p95 ≤ 1/255; committed vs live rim readings differ by at most 0.13/255 on the pickup-100 arms). The pickup-0 arm's live tip reads lower than its export (12.55 vs 9.28 light, 44.71 vs 35.46 chroma) — the same measurement fact recorded in Task 3, not a new regression.
5. **Amount 0** — with Edge 0 the document is byte-identical to the committed baseline (digests `82374ed4 / 83f54524 / 8aad7f58 / 8a347e61`) — no regression on the accepted surface.

No row is claimed green from this side.

### Deviations

**1. [Prompt] The plan has no `<revision id="R3">` block.** Only R2 (line 96) and R1 (line 108) exist in `261126-hgl-PLAN.md`; Task 4 was executed from its own text plus R2.

**2. [Instrument] Control Live readings are null by construction; the bar reads the control's Committed twin.** The `--edge 0` capture has no layer and no live composite, so `edgeRim*Live` is absent (null, never a fabricated zero) on every control. `edgeRimFailures` compares each layer Live field against the control's Committed field (the same number to 2 dp); the reason is documented at `EDGE_RIM_PARITY_MAX` and pinned in `harness.test.ts`.

**3. [Rule 3 - Blocking] Added the `rim2-ctl0-f100` capture.** The plan's capture list names `--pickup 0 --falloff 100` (layer) but the parity bar needs that arm's same-recipe control; without it `rim2-p0-f100` would fail "control is missing". The control reads stricter than the p100 controls (17.78 / 14.11 light, 59.51 / 47.59 chroma), so this enables the comparison without widening the bar.

**4. [Rule 3 - Blocking] `scattering.test.ts` pin updated in the same commit.** It pinned the retired `float prevW = smoothstep(1e-6, 1e-3, prev2);` line. Replaced with the presence-gate pin plus the new presence-uniform / divide / unit-10-bind pins and the `prev2` absence pin; the file is not in the plan's `<files>` list but the package gate cannot pass without it. No other test was weakened.

**5. [Instrument] `compare.mjs` gained a self-contained `edge-rim` baseline branch and an `--other` rim block.** No committed baseline covers a layer-active rim scene, so a rim gate compared "against baseline" now runs the parity relation and the alpha-law checks in place (exit by verdict) instead of failing on a missing baseline file. The `--other` block compares the eight rim fields (nulls included) so the determinism pair is judged on the readings, not just digests. `baselines/` was not touched.

**6. [App-suite flake] One load-induced failure in `src/lib/physicPaintBridge.test.ts` (WR-04) on the first full run.** The file passes in isolation (187 tests); a clean full re-run passed every test file (9,876 passed). Out of scope: documented, not fixed.

**7. [Bookkeeping] Frontmatter `actuals` corrected and completed.** `tokens: 33182` = 132,726 chars / 4 over the realized committed diff (`git diff 741e40a1c..HEAD`, 10 files, 1,602+/142−); `tasks: 4` (all four tasks executed); `commits: 5` measured via `git rev-list --count 741e40a1c..HEAD`; `duration: 95min` = 12:06:25Z (Task 1 start) → 13:41:36Z (final code commit); `plan_head_after` is the real full hash of `0f19b29ff`.

### Self-Check (Task 4): PASSED

- Code commit `0f19b29ff6a7874d1bbe75f88166b165a5587017` exists on `dev` (sequential, not protected); 6 files, 457 insertions / 12 deletions; post-commit deletion check empty; no `.planning/` artifact, no STATE/ROADMAP/WINDOWS/64-BEADS-RECALL change committed — FOUND.
- Eight rim captures + r2 twin + amount-0 + the edge-layer pair present under `/tmp/medium-engine` with their transparent PNGs — FOUND.
- Amount-0 identity: four digests equal, zero drift, structural bypass — FOUND (`compare.mjs edge-layer-neutral`, `--edge-structural`).
- Determinism: rim pair 0 differing / 0 missing fields; edge-layer pair PASS — FOUND.
- Four gates + package build: package build PASS, package suite 43 files / 1,111 passed / 8 skipped, package check clean, app suite clean re-run 9,876 passed, app tsc exit 0 — FOUND.
- Rim bar: 22/32 within +1/255; the 10 lateral failures reported, bar kept at 1/255, status `halted` — FOUND.

---

## OUTCOME (final, 2026-11-26) — both laws withdrawn on the user's call

Commit `a81d874d8` reverts `d14b986dc` and `0f19b29ff`. Engine source (`packages/efx-watercolor/src`) is byte-identical to `a96602803`; the shipped compositor, the deposit law, the falloff family, the cap close-out and the pickup laws are untouched. The two laws are retained only in history, with their measurements.

**Why.** On the artist's exact yellow-over-blue recipe the pickup-reference law closed the tip rim (46.68 → 4.81/255, below the sheet path's own 8.98) but lightened the lateral fringe: pre-law 0.805 → post-law 0.880 at station −166, against the sheet control's 0.786. It traded one surface for the other instead of removing the halo. The occupancy law from Task 2 moved the fringe by less than one display step, because `presence` saturates to 1.0 across the letterplate and the premultiplication leak lives only in a 1-3 px band at the extreme start/end.

**What the quick delivers (keep).**
1. The artist's exact recipe as a probe scene: `--scenario edge-rim` — blue `#1469e8` Gouache wash, 272 px, edge 0 / falloff 50, pickup 100, feather 100, dry 0, pigment 100; yellow `#f9e01c` Gouache stroke, 100 px, edge 100 / falloff 100, pickup 100 (and the 0 control), feather 100, dry 0, pigment 100.
2. The rim instrument: lateral and tip profiles; lightness and chroma; committed and live; references to the bare under and the core; 5-station smoothing and a >= 2-station coherent-run guard so the pickup mosaic is never the target.
3. The sheet-path control (`--edge 0`) as the artist's accepted Amount-0 baseline — the parity relation (`EDGE_RIM_PARITY_MAX = 1`) is the only meaningful layer bar, because the yellow-over-blue crossing pales by construction (control 3.41 lateral / 8.98 tip light at falloff 100).
4. `--feather` on the layer scenes and the `edgeFringeDip*` diagnostic (the red-over-blue `edge-layer` pair cannot judge the halo).

**Re-plan inputs (measured, not conclusions).**
- The lateral light rim is layer-specific and pickup-dependent: falloff 0/50/100 at pickup 100 reads 54.56 / 32.63 / 9.36 against the control's 3.41; pickup 0 at falloff 100 reads 2.06.
- The tip rim was the only surface the pickup-reference law fixed; the lateral band persists at full layer cover and scales with the falloff knob.
- The rim metric still needs one correction before it can be a bar: its winning run sits at station −110, ~100 px inside the stroke at cover 1.000 (a Gouache bristle-streak valley). The search must be restricted to the outer fringe band.
- The rendered surfaces for the artist: `/tmp/cmp-rim-p100-f100-big.png` (pre-law), `/tmp/cmp-rim2-p100-f100-big.png` (post-law), `/tmp/crop-rim2-ctl-f100-big.png` (sheet baseline).

**Status: halted.** No fix is claimed; the live UAT row is not offered. The next quick starts from the `edge-rim` scene and the corrected fringe-band metric.
