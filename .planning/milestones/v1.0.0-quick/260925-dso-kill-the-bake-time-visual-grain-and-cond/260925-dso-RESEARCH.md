# Quick 260925-dso: Kill the bake-time visual grain, condition the physics height field — Research

**Researched:** 2026-09-25
**Domain:** efx-physic-paint stroke raster + paper height-map pipeline
**Confidence:** HIGH (all code claims verified by reading source this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Height normalization:** mean-centre the paper height map to 0.5, then clamp contrast to +/-0.40 (moderate range). Noticeable tooth in deposit adsorption without pixel jitter.
- **Texture-load failure fallback:** when a paper IS selected but its texture fails to load, physics height is flat (null / 0.5). No procedural fbm ever — `ensureHeightMap` is never used as a stand-in for missing paper or failed texture load.
- **Code deletion vs. parameter zeroing:** delete dead code — remove the grain alpha modulation from `fillPolyGrain` and delete `applyPaperEmboss` entirely. Clean codebase so 9b starts fresh. No dead parameter-zeroing paths left behind.
- **Keep the physics height map** for wet diffusion, deposit adsorption, `compositeWetLayer` — that is simulation, not visual grain.
- **Do NOT** build the new composite paper pass — that is 9b.

### Claude's Discretion
- Exact implementation of the normalization pass (single-pass mean + clamp vs. two-pass).
- How to structure the height-map conditioning in `core/paper.ts` (inline in `setPaperGrain` vs. separate function).
- Whether the `grain` parameter on `fillPolyGrain` is removed entirely or kept at 0 for the emboss parameter (which is already hardcoded to 0).

### Deferred Ideas (OUT OF SCOPE)
- 9b composite paper pass / paper tooth in the paint body (interim state accepted: no paper tooth until 9b).

### Task pins (must be RED before implementation)
1. Baked stroke silhouette edge is clean (no noise-carved alpha); stroke path runs no grain/emboss pixel pass.
2. With NO paper selected (`paperGrain === ''` = the app's first-class "grain off" encoding), stroke body has no per-pixel deposit noise — physics height is flat.
3. With a paper selected, height map is detail-normalized (not raw photo red channel).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIN-1 | Stroke raster runs no grain/emboss pixel pass; clean silhouette | `paint.grainRemoval` contract test: timing stages `paint-grain-*` / `paint-emboss-*` never fire; no `putImageData` during raster (seam: `paint.ts:83-102`, `264-332`) |
| PIN-2 | `setPaperGrain('')` / texture-missing → `paperHeight === null` (flat) | `EfxPaintEngine.setPaperGrain` collapses to lookup-or-null; `ensureHeightMap` deleted (seam: `EfxPaintEngine.ts:1050-1067`, `paper.ts:110-128`) |
| PIN-3 | Paper-selected height map mean ≈ 0.5, range ⊆ [0.10, 0.90] | New pure `conditionHeightMap` in `core/paper.ts`, called from `loadPaperTexture` (seam: `paper.ts:49-52`) |
</phase_requirements>

## Summary

The task premise is confirmed against source. Every paint stroke raster pass runs **two kinds of synchronous pixel passes** over the offscreen stroke canvas: (a) a grain fbm alpha-modulation pass on every even polygon layer — in the pickup-0 path that is ~19 `getImageData`/`putImageData` round-trips per stroke (37 layers, `i % 2 === 0`) — and (b) one emboss readback/writeback per stroke (per segment when pickup > 0). The grain pass multiplies pixel alpha by at most a 20% fbm factor (`mod ∈ [0.8, 1.0]`), which carves ragged edges but produces no visible tooth. The emboss pass runs live whenever `paperHeight` is non-null because the default `embossStrength` is `0.45` (not 0) — its 100%-opacity branch only lifts RGB on paper peaks. Separately, the physics height field has two defects: `setPaperGrain('')` (the app's grain-off encoding, emitted for fresh layers) falls into `ensureHeightMap` procedural fbm — full-canvas per-pixel noise driving deposit adsorption — and a loaded paper stores the **raw photo red channel** (`pd[i*4] / 255`) with uncalibrated mean/contrast.

**Primary recommendation:** condition the height map **once at load time inside `loadPaperTexture`** via an exported pure `conditionHeightMap` (two-pass mean + clamp), collapse `setPaperGrain` to lookup-or-null (delete `ensureHeightMap`), delete `fillPolyGrain` and `applyPaperEmboss` outright and replace the three `fillPolyGrain` call sites with `fillFlat` (which the odd layers already use), and drop the now-purposeless `embossStrength`/`embossStack` parameters from the paint.ts raster signatures while keeping the engine state field and `setEmbossStrength` (the persisted document format and the TopBar "Grain strength" control still reference it until 9b).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bake-time raster modulation (grain/emboss) | Brush raster (`brush/paint.ts`) | — | Pure stroke-drawing concern; delete at source |
| Height-map conditioning (mean-centre + clamp) | Core load (`core/paper.ts`) | Engine (`setPaperGrain` consumer) | One-time cost at texture load; all three engine fields share the same reference |
| Deposit adsorption / drying / wet display | Core simulation (`wet-layer`, `drying`, `compositor`) | — | Keep untouched — inputs change, math does not |

## Code-Path Verification (all [VERIFIED] — read this session)

### 1. Grain pass in `fillPolyGrain` — `packages/efx-physic-paint/src/brush/paint.ts:51-104`
- Guard: `if (grain > 0.01 || emboss > 0.01) {` [VERIFIED: packages/efx-physic-paint/src/brush/paint.ts:83]
- Modulation: `if (grain > 0.01) mod *= 1 - grain * 0.5 * (1 - fbm((ox + px) * 0.08, (oy + py) * 0.08, 3))` [VERIFIED: packages/efx-physic-paint/src/brush/paint.ts:91] — grain ∈ [0.4·0.5·(1−fbm)] → alpha factor ∈ [0.8, 1.0]
- Emboss branch (dead today): `if (emboss > 0.01) {` samples `sampleHFn` — `mod *= clamp(lerp(1, embMod, emboss), 0.05, 2.0)` [VERIFIED: packages/efx-physic-paint/src/brush/paint.ts:92-96]. Every call site passes `emboss` = `0`, so the branch never executes; only `grain` drives the pass.
- Three call sites, all inside the layer loops, all with `grain: 0.4, emboss: 0` [VERIFIED: paint.ts:515, :562, :630]:
  `if (i % 2 === 0) fillPolyGrain(oc, v, cr, cg, cb, lAlpha, 0.4, 0, paperHeight, width, height, sampleHFn, observePrimitive)`
- Pass cost: pickup-0 branch builds `layers = Math.round((22 + 15) / (speedDeplete || 1))` ≈ 37 layers → 19 grain readback/writeback passes per stroke (plus 1 emboss pass), each `getImageData` + pixel loop + `putImageData` [VERIFIED: paint.ts:509-519].

### 2. `applyPaperEmboss` — `paint.ts:264-332`
- Early return: `if (!paperHeight || embossStrength <= 0) return` [VERIFIED: paint.ts:276]
- Default state is **not** 0: `embossStrength: 0.45,` / `embossStack: 8,` [VERIFIED: src/engine/EfxPaintEngine.ts:592-593] → the pass runs whenever a paper is loaded.
- 100%-opacity branch [VERIFIED: paint.ts:300-310]: `if (fullOpacity) { // 100% opacity: peak lightening only (paper grain texture) // Skip alpha modulation (causes transparency) and valley darkening (compounds)` → only `lift = colorShift * 80` RGB lift, `continue`.
- Partial opacity: full emboss (alpha + color), `d[pi + 3] = Math.round(clamp(d[pi + 3] * alphaMod, 0, 255))` [VERIFIED: paint.ts:313-315].
- **Callers: exactly three, all in `paint.ts` stroke-raster paths** [VERIFIED: paint.ts:526-527, :573-574, :638-639]. No other file imports it; no test imports it (grep across `src/` + `app/` — only doc comments in `productionAaSettleMeasurement.test.ts` mention it). Safe to delete wholesale.

### 3. `setPaperGrain` — `EfxPaintEngine.ts:1050-1067`
- Hit path: `this.paperHeight = tex.heightMap` (raw) [VERIFIED: :1059]
- Miss path (grain-off `''` or texture-load failure): `// Generate procedural heightmap` → `this.paperHeight = ensureHeightMap(null, null, this.width, this.height)` [VERIFIED: :1063-1064] — this is the pin-2 target.
- `physicsHeightMap` and `texHeight` are assigned here (and at :377-378) but **read nowhere** — write-only fields (verified by grep across `src/`); leave alone or note as dead state for 9b.
- Callers of `setPaperGrain('')`: `applyBackgroundFallbackToEngine` → `engine.setPaperGrain(fallback.paperGrain ? fallback.texture : '')` [VERIFIED: app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:158]. `paperGrain: ''` is the app's first-class "grain off" encoding (fresh layers default `paperGrain: false` → `''`; quick 260921-pgd made both validators accept it).

### 4. Height-map extraction & procedural fbm — `core/paper.ts`
- Raw red channel: `for (let i = 0; i < width * height; i++) heightMap[i] = pd[i * 4] / 255` [VERIFIED: core/paper.ts:51]
- Procedural fbm: `const fine = fbm(x * 0.25, y * 0.25, 4)` ... `paperHeight[y * width + x] = clamp(fine * 0.7 + med + 0.15, 0, 1)` [VERIFIED: core/paper.ts:121-124] — delete `ensureHeightMap` entirely (only caller is `setPaperGrain`).
- `sampleH` null contract: `if (!paperHeight) return 0.5` [VERIFIED: core/paper.ts:75] — flat consumers already correct for null.
- `sampleTexH` (paper.ts:89) has **zero callers** — pre-existing dead export, out of scope.

### 5. Physics consumers of `paperHeight` (KEEP — simulation, not grain)
| Consumer | Math | Location |
|---|---|---|
| Deposit adsorption (D-08), 4 entry points | `const adsorption = (1 - wFrac) * (1 - h * gamma) * delta` + `depositAlpha *= Math.max(floor, adsorption)` where `const floor = userOpacity * userOpacity` | core/wet-layer.ts:207-213, 293-299, 358-364, 455-461 |
| Deposit keep-gate (rm2) | `const DEPOSIT_KEEP_TIER = 70` — include/exclude only, never alpha | core/wet-layer.ts:417, 447 |
| Wet display composite | `const paperMod = 1.0 - paperStrength * paperHeight` with `const paperStrength = 0.05 + 0.20 * (1 - Math.min(1, density * 2))` | render/compositor.ts:40-41 |
| Drying drain (partial opacity only) | `sa *= clamp(1.4 - ph * 0.8, 0.3, 1.4)` | core/drying.ts:127-131 |
| Fluid solver | `_sampleHFn` — **unused, kept for API compat** | core/fluids.ts:431-443 |

`compositeWetLayer` receives `sampleHFn` built from `this.paperHeight` — with null it samples a constant 0.5 (flat, no per-pixel noise). All consumers are monotone in `h`; conditioning preserves their behavior, only narrowing amplitude.

## Recommended Approach

### Height normalization: separate pure function, called at load time
Add to `core/paper.ts`:
```ts
/** 260925-dso: condition a raw photo height map — mean-centre to 0.5, clamp contrast to ±0.40. */
export function conditionHeightMap(raw: Float32Array): Float32Array {
  // pass 1: mean; pass 2: out[i] = clamp(0.5 + (raw[i] - mean), 0.1, 0.9)
}
```
Call it inside `loadPaperTexture` right after the extraction loop (`paper.ts:49-52`), before `resolve`. Why here, not inline in `setPaperGrain`:
- **Once per texture load** (async loader at init), not on every paper switch.
- `paperHeight`, `physicsHeightMap`, `texHeight` all share the one conditioned reference — no chance of a raw copy leaking into physics.
- `setPaperGrain` collapses to lookup-or-null with zero math; its miss branch is just `this.paperHeight = null`.
- The transform is **idempotent** (re-centring a centred map is a no-op; clamped stays clamped), so double application is harmless even if a future path re-conditions.
- Full-canvas cost: 2 passes over width×height per paper — trivial next to the tiling + `getImageData` the loader already does.

`setPaperGrain` after the change:
```ts
const tex = key ? this.paperTextures.get(key) : undefined
this.texHeight = tex?.heightMap ?? null
this.paperHeight = tex?.heightMap ?? null   // '' or failed load → null → flat
this.physicsHeightMap = this.paperHeight
```
Texture-load failure already routes here: `loadPaperTexture` rejects → `loadPaperTextures` catch → key absent from `paperTextures` [VERIFIED: EfxPaintEngine.ts:2969-2985].

### `fillPolyGrain` after grain removal: delete the function
With the grain pixel pass gone, the remaining body (temp canvas → padded bbox → poly fill → `drawImage`) is exactly `fillFlat` with extra steps — and `fillFlat` [VERIFIED: paint.ts:110-126] is already what odd layers use. Recommendation per the deletion ethos:
- Delete `fillPolyGrain` (and its `fbm` import at paint.ts:15 — line 91 is fbm's only use in this file).
- Collapse each call site: `if (i % 2 === 0) fillPolyGrain(...) else fillFlat(...)` → single `fillFlat(oc, v, rgbHex(cr, cg, cb), lAlpha)` (the seg path already has `segHex`). The `i % 2` alternation existed only to alternate grain/flat.
- Bonus: eliminates a temp canvas **allocation per even polygon** per stroke.
- Two behavioral deltas to accept knowingly: (1) `fillPolyGrain`'s bbox guard `if (bw < 1 || bh < 1 || bw > 4000 || bh > 4000) return` [VERIFIED: paint.ts:71] disappears — `fillFlat` draws unconditionally; harmless in practice (polys live inside the bounds-clipped offscreen canvas). (2) alpha via `globalAlpha` (save/restore) instead of `rgba(...)` — equivalent for an isolated fill.
- Alternative (CONTEXT discretion #3): keep `fillPolyGrain` minus modulation — rejected: it keeps the per-polygon temp canvas as dead overhead.

### `applyPaperEmboss` callers / deletion blast radius
- Delete the function + its 3 call sites (`paint.ts:526-527, 573-574, 638-639`) and the `paint-raster-paper-emboss` timing stage (no test pins any stage name — grep verified).
- The `embossStrength`/`embossStack` parameters through `renderPaintStroke` / `createPaintStrokeRasterContinuation*` become purposeless — recommend dropping them from the paint.ts signatures and the 3 engine call sites [VERIFIED: EfxPaintEngine.ts:2211-2212, 2488-2489, 2567], plus the `applyEraseStroke` param (it is **already unused** in erase's body — only its signature carries it).
- **Keep** `state.embossStrength`/`state.embossStack`, `setEmbossStrength`, and the `SETTINGS_KEYS` entry: the document format validator requires `typeof value.embossStrength === 'number'` [VERIFIED: EfxPaintEngine.ts:228, 265] and `documentFormat.test.ts` pins a 0.45 round-trip. Format churn is out of scope (and the TopBar "Grain strength" control still calls it — see Open Questions).
- Update `paint.continuation.test.ts` positional args if signatures change: `..., false, 0, 8, 0.5, () => 0.5` (the `0, 8` are embossStrength/embossStack) [VERIFIED: paint.continuation.test.ts:56, :59]. The parity assertions themselves (sequential vs resumable) are robust to grain removal.

## Common Pitfalls

1. **Harness parity drift (biggest trap).** The two production-geometry measurement harnesses replicate the grain pass in-harness: `const GRAIN = 0.4` and `grainFn = ... 1 - GRAIN * 0.5 * fbm(...)` applied on even layers [VERIFIED: src/core/productionAaSettleMeasurement.test.ts:126, 322-326; src/core/physicsWidthScaling.test.ts:93, 284-288]. After production grain removal these measure dead code. Plan a test-only parity commit (drop `grainFn`), re-run both suites, and check whether the pyp sanity gates (105 distinct edge-band alphas) and outcome table shift. Do **not** re-litigate rm2's tier 70 unless a boundary row flips. `physicsSettledFootprint.test.ts` uses its own synthetic raster (rows 29–34 model, [VERIFIED: physicsSettledFootprint.test.ts:119-153]) — its PIN 0/texture contracts are unaffected.
2. **Settled-footprint creep.** Removing the ≤20% grain alpha reduction raises even-layer edge alphas → slightly more pixels clear `DEPOSIT_KEEP_TIER = 70` → settled width may widen by a fringe row. Guardrails: do not touch `wet-layer.ts`/`compositor.ts`/`fluids.ts`/`drying.ts` math (m7w law: never fix width via alpha). Native UAT row: settled footprint still matches the preview ribbon; PIN 0 body ratio still 1.0000.
3. **Deposit floor interplay with conditioning.** At 100% user opacity `floor = 1.0` dominates unless `adsorption > 1` ⇒ `h < ~0.21` (at zero wetness). Mean-centring repositions which pixels get the valley boost — tooth at full opacity comes only from `h < 0.21` pixels. If the conditioned ±0.40 map yields too few, granulation weakens; that is what PIN 3 + the native "wet edges + granulation present, not a hard stamp" row verify.
4. **Bristle traces still sample paper height (out of scope, watch it).** `if (hVal > 0.72 && Math.random() > 0.3) { on = false; continue }` [VERIFIED: paint.ts:187-188] carves paper-dependent gaps into bristle traces at raster time — a residual bake-time paper consumer. The decided deletion list does not include it; leave it, but if PIN-1's clean-edge UAT row shows raggedness, this is the remaining source (bristles are faint: alpha 0.015–0.075).
5. **Playback/determinism:** grain used deterministic `fbm` — removal only makes rasters more uniform; the sequential-vs-resumable parity test stays green. `paperHeight` is runtime-only (never persisted); documents store only the `paperGrain` key — no data migration, no backward-compat code (per project law).
6. **`sampleH(null) = 0.5` is not "unmodulated 1.0".** Flat consumers (composite `paperMod = 1 − s·0.5`) apply a uniform factor, not zero — correct and unchanged; pin 2 asserts *no per-pixel* noise, not zero modulation.

## Validation Architecture

Nyquist validation is **enabled** (`workflow.nyquist_validation: true` in .planning/config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (lives in `app/`; no package-level config) [VERIFIED: app/package.json:50] |
| Config file | `app/vitest.config.ts` (app only); package tests run with default globs from cwd |
| Quick run | `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run <file>` |
| Full package suite | `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run` |
| App suite (only if app files touched) | `cd app && ./node_modules/.bin/vitest run` |
| Typecheck | `tsc --noEmit` from `packages/efx-physic-paint` (strict; `noUnusedParameters` NOT set — unused params won't fail) [VERIFIED: packages/efx-physic-paint/tsconfig.json] |

Collect only `.test.ts` files (project law — a `.test.tsx` target runs nothing).

### Phase Requirements → Test Map
| Req | Behavior | Test type | Command | File |
|-----|----------|-----------|---------|------|
| PIN-1 | No grain/emboss pixel pass during raster | unit contract (timing-observer: no `paint-grain-*`/`paint-emboss-*` stages; or canvas log: no `put` entries) | `vitest run src/brush/paint.grainRemoval.test.ts` | **Wave 0 gap — create** |
| PIN-2 | `setPaperGrain('')` → `paperHeight === null`; no fbm fallback | unit (engine; precedent: tests poke privates — `engine.paperTextures = new Map()` [VERIFIED: EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:519]) | `vitest run src/engine/EfxPaintEngine.paperHeight.test.ts` | **Wave 0 gap — create** |
| PIN-3 | `conditionHeightMap`: mean ≈ 0.5, all values ∈ [0.10, 0.90], rank-monotone | unit on pure fn + source-shape pin that `loadPaperTexture` pipes through it | `vitest run src/core/paperConditioning.test.ts` | **Wave 0 gap — create** |
| REG | Continuation parity, pyp/stb harness suites stay coherent | regression | run `paint.continuation`, `productionAaSettleMeasurement`, `physicsWidthScaling` | existing |

Sampling: quick-run the touched suites per commit; full package suite before UAT handoff. PIN-1's *visual* "clean silhouette" half is native UAT (headless has no real Canvas2D — the pyp harness documents this).

**Guardrail expectation:** diffs confined to `brush/paint.ts`, `core/paper.ts`, `engine/EfxPaintEngine.ts` (`setPaperGrain` + call-site params), tests. `wet-layer.ts`, `compositor.ts`, `fluids.ts`, `drying.ts`, deposit math: **byte-identical**.

## Runtime State Inventory
Not a rename/migration phase — no stored data, service config, OS state, secrets, or build artifacts carry the grain strings. `paperHeight` is runtime-only; persisted documents store `paperGrain` keys (unchanged values) and `embossStrength` (kept). **None found — verified by grep of `paperHeight`/`ensureHeightMap` across `packages/` + `app/`.**

## Security Domain
N/A for this task (no new untrusted input, crypto, auth, or serialization surfaces). Document settings validation (`isEngineTrackSettings`) is untouched; ASVS V5 input validation not applicable beyond existing fail-closed validators.

## Open Questions (all RESOLVED — dispositions carried into 260925-dso-PLAN.md)

1. **"Grain strength" control becomes inert after `applyPaperEmboss` deletion.** TopBar segmented None/Soft/Med/Hard → `setEmbossStrength` → only `applyPaperEmboss` read it. Recommend: keep the control visible (9b rewires it to the composite paper pass); UAT must not test its visual effect this quick. Confirm with user if they'd rather hide it. **(RESOLVED — plan disposition: control stays visible and untouched (format + UI compatibility must_have); it surfaces as the informational note in native UAT row 7 ("expected interim, do not grade"), so the user confirms visibility vs hiding at UAT rather than before planning; its visual effect is not graded this quick.)**
2. **Harness parity scope:** update `GRAIN`/`grainFn` replication in pyp + stb harnesses inside this quick (recommended, test-only commit, before/after suite runs) or defer? Deferring leaves the calibration oracle modeling dead code. **(RESOLVED — folded into this quick: plan Task 3 removes the grain replication from both harnesses, with the decision tree (a)/(b)/(c) and before/after recalibration recorded in the SUMMARY.)**
3. **Bristle paper skip** (`paint.ts:187-188`) left in place — flag to user: it is the one remaining bake-time paper-height consumer. Recommend leave until 9b unless the PIN-1 UAT row shows bristle-carved edges. **(RESOLVED — deliberately left in place until 9b (out of the decided deletion list); flagged to the user in native UAT row 5's note as the known residual raggedness source.)**
4. **Background selector vs. grain-off:** choosing transparent/white background does NOT clear `paperHeight` (paperGrain stays `canvas1` default — invisible-paper adsorption persists). Out of the decided scope; pin 2 targets the `paperGrain === ''` encoding only. Raise with user only if they meant background-driven flatness too. **(RESOLVED — scoped out of this quick: pin 2 asserts the `paperGrain === ''` encoding and the texture-load-failure route only (Assumption A3); background-driven flatness is not implied and is not tested.)**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `conditionHeightMap` two-pass at `loadPaperTexture` is the right insertion point (discretion) | Recommended Approach | Low — idempotent; easily moved into `setPaperGrain` |
| A2 | Dropping `embossStrength`/`embossStack` from paint.ts signatures is in the "no dead code" spirit (state field kept) | applyPaperEmboss | Low — churn touches 3 engine call sites + 1 test |
| A3 | Grain-off = `paperGrain === ''` is pin 2's "no paper" (evidence: 260921-pgd contract) | PIN-2 | MEDIUM — if user meant background-driven no-paper, extra flattening rule needed |
| A4 | pyp/stb harness parity update folded into this quick | Pitfalls 1 | MEDIUM — deferred means oracle drift |

## Sources

**Primary (HIGH):** direct reads of `packages/efx-physic-paint/src/brush/paint.ts`, `core/paper.ts`, `core/wet-layer.ts`, `render/compositor.ts`, `core/drying.ts`, `engine/EfxPaintEngine.ts`, `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts`, `engine/usePhysicsPaintEngineActions.ts`, `view/PhysicsPaintTopBar.tsx`, harness tests (`productionAaSettleMeasurement`, `physicsWidthScaling`, `physicsSettledFootprint`, `paint.continuation`), `app/vitest.config.ts`, package `tsconfig.json` — all this session.

**Corroborating (HIGH):** memory record for quick 260921-pgd (`paperGrain: ''` = grain-off contract, fix 4f35efd7).

## Metadata

**Confidence breakdown:**
- Code-path verification: HIGH — every cited line read this session, quotes verbatim
- Normalization placement: HIGH (mechanics) / MEDIUM (discretion choice)
- Pitfalls: HIGH for harness parity + floor interplay; MEDIUM for magnitude of settled-footprint creep (needs measurement)

**Research date:** 2026-09-25
**Valid until:** 30 days (internal codebase, low churn in these files)
