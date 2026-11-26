---
phase: 261125-kvl
plan: 01
subsystem: watercolor-engine / stroke-layer-transparency
tags: [webgl2, watercolor, gouache, edge-transparency, stroke-layer, band-mix, probe-gate, studio-parity]

# Dependency graph
requires:
  - phase: 261124-ujb
    provides: the Spec 10 record/param plumbing decisions and the profile-identity gate pattern (2e-4 rows, digest-drift evidence)
  - phase: spike-006
    provides: the frozen encoder (8 compiled bands, rank-one Jacobian, 4-iteration LM cap, seed mix), the amount-0 bypass law and the known reuse rules
provides:
  - a per-stroke translucent stroke layer for Edge transparency on bristle brush strokes (lazy allocation, deposit routing, stroke-end merge)
  - the stroke-end band-mix merge with the frozen encoder and a copy-back over the merge rect (never a swap)
  - the live display branch (displayLayerFS) while a layer is open; every export still binds the shipped displayFS
  - the probe `edge-layer` scenario, its pre-change amount-0 baseline and the amount-keyed comparator invariants
  - the measured memory, k, print-retention, polish and merge-submission figures
  - an automated-ready gate ladder and the ten live UAT rows handed to the artist
affects: [64-medium-engine, Edge transparency UAT, any future layer work (capture/cache/bake contracts stay unchanged)]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized diff)
actuals:
  tokens: 81460
  tasks: 6
  commits: 6
plan_head_before: d3a88748dfccbc8e0afe9e7091568799bd5ae2fc
plan_head_after: e8b0f4467bf5a313522a3fbe85a8a11843e77dd6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-stroke layer set (ink double RGBA16F, film [R16F,R16F], relief R16F, mergeRelief R16F) allocated lazily on the first Edge-active bristle stroke and forgotten on every document recreate"
    - "Amount 0 is a branch, never a value: openLayer's predicate keeps ensureLayer unreachable and the merge uncalled at edgeFade 0"
    - "The merge is scissored to the stroke's rect and copies ink.write→ink.read, cover.write→cover.read, mergeRelief→relief back over that rect only"
    - "New programs only: displayLayerFS is separate; displayFS is emitted byte-identically from displaySource(false); struct Gathered is never widened"
    - "Probe memory accounting from live target texture counts × live dims × Engine.ensureLayer's declared strides (WebGL2 has no per-level format query)"

key-files:
  created:
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/spectral.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/emboss.test.ts
    - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
    - packages/efx-watercolor/src/playground/shaders.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/mediumSelection.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts

key-decisions:
  - "Amount 0 bypasses the layer structurally: no layer target, no merge draw, no clear — proven by counters (layerAllocated false, mergeDraws 0) and byte-identical to the pre-change baseline"
  - "The frozen encoder is used verbatim: 8 compiled bands [1,3,5,7,9,10,11,13], A_eff = A·cover_L, rank-one Jacobian, 4 LM iterations hard cap, seed mix(base, layer, aEff); uniforms limited to amount/start/falloff/maxIter; no tuning parameters"
  - "The merge target is built on the display-domain (polished) states and written as ink = fit/k − fixed — the storage-domain form of the frozen fit − fixed"
  - "The live display shows the band mix through a separate displayLayerFS bound only when the render target is null and a layer is open; exports never see the layer samplers"
  - "Every stroke-abandon path discards the layer (clear, resetSheet, abortStroke, travel, restore, resizeDocument) and every document recreate nulls the layer fields before freeing targets; discardLayer is idempotent"
  - "Probe memory is measured as live texture count × live dims × declared stride (40 B/px total) because WebGL2 exposes no texture-format query; the five allocations are pinned in source by coverageLifecycle.test.ts"
  - "The k range is measured on the live paper bytes, never re-derived (edgeKMin/edgeKMax added in Task 6 after the ladder; the four amount-100 operands were re-run and are digest-identical)"

patterns-established:
  - "One-shot per-stroke layer with a stroke-end merge inside the stroke's own undo transaction, hooked once at processInput's ending branch before this.stroke = null"
  - "Amount-keyed comparator invariants: at edgeAmount 0 only the identity block runs; at > 0 every named studio row is required and missing rows fail by name"
  - "REPORTED-not-barred measurements (polish settle, print retention) carried in the capture with the bar documented beside them, so UAT judges the visual result instead of a hidden threshold"

requirements-completed: [EDGE-IDENTITY, EDGE-CONTINUITY, EDGE-GLAZE, EDGE-FALLOFF, EDGE-PARITY, SPEC10-PLUMBING, G1, G2, G3, G4, G5]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Per-stroke layer set with deposit routing and the stroke-end band-mix merge, committed once inside the stroke's own undo transaction"
    requirement: "EDGE-PARITY"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverageLifecycle.test.ts (36 pins: open sites, predicate, ensureLayer allocations, ending-branch order, discard idempotency, recreate nulling, docTargets membership)"
        status: pass
      - kind: integration
        ref: "probe/medium-engine: edge-layer-g15-f50 + --other repeat; G1/G2 studio rows (mergeDraws 1, callback after commit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live display branch shows the frozen band mix while the layer is open; exports stay the shipped displayFS"
    requirement: "EDGE-PARITY"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/shaders.test.ts (displayFS byte identity, displayLayerFS tuple identity, 23-program literal pin)"
        status: pass
      - kind: integration
        ref: "probe/medium-engine: --falloff-sweep (encoder residual max 1/255, p95 1/255, 0 over; linearHalfOnWhite <= 1/255; core 0; continuity 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Amount 0 is a structural bypass and reproduces the pre-change bytes"
    requirement: "EDGE-IDENTITY"
    verification:
      - kind: automated_ui
        ref: "run.mjs --gate edge-layer-neutral + compare.mjs --edge-structural + compare.mjs baseline (digests 6a3bf13c/d91a6e5e/0c0522e2/f7caca0a, identical; layerAllocated false, mergeDraws 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Falloff 0/50/100 strictly orders the midpoint alpha broad < linear < rim on both sides while cover_L is falloff-independent"
    requirement: "EDGE-FALLOFF"
    verification:
      - kind: integration
        ref: "compare.mjs --falloff-sweep: paper 0.3168 < 0.5113 < 0.7051; under 0.3547 < 0.5586 < 0.747"
        status: pass
    human_judgment: false
  - id: D5
    description: "Over a same-visit under-stroke the faded band is a between-mix (glaze) with no pale fringe or washed-out mark"
    requirement: "EDGE-GLAZE"
    verification:
      - kind: integration
        ref: "edge-layer scenario invariant on every capture: continuity 0/0 both sides, under-side midAlpha 0.3547/0.5586/0.747 recovered through the committed sheet, encoder residual within bar"
        status: pass
    human_judgment: false
  - id: D6
    description: "Spec 10 parameter plumbing: canonical amount/falloff records, Engine Params, visibility and the two Gouache-only rows"
    requirement: "SPEC10-PLUMBING"
    verification:
      - kind: unit
        ref: "params.test.ts, mediums.test.ts, bristles.test.ts, aquarelleParamVisibility.test.ts, mediumSelection.test.ts, brushGroupMedium.test.ts, AquarelleGlobalsPanel.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Screen/scripted/bake strokes commit exactly once at stroke end; undo/redo and every interruption leave the sheet intact; memory measured at 1080²/2048²/4K"
    requirement: "G1"
    verification:
      - kind: integration
        ref: "probe studio rows: G1 pointer (draws 6→7, callback after commit), G2 adapter (merge 1), replay identical, undo/redo 0 texels, interruption rows keyed, memory 44.49 MiB @ 1080² / 160 MiB @ 2048² / 160.16 MiB at the 2049² clamp"
        status: pass
    human_judgment: false
  - id: D8
    description: "The ten live UAT rows handed to the artist — visual judgment of translucency, falloff distribution, seams, scale, wet/pickup, bristle gaps and interruption"
    requirement:
    verification: []
    human_judgment: true
    rationale: "The rows are perceptual: band smoothness, glaze colour survival, seams at caps/rim under Feather 0/85, band scaling by brush, the bristle-gap character and the settle on leave/reopen. No headless probe can judge them; they are listed verbatim and none is claimed."

# Metrics
duration: 130min
completed: 2026-11-25
status: complete
---

# Phase 261125-kvl Plan 01: Per-stroke translucent stroke layer (Edge transparency) Summary

**A Gouache/Pen bristle stroke now paints into its own lazy per-stroke layer and composites once at stroke end through the spike-006 frozen band-mix encoder, so the paper or the under-stroke shows through the edge in its own colour while the core keeps the layer's full paint — with amount 0 proven byte-identical to the pre-change baseline and every Studio path (pointer, scripted, bake, undo/redo, interruption, reopen) held to the same contract.**

## Performance

- **Duration:** ~130 min (commit span 16:20 → 18:30 on 2026-11-25; earlier planning not measured)
- **Tasks:** 6/6
- **Commits:** 6 (measured from the plan ledger `d3a88748d..HEAD`)
- **Files:** 24 code files changed (1 added, 23 modified); no dependency added

## Accomplishments

1. **Task 1 (be7f56bbb)** — added the `edge-layer` probe scenario, the amount-keyed comparator invariants (`--falloff-sweep`, `--edge-structural`, `--other`), the harness process pins and the PRE-change amount-0 baseline `baselines/edge-layer-neutral.json`. The gate existed before the source moved.
2. **Task 2 (5e07724e5)** — Spec 10 plumbing: canonical `edge`/`falloff` (Edge transparency / Rim falloff) records through `toEngineParams` into Engine `Params`, the sixteen-key records, visibility rules and the two Gouache-only rows. Inert at edgeFade 0.
3. **Task 3 (244a82a22)** — the tracer: lazy layer targets, deposit routing into the layer set, the stroke-end band-mix merge with the frozen encoder, and the copy-back over the merge rect. One straight amount-100 stroke over paper allocates, routes, merges once and commits.
4. **Task 4 (bbd946b77)** — the live display branch: `displayLayerFS` mixes the band values of the polished sheet and layer states; `displayFS` is emitted byte-identically from `displaySource(false)`; exports never bind the layer. Live-vs-merged parity measured at every falloff; `edgePolishDelta` measured and reported.
5. **Task 5 (71bcbe251)** — Studio parity: live pointer drive (G1), adapter applyStroke (G2), bake replay (G3), amount-0 structural rows (G4), the same-visit summed-base scene (G5), undo/redo exactness, every interruption path, and the memory budget at 1080²/2048²/4K.
6. **Task 6 (e8b0f4467)** — the full gate suite and the probe ladder, the measured k range, and the ten UAT rows handed to the artist. Ends automated-ready.

## G1–G5 rows (each decided by the ladder's captures)

- **G1 — live pointer stroke:** PASS. `edgeG1MergeDraws` 1, `edgeG1CallbackCount` 1, `edgeG1LayerOpenAtCallback` false (the callback fires after the commit), `edgeG1LayerClosed` true, draws before 6 / at callback 7, sheet peak 1 (and 1 at the callback); the 1×1 readHalf fence ran after the settle.
- **G2 — adapter applyStroke (scripted Studio path):** PASS. `edgeG2MergeDraws` 1, `edgeG2SheetPeak` 1, `edgeG2LayerClosed` true.
- **G3 — bake replay:** PASS. `edgeReplaySelfIdentical` true, `edgeReplayIdentical` true, `edgeReplayMaxDelta` 0, `edgeReplayDiffTexels` 0 (byte-identical at amount 100; the bar allowed 2/255).
- **G4 — amount 0 structural:** PASS. `layerAllocated` false, `mergeDraws` 0, `mergeDrawsFirst` 0; the neutral capture is digest-identical to the pre-change baseline: paper `6a3bf13c`, transparent `d91a6e5e`, white `0c0522e2`, pigment `f7caca0a` (zero drift; profile rows within 2e-4). Note on the plan's headline digest `36a3f71d`: that digest belongs to the spike's Q4 scene (paper `cold`, seed `0xc0ffee`); the `edge-layer` scenario's pre-change baseline is the committed `baselines/edge-layer-neutral.json` captured in Task 1 on the pre-change tree, and the amount-0 run reproduces it byte-for-byte — the digest-drift mechanism reports no drift because there is none.
- **G5 — the merge's base is the summed sheet:** PASS. The same-visit under-stroke side is recovered through the committed sheet with stroke A already merged in: under-side `midAlpha` 0.3547 / 0.5586 / 0.747 at falloff 0/50/100, paper-side 0.3168 / 0.5113 / 0.7051; continuity 0/0; paper core exact 0/255. Under-side `coreExact` is absent (`null`) because no under-side station reached the layer-cover ≥ 0.999 exact-endpoint set — reported as absent, not fabricated as 0. No `edge-layer-g15*` baseline exists or was created; the invariant runs on every capture and in every comparator mode.

## Gate results (verbatim)

### Task 5 ladder — all PASS

```
run.mjs --gate edge-layer-g15-f0   --edge 100 --falloff 0   -> layer true | merge draws 1 (first 1)
  sweep midAlpha paper 0.3168 / under 0.3547 | core 0 / absent | continuity 0 / 0
  encode max 1 | p95 1 | over 0 (1/255) | linearHalfOnWhite 0.3558
  polish max 25 | p95 2 | over 5502 (2/255, REPORTED) | round trip true | replay identical true | print 0 / 0.2869
run.mjs --gate edge-layer-g15-f50   -> midAlpha 0.5113 / 0.5586; encode 1/1/0; half 0.3805; polish 25/3/6962; print 0 / 0.4344
run.mjs --gate edge-layer-g15-f100  -> midAlpha 0.7051 / 0.747;  encode 1/1/0; half 0.3031; polish 25/3/9353; print 0 / 0.5492
run.mjs --gate edge-layer-g15-r2    -> digest-identical to g15-f50 (b2e8d809 / 8c3f1f24 / 30787681 / 20d91c3e)
compare.mjs edge-layer-g15-f0 --falloff-sweep g15-f50 g15-f100
  RESULT: PASS — strict mid-alpha ordering broad < linear < rim on both sides, falloff-independent cover_L
compare.mjs edge-layer-g15-f50 --other edge-layer-g15-r2
  RESULT: PASS — all 12 fields equal and the scenario invariants hold
run.mjs --gate edge-layer-neutral --edge 0 --falloff 50
  amount 0 | layer false | merge draws 0 | digests 6a3bf13c / d91a6e5e / 0c0522e2 / f7caca0a
compare.mjs edge-layer-neutral --edge-structural
  RESULT: PASS — the structural relation holds
compare.mjs edge-layer-neutral
  RESULT: PASS — all 12 fields equal and the scenario invariants hold (vs the pre-change baseline)
pnpm --dir packages/efx-watercolor exec vitest run
  Test Files 43 passed (43) | Tests 1075 passed | 8 skipped (1083)
```

Extra required capture (memory action): `--gate edge-layer-mem-1080 --size 1080 --edge 100 --falloff 50` — layer true, merge 1, memory `[1080,1080]` 44.49 MiB @ 40 B/px, encode 2/0/0, polish 23/3/4389, print 0 / 0.3906.

### Task 6 ladder

```
pnpm --dir packages/efx-watercolor exec vitest run  -> 43 files, 1075 passed, 8 skipped  PASS
pnpm --dir packages/efx-watercolor build           -> build success                          PASS
pnpm --dir app exec vitest run                     -> see the app-vitest note below (NOT fully green)
pnpm --dir app exec tsc --noEmit                   -> exit 0                                PASS
pnpm --dir packages/efx-watercolor check           -> tsc --noEmit exit 0                   PASS
run.mjs --gate edge-layer-neutral (+ --edge-structural + baseline) -> PASS (second process; digests identical)
run.mjs --gate edge-layer-a100-f0 / -f50 / -f100 / -f50-r2          -> ran, all rows present
compare.mjs edge-layer-a100-f0 --falloff-sweep a100-f50 a100-f100   -> PASS strict ordering both sides
compare.mjs edge-layer-a100-f50 --other edge-layer-a100-f50-r2      -> PASS all 12 fields + studio rows equal
```

**App vitest, reported honestly:** the full-suite command does not exit 0 in this environment. Across four full-suite runs, three failed with exactly one failing test in `src/lib/physicPaintBridge.test.ts > 63-05 brush-tip realm channels` — two different individual tests across runs (`catalog pull > removes its one-shot listener when no receiver answers (bounded wait)` timed out at 20000 ms; `import round trip through the main realm > answers with the same operationId ...` failed at 15311 ms). The same file passes in isolation: 186 passed, 1 skipped, 2.4 s. No file changed by this plan participates in that bridge suite; the failure is a load-sensitive, pre-existing test (its own 20 s bounded wait collides with vitest's 20 s default under parallel load). It is logged in `deferred-items.md` and was not modified — out of scope for this quick.

### Task 6 extended suite order note

`pnpm --dir packages/efx-watercolor check` was run after the app gates as the plan's action requires; it passed both before and after the k-field addition. The package vitest suite was re-run after that addition: still 1075 passed / 8 skipped.

## Recorded numbers (Task 6)

- **Encoder residual** (merged sheet decoded band vs the live band mix computed from the read-back layer + sheet, through the display's own k, in 1/255): **max 1, p95 1, over 0** at falloff 0 / 50 / 100 over both sides; at 1080² falloff 50: max 2, p95 0, over 0. Bar: max ≤ 2/255, p95 ≤ 1/255, zero over — met.
- **linearHalfOnWhite** (50 %-over-white, linear light, 1/255): **0.3558** (f0) / **0.3805** (f50) / **0.3031** (f100) / **0.3269** (1080² f50). Bar ≤ 1/255 (spike measured 0.08/255) — met.
- **edgePolishDelta** (REPORTED, never barred): max **25/255**, p95 **2/255** (f0) and **3/255** (f50, f100; pooled both sides), texels over 2/255 **5502 / 6962 / 9353**; 1080² f50: 23 / 3 / 4389. The p95 of 3/255 at f50/f100 is over the 2/255 attention line and is reported as such. The plan's raw-state fallback was measured in Task 4 and did not shrink the settle (recorded in bbd946b77 and in probe.ts's polish comment); its exact figures were not persisted as capture fields — only the shipped polish rows are in every capture. UAT row 6 judges the settle.
- **The merge's k range:** **[0.8487, 1.1311]** over both visited rects, measured on the live paper bytes, identical at every falloff and in every process. Provenance: the display's granulation step `gran = 1 + uGranulation·(0.5 − paper.g)·2.2` with `uGranulation = params.granulation·0.55 = 0.275` (the record's granulation 50 → engine 0.5); the merge writes `ink = fit/k − fixed`, the storage-domain form of the frozen `fit − fixed`. The spike digest `3170f21b` is **NOT** applicable verbatim to this scene.
- **Per-station print retention** (layer print share at the silhouette station, a share in [0,1] — reported, not barred; the comparator's note says the reverted film law's 95–96 % floors do not transfer): paper **0** at every falloff; under **0.2869** (f0) / **0.4344** (f50) / **0.5492** (f100), and **0.3906** at 1080² f50. The across-profile carries all 281 stations per side.
- **Falloff ordering:** paper **0.3168 < 0.5113 < 0.7051**, under **0.3547 < 0.5586 < 0.747** (f0 < f50 < f100), strict on both sides; the layer's `cover_L` rows are identical across falloffs within 1/255 (the deposit does not read the falloff).
- **Memory (layer set + mergeRelief, 40 B/px):** 1080² = **44.49 MiB** (46,656,000 B: ink 2×18.66 MB + film 4.67 MB + relief 2×2.33 MB); 2048² = **160 MiB** (167,772,160 B); the engine 4K clamp `clampDocSize(4096,4096)` = **[2049,2049]** → **160.16 MiB**; a raw 4096² sheet would be **640 MiB** but is unreachable (MAX_DOC_LONG 3072 / MAX_DOC_PIXELS 4.2 M). The plan's DESIGN figure of ~250 MB at 4K assumed 22 B/px; the measured figure is **40 B/px** — flagged for the artist, not a gate.
- **Merge cost at 2K:** **0.1–0.2 ms** CPU submission per scissored merge inside the instrumented window (max 0.2 ms; G1's instrumentation times only the merge draw calls). GPU completion is not fenced in that window — the following capture readback syncs outside it — so this is a submission-time floor, not a felt frame. The spike's frozen **~21 ms** was a *felt* 2K frame over a 1.45 M-texel stroke rect including sync and the full encoder work; no like-for-like felt measurement of the shipped merge was taken by this probe, so no claim is made that the shipped merge meets that budget. The real number is recorded above.
- **Two pre-existing engine facts left untouched (reuse rules, not defects):**
  1. *Stroke-start lastDir/lastAngle carry* — `scriptBegin` seeds the first dab from the previous stroke's end direction and `resetSheet()` clears neither (Engine.ts:1494 / :2791). Replays must pin `lastDir = [1,0]`, `lastAngle = 0` (the probe's `pinStrokeStart`); without it a fresh-visit vs reset replay differed by 187/255 over 3759 texels at 512² with no layer involved.
  2. *Capture-bbox drift* — `captureSheet`'s crop is the `everPainted` bbox and drifts by a band at the edges between in-process replays (7 px at 540², 16–17 px at 2K; the extra band carries no paint; cause untraced). Compare display bytes or the union, never two differently cropped arrays. The 2K visit crop covers the whole 2048² sheet, so its digests are comparable — which is why the ladder's cross-process comparisons use the visit crops.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The probe's memory row cannot query texture formats in WebGL2**
- **Found during:** Task 5 (first gate run died with `level.getTexLevelParameter is not a function`)
- **Issue:** The initial implementation queried the driver for each texture's internal format; WebGL2 exposes no `getTexLevelParameter` (lib.dom.d.ts correctly omits it).
- **Fix:** Reworked the measurement to live target texture count × live dimensions × Engine.ensureLayer's declared strides (`EDGE_LAYER_INK_STRIDE = 8`, `EDGE_LAYER_FILM_STRIDE = 2`, `EDGE_LAYER_RELIEF_STRIDE = 2` → 40 B/px), documented in the helper; the five allocations are already source-pinned by coverageLifecycle.test.ts. The comparator then asserts targets-sum === layerBytes.
- **Files modified:** probe/medium-engine/probe.ts
- **Commit:** 71bcbe251

**2. [Rule 1 - Bug] mergeTimes was scoped inside the edge-layer branch but read by the report outside it**
- **Found during:** Task 5 wiring
- **Fix:** Hoisted `mergeTimes` to function scope beside `edgeMergeDeltas`; the report reads the visit's own timings before any replay or studio merge.
- **Files modified:** probe/medium-engine/probe.ts
- **Commit:** 71bcbe251

**3. [Rule 1 - Bug] Three new coverageLifecycle pins were anchored on wrong literals**
- **Found during:** Task 5 test authoring (36/36 after correction)
- **Fix:** Pointerdown slice ends at `this.pushSample(e);` (the beginStep literal was the slice start); the discard guard's closing brace is searched as `\n    }` (the first `}` belongs to `const { g } = this;`); both ink halves are cleared, so the pinned count is 2.
- **Files modified:** coverageLifecycle.test.ts
- **Commit:** 71bcbe251

**4. [Rule 1 - Bug] The SUMMARY's required k range was not emitted by the probe**
- **Found during:** Task 6 while collecting the recorded numbers
- **Fix:** Added `edgeKMin`/`edgeKMax` to the report, measured from the already-built k array over both visited rects; re-ran the four amount-100 gates and both comparators — pixel digests unchanged, sweep and `--other` PASS, package suite green.
- **Files modified:** probe/medium-engine/probe.ts
- **Commit:** e8b0f4467

### Notes on planned files

- `packages/efx-watercolor/src/adapter/engineAdapter.ts` is listed in the plan but required no edit: the existing `applyStroke` path already reaches `processInput`'s ending branch, which is the single commit hook. Its behaviour is proven by G2 and the bake replay.
- No npm/pip/cargo dependency was added; the package-manager checkpoint does not apply.

## Issues / Deferred (out of scope, not fixed)

- **App vitest full-suite flake** — `src/lib/physicPaintBridge.test.ts` realm-channel suite, one timeout-shaped failure per full-suite run (3 of 4 runs; two different tests; file passes in isolation 186/1-skipped in 2.4 s). Unrelated to this diff; logged in `deferred-items.md`.
- **Polish settle over the attention line** — p95 3/255 at f50/f100 (line 2/255); reported, not barred by design; UAT row 6 judges.
- **Print retention below the design comment's 95–96 %** — measured 0 / 0.29–0.55 at the silhouette station; reported, not barred; UAT row 9 judges the gaps visually.
- **Memory assumption mismatch** — DESIGN 22 B/px vs measured 40 B/px (flagged above; not a gate).
- **Felt merge cost** — not measured by the headless probe; only CPU submission time is recorded.

## Known Stubs

None. No hardcoded empty values, placeholder text or unwired components were introduced by this plan.

## Threat surface

No new surface beyond the plan's threat model. The new shader code lives in new programs; `struct Gathered` is not widened, the 23-program literal pin holds, `displayFS` stays byte-identical (shaders.test.ts), the amount-0 path is a structural branch, and the layer lifecycle is pinned at every stroke-null and recreate site.

## Auth gates

None.

## Live UAT hand-off — for the artist, never claimed

Status: **automated-ready**. The following rows are handed over verbatim; none is marked passed. The live app is the judge of rows 2–10, and row 1 is backed by the automated baseline identity.

1. amount 0 identical to today's brush and watercolor unchanged;
2. amount 50 / 100, falloff 50 on paper — continuous stroke, smooth translucent edge, no banding;
3. amount 100 falloff 0 vs 100 side by side — visibly different distribution, the rim setting keeps the middle solid;
4. a stroke over another stroke (same visit and over a committed key) — the under-colour shows through the fade, no pale band, no white fringe, no holes;
5. Feather 0/85 x falloff 0/100 — no seam at the caps or the rim;
6. leave/reopen, forced re-render, Undo/Redo — identical;
7. Pen (small) and Gouache (large) — the band scales with the stroke;
8. the wet/pickup row — the layer's own wetness is not simulated (self-pickup and wet-on-wet drag within one stroke), pickup stays sheet-side;
9. the bristle-gap row — the base survives in the layer's own gaps (print retention 95-96 % at the band edge): no pale band in the gaps, the mark keeps its character;
10. mid-stroke interruption discards the layer — differs from today's partial-dab persistence.

## Deviations summary

Plan executed as written apart from the four auto-fixed implementation issues above. No architectural change, no sheet-format change, no uniform/global stroke opacity, no display-alpha change, no capture-merge/sheet-cache/bake-contract change.

## Code review (post-execution) — WR-01 and WR-02 closed

Two commits landed after this SUMMARY was first written, from the `--full` code review. Both are in-tree and re-verified.

**`55119b6b0` fix(261125-kvl): WR-01 stamp the merged region's last-touch at merge.**
The merge wrote ink, cover and relief but never `lastTouch`, while `bristleTouch` early-returns while a layer is open — so just-merged paint read as DRY (up to the week-dry sentinel) to the next stroke's pickup, contradicting the spike's own rule that a just-merged stroke is still wet. `mergeStrokeLayer` now runs ONE `bristleTouch` draw over the merge rect after the third pass, weighted by the merged cover, with the program's carry discipline intact. Undo-safety verified in code: every dab's prologue `touch(rect)` snapshots `lastTouch.read` as the fifth `snapshotLayers()` entry, and `layerRect` is the union of those dabs. Proven behaviourally, not lexically: the probe reads the last-touch R32F lane over the first merge's own rect, barring `after > before` at amount > 0 and both-null at amount 0 — measured `-604800 -> 0.05 s` in every amount>0 capture. Amount-0 export digests unchanged.

**`e940c5165` test(261125-kvl): WR-02 execute the Studio lifecycle bars on failing fixtures.**
The ~60 Studio lifecycle bars had no failing fixture, so a dropped or inverted bar (double merge, merge after callback, leaked layer, non-idempotent discard, wrong memory bytes) would have shipped green. `harness.test.ts` now mutates a valid row into an invalid one per bar and asserts the comparator rejects, plus one deleted-field case. No bar, threshold or number was weakened.

## Final gate suite (after both fixes)

| Gate | Result |
|---|---|
| `pnpm --dir packages/efx-watercolor exec vitest run` | 43 files, **1085 passed**, 8 skipped |
| `pnpm --dir packages/efx-watercolor build` | ESM + DTS success |
| `pnpm --dir packages/efx-watercolor check` | exit 0 |
| `pnpm --dir app exec vitest run` | 467 passed, 2 skipped — **fully green this run** (the known `physicPaintBridge` flake did not occur) |
| `pnpm --dir app exec tsc --noEmit` | exit 0 |
| `edge-layer-g15-f0/-f50/-f100` | PASS — midAlpha paper 0.3168/0.5113/0.7051, under 0.3547/0.5586/0.747; encode 1/1/0 each; core 0/255 |
| `edge-layer-g15-r2` replay | PASS — digest-identical to f50 (`b2e8d809/8c3f1f24/30787681/20d91c3e`) |
| `--falloff-sweep` | PASS — strict broad < linear < rim on both sides; cover_L falloff-independent |
| `edge-layer-neutral` + baseline + `--edge-structural` | PASS — digests `6a3bf13c/d91a6e5e/0c0522e2/f7caca0a`, layerAllocated false, mergeDraws 0, zero drift |
| `--other` determinism pair | PASS — all 12 fields equal |

## Verification (post-execution)

`261125-kvl-VERIFICATION.md` — status **`human_needed`**, **6/6 must-haves verified**. The verifier re-ran every measured bar on the current tree rather than trusting this SUMMARY: amount-0 identity byte-identical to the committed baseline, encoder residual max 1 p95 1 zero over, linear-light 50 % 0.3805/255, falloff ordering strict, G1–G5 individually passing, and the WR-01 last-touch stamp confirmed live. The 10 human rows above are the remaining work by design.

## Self-Check: PASSED

- Created files exist: `261125-kvl-SUMMARY.md`, `deferred-items.md`, `baselines/edge-layer-neutral.json`.
- All eight commits are ancestors of HEAD: be7f56bbb, 5e07724e5, 244a82a22, bbd946b77, 71bcbe251, e8b0f4467, 55119b6b0, e940c5165.
- No code left uncommitted (`git status` shows only the hook-modified PLAN/BEADS-RECALL and the untracked docs artifacts the orchestrator commits).

## Close-out — 2026-11-26 (UAT approved)

The artist approved the live surface on 2026-11-26 ("Its amazing work, you success!"). The shipped implementation is no longer the band-mix encoder described above: live UAT rejected the encoder's optical average on 2026-11-25 (pale/lavender fringe, no pickup, smoothed feather noise, rectangular patches) and the layer was rebuilt through five more commits:

- `16e3bda2a` — the coefficient-space composite: `film_out = mix(film_S, film_L, aEff)` stored as `ink = film − fixed`; the LM fit, band table, seed, k division and merge pre-blur are gone; the live display mixes a/b/scatter coefficients before the one shipped basis. Live = committed exact; amount 0 byte-identical.
- `4611dd030` — the layer's last-touch stamp: `bristleTouch` no longer early-returns while the layer is open, so the gather sees the paint the dab crosses. Pickup over dry settled under: 0.57 mix (was 0).
- `a484788f5` — one reusable `lateralWeight(u, amount, falloff) = 1 − amount·u^e`, e = 2^(2b − 1), u = 0 on the centre/action line and 1 at the visual edge, anchor `BRISTLE_LAYER_EDGE = 0.9`, no inner plateau. At amount 100 the near-opaque half-band is 0/4/15 px at falloff 0/50/100.
- `539160b0b` — the layer's smear arm returns the hash's mean (`uSmearSmooth`, layer-only; the sheet path keeps the shipped hash byte-identically), removing the stationary pickup mosaic.
- `9f8c0fe4a` — the layer's ink pair ping-pongs (`layerInkCarry`) and the deposit reads the LAYER's own previous film (±1.5 px 5-tap average) as the smear reference (the sheet only where the layer is empty); the layer's cover smear is suppressed. Probe: layer high-pass 0.0492 → 0.0131 (sheet 0.0126, pickup-0 0.0015); under-share 0.5255 → 0.3032; across-band chroma 0.214 at the centre → the under's 0.080 at the rim.

Final gates after `9f8c0fe4a`: package vitest 43 files / 1099 passed / 8 skipped; package tsc clean; app vitest 467 files / 9876 passed / 4 skipped / 96 todo; app tsc clean. Amount 0 at 2048 equals the committed `edge-layer-neutral` on all four digests (82374ed4 / 83f54524 / 8aad7f58 / 8a347e61); live-vs-committed encode p95 0/255 and polish p95 0/255 (lateral stations max 22); replay and capture round trip identical; reruns byte-identical. The cap quick `261125-rtc` (`e58497d3b`) is separate and remains closed.

Known residual carried to a new quick: a subtle white halo at the Feathered fringe on the layer path (Edge transparency on, noise Feather; the artist's green-over-blue screenshot, 2026-11-26). Mechanism to verify: the merge exchanges a fraction `aEff` of the under film against a layer film premultiplied by the gather's coverage, so at the fringe the under loses `O(a)` while the layer adds `O(a²)` — a local film minimum. Still recorded, not gated: the first-visit cached-base pickup residual (by design), the under-side cover drift 0.0363/0.0576, and the layer memory 40 B/px against DESIGN's 22 B/px. Nothing is pushed.
