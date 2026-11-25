---
phase: quick-261125-kvl
verified: 2026-11-25T18:01:26Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-PLAN.md
  - .planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-SUMMARY.md
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
  - packages/efx-watercolor/src/playground/emboss.test.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/spectral.ts
covered_digest: "v4:sha256:fb329971caca2dfe6038a9cf27ac57f2b414a113bf4aa92a37c6d4abf6e7557a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT 1 — amount 0: paint with the shipped brush exactly as today (Edge transparency 0) and compare against the pre-change build"
    expected: "Identical result: same stroke, same watercolor behaviour, no visual difference"
    why_human: "Live-app visual comparison; the automated side is covered by the byte-identical baseline capture (digest equality and zero channel-row delta), but the shipping judgement is the artist's"
  - test: "UAT 2 — amount 50 / 100, falloff 50 on paper"
    expected: "Continuous stroke, smooth translucent edge, no banding"
    why_human: "Aesthetic judgement of the translucent band; probe measures continuity numerically but cannot judge banding"
  - test: "UAT 3 — amount 100, falloff 0 vs 100 side by side"
    expected: "Visibly different distribution; the rim setting keeps the middle solid"
    why_human: "Visual judgement of the falloff shape; the ordering itself is measured (broad < linear < rim)"
  - test: "UAT 4 — a stroke over another stroke (same visit and over a committed key)"
    expected: "The under-colour shows through the fade; no pale band, no white fringe, no holes"
    why_human: "Glaze-vs-wash judgement is a visual call; continuity (the envelope bar) is measured automatically"
  - test: "UAT 5 — Feather 0/85 x falloff 0/100"
    expected: "No seam at the caps or the rim"
    why_human: "Seam visibility is a visual judgement no capture resolves"
  - test: "UAT 6 — polish settle: a committed Edge stroke left to settle"
    expected: "The display's second film-blur settle is acceptable at p95 3/255 at f50/f100 (reported, not barred)"
    why_human: "The polish delta (max 25/255, p95 2-3/255) is deliberately REPORTED, not gated; the artist judges the settle"
  - test: "UAT 7 — Pen (small) and Gouache (large)"
    expected: "The band scales with the stroke"
    why_human: "Scale judgement at live stroke sizes"
  - test: "UAT 8 — the wet/pickup row"
    expected: "The layer's own wetness is not simulated (self-pickup and wet-on-wet drag within one stroke are out of scope); pickup stays sheet-side"
    why_human: "Declared scope behaviour; needs live confirmation of the documented limit. WR-01 made the post-commit read wet (merge last-touch stamped), which is now measured: -604800 -> 0.05 s"
  - test: "UAT 9 — the bristle-gap row"
    expected: "The base survives in the layer's own gaps: no pale band in the gaps, the mark keeps its character (print retention measured 0 paper-side / 0.29-0.55 under-side, reported, not barred)"
    why_human: "Visual judgement of the gaps; the retention numbers are reported beside the capture by design"
  - test: "UAT 10 — mid-stroke interruption"
    expected: "An interrupted Edge stroke discards the layer (no partial paint), differing from today's partial-dab persistence"
    why_human: "The discard is measured (abort sheet max 0), but the artist should confirm the felt behaviour matches the locked decision"
---

# Phase 261125-kvl: Per-stroke translucent stroke layer (Edge transparency) Verification Report

**Phase Goal:** Implement the per-stroke translucent stroke layer for Edge transparency exactly as frozen by spike 006 — engine targets, deposit routing, lateral field, stroke-end merge, live display branch, Studio wiring and the Spec 10 parameter plumbing — ending automated-ready with the live UAT rows handed to the artist and not claimed.
**Verified:** 2026-11-25T18:01:26Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All six must-have truths are verified against the current tree, including the two
post-SUMMARY commits (`55119b6b0` WR-01, `e940c5165` WR-02). Every measured bar was
re-run by this verifier on the current tree, not taken from the SUMMARY.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Amount 0: the two-stroke visit reproduces the shipped display bytes; every profile row within 2e-4 of the pre-change baseline; no layer target allocated; no merge draw; drift surfaced not hidden | VERIFIED | **Re-ran.** Fresh `edge-layer-neutral` capture (2048², edge 0): all 12 baseline fields equal, including all four digests (`6a3bf13c` / `d91a6e5e` / `0c0522e2` / `f7caca0a`) and `byteLength`; worst channel-row delta vs the committed pre-change baseline is **0** (stronger than 2e-4); offsets identical. `--edge-structural`: `layerAllocated false`, `mergeDraws 0`, `mergeDrawsFirst 0`. The drift mechanism exists (`digestDriftExempt`, drift printed never silently passed) and reports zero drift |
| 2 | Amount 100: the edge band is continuous (no holes, no pale fringe, no washed-out mark) and the core reads the layer's full paint at 0/255 through the encoder | VERIFIED | **Re-ran** (my own `edge-layer-a100-f50-v` capture): `edgeCoreExactPaper 0` (0/255), `edgeContinuityPaper 0`, `edgeContinuityUnder 0`; continuity is the [band_S, band_L] envelope bar that fails pale fringes and washed-out marks; cover at the mid station 0.8239 (paper) / 0.8465 (under) positive. Under-side `coreExact` is `null` and allowed: the scene's deposit never reaches `aEff >= 1 - 1e-4` there (`coreRunnable` rule; `debugMaxAeff*` reported, never a fabricated 0) |
| 3 | Over a same-visit under-stroke the faded band is a between-mix of both strokes' display bands — never paler than both, the under-stroke's hue survives (a glaze, not a wash) | VERIFIED | **Re-ran.** Under-side `edgeContinuityUnder 0` at falloff 0 / 50 / 100 (envelope holds: never outside the two band endpoints); under-side readings recovered through the committed sheet with the first stroke already merged (G5): midAlpha 0.3547 / 0.5586 / 0.747; print retention 0.4344 at f50, a measured share in [0,1] (reported, never a silent threshold). The glaze aesthetic itself is UAT row 4 |
| 4 | Falloff 0 / 50 / 100 strictly orders the band's midpoint alpha broad < linear < rim over paper and over a same-visit under-stroke, while the core keeps the layer's full paint exactly at every falloff | VERIFIED | **Re-ran** (`--falloff-sweep` on current-tree captures f0/f50/f100): paper **0.3168 < 0.5113 < 0.7051**, under **0.3547 < 0.5586 < 0.747**, strict, no tolerance; `edgeAcross.offsets` identical across all three and cover_L rows agree within 1/255 (the deposit does not read the falloff); each capture independently passed the amount-keyed bars, including `edgeCoreExactPaper 0` at every falloff |
| 5 | The merged sheet re-rendered through the real display matches the live composite's band values within the encoder bar (max <= 2/255, p95 <= 1/255, zero over); 50%-over-white LINEAR light <= 1/255; capture round trip byte-identical; same script twice byte-identical | VERIFIED | **Re-ran.** `edgeEncodeMax 1`, `edgeEncodeP95 1`, `edgeEncodeOver 0` (bars 2 / 1 / 0); `linearHalfOnWhite 0.3805 <= 1`; `edgeCaptureRoundTrip true`; `edgeReplaySelfIdentical true`, `edgeReplayIdentical true`, `edgeReplayMaxDelta 0`, `edgeReplayDiffTexels 0`. Determinism `--other` (my independent run vs the executor's capture): all 12 fields and all Studio rows equal |
| 6 | Pointer, scripted and bake strokes commit exactly once at stroke end inside the stroke's own undo transaction — including the first Edge-active stroke on a fresh engine; an interrupted stroke (key leave, tool switch, sheet reset, undo/redo, resize) discards the layer and leaves the sheet exactly as before the stroke | VERIFIED | **Re-ran** (probe rows + code): `edgeG1MergeDraws 1`, `callback x1`, `layerOpenAtCallback false`, sheet peak 1 at callback; `edgeG2MergeDraws 1`; undo/redo restore 0/0 texels and 0/0 outside; abort sheet max **0**, `edgeAbortWasOpen true`, `edgeAbortNextMerge 1`; undo-with-layer-open closed, next merge 1; restore / resize / create: fields null, allocated false, next merge 1, reallocated true; `edgeCreateDiscardIdempotent true`. Code: the single commit site is `processInput`'s ending branch (Engine.ts:3091 `commitLayer(s)` then :3092 `this.stroke = null`, before the callbacks); all six `this.stroke = null` sites are covered (four discard, two forget); `discardLayer()` clears only while open and resets unconditionally (idempotent, safe after `forgetLayer`); `createDocument`/`resizeDocument`/`applyWhole`/`restore` call `forgetLayer()` before disposal/allocation |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

Deviations noted, none affecting the verdict:

- The PLAN's literal digest `36a3f71d` belongs to the spike's Q4 scene (paper `cold`, seed
  `0xc0ffee`), not to the `edge-layer` scenario. The applicable reference is the committed
  pre-change baseline `baselines/edge-layer-neutral.json` (captured 25 Nov 16:16, before any
  source change), and the re-run reproduces it byte-for-byte. RESEARCH itself states digest
  equality is drift evidence, profile identity is the gate — no drift exists to report.
- The SUMMARY predates `55119b6b0` and `e940c5165`: both are in the tree and verified (WR-01
  stamp measured `-604800 -> 0.05 s`; WR-02 fixtures execute and the suite count is 1085 passed
  vs the SUMMARY's 1075 — the +10 WR-02 tests).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/src/playground/Engine.ts` | layer targets, routing, merge, display branch | VERIFIED | 4796 lines; layer fields :656-671, `layerTargets` :964, `layerStrokeActive` :980, `ensureLayer` :986, `openLayer` :1006, `discardLayer` :1028, `forgetLayer` :1042, `commitLayer` :1058, `bindLayerAlpha` :1070, `mergeStrokeLayer` :1125 (3 passes + copy-back + WR-01 stamp :1186-1209), recreate paths :1260/:1495/:2484/:2518/:2538/:2582, ending branch :3091, `bristleInk` guard :4087, `bristleLayerInk` :4220 |
| `packages/efx-watercolor/src/playground/shaders.ts` | frozen law, layer programs, displayLayerFS | VERIFIED | 2532 lines; `STROKE_LAYER_ALPHA` :1532, clear :1548, `bristleCoverLayerFS` :1568, `strokeLayerMergeFS` :1635 (8 bands, rank-one Jacobian, 4 LM iterations, seed mix, `x/k - fixed`), cover/relief passes :1854/:1865, `displaySource(false/true)` :2224-2517, `displayFS`/`displayLayerFS` :2524/:2532 |
| `packages/efx-watercolor/src/playground/spectral.ts` | band set + shared basis generator | VERIFIED | `STROKE_LAYER_BANDS = [1,3,5,7,9,10,11,13]` :158; `displayBandStatementsGLSL` shared by `displayBasisGLSL` and `displayBasisFnGLSL` |
| `packages/efx-watercolor/src/playground/bristles.ts` | edge constants + exponent law | VERIFIED | `BRISTLE_EDGE_START = 0.3` :279; `edgeFalloffExponent` :419 = `clamp(2^(2b-1), 0.5, 2)`, non-finite -> 1 |
| `packages/efx-watercolor/src/playground/params.ts` | canonical pair + 0..100 conversion | VERIFIED | fields :97/:103, defaults 0/50 :123-124, `toEngineParams` `clamp01(num/100)` :231-232 |
| `packages/efx-watercolor/src/playground/mediums.ts` | 16-key medium set | VERIFIED | `edgeFade`/`edgeFalloff` in the key union :54-55; watercolor derived :91-92; acrylic literal 0/50 |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | record fields, keys, defaults | VERIFIED | fields :124-125, keys :147-148, defaults 0/50 :169-170 |
| `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` | two rows in the edge group | VERIFIED | :177 Feather, :181 Edge transparency, :182 Edge falloff, group `'edge'`, `paint: BRISTLE_MEDIA` |
| `packages/efx-watercolor/probe/medium-engine/probe.ts` | edge-layer scenario + G1-I5 rows | VERIFIED | 5770 lines; readings :3140-3178, `edgeStudioRows` :3417-3690 drives the real seams (scriptBegin+queue+tick, applyStroke, abortStroke, undo, restore, resizeDocument, createDocument) |
| `packages/efx-watercolor/probe/medium-engine/compare.mjs` | amount-keyed bars + sweep + structural | VERIFIED | 2723 lines; `edgeIdentityFailures` 2e-4 :1349, `edgeLayerFailures` :1434, studio bars :1688-1876, WR-01 pair :1892-1930, structural :1942, sweep :2330-2466 (strict ordering both sides, offsets identical, cover within 1/255) |
| `packages/efx-watercolor/probe/medium-engine/run.mjs` | gate runner, `--edge`/`--falloff` gated to edge-layer | VERIFIED | scenario chain :337, operands :358/:374, outDir :263, headless Chrome :570-605 |
| `packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json` | pre-change baseline | VERIFIED | 21787 bytes, captured before any source change; reproduced byte-for-byte by the re-run |

No stubs: no `return null`-only paths, no placeholder text, no hardcoded-empty props in any changed file. The one deliberate early-return (`bristleTouch` while the layer is open) is covered by WR-01's merge stamp.

### Key Link Verification

The `gsd-tools query verify.key-links` heuristic cannot follow this plan's links (they are same-file behavioural relations described in prose, `from == to` in five of six cases; it reported "Target not referenced in source" for all six). Each was verified manually against the current tree:

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Engine.ts | Engine.ts | `bristleInk` routes to the layer and skips fixed attenuation / touch / erode | WIRED | :4087-4090 guard after the shared rect/snapshot bookkeeping returns into `bristleLayerInk` (:4220), which draws ink into `layerInk.read`, the two-attachment `bristleCoverLayerFS` into `layerFilm`, relief into `layerRelief`; fixed draw, `bristleTouch` and the relief erode are skipped on that branch |
| Engine.ts | Engine.ts | one `commitLayer()` in the `s.ending` branch before `this.stroke = null`, the single hook for pointer/scripted/bake | WIRED | :3091 `this.commitLayer(s)`; :3092 `this.stroke = null`; callbacks after; exactly one call site |
| Engine.ts | Engine.ts | merge writes ink.write/cover.write/mergeRelief then blits back into the read halves over the merge rect — never a swap | WIRED | blits :1182-1185 write->read; the only swap in the merge is WR-01's `lastTouch.swap()` :1208 (correct ping-pong discipline) |
| Engine.ts | shaders.ts | `drawDisplay` selects `displayLayerFS` only when the render target is null and a layer is open; exports bind the shipped `displayFS` | WIRED | `layerLive` :4658 = `target === null && layerOpen && layerInk !== null`; program choice :4660; layer uniforms bound only under `layerLive` :4714 |
| params.ts | Engine.ts | `edgeFade 0` keeps `ensureLayer()` unreachable — a branch, never a value | WIRED | `ensureLayer` called only from `openLayer` :1008; `openLayer` early-returns :1007 unless `layerStrokeActive` (:981 requires `params.edgeFade > 0`); `layerTargets()` returns `[]` unallocated; `commitLayer` early-returns while closed |
| Engine.ts | Engine.ts | `openLayer` at scriptBegin and the pointerdown site gated on the per-stroke predicate, never the sheet-sticky `bristleContent` | WIRED | `openLayer` call sites :1825 (scriptBegin) and :2776 (pointerdown), both behind `layerStrokeActive` = `edgeFade > 0 && tool === 'brush' && isBristleResponse(brush)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| probe captures | `edgeMidAlpha*`, `edgeCoreExact*`, `edgeContinuity*`, `edgeEncode*`, `edgePrintRetention*`, `linearHalfOnWhite`, `edgeMergedTouch*` | Engine pixel readbacks through the legal `readHalf` path over the live/merged sheets, surfaces derived by the frozen encoder | Yes — my independent re-run reproduced every number exactly (0.5113/0.5586, 1/1/0, 0.3805, -604800->0.05 s) | FLOWING |
| probe lifecycle rows | `edgeG1*`, `edgeG2*`, `edgeUndo*`, `edgeRestore*`, `edgeResize*`, `edgeCreate*`, `edgeAbort*`, `edgeMemory*` | Real engine calls (scriptBegin+queue+tick, adapter applyStroke, abortStroke, undo/redo, restore, resizeDocument, createDocument) reading live engine fields and target sizes | Yes — deltas move only by the expected 1 merge, fields null after recreate, bytes 167772160 = 40 B/px x 2048² | FLOWING |
| comparator bars | capture fields | `edgeLayerFailures`/`edgeStudioFailures`/`edgeMergeTouchFailures`/`--falloff-sweep`/`--edge-structural` | Yes — every mode exits 0 on passing captures and exit 1 on the WR-01/WR-02 failing fixtures | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Amount-0 structural bypass + byte identity | `run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` (re-run by verifier) then `compare.mjs edge-layer-neutral --edge-structural` and `compare.mjs edge-layer-neutral` | exit 0; `layerAllocated false`, `mergeDraws 0`; all 12 baseline fields equal (byte-identical to the pre-change baseline) | PASS |
| Amount-100 live bar set on an independent re-run | `run.mjs --gate edge-layer-a100-f50-v --scenario edge-layer --size 2048 --edge 100 --falloff 50` + `compare.mjs edge-layer-a100-f50-v --other edge-layer-a100-f50` | exit 0; identical readings; all 12 fields + Studio rows equal to the executor capture | PASS |
| Falloff ordering | `compare.mjs edge-layer-a100-f0 --falloff-sweep edge-layer-a100-f50 edge-layer-a100-f100` | exit 0; paper 0.3168 < 0.5113 < 0.7051; under 0.3547 < 0.5586 < 0.747; cover_L falloff-independent within 1/255 | PASS |
| Determinism (same script twice) | `compare.mjs edge-layer-a100-f50 --other edge-layer-a100-f50-r2` | exit 0; all fields equal; replay byte-identical | PASS |
| Package test suite | `pnpm --dir packages/efx-watercolor exec vitest run` (re-run by verifier) | 43 files, **1085 passed, 8 skipped** (1093) — SUMMARY says 1075; the +10 are the WR-02 fixtures | PASS |
| App targeted tests | `pnpm --dir app exec vitest run` on the 4 Edge-plumbing test files | 4 files, 95 passed, 3 skipped | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `probe/medium-engine/run.mjs` (neutral) | `node run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` | exit 0, 8983 ms; 2048x2048; digests equal to baseline | PASS |
| `probe/medium-engine/run.mjs` (amount 100) | `node run.mjs --gate edge-layer-a100-f50-v --scenario edge-layer --size 2048 --edge 100 --falloff 50` | exit 0, 10374 ms; every bar in range | PASS |
| `probe/medium-engine/compare.mjs` (baseline mode) | `node compare.mjs edge-layer-neutral` | exit 0, "all 12 fields equal and the scenario invariants hold" | PASS |
| `probe/medium-engine/compare.mjs` (structural mode) | `node compare.mjs edge-layer-neutral --edge-structural` | exit 0, "the structural relation holds" | PASS |
| `probe/medium-engine/compare.mjs` (sweep mode) | `node compare.mjs edge-layer-a100-f0 --falloff-sweep edge-layer-a100-f50 edge-layer-a100-f100` | exit 0, strict ordering both sides | PASS |
| Executor captures at current tree | `/tmp/medium-engine/edge-layer-g15-*`, `edge-layer-mem-1080.json` (18:23-18:52) | produced from the same tree as the sweep operands; memory 44.49 MiB @ 1080² recorded | PASS (recorded evidence) |

Measured bars: re-run vs recorded - every bar in must_haves (amount-0 identity,
live-vs-merged encoder, falloff ordering, linear-light 50%, G1-G5) was **re-run by this
verifier on the current tree**; no bar rests on SUMMARY numbers alone. The only recorded-only
figures are the 1080² memory row (44.49 MiB, capture `edge-layer-mem-1080.json`) and the
merge CPU submission (0.1 ms, reproduced in my capture).

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| EDGE-IDENTITY | PLAN frontmatter | Amount 0 reproduces shipped bytes | SATISFIED | Truth 1 (byte-identical baseline, structural bypass) |
| EDGE-CONTINUITY | PLAN frontmatter | Continuous band, exact core | SATISFIED | Truth 2 (`continuity 0/0`, `coreExactPaper 0`) |
| EDGE-GLAZE | PLAN frontmatter | Between-mix over an under-stroke | SATISFIED | Truth 3 (under continuity 0, retention 0.4344 measured) |
| EDGE-FALLOFF | PLAN frontmatter | Strict broad < linear < rim | SATISFIED | Truth 4 (sweep PASS both sides) |
| EDGE-PARITY | PLAN frontmatter | Live vs merged within the encoder bar; deterministic | SATISFIED | Truth 5 (1/1/0, 0.3805, replay identical) |
| SPEC10-PLUMBING | PLAN frontmatter | Canonical pair through every layer | SATISFIED | params :231-232, Engine :134/:152/:1072-1074/:3984-3986, mediums :54, record state :124/:147/:169, visibility :181-182 |
| G1 | PLAN frontmatter | Pointer stroke merges once | SATISFIED | `edgeG1MergeDraws 1`, callback x1, layer closed at callback |
| G2 | PLAN frontmatter | Scripted stroke merges the same | SATISFIED | `edgeG2MergeDraws 1` |
| G3 | PLAN frontmatter | Bake replay identical | SATISFIED | `edgeReplayIdentical true`, maxDelta 0, diffTexels 0 |
| G4 | PLAN frontmatter | Amount-0 structural bypass | SATISFIED | `layerAllocated false`, `mergeDraws 0`, byte-identical |
| G5 | PLAN frontmatter | Merge base is the summed sheet | SATISFIED | Under-side readings recovered through the committed sheet |

No milestone requirement in `.planning/REQUIREMENTS.md` maps to this quick; no orphaned IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX` in any changed file | — | None |
| — | — | No placeholder / "not implemented" / empty-handler patterns | — | None |

REVIEW.md findings (261125-kvl-REVIEW.md) re-checked against the tree:

- **WR-01** — closed by `55119b6b0`: merge now stamps last-touch after pass 3's copy-back,
  weighted by the merged cover, with the same carry discipline; undo safety grounded
  (`snapshotLayers` fifth entry = `lastTouch.read` :4290; every dab prologue calls
  `touch(rect)`). Behavioural pin: `-604800 -> 0.05 s`, re-run by the verifier.
- **WR-02** — closed by `e940c5165`: every Studio lifecycle bar now has a failing fixture
  (harness.test.ts :2513-2573), including the deleted-row case; suite green.
- **IN-01 / IN-02 / IN-03** — INFO only, unchanged (structural tuple identity, hand-copied
  cover shader body, lexical lifecycle pins). They do not affect the goal.

Accepted, not raised as gaps: polish p95 3/255 (reported, UAT row 6); print retention
0 / 0.29-0.55 (reported, UAT row 9); layer memory 40 B/px measured vs DESIGN's 22 B/px
(160 MiB at 2048², 160.16 MiB at 2049² clamp — recorded as a number); the pre-existing
`app/src/lib/physicPaintBridge.test.ts` full-suite flake (unrelated, logged in
deferred-items.md); the two pre-existing engine facts kept as documented reuse rules.

### Human Verification Required

The ten live UAT rows are handed to the artist, never claimed here (the quick's declared
ending is automated-ready). See the frontmatter `human_verification` list for the full
test/expected/why_human form. Summary:

1. Amount 0 identical to today's brush and watercolor unchanged (row 1 is backed by the
   automated byte-identical baseline).
2. Amount 50 / 100, falloff 50 on paper — continuous stroke, smooth translucent edge, no banding.
3. Amount 100, falloff 0 vs 100 side by side — visibly different distribution; rim keeps the
   middle solid.
4. A stroke over another stroke (same visit and over a committed key) — the under-colour shows
   through the fade; no pale band, no white fringe, no holes.
5. Feather 0/85 x falloff 0/100 — no seam at the caps or the rim.
6. The polish settle at p95 3/255 (reported, not barred).
7. Pen (small) and Gouache (large) — the band scales with the stroke.
8. The wet/pickup row — the layer's own wetness is not simulated; pickup stays sheet-side.
9. The bristle-gap row — no pale band in the gaps; the mark keeps its character.
10. Mid-stroke interruption discards the layer (differs from today's partial-dab persistence).

### Gaps Summary

No gaps. Every must-have truth is verified against the current tree, every artifact is
present and substantive, every key link is wired, and every measured bar was independently
re-run. The phase goal's automated-ready deliverable is achieved and the ten live UAT rows
are handed over exactly as the goal requires; they are recorded as human verification items,
not as gaps. Two documentation discrepancies are noted and do not affect the verdict: the
PLAN's literal digest `36a3f71d` belongs to the spike's Q4 scene (the committed edge-layer
baseline is the applicable reference, reproduced byte-for-byte), and the SUMMARY predates the
WR-01/WR-02 commits (both verified in the tree; suite 1085 passed vs the SUMMARY's 1075).

---

_Verified: 2026-11-25T18:01:26Z_
_Verifier: Claude (gsd-verifier)_
