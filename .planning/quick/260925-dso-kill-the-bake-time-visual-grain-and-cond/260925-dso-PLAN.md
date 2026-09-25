---
phase: quick-260925-dso
plan: 260925-dso
type: tdd
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-SUMMARY.md
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/brush/erase.ts
  - packages/efx-physic-paint/src/core/paper.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts
  - packages/efx-physic-paint/src/core/paperConditioning.test.ts
  - packages/efx-physic-paint/src/brush/paint.continuation.test.ts
  - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
  - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
autonomous: true
requirements: [QUICK-260925-DSO]
estimate:
  tokens: 45000
  raw_tokens: 30000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Stroke raster runs zero grain/emboss pixel passes: rendering a stroke with a non-null height map (pickup 0 AND pickup 60) records no paint-grain-*, paint-emboss-*, or paint-raster-paper-emboss timing stages and no putImageData writeback during the raster — asserted by the new paint.grainRemoval.test.ts with observer-wiring controls (paint-raster-geometry, paint-raster-layers) green, RED at base; the baked silhouette carries no fbm-carved alpha raggedness (native UAT row)"
    - "Grain-off and failed textures are flat: setPaperGrain('') and setPaperGrain(unknown-key) (the texture-load-failure route) leave paperHeight === null, so sampleH returns the constant 0.5 with no per-pixel noise, and no procedural fbm height-map generator exists anywhere in the package — asserted by the new EfxPaintEngine.paperHeight.test.ts, RED at base"
    - "Loaded paper height is detail-normalized (per locked decision: mean-centre to 0.5, contrast clamped to ±0.40): conditionHeightMap output has mean 0.5 on non-clamping input, every value within [0.10, 0.90], rank order preserved, idempotent on symmetric input — and loadPaperTexture pipes its extraction through it, so the raw photo red channel never reaches paperHeight; asserted by the new paperConditioning.test.ts, RED at base (export missing)"
    - "Physics simulation untouched: wet-layer.ts, compositor.ts, fluids.ts, drying.ts byte-identical; DEPOSIT_KEEP_TIER = 70, depositAlpha, strokeOpacity, drying drain math untouched (m7w/260924-rm2/260925-b7c law) — diff guardrail empty"
    - "Format and UI compatibility kept: state.embossStrength default 0.45, state.embossStack, setEmbossStrength, the SETTINGS_KEYS entry, the isEngineTrackSettings validator and the documentFormat.test.ts round-trip all stay green; TopBar/Settings Grain-strength control untouched (known inert interim state until 9b — expected, not a defect)"
    - "Harness parity after Task 3: the pyp and stb measurement harnesses no longer replicate the removed even-layer grain modulation, and their law gates still hold (envelope W_visible ≤ 8, texture d(b) ≥ 1, PIN 0 body ratio 1.0000, PIN 0b floors, pyp substrate sanity) — or the plan STOPs with a measured report instead of weakening any gate"
  artifacts:
    - packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts (pin 1: no raster grain/emboss pass, RED at base)
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts (pin 2: flat height, RED at base)
    - packages/efx-physic-paint/src/core/paperConditioning.test.ts (pin 3: conditioned height map, RED at base)
    - packages/efx-physic-paint/src/core/paper.ts (conditionHeightMap export wired into loadPaperTexture; procedural generator deleted)
    - packages/efx-physic-paint/src/brush/paint.ts (grain fill and emboss applier deleted; flat fill on every layer)
    - .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-SUMMARY.md (status automated-ready + native UAT rows)
  key_links:
    - "loadPaperTexture → conditionHeightMap → tex.heightMap → setPaperGrain lookup-or-null → paperHeight, the single conditioned reference shared by deposit adsorption, wet composite, and drying"
    - "the three raster layer loops → flat fill on every layer → transferToWetLayerClipped (wet transfer call unchanged — inputs change, simulation math does not)"
    - "engine raster/erase call sites ↔ the shrunk paint.ts/erase.ts positional signatures (drop the emboss args on both sides in the same commit or tsc fails)"
    - "pyp/stb harness raster model ↔ production raster (harness parity is what keeps the law gates proving production behavior)"
---

<objective>
Kill the bake-time visual grain: delete the fbm alpha-modulation pass and the paper-emboss pass from stroke raster (they carve ragged edges, produce no visible tooth, and cost two synchronous pixel passes per stroke), and condition the physics height field so it is flat (null / 0.5) without a paper and detail-normalized (mean-centre 0.5, ±0.40 contrast) with a paper.

Purpose: per the locked decisions in 260925-dso-CONTEXT.md (2026-09-25) the grain pass is pure cost with no visual payoff; the height field has two defects — the grain-off encoding `paperGrain: ''` falls into a procedural fbm generator (full-canvas per-pixel noise driving deposit adsorption), and a loaded paper stores the raw photo red channel with uncalibrated mean/contrast. Clean deletion so 9b starts fresh: no dead parameter-zeroing paths. The physics height map itself stays (wet diffusion, deposit adsorption, compositeWetLayer are simulation, not visual grain), and the 9b composite paper pass is explicitly out of scope.

Output: three pin files RED at base then GREEN, the production deletions/conditioning, pyp/stb harness parity, guardrailed full battery, and a SUMMARY with status automated-ready (native UAT rows for the user). No installs, no push, no document-format change.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-CONTEXT.md
@.planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-RESEARCH.md

Key code anchors (read before editing — all line numbers verified in RESEARCH.md this session):
- packages/efx-physic-paint/src/brush/paint.ts — grain fill helper at 51-104 (guard `grain > 0.01 || emboss > 0.01` at 83, timing stages `paint-grain-*` at 84/86/101/103, `fbm` import at 15 is its only use), emboss applier at 264-332 (early return at 276, stages `paint-emboss-*`), three layer loops calling the grain fill with `grain: 0.4, emboss: 0` at 515/562/630 and the emboss applier at 526/573/638, signatures with embossStrength/embossStack at 413-414/451-452/486-487/603-604, flat fill helper `fillFlat` at 110-126.
- packages/efx-physic-paint/src/core/paper.ts — extraction loop in loadPaperTexture at 49-52 (`heightMap[i] = pd[i * 4] / 255`), procedural fbm generator `ensureHeightMap` at 110-128 (only caller: setPaperGrain), `sampleH` null contract `if (!paperHeight) return 0.5` at 75.
- packages/efx-physic-paint/src/engine/EfxPaintEngine.ts — import at 43, defaults `embossStrength: 0.45` / `embossStack: 8` at 592-593, `setPaperGrain` at 1050-1067 (miss branch at 1063-1064 is the pin-2 target), `setEmbossStrength` at 1071+, SETTINGS_KEYS at 228, validator at 265, raster call sites at 2211-2212 / 2488-2489, erase call site at 2567.
- packages/efx-physic-paint/src/brush/erase.ts — `applyEraseStroke` signature carries `embossStrength` at 36, unused in the body.
- Test harness precedents: src/brush/paint.continuation.test.ts (canvasFactory stub + document stub + positional args `..., false, false, 0, 8, 0.5, () => 0.5`), src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts (`Object.create(EfxPaintEngine.prototype)` private-poking harness at :40), src/core/productionAaSettleMeasurement.test.ts:126/322-326 and src/core/physicsWidthScaling.test.ts:93/284-288 (in-harness GRAIN/grainFn replication to remove in Task 3).
</context>

<tasks>

<task type="tdd">
  <name>Task 1: RED — three pins: no raster grain/emboss pass, flat height without paper, conditioned height map</name>
  <files>packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts, packages/efx-physic-paint/src/core/paperConditioning.test.ts</files>
  <behavior>
  - Pin 1 (paint.grainRemoval.test.ts), for BOTH pickup = 0 and pickup = 60: observer-wiring controls pass at base (collected stages include `paint-raster-geometry` and `paint-raster-layers`); the assertions that MUST FAIL at base are: no collected stage begins with `paint-grain-`, no collected stage begins with `paint-emboss-`, no collected stage equals `paint-raster-paper-emboss`, and the operation log contains no `put` entry (the grain/emboss writebacks are the raster's only putImageData); a source-shape leg reads src/brush/paint.ts and asserts the grain-fill helper identifier and the emboss-applier identifier are absent from the file (both present at base → fails).
  - Pin 2 (EfxPaintEngine.paperHeight.test.ts): `setPaperGrain('')` leaves `engine.paperHeight` strictly null (base: procedural fbm Float32Array → fails); `setPaperGrain('texture-load-failed-key')` with the key absent from paperTextures (the failed-load route) also yields null (fails at base); control that passes at base: a populated `paperTextures` entry returns that exact heightMap reference on paperHeight, texHeight, and physicsHeightMap; a source-shape leg asserts core/paper.ts no longer exports the procedural fbm generator and EfxPaintEngine.ts no longer imports it (fails at base).
  - Pin 3 (paperConditioning.test.ts): imports `conditionHeightMap` from ./paper (fails at base — export does not exist); (a) mean-centre: 256 inputs of 0.7 + symmetric jitter in [-0.1, 0.1] → output mean toBeCloseTo(0.5, 4) with no clamping involved; (b) clamp: input mixing 0.9 and 0.1 values (asymmetric mean) → every output ≥ 0.10 - 1e-6 and ≤ 0.90 + 1e-6 (the ±0.40 contrast law); (c) rank-monotone: non-decreasing input → non-decreasing output; (d) idempotence on the symmetric input: second pass elementwise toBeCloseTo first pass (precision 6); (e) source-shape: the loadPaperTexture body in core/paper.ts pipes its extraction through conditionHeightMap (substring search within the function's source region — fails at base).
  - Expected RED evidence: all three files fail at base (pins 1-2 on behavior + source-shape legs, pin 3 on the missing export); the control legs (observer wiring, texture-map hit) pass and prove the harnesses work.
  </behavior>
  <action>TDD RED step — write ONLY the three test files, zero production edits. Read src/brush/paint.continuation.test.ts first and mirror its harness exactly: the `canvasFactory(log)` stub (save/restore/beginPath/moveTo/lineTo/closePath/fill/stroke/translate/drawImage push to log, getImageData returns a zeroed Uint8ClampedArray, putImageData pushes 'put'), the `vi.stubGlobal('document', { createElement })` pattern, the seeded Math.random spy, the `wet()` Float32 buffer helper, and the 4-point PenPoint array with `opts = { size: 6, opacity: 75, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup, eraseStrength: 50, antiAlias: 0 }`. For pin 1, run `it.each([0, 60])` over pickup: build `paperHeight = new Float32Array(width * height).fill(0.5)` (non-null so the emboss branch is live at base), define `const stages: string[] = []` with observer `(stage: string) => { stages.push(stage) }`, and call renderPaintStroke with the CURRENT positional args ending `..., false, false, 0.45, 8, 0.5, () => 0.5, observer` (hasPenInput, wetPaper, embossStrength, embossStack, waterAmount, sampleHFn, observePrimitive — Task 2 will drop `0.45, 8` from this test when the signature shrinks). Assert the controls and the four negative behaviors from the behavior block. For pin 2, mirror src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts's `Object.create(EfxPaintEngine.prototype)` + Object.assign harness, assigning only what setPaperGrain touches: `requestRender: vi.fn()`, `flushPendingStrokeFinalizations: vi.fn()`, `displayCompositeDirty: false`, `currentPaperKey: ''`, `paperTextures: new Map()`, `width: 4`, `height: 4`, `texHeight: null`, `paperHeight: null`, `physicsHeightMap: null`. For pin 3, import the not-yet-existing export directly. Use `node:fs` readFileSync (with `new URL('./paint.ts', import.meta.url)` style paths) for the source-shape legs — this is a pure-function/source contract test, reading sibling source files is the established pattern for shape pins. Commit: test(260925-dso): RED — no raster grain/emboss pass, flat height without paper, conditioned height map. Do NOT touch any production file in this task.
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.grainRemoval.test.ts src/engine/EfxPaintEngine.paperHeight.test.ts src/core/paperConditioning.test.ts</automated>
  </verify>
  <done>Three pin files exist and run: pin-1 fails on the grain/emboss stage and writeback assertions plus the source-shape leg (controls green, both pickup values), pin-2 fails on the two null-height legs plus source-shape (map-hit control green), pin-3 fails on the missing export; RED output recorded (failing test name + expected/actual) for the SUMMARY; `git diff --name-only` shows zero production files; commit exists.</done>
</task>

<task type="tdd">
  <name>Task 2: GREEN — condition the height map, flatten the fallback, delete grain + emboss raster passes</name>
  <files>packages/efx-physic-paint/src/core/paper.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, packages/efx-physic-paint/src/brush/paint.ts, packages/efx-physic-paint/src/brush/erase.ts, packages/efx-physic-paint/src/brush/paint.continuation.test.ts, packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts</files>
  <behavior>
  - All three pin files GREEN: no grain/emboss stages or writeback during raster (both pickups), flat null height for grain-off and failed-load keys, conditioned height map (mean 0.5 / range [0.10, 0.90] / rank / idempotence / loadPaperTexture wiring).
  - paint.continuation.test.ts stays green after its positional-arg update (sequential vs resumable parity robust to grain removal).
  - documentFormat.test.ts green — 0.45 embossStrength round-trip intact (state field kept).
  - Full package suite returns base results (sole failure = pre-existing EfxPaintEngine.liveAlphaCache, ledger 74); `npm run check` (tsc) clean.
  </behavior>
  <action>GREEN step, in two commits. Commit 2a (height field): in core/paper.ts add the exported pure function `conditionHeightMap(raw: Float32Array): Float32Array` — pass 1 computes the arithmetic mean of the array, pass 2 writes `clamp(0.5 + (raw[i] - mean), 0.1, 0.9)` (locked decision: mean-centre to 0.5, contrast clamped to ±0.40 → output band [0.10, 0.90]); call it inside `loadPaperTexture` right after the extraction loop (paper.ts:49-52) so the resolved heightMap is the conditioned one — conditioning happens ONCE at texture load, and tex.heightMap/paperHeight/physicsHeightMap all share that one reference (Claude's discretion per CONTEXT: separate pure function at load time, not inline in setPaperGrain). Then delete the procedural fbm height-map generator (`ensureHeightMap`) from paper.ts entirely, and remove its now-orphaned imports (grep fbm/clamp usage in paper.ts first — keep whatever other functions still use). In EfxPaintEngine.ts: drop the deleted generator from the paper import (line 43) and collapse `setPaperGrain` to lookup-or-null: `const tex = this.paperTextures.get(key)`, then `this.texHeight = tex?.heightMap ?? null`, `this.paperHeight = tex?.heightMap ?? null`, `this.physicsHeightMap = this.paperHeight` — the `''` grain-off encoding and the texture-load-failure route (key absent because loadPaperTexture rejected) both land on null → flat (locked decision: no procedural fbm ever). Keep the requestRender / flushPendingStrokeFinalizations / displayCompositeDirty / currentPaperKey lines exactly as they are. Do NOT touch setEmbossStrength, the state defaults (0.45 / 8), SETTINGS_KEYS, or the validators — the format still requires the field. Commit 2b (raster deletion): in paint.ts delete the grain-fill helper (`fillPolyGrain`) and the emboss applier (`applyPaperEmboss`) outright, delete the `fbm` import (line 15, its only user), and in each of the three layer loops replace the even/odd branch with a single flat fill for every layer — use the same geometry `v = deform(baseD, variance * 0.2)` and the color expression the odd branch already uses (`color` in the pickup-0 and single-color loops, `segHex` in the segment loop) with each layer's own `lAlpha` (even layers keep `lAlpha`, NOT the odd branch's reduced trailing-pass alphas — only the fill mechanism changes); remove the three `paint-raster-paper-emboss` measurePrimitive blocks entirely; drop the `embossStrength, embossStack` parameters from `renderPaintStroke`, `createPaintStrokeRasterContinuation`, `createPaintStrokeRasterContinuationFromCurve`, `renderPaintStrokeSingleColor` and every internal pass-through of them (lines 436, 471). In erase.ts drop the unused `embossStrength` parameter (line 36) from `applyEraseStroke`. In EfxPaintEngine.ts remove `this.state.embossStrength, this.state.embossStack` from the createPaintStrokeRasterContinuation site (~2211) and the renderPaintStroke site (~2488-2489), and remove `this.state.embossStrength,` from the applyEraseStroke site (~2567) — remaining args keep their order. Update positional args in the two tests that pass them: paint.continuation.test.ts (drop `0, 8` at lines 56 and 59) and pin-1's paint.grainRemoval.test.ts (drop `0.45, 8`). `npm run check` (tsc) is the completeness net for any missed positional site. Commit 2a: feat(260925-dso): condition paper height map, flat fallback — no procedural fbm. Commit 2b: feat(260925-dso): delete bake-time grain/emboss raster passes. Guardrail: no edits to wet-layer.ts, compositor.ts, fluids.ts, drying.ts, types.ts, stroke.ts, canvas.ts, or anything under app/.
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.grainRemoval.test.ts src/engine/EfxPaintEngine.paperHeight.test.ts src/core/paperConditioning.test.ts src/brush/paint.continuation.test.ts src/engine/EfxPaintEngine.documentFormat.test.ts && ../../app/node_modules/.bin/vitest run && npm run check</automated>
  </verify>
  <done>All three pins GREEN plus continuation and documentFormat green; full package suite at base results (sole failure = pre-existing EfxPaintEngine.liveAlphaCache); tsc clean; setPaperGrain is pure lookup-or-null, loadPaperTexture resolves conditioned maps, the grain fill and emboss applier are gone from paint.ts with flat fills on every layer, emboss args gone from paint/erase signatures and engine call sites while state field/setEmbossStrength/validator untouched; guardrail diff list empty; RED evidence recorded before, GREEN after.</done>
</task>

<task type="auto">
  <name>Task 3: pyp/stb harness parity, guardrailed full battery, SUMMARY</name>
  <files>packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts, packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts, .planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-SUMMARY.md</files>
  <action>Restore calibration-oracle parity: both production-geometry measurement harnesses replicate the now-dead even-layer grain modulation in-harness. In productionAaSettleMeasurement.test.ts remove `const GRAIN = 0.4` (line 126), the `grainFn` parameter of compositePolygon (line 240) and its application `if (grainFn) src *= grainFn(lx, ly)` (line 290), and the even-layer grainFn construction at the call site (lines 321-326) — call compositePolygon without it; update the stale comments that describe grain inclusion (lines 20, 125, 321). Do the identical removal in physicsWidthScaling.test.ts (lines 93, 194, 244, 284-288). Do NOT touch physicsSettledFootprint.test.ts — its synthetic raster models production independently and its PIN 0/texture contracts are unaffected. Then run both harnesses plus physicsSettledFootprint and apply this decision tree: (a) everything green → proceed; (b) a calibrated numeric expectation moved (edge-band alpha distributions, sanity counts, width bands, body means) ONLY because removing the ≤20% grain alpha reduction raised even-layer edge alphas → recalibrate that expectation to the newly measured value keeping its law intent, and record before/after numbers in the SUMMARY; (c) a LAW gate fails — envelope W_visible ≤ 8, texture presence d(b) ≥ 1, PIN 0 body ratio 1.0000, PIN 0b opacity floors, held-pose determinism, hairline ceiling — or an rm2 boundary row flipped (tier 70), or holding the gate would require editing wet-layer.ts, compositor.ts, fluids.ts, drying.ts, depositAlpha/strokeOpacity, DEPOSIT_KEEP_TIER, or the conditioning law → STOP immediately, commit nothing further, and report the failing gate with measured numbers for a user decision (do NOT re-litigate rm2's tier 70 yourself). Guardrails, verified by diff scope: `git diff --name-only` must list only the expected files (the two harnesses + Task 1/2 files + SUMMARY) and must be EMPTY for packages/efx-physic-paint/src/core/wet-layer.ts, src/core/fluids.ts, src/core/drying.ts, src/render/compositor.ts, src/core/paper.ts (Task 2 already finished), src/types.ts, src/brush/stroke.ts, src/render/canvas.ts, and any package.json / pnpm-lock.yaml (T-dso-SC). Full battery: the two harnesses + footprint + all three pins + continuation, package-wide vitest (only the pre-existing liveAlphaCache may fail), the app suite (`cd /Users/lmarques/Dev/efx-motion-editor/app && ./node_modules/.bin/vitest run` — app files untouched, engine API surface kept), and `npm run check`. Finally write 260925-dso-SUMMARY.md with status automated-ready and these native UAT rows: (1) stroke silhouette edges are clean — no ragged noise-carved edge vs a pre-fix build side by side; (2) fresh layer / no paper (grain-off): settled stroke body shows no per-pixel deposit noise — flat physics height; (3) paper selected: deposit shows noticeable tooth/granulation (wet edges + adsorption valleys) WITHOUT pixel jitter — detail-normalized height; (4) stroke body opacity unchanged vs before (PIN 0 law, no wash-out); (5) settled footprint still matches the preview ribbon (260925-b7c law) — if any raggedness remains, note it: the bristle paper-height skip was deliberately left in place (known residual until 9b); (6) two identical held-pose strokes identical (determinism, no boil); (7) Normal mode unchanged — plus the informational note that the Grain-strength control remains visible but has no visual effect until 9b (expected interim, do not grade) and that paper tooth in the paint body is deferred to 9b. Record the RED evidence (Task 1 failures) and any before/after recalibrations in the SUMMARY. Leave the SUMMARY uncommitted per quick convention (follow the 260925-b7c precedent in this directory — orchestrator owns the docs commit).
  </action>
  <verify>
  <automated>cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/productionAaSettleMeasurement.test.ts src/core/physicsWidthScaling.test.ts src/core/physicsSettledFootprint.test.ts src/brush/paint.grainRemoval.test.ts src/engine/EfxPaintEngine.paperHeight.test.ts src/core/paperConditioning.test.ts && ../../app/node_modules/.bin/vitest run && npm run check && git diff --name-only -- packages/efx-physic-paint/src/core/wet-layer.ts packages/efx-physic-paint/src/core/fluids.ts packages/efx-physic-paint/src/core/drying.ts packages/efx-physic-paint/src/render/compositor.ts packages/efx-physic-paint/src/types.ts packages/efx-physic-paint/src/brush/stroke.ts packages/efx-physic-paint/src/render/canvas.ts</automated>
  </verify>
  <done>Both harnesses free of the grain replication and green (or recalibrated with before/after documented); all law gates hold — or the plan STOPped with a measured gate-by-gate report and no further commits; locked-surface diff list empty; full package suite at base results; app suite at base results; tsc clean; SUMMARY exists with status automated-ready, the 7 native UAT rows, the Grain-strength interim note, the 9b deferral note, and the RED evidence — no done claim before native UAT.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Local refactor inside the paint package: no new external input, no parsing, no network, no auth; the document format surface (EngineTrackSettings) is read-only in this quick |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-dso-01 | Repudiation | silent physics weakening via test-gate edits | medium | mitigate | Task 3 decision tree: law gates (envelope ≤ 8, texture d(b) ≥ 1, PIN 0/0b, determinism, hairline ceiling) may never be weakened — failure under (c) STOPs with a measured report instead of gate edits |
| T-dso-02 | Tampering | persisted document settings (embossStrength) | medium | mitigate | State field, defaults 0.45/8, setEmbossStrength, SETTINGS_KEYS and validator all kept; documentFormat round-trip test runs in Task 2's battery; clean-break law applies to nothing here because nothing stored changes |
| T-dso-03 | Elevation of Privilege | package installs during execution | high | mitigate | No installs in scope; Task 3 diff guardrail proves no package.json / pnpm-lock.yaml changes (T-dso-SC) |
| T-dso-04 | Information Disclosure | none — local vitest runs, no network, no auth, no user data | low | accept | External I/O out of scope |
</threat_model>

<verification>
- RED gate: Task 1's three vitest files fail at base with the pin-1 stage/writeback legs, pin-2 null-height legs, and pin-3 missing export as the failures; control legs green; zero production diffs.
- GREEN gate: same command exits 0 after Task 2 (pins + continuation + documentFormat); full package vitest matches base (sole failure = pre-existing EfxPaintEngine.liveAlphaCache); `npm run check` clean.
- Parity gate: pyp + stb harnesses contain no grain replication; law gates green or the plan STOPped with a report.
- Scope gate: locked-surface `git diff --name-only` list empty (wet-layer.ts, fluids.ts, drying.ts, compositor.ts, types.ts, stroke.ts, canvas.ts, package.json, pnpm-lock.yaml, app/ untouched); no installs, no push, no format change, no 9b composite pass.
</verification>

<success_criteria>
All three pins RED at base then GREEN; grain and emboss pixel passes deleted from the raster (zero grain/emboss stages, zero writebacks); height field flat without a paper (null, no procedural fbm anywhere) and conditioned with one (mean 0.5, band [0.10, 0.90]); simulation math and document format byte-identical; harnesses re-calibrated on the grain-free raster with law gates unweakened; SUMMARY status automated-ready with the 7 native UAT rows pending the user's live check (no done claim before native UAT).
</success_criteria>

<output>
Create `.planning/quick/260925-dso-kill-the-bake-time-visual-grain-and-cond/260925-dso-SUMMARY.md` when done (uncommitted per quick convention; orchestrator owns the docs commit)
</output>
