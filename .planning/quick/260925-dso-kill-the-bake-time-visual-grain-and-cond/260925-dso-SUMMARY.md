---
phase: quick-260925-dso
plan: 260925-dso
title: Kill the bake-time visual grain and condition the physics height field
status: complete
subsystem: packages/efx-physic-paint (brush raster + paper height-map pipeline)
tags: [quick, physic-paint, grain-removal, height-conditioning, tdd, red-green, harness-parity, automated-ready]
requires: [QUICK-260925-DSO]
provides: []
affects: [efx-physic-paint/raster, efx-physic-paint/paper-height, efx-physic-paint/harness-parity]
tech-stack:
  added: []
  patterns: [tdd-red-green, source-shape-pins, pure-fn-conditioning-at-load, lookup-or-null-fallback, harness-parity]
key-files:
  created:
    - packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts
    - packages/efx-physic-paint/src/core/paperConditioning.test.ts
    - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-RED-EVIDENCE.json
  modified:
    - packages/efx-physic-paint/src/core/paper.ts # conditionHeightMap wired into loadPaperTexture; ensureHeightMap + fbm import deleted
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts # setPaperGrain lookup-or-null; emboss args dropped from 3 call sites (state field kept)
    - packages/efx-physic-paint/src/brush/paint.ts # fillPolyGrain + applyPaperEmboss deleted; flat fill on every layer; emboss params dropped
    - packages/efx-physic-paint/src/brush/erase.ts # unused embossStrength param dropped
    - packages/efx-physic-paint/src/brush/paint.continuation.test.ts # positional args updated
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts # grain replication removed + bottom-level sanity recalibration
    - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts # grain replication removed
decisions:
  - "Conditioning runs ONCE at texture load via exported pure conditionHeightMap (mean-centre to 0.5, contrast clamped +/-0.40 -> band [0.10,0.90]); tex.heightMap / paperHeight / physicsHeightMap share the one conditioned reference"
  - "setPaperGrain is pure lookup-or-null: grain-off '' and texture-load-failure keys both land on null (flat, sampleH = constant 0.5); no procedural fbm ever — ensureHeightMap deleted from the package"
  - "Clean deletion, not parameter zeroing: fillPolyGrain + applyPaperEmboss and the embossStrength/embossStack raster params are gone; state.embossStrength (0.45), state.embossStack (8), setEmbossStrength, SETTINGS_KEYS, validator and the documentFormat round-trip kept — format field intact until 9b"
  - "pyp bottom-side sanity recalibrated per plan case (b): per-side sub-255 level floor 3 -> 2, measured numbers below; every LAW gate untouched (envelope <= 8, texture d(b) >= 1, PIN 0 1.0000, PIN 0b floors, determinism, hairline, tier 70)"
actuals:
  tokens: 11800 # chars/4 over the realized diff (47,418 bytes, 11 files, 03cb0d37..6200eadd)
  tasks: 3
  commits: 4
metrics:
  duration: ~18min
  completed: 2026-09-25
---

# Quick 260925-dso: Kill bake-time grain, condition the physics height field — Summary

**Bake-time grain/emboss passes deleted from the stroke raster (fillPolyGrain + applyPaperEmboss gone, flat fill on every layer — zero paint-grain-*/paint-emboss-* stages, zero putImageData writebacks), and the physics height field conditioned: flat (null → sampleH 0.5) for grain-off and failed loads with no procedural fbm anywhere, detail-normalized (mean 0.5, band [0.10, 0.90]) for loaded papers — three pins RED at base then GREEN, simulation math and document format untouched, pyp/stb harnesses on grain-free parity with all law gates green (0 STOP findings). Automated-ready — 7 native UAT rows pending.**

## What Was Built

- **Task 1 (RED, `140a1801`):** three pin files, zero production edits. Pin 1 (`paint.grainRemoval.test.ts`): for pickup 0 and 60 the observer-wiring controls are green (`paint-raster-geometry`, `paint-raster-layers` collected) while the four negatives fail at base; source-shape leg greps paint.ts for `fillPolyGrain`/`applyPaperEmboss`. Pin 2 (`EfxPaintEngine.paperHeight.test.ts`): grain-off `''` and failed-load key must leave `paperHeight` null (base: procedural fbm Float32Array), map-hit control green at base, source-shape requires `ensureHeightMap` gone from paper.ts and unimported by the engine. Pin 3 (`paperConditioning.test.ts`): `conditionHeightMap` export missing at base plus mean/clamp/rank/idempotence legs and the `loadPaperTexture` wiring source-shape.
- **Task 2 (GREEN, `944c37a7` + `b8dcfcca`):** `conditionHeightMap` added and called once inside `loadPaperTexture` right after the red-channel extraction; `ensureHeightMap` and its `fbm` import deleted; `setPaperGrain` collapsed to `tex?.heightMap ?? null` on all three fields. Then the raster deletion: `fillPolyGrain` + `applyPaperEmboss` + the `fbm`/`polyBounds` imports + stale doc mentions removed, the three layer loops collapse to `fillFlat` on every layer (same `deform(baseD, variance * 0.2)` geometry, each layer's own `lAlpha`, odd-branch color expression), `paint-raster-paper-emboss` measure blocks removed, `embossStrength`/`embossStack` dropped from `renderPaintStroke`/`createPaintStrokeRasterContinuation*`/`renderPaintStrokeSingleColor`/`applyEraseStroke` signatures and the 3 engine call sites (remaining args keep order), positional args updated in continuation + pin-1 tests.
- **Task 3 (`6200eadd`):** pyp + stb harnesses free of the in-harness grain replication (`GRAIN`, `grainFn` param/application, even-layer construction, stale comments, `fbm` imports); decision tree applied — see Deviations.

## RED Evidence (Task 1, verified)

Record: `260925-dso-RED-EVIDENCE.json` — `gsd_run check tdd-red-evidence` → **RED_EVIDENCE_OK** (`target_test_failed`). Run: `12 failed | 1 passed (13)`, exit 1, zero production diffs.

- Pin 1: `expected true to be false` (a `paint-grain-*` stage IS collected at base) on both pickup legs; source-shape `expected … not to contain 'fillPolyGrain'`. Controls green.
- Pin 2: `expected Float32Array[…(16.807688251137733)] to be null` on both null-height legs; source-shape `not to match /export function ensureHeightMap/` failed. Map-hit control green.
- Pin 3: `expected 'undefined' to be 'function'` (export missing); legs (a)–(d) fail with `conditionHeightMap is not a function`; leg (e) `expected 'export function loadPaperTexture(…' to contain 'conditionHeightMap'`.

After Task 2: all three pins green (19/19 with continuation + documentFormat), tsc clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan case (b) — recalibrated expectation] pyp bottom-side sanity floor 3 → 2**
- **Found during:** Task 3 (harness parity run after grain replication removal)
- **Issue:** `productionAaSettleMeasurement.test.ts` sanity required ≥ 3 distinct sub-255 alpha levels per side of the MID_X column. Post-removal bottom side measured `[65, 245]` (2 levels).
- **Root cause:** the third baseline level was grain's ±1 plateau jitter (243 vs 244 on adjacent plateau rows) — pure noise from the deleted pass, not fringe structure. Law intent (graduated fringe, not a hard cut; never the literal 160/110/60 ramp) is still carried by MID_X distinct > 2, explicit ramp rejection, and the band-richness floor.
- **Before/after numbers (plan-mandated):**
  - topSide levels: `[24,230,243]` (3) → `[25,233,245]` (3) — expectation unchanged (≥ 3)
  - bottomSide levels: `[63,243,244]` (3) → `[65,245]` (2) — expectation 3 → 2
  - edge-band distinct alphas: 105 → 103 (floor 6 untouched, still far above)
  - plateau: 244 → 245; MID_X fringe rows 63 → 65 / 24 → 25 (edge alphas rose as predicted — grain's ≤20% alpha reduction is gone)
- **Files modified:** `packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts`
- **Commit:** 6200eadd

No other deviation: no law gate moved, no locked file touched, no installs, no push, no document-format change, no 9b composite pass.

## Law Gates (Task 3 decision tree — all green, no STOP)

| Gate | Result |
|------|--------|
| Envelope W_visible ≤ 8 (default water, both papers) | PASS (6–8 across the tables) |
| Texture presence d(b) ≥ 1 at spread-engaged (Spread 80) | PASS — stb W2/W6 green |
| PIN 0 body ratio | 1.0000 everywhere |
| PIN 0b opacity floors (≥ 0.95×) | hold (meanAlpha ≈ 2880.9–2883.2, display 255.00) |
| Held-pose determinism (pyp PIN 3, stb W5) | byte-identical digests |
| Hairline ceiling / W1–W4, W7 | green (stb 7/7) |
| rm2 boundary (tier 70) | unchanged — tier 70 rows PASS, 0 STOP findings |
| physicsSettledFootprint.test.ts | untouched: 4 passed \| 3 skipped (base) |

## Verification

- Targeted (Task 3 gate): pyp 7/7, stb 7/7, footprint, all 3 pins + continuation green; `npm run check` clean; locked-surface `git diff --name-only` EMPTY (wet-layer, fluids, drying, compositor, paper, types, stroke, canvas, all package.json, pnpm-lock.yaml, app/).
- Full package suite: **1 failed | 20 passed (21 files), 173 passed | 3 skipped (177 tests)** — sole failure = pre-existing `EfxPaintEngine.liveAlphaCache` (ledger 74), base results.
- App suite: **4268 passed | 0 failed** (230 files) — app untouched.
- tsc (`npm run check`): clean after every commit.
- Commits: `140a1801` (RED), `944c37a7` (2a height), `b8dcfcca` (2b raster), `6200eadd` (3 parity) — 4 measured from ledger base `03cb0d37`.

## Known Stubs / Residuals (deliberate, per plan)

- **Grain-strength control is inert until 9b:** TopBar/Settings control, `setEmbossStrength`, `state.embossStrength` (0.45) and the format validator are untouched and visible — expected interim state, not a defect, not graded this quick.
- **Bristle paper-height skip** (`paint.ts`, `hVal > 0.72` carve) deliberately left in place until 9b — the one remaining bake-time paper consumer (known residual raggedness source, flagged in UAT row 5).
- **Paper tooth in the paint body** deferred to the 9b composite paper pass.

## Native UAT Rows (pending — no done claim before native UAT)

1. **Clean silhouette:** stroke edges are clean — no ragged noise-carved edge vs a pre-fix build side by side.
2. **Grain-off flat:** fresh layer / no paper (`paperGrain: ''`) — settled stroke body shows no per-pixel deposit noise (flat physics height).
3. **Paper tooth:** paper selected — deposit shows noticeable tooth/granulation (wet edges + adsorption valleys) WITHOUT pixel jitter — detail-normalized height.
4. **Opacity unchanged:** stroke body opacity unchanged vs before (PIN 0 law, no wash-out).
5. **Footprint parity:** settled footprint still matches the preview ribbon (260925-b7c law) — *if any raggedness remains, note it: the bristle paper-height skip was deliberately left in place (known residual until 9b).*
6. **Determinism:** two identical held-pose strokes identical (no boil).
7. **Normal mode unchanged** — plus the informational note that the **Grain-strength control remains visible but has no visual effect until 9b** (expected interim, do not grade) and that paper tooth in the paint body is deferred to 9b.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes (plan threat model: no new trust boundaries; T-dso-01/02/03 all held: law gates unweakened except the plan-authorized case-(b) sanity count, format surface kept, zero installs).

## Self-Check: PASSED

- 11/11 claimed files exist (3 pins, 4 production sources, 2 harnesses, SUMMARY, RED-EVIDENCE record)
- 4/4 commits present in history: 140a1801, 944c37a7, b8dcfcca, 6200eadd
- `status: complete` frontmatter present; no `fillPolyGrain` / `applyPaperEmboss` / `ensureHeightMap` residue anywhere in `packages/efx-physic-paint/src` production code
- Commits measured from ledger base `03cb0d37` → HEAD: `git rev-list --count` = 4 (matches frontmatter `commits: 4`)

