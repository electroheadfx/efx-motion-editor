# Quick Task 261125-kvl: Per-stroke translucent stroke layer (Edge transparency) - Research

**Researched:** 2026-11-25
**Domain:** WebGL2 paint engine (`packages/efx-watercolor`) + Studio/app wiring + probe harness
**Confidence:** HIGH (all in-repo claims read from the working tree this session; the frozen law is taken as given, not re-derived)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Mid-stroke interruption
- The layer is **DISCARDED** when a stroke is interrupted before its stroke-end (key leave, tool switch, sheet reset): clear the layer targets and leave the sheet exactly as it was before the stroke began.
- No merge runs on an interrupted stroke. No partial paint lands.

#### Layer allocation
- Layer targets are allocated **lazily, on the first stroke whose `edgeTransparency > 0`**, and kept for the engine's lifetime.
- At `edgeTransparency = 0` no layer target is ever allocated and no merge draw is ever submitted — this is gate row G4 and must be proven, not assumed.
- Targets are cleared (not freed) at every stroke end.

#### Delivery shape
- **One quick**, staged internally along the design's own four stages, executed as sequential tasks on the main tree (worktrees are disabled in this repo's config).
- The quick ends at **automated-ready**; the live UAT rows are handed to the artist, never claimed here.

#### Source commits for the Spec 10 plumbing (factual correction to the brief)
- The brief names `e08e356f9` as the source of the plumbing. Verified: `e08e356f9` carries the **records, UI rows and app tests** (`mediums.ts`, `aquarelleRecordState.ts`, `aquarelleParamVisibility.ts`, `mediumSelection`/`brushGroupMedium`/`AquarelleGlobalsPanel` tests).
- The **canonical params and the engine uniform plumbing** (`params.ts` `edgeFade`/`edgeFalloff`, `Engine.ts` `Params` defaults and `uEdgeStart`/`uEdgeFade`/`uEdgeFalloff` bindings) live in `1c5a27f4b`.
- Therefore the re-application must take **selected hunks from `1c5a27f4b`** (params + uniform bindings only) **plus the whole of `e08e356f9`'s record/UI/test surface**, excluding every film-law hunk (`bristles.ts` `bristleEdgeFilm`, `g.film` in `Gathered`, the `shaders.ts` film term, and the six law commits after `1c5a27f4b`).

### Claude's Discretion
- Probe scenario shape and naming (the design calls it `edge-layer`), the exact target formats and bind points, and the internal task decomposition across the design's four stages.

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md has no separate `## Deferred Ideas` section. The task boundary states the out-of-scope surface verbatim: "In scope: engine + Studio wiring. Out of scope: density/colour falloff, feather-noise work, any sheet-format change, any uniform/global stroke opacity, any display-alpha change, and the two pre-existing engine facts (stroke-start direction inheritance, capture-bbox drift) which must NOT be fixed."
</user_constraints>

## Summary

This is a wiring job, not a design job: the composite law, the encoder and the amount-0 bypass are frozen by spike 006, and every seam below already exists at a known line. The two findings that most shape the plan:

1. **Both stroke paths converge on one ending branch.** `processInput()`'s `s.ending` block (`Engine.ts:2748-2755`) runs for pointer strokes and for scripted/baked strokes alike, after the end-cap catch-up dab (:2728-2737) and before `onStrokeEnd`. `scriptEnd()` only sets `ending = true` (`Engine.ts:1511-1515`) and `tick()` calls `processInput()` (`Engine.ts:1572-1574`), so a single merge call placed in that branch satisfies G1, G2 and G3. The undo step is already open (`beginStep` at pointerdown `Engine.ts:2438` / `scriptBegin` `Engine.ts:1486`).
2. **Amount-0 byte identity is safest by construction, not by gate.** Adding a `uLayerOn` branch to `displayFS` or a `lateral` field to `struct Gathered` changes the SOURCE of every program that shares it, recompiles them, and can drift export bytes at amount 0 (the ujb UAT #4 codegen lesson). The plan should therefore put every new behaviour in NEW programs registered outside the pinned 23-entry literal (`Engine.ts:693-744`), leave the source text of `displayFS`, `bristleCoverFS`, `bristleDepositFS` and the shared `Gathered` struct untouched, and prove G4 against digest `36a3f71d` plus the ujb profile-identity mechanism (row tolerance `2e-4`) as the durable gate.

**Primary recommendation:** four sequential tasks = the design's four stages; stage 1 adds lazy layer targets + a TS-only `bristleInk` routing branch + the merge (identity at amount 0); stage 2 adds `bristleCoverLayerFS` (cover + lateral MRT, MIN on attachment 1) and a display-layer program; stage 3 wires the merge output back through the double-buffer (no swap; copy-back over the merge rect) and the probe gates; stage 4 is the artist UAT hand-off.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Layer targets (ink/cover/lateral/relief) | Engine document storage (`Engine.allocateTargets`, :798) | GL wrapper (`gl.ts` Target/DoubleTarget) | Targets are engine-owned document memory; the GL wrapper only allocates |
| Deposit routing into the layer | Engine deposit (`bristleInk`, :3715) | Shaders (existing `bristleDepositFS`/`bristleCoverFS` sources untouched) | The route is a TS branch selecting bound targets, not a shader law change |
| Lateral field accumulation | GPU shader pass (new `bristleCoverLayerFS`) | Engine draw call (per-attachment blend state) | Per-texel MIN is a blend-equation behaviour, not CPU bookkeeping |
| Stroke-end merge | Engine lifecycle (`processInput` ending branch, :2748) | GPU merge program + copy-back | One call site serves pointer, scripted and bake strokes |
| Live display of the layer | GPU display (`displayFS` family) | `Engine.drawDisplay` (:4226) bind + live-only gate | Exports must keep the sheet-only program; the gate mirrors `uUnderlayOn` |
| Capture / cache / undo / bake | Engine sheet seams (`captureWhole` :994, history :3850) | None | The merge lands in the sheet before any of these read it |
| Params / UI | App + package records (`params.ts`, `mediums.ts`, `aquarelle*` files from `e08e356f9`) | Engine uniform bindings (`1c5a27f4b`) | Re-apply the reverted Spec 10 plumbing, excluding film-law hunks |
| Verification | Probe harness (`probe/medium-engine`) | vitest + tsc | The harness is the only place the law can be measured |

## Key files and line numbers

| Concern | File:lines | Action |
|---------|-----------|--------|
| Stroke-end convergence | `packages/efx-watercolor/src/playground/Engine.ts:2748-2755` | Put the merge call inside `if (s.ending)` before `this.stroke = null` or use the local `s`; it must run for `SCRIPT_POINTER` too |
| Scripted end | `Engine.ts:1511-1515` (`scriptEnd`), `:1572-1574` (`tick` -> `processInput`) | No change needed; confirms G2/G3 inheritance |
| Scripted begin + undo step | `Engine.ts:1484-1501`; `if (step !== false) this.beginStep('script', step);` (:1486); `dx: this.lastDir[0], dy: this.lastDir[1], angle: this.lastAngle, azimuth: null,` (:1494) | The merge runs inside this step |
| Pointer begin + undo step | `Engine.ts:2430-2438`; `this.beginStep('stroke', STROKE_LABEL[tool]);` (:2438) | Same step; no new step for the merge |
| Stroke state (needs a rect) | `Engine.ts:317-345` — `interface Stroke` has no rect field | Add a layer/merge rect accumulator (e.g. `layerRect: Rect \| null`) unioned in `bristleInk` |
| Interruption seams | `Engine.ts` `clear()` :2155 (`this.stroke = null;` :2156), `resetSheet()` :2186 (:2187), `abortStroke()` :2202 (:2205), `restore()` :1169 (:1172) | Clear the layer here; `clear`/`resetSheet` wipe the sheet anyway, `abortStroke` travels undo |
| End triggers (not interruption) | `Engine.ts:2467` (tablet hover -> `ending = true`), :2475-2481 (pointerup/pointercancel -> `ending = true`), :2484 (window blur -> `ending = true`) | These FINALIZE; do not route them to the discard path |
| Target allocation | `Engine.ts:798-839`; `this.ink = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);` (:806), `this.fixed = g.target(...)` (:807), `this.relief = g.target(..., [HALF_FLOAT_R], gl.LINEAR);` (:811), `this.cover = g.double(..., [HALF_FLOAT_R], gl.LINEAR);` (:814) | Add a lazy `allocateLayerTargets()` called from the first Edge-active stroke |
| Target disposal | `Engine.ts:879-895` (`docTargets()`) | Add layer targets so doc resize frees them |
| Deposit draws | `Engine.ts:3715-3764` — four draws: attenuation on `ink.read` (:3732-3734), `g.draw(this.fixed, rect);` (:3743), carried on `ink.read` (:3745-3747), cover on `cover.read` (:3755-3762) | Layer path: draw 1+3 into `layerInk`, cover into `layerCover` via the NEW layered cover program, SKIP the `fixed` draw, never touch sheet cover/relief/lastTouch |
| Deposit rect | `Engine.ts:3719-3720` `const rect = this.stampRect(x, y, r, this.dw, this.dh, 1.6); this.touch(rect);` | Still required for undo/active/dirty bookkeeping; union it into the stroke's merge rect |
| Lateral source | `packages/efx-watercolor/src/playground/shaders.ts:1095-1098` and `:1163` `float lateral = abs(across);` | `across` is derived only from `vUv`, `uPoint`, `uAxis`, `uRadius`, `uSheetAspect` — recompute in the new program, do NOT widen `struct Gathered` (:1080-1086) |
| Cover program | `shaders.ts:1410-1440` (`bristleCoverFS`) — footprint discard :1417, `if (a <= 1e-3) discard;` :1418-1420, `float target = a * uCoverTarget * g.alpha;` :1424, `o0 = vec4(target, 0.0, 0.0, a);` :1439 | Copy into a NEW 2-output `bristleCoverLayerFS`; keep the shipped program source byte-identical |
| Display program | `shaders.ts:1842-2064` (`displayFS`); band reconstruction `${displayBasisGLSL()}` :1940-1942; `uLayerOn`-style precedents :2009-2019 | Preferred: a NEW layer display program built from a `#define` variant of the same source, so `displayFS` SASS is unchanged at amount 0 |
| Band GLSL emitter | `packages/efx-watercolor/src/playground/spectral.ts:152-196` (`displayBasisGLSL`) | It references locals `a`, `b`, `scatter`, `rgb`, `tr`; a second evaluation needs the spike's `rgbOf(a,b,s)` function pattern (probe `merge.ts:742-746`) or a renamed-instantiation refactor |
| Display bind points | `Engine.ts:4226-4283` (`drawDisplay`) — units 0-9 bound; `const underlayLive = target === null && mode === MODE.pigment && this.underlayTex !== null;` (:4268), `gl.uniform1i(p.u.uUnderlayOn, underlayLive ? 1 : 0);` (:4270), `g.draw(target, scissor, this.canvasSize);` (:4282) | Bind layer textures at units 10-13 and gate them on the live render (`target === null`), mirroring the underlay seam |
| Live render call | `Engine.ts:4297` `this.drawDisplay(null, this.view, rect, false, this.compositorLayer ? MODE.pigment : MODE.screen);` | The only on-screen call; every export goes through `readback` (`Engine.ts:2364-2383`) |
| Sheet capture | `Engine.ts:994-1016` (`captureWhole`) reads `this.ink.read.views[0/1]`, `this.fixed.views[0/1]`, `this.wet.read.views[0]`, `this.relief.views[0]`, `this.cover.read.views[0]`, `this.lastTouch.read.views[0]` | The merge must leave the READ halves current (see Q4) |
| Ping-pong writes | `Engine.ts:4128` `g.draw(this.ink.write, rect); this.ink.swap();`; :4157 `g.draw(this.cover.write, rect); this.cover.swap();`; `uploadWhole` fills BOTH halves (:1034, :1037, :1041) | A partial-rect write + swap on the merge would make `read` stale outside the merge rect (Q4) |
| Undo protection | `Engine.ts:3845-3851` — `touch()` calls `protectHistory(0, rect+margin, this.snapshotLayers())`; `snapshotLayers()` :3859-3865; `protectHistory` :4018-4021 `if (!this.stepRecording) return; this.history.protect(p, rect, layers);` | Every dab already protects the merge rect before paint; the merge itself needs no new protection (add one only as a defensive no-op) |
| Program registry | `Engine.ts:693-744` — pinned 23-entry literal; new programs appended outside it (`this.programs.bristleCover` etc.); `coverageLifecycle.test.ts:229-235` pins that pattern | Register `bristleCoverLayer`, the layer display variant and `strokeLayerMerge` outside the literal |
| Probe scenario | `packages/efx-watercolor/probe/medium-engine/probe.ts:2273-2517` (`lineProfileSet`), :2784-2835 (`driveBristleEnd` pointer-path model), :3320 (dispatch ternary), :3388-3395 (adapter), :3446-3461 (script drive) | Add `edge-layer`; `lineProfileSet` returns `{ centreRow, peakCover, interior, rim, halo, offsets, across: { cover, dark, ink }, stations, tiling }` (no `print` in the current tree) |
| Probe CLI | `run.mjs` query builder :462-478, scenario whitelist :304-306, baseline dir `probe/medium-engine/baselines/` | Add `edge-layer` to the whitelist and any `--edge`/`--falloff` flags the scenario needs |
| Comparator | `compare.mjs:155-156` (`DIGESTS`, `FIELDS`), `alphaLawFailures` :198-..., bristle predicate :220 `const bristle = String(data.scenario).startsWith('bristle-')`, `SCENARIO_INVARIANTS` :1229-1240, invariant runner :1246-1249, baseline resolution :1386-1430, field-equality loop :1573-1605 | Add `edge-layer` to the alpha-law predicate and to the invariant set; reintroduce the ujb identity machinery (Q6) |
| Reverted edge scenario (source material) | `git show 5e6e7a37a^:packages/efx-watercolor/probe/medium-engine/probe.ts` and `.../compare.mjs` | `edgeTransparencyScript()`, `edgeTransparencyMetrics`, the `EDGE_*` tolerances and the `edgeDrift` field-loop exemption are all there; recover, do not redesign |
| Scripted adapter | `packages/efx-watercolor/src/adapter/engineAdapter.ts:477-521` (`feedDueSample` -> `engine.scriptEnd()` at :518-520), :613-639 (`applyStroke` feeds all samples then `engine.tick(HOST_DT)`) | G2/G3 need no change here, only the engine call |
| Plumbing to re-apply | `git show 1c5a27f4b` (`params.ts`, `Engine.ts` `Params`/`DEFAULT_PARAMS`, `bindGather` edge uniforms, `bristles.ts` constants) + `git show e08e356f9` (`mediums.ts`, `aquarelleRecordState.ts`, `aquarelleParamVisibility.ts`, app pins) | Selected hunks only; exclude `bristleEdgeShift`/`bristleEdgeFilm`/film law |
| Feather constant | `packages/efx-watercolor/src/playground/bristles.ts:236` `export const BRISTLE_FEATHER_EDGE = 0.66;` | `uFeatherEdge` in the frozen law; `BRISTLE_EDGE_START = 0.3` exists only in `1c5a27f4b` and must be re-applied |

## Q1 - Where the merge hooks into the stroke lifecycle

**Answer: one call site, `processInput()`'s `s.ending` branch, and it already serves pointer + scripted + bake.**

Verified verbatim (`Engine.ts:2748-2755`):

```ts
if (s.ending) {
  this.stroke = null;
  this.restoreStrokePigment();
  if (s.pointerId !== SCRIPT_POINTER) {
    this.callbacks.onStrokeTool?.(null);
    this.callbacks.onStrokeEnd?.(s.tool);
  }
}
```

- `scriptEnd()` is `this.stroke!.ending = true;` (`:1513`); `tick(dt)` calls `this.processInput(dt);` (`:1572-1574`). So a scripted stroke ends in the same block.
- The adapter's `applyStroke()` calls `feedDueSample(Number.MAX_SAFE_INTEGER)` then `engine.tick(HOST_DT)` (`engineAdapter.ts:613-639`); `feedDueSample` calls `engine.scriptEnd()` when the queue is exhausted (`:518-520`). The bake replay, Studio apply and capture all inherit the merge with zero extra wiring (G2, G3).
- The end-cap catch-up dab runs at `:2728-2737` BEFORE the ending block, so the merge necessarily includes the end cap.
- The undo step is already open: `beginStep('stroke', STROKE_LABEL[tool])` at pointerdown (`:2438`), `beginStep('script', step)` at `scriptBegin` (`:1486`). The merge must NOT open a step; it runs inside the stroke's own transaction.
- `this.stroke = null` at :2749 means the merge must run before that line or use the local `s`. The merge rect is not on `Stroke` today (`interface Stroke` `:317-345` has no rect), so add an accumulator (e.g. `layerRect`) unioned in `bristleInk` after `:3719`, or carry a local union into a new engine field reset at stroke begin.
- **Interruption vs ending:** the discard decision needs its own path. The paths that null `this.stroke` outside the ending branch are `clear()` (:2155-2156), `resetSheet()` (:2186-2187), `abortStroke()` (:2202-2205) and `restore()` (:1169-1172). `clear`/`resetSheet` wipe the sheet, so dropping the layer there is trivially correct; `abortStroke` travels undo, which restores the pre-stroke sheet. All four must clear the layer targets so a later stroke cannot merge stale layer paint. Note pointerup, pointercancel and window blur set `ending = true` (`:2475-2484`), and the tablet-hover guard sets it at `:2467` — those are normal ends, not interruptions, and must still merge.
- The pre-stroke undo protection already covers the merge rect: `touch(rect)` (`:3845-3851`) protects `snapshotLayers()` with `PROTECT_MARGIN` on every dab rect, and the merge rect is the union of those dab rects. Do not add a second step.

## Q2 - How `bristleInk()` routes into layer targets and writes the lateral MIN field

**Answer: a TS-only four-draw branch in `bristleInk`, plus ONE new cover program that emits two attachments. Do not edit `bristleCoverFS` or `struct Gathered`.**

`bristleInk()` (`Engine.ts:3715-3764`) is exactly four draws on one shared rect:

1. `gl.uniform1i(d.u.uMode!, 1); gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); g.draw(this.ink.read, rect);` (:3732-3734) - the layer's ink attenuation target is `layerInk`.
2. `g.draw(this.fixed, rect);` (:3743) - the settled-half attenuation. **SKIP in the layer path** (the layer has no settled pool). This is the load-bearing "which draw to skip".
3. `gl.uniform1i(d.u.uMode!, 0); gl.blendFunc(gl.ONE, gl.ONE); g.draw(this.ink.read, rect);` (:3745-3747) - the carried add, into `layerInk`.
4. `c.bind(); this.bindGather(c, ...); gl.uniform1f(c.u.uCoverTarget!, bodyAlpha); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); g.draw(this.cover.read, rect);` (:3755-3762) - into `layerCover`, via the new program, which also writes `layerLateral`.

The deposit program itself (`bristleDepositFS`) is unchanged: only the bound target changes. That keeps the amount-0 SASS and export bytes of the shipped deposit path intact.

**The lateral field.** `lateral` is computed inside `gatherBristle` as `float lateral = abs(across);` (`shaders.ts:1163`), but `across` is fully recoverable from uniforms in any fragment:

```glsl
vec2 p = uv - uPoint;
p.x *= uSheetAspect;
vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
float across = q.x;
```

(`shaders.ts:1095-1098`). The plan must NOT add a field to `struct Gathered` (`shaders.ts:1080-1086`): that struct is spliced into every bristle program, so editing it rewrites the source of `bristleDeposit`, `bristleCover`, `bristleRelief`, `bristleTouch`, `bristleCarrier` and `bristleSnapshot` and can drift the amount-0 digest. Instead, `bristleCoverLayerFS` is a COPY of `bristleCoverFS` (:1410-1440) that recomputes the 4 lines above in `main()` and adds a second output:

```glsl
layout(location = 0) out vec4 o0;   // cover, as shipped: vec4(target, 0.0, 0.0, a)
layout(location = 1) out vec4 o1;   // lateral: vec4(clamp(abs(across) / uFeatherEdge, 0.0, 1.0))
```

with per-attachment blend: `gl.blendFunci(0, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` and `gl.blendEquationi(1, gl.MIN)`. Keeping the shipped `if (a <= 1e-3) discard;` (:1418-1420) is safe: a fragment that deposits no cover does not need to write lateral, because `A_eff = A * cover_L` makes `u` irrelevant wherever `cover_L` is zero. The new program is registered outside the 23-entry literal (`Engine.ts:693-744`) and the pin test pattern at `coverageLifecycle.test.ts:229-235` covers it.

**Pitfall the plan must carry:** `gl.clearTarget()` hardcodes `gl.clearColor(0, 0, 0, 0);` (`gl.ts:131-138`). The lateral field must be cleared to **1.0** at every stroke start (and end), or the MIN blend starts from 0 everywhere and `u = 0` makes the whole stroke read as core. Either extend `clearTarget` with a colour argument or add a dedicated lateral clear. `layerCover` clears to 0 as usual.

**Memory:** 2 x RGBA16F + 2 x R16F (cover, lateral) + 1 x R16F (relief) at sheet size, lazily allocated and kept. Approximately 23 MB at 1080 squared, approximately 250 MB at 4K (DESIGN section 5); measure before shipping.

## Q3 - `displayFS` and the `uLayerOn` branch

**Answer: prefer a second display program compiled from the same source with a define, bound only while a layer is live. Exports keep the untouched `displayFS` and bind the sheet-only path.**

What `displayFS` does today (`shaders.ts:1842-2064`):

- Samples the sheet's read halves: `vec4 a = texture(uInkA, uv) + texture(uFixedA, uv); vec3 b = iB.rgb + fB.rgb; float scatter = iB.a + fB.a;` (:1910-1915).
- Reconstructs the 16 bands inline: `vec3 rgb = vec3(0.0); float tr;` then `${displayBasisGLSL()}` (:1940-1942). `displayBasisGLSL` (`spectral.ts:152-196`) references locals `a`, `b`, `scatter` and writes `rgb`/`tr`, so a second evaluation on layer state needs the spike's function pattern `vec3 rgbOf(vec4 a, vec3 b, float s)` (`probe/merge.ts:742-746`) or a renamed instantiation.
- Existing live-only gate precedent: `underlayLive` (`Engine.ts:4268`) combines `target === null` with a mode test; exports always get `uUnderlayOn = 0`.

Recommended shape:

1. Add a `#define STROKE_LAYER_ON 0/1` (or an equivalent codegen split) around the band mix in the `displayFS` SOURCE FAMILY, and compile two programs from it: the shipped 0 variant (byte-identical source to today) and the layer variant used only on the live compositor render. `Engine.drawDisplay` (`:4226-4283`) binds `layerInk` (2 textures), `layerCover`, `layerLateral` at units 10-13 and selects the layer program only when `target === null`, `uLayerOn > 0` and a layer is open. Exports (`readback` :2364-2383, `exportCanvas` :1595-1625) never see it.
2. The layer branch evaluates the frozen law per band: sheet `a`/`b`/`scatter` from `uInk*`+`uFixed*`, layer `a`/`b`/`scatter` from `layerInk*`, `u` from `layerLateral.r` (already clamped 0..1 at write time), `e = exp2(2.0 * uFalloff - 1.0)`, `A = 1.0 - uAmount * pow(t, e)`, `aEff = clamp(A * lc, 0.0, 1.0)`, then `mix(base, layer, aEff)` per band reconstruction, exactly like `displayCostShader`'s `oColor = vec4(mix(base, layer, aEff), 1.0);` (`probe/merge.ts:761-763`). Note the spike's `uMode == 2` early-out: when `lc <= 1.0 / 65504.0`, fall back to the base (do not evaluate a zero-alpha layer).

If the planner chooses instead to put a single `uLayerOn` uniform branch into the shipped `displayFS` (what DESIGN section 4 names), then the amount-0 gate MUST be profile identity, not digest equality (Q6) - the source change can drift the export SASS even with the branch not taken. The define variant avoids that risk entirely and is within Claude's discretion on bind points.

## Q4 - What the merge shader samples and writes (incl. the double-buffer hazard)

**Answer: sample `ink.read + fixed` (G5), layer state, `cover.read` and `relief`; produce `fit - fixed` into the ink halves, `cover_out` and `relief_out`; do NOT swap the doubles - copy back over the merge rect.**

The spike shader (`probe/merge.ts:117-130`) takes a pre-summed `uBaseA/uBaseB`, `uLayerA/uLayerB`, `uCover`, `uLateral`, `uSeedA/uSeedB`, and writes the FIT only:

```glsl
uniform sampler2D uBaseA, uBaseB, uLayerA, uLayerB, uCover, uLateral, uSeedA, uSeedB;
uniform vec2 uOutSize;
uniform float uAmount, uStart, uFalloff;
uniform int uMaxIter, uSeedOn, uCoreSkip, uDebug;
```

The composite core is `:186-189` (`t`, `e`, `A`, `aEff = clamp(A * cover, 0.0, 1.0)`), with exact endpoints at `:200-201` and the seed `mix(base, layer, aEff)` at `:212-214`. The engine variant must add `uFixedA`/`uFixedB` and sum in-shader (`uBase = texture(uInk, uv) + texture(uFixed, uv)`) to satisfy G5 - in the same visit the earlier stroke's paint may still sit in `ink` (RESUME gate G5; `probe/q4.ts:758`).

Write-back, frozen by the spike (`probe/q4.ts:32` and `:790`, `probe/sheet.ts:148-153`): the merge writes `fit - fixed` into the ink halves, leaving `fixed` untouched, so the display's `ink + fixed` sums to `fit`:

```
//    write-back  in place: ink = fit − fixed, display = ink + fixed = fit
writeBack: 'in place: ink = fit - fixed; display = ink + fixed = fit'
```

Concretely: `oA = fitA - texture(uFixedA, uv)` (all 4 channels), `oB = fitB - texture(uFixedB, uv)` (including `.a = S`), `cover_out = 1.0 - (1.0 - cover_S) * (1.0 - A * cover_L)`, `relief_out = relief_S + aEff * relief_L`.

**MRT layout constraint:** the existing `ink` double target has exactly 2 attachments (`gl.ts:84-118` builds one attachment per format). Rendering `oA`, `oB`, `oCover` and `oRelief` in one draw needs 4 attachments, so the merge must render into targets with matching layouts or split passes. Minimal decomposition:

- Pass 1 (the ~21 ms LM fit): render into `ink.write` (2 attachments) - the expensive pass, shader identical to the spike plus the in-shader `+ fixed` sum and the `- fixed` output subtraction.
- Pass 2 (cheap, pointwise): `cover_out` into `cover.write` (1 attachment).
- Pass 3 (cheap): `relief_out` into a transient `mergeRelief` R16F scratch (1 attachment), because `relief` is a single target and a fragment cannot sample and render it in one pass (`relief` is `Target`, not `DoubleTarget`, `Engine.ts:811`).
- Copy back: `ink.write -> ink.read`, `cover.write -> cover.read`, `mergeRelief -> relief`, over the merge rect only. Then clear the layer targets.

**The ping-pong hazard (verified, must be in the plan):** `step()` draws into `this.ink.write` then `this.ink.swap()` (`:4128`), and likewise cover (`:4157`); `captureWhole()` reads `this.ink.read`/`this.cover.read` (`:1008-1014`) and display binds `read` (`:4230-4231`, `:4264`). Immediately after a swap, the two halves differ inside the rect the advect drew, and the merge rect is not guaranteed to contain that rect. Drawing the merge into `write` and then swapping would therefore make `read` stale inside `(lastAdvectRect - mergeRect)` and silently lose paint on capture. So: write, then **copy back into `read` over the merge rect WITHOUT swapping**, keeping `read` authoritative. `gl.blit` (`gl.ts:184-191`) copies FBO to FBO only between framebuffers with the same attachment count (so 2-att ink halves pair, and 1-att cover/relief pair), but half-float blit support should be verified on Metal and SwiftShader; a trivial copy program per target is the guaranteed fallback. The probe must assert the sheet before/after the merge matches outside the rect (add to the G-series).

Also: because the layer path calls `touch(rect)` (needed for `everPainted`, dirty and undo), the sheet's `active`/`painted` bookkeeping will extend over the stroke rect even though the sheet is not painted until the merge. That is intended for pickup (pickup stays sheet-side) but the wet/pickup UAT row must cover it (DESIGN section 7.6).

## Q5 - The probe harness contract

**Answer: add an `edge-layer` scenario that reuses the reverted `edge-transparency` machinery, drive both a live pointer stroke and a scripted/adapter stroke, and commit pre-change baselines.**

- Scenario dispatch lives in `probe.ts:3320` (nested ternary); scenario names are whitelisted in `run.mjs:304-306`. A new name must also be added to `compare.mjs`'s `alphaLawFailures` bristle predicate (`:220`, currently `String(data.scenario).startsWith('bristle-')`) or the visible-alpha law will fail the scenario, and to `SCENARIO_INVARIANTS` (`:1229-1240`) if it carries an invariant.
- `lineProfileSet(engine)` (`probe.ts:2273-2517`) is the profile reader; in the current tree it returns `{ centreRow, peakCover, interior, rim, halo, offsets, across: { cover, dark, ink }, stations, tiling: { rows, coherence, enclosed } }` - the `print` array the reverted edge metrics used is gone, so if the plan wants print retention it must be readded.
- Pointer path (G1): `driveBristleEnd(adapter, engine, drive, body, strokeSize)` (`probe.ts:2784-2835`) is the working model - `engine.scriptBegin(...)`, relabel `stroke.pointerId = END_LIVE_POINTER`, push into `live.queue` and `engine.tick(END_DT)`, then `stroke.ending = true; engine.tick(END_DT);` with settle + fence. Copy this to a `driveEdgeLayerEnd` that sets `edgeTransparency > 0` and asserts the merge ran.
- Scripted path (G2/G3): the adapter loop at `probe.ts:3446-3461` (`adapter.applyStroke(makeStroke(entry))` + `adapter.stepTick(tick)`), with `createAquarelleEngineAdapter({ width: sheet, height: sheet, paperPreset: COLD, paperStrength: PAPER_STRENGTH })` (`:3388-3395`).
- Source material for the reverted scenario: `git show 5e6e7a37a^:packages/efx-watercolor/probe/medium-engine/probe.ts` and `.../compare.mjs` - it contains `edgeTransparencyScript()`, `edgeTransparencyMetrics` (`strokeBrush, edgeAmount, edgeFalloff, edgeAcross { offsets, cover, ink, dark, print }, edgeTiling`), `isBristleCapture`, the `--edge`/`--falloff` CLI flags (`run.mjs:318-347` pre-revert, appended at `:514`), and the comparator's `EDGE_*` tolerances. Recover, do not redesign.
- Baselines: `baselines/<gate>.json` committed from the PRE-change tree; the comparator (mode 1) resolves the self baseline at `join(here, 'baselines', `${gate}.json`)` and the actual at `join(tmpDir, `${gate}.json`)` (`compare.mjs:1386-1430`), then requires every `FIELDS` entry equal (`:1573-1605`). The revert deleted `edge-transparency-neutral.json` and `edge-transparency-neutral-broad.json`; new `edge-layer` baselines must be captured before any shader edit.
- Probe reference digests (RESUME): amount-0 visit `36a3f71d`; merged sheet `3170f21b` (frozen encoder, falloff 50, same-visit stroke).
- Environment verified this session: node v24.15.0, pnpm 10.27.0, Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, esbuild 0.27.7 resolved from `node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild` (`run.mjs:479-483`).

## Q6 - How amount-0 byte identity is proven (the mechanism the plan should use)

**Answer: profile identity as the gate (row tolerance `2e-4`), digest equality as drift evidence; capture the digest `36a3f71d` as the headline but do not fail the plan on digest drift alone.**

The ujb UAT #4 lesson: adding shader dataflow can reorder GPU instruction scheduling and drift export digests while the scene is identical. The current tree contains NO profile-identity comparator - the revert removed it. The mechanism to reintroduce (verbatim from `git show 5e6e7a37a^:...compare.mjs`):

```js
const EDGE_IDENTITY_TOLERANCE = 2e-4  // the profile arrays are recorded at four decimals, so a row may move by one rounding step under GPU ULP drift (measured 2026-11-25: every row identical to 4 dp)
```

plus the field-loop exemption:

```js
const edgeIdentity =
  mode === 'baseline' && actual.gate.startsWith('edge-transparency') && actual.edgeAmount === 0
if (a !== b) {
  if (edgeIdentity && field.startsWith('digest')) {
    edgeDrift += 1
    ...
  } else { differing += 1; ... }
}
```

and the PASS note "all ${FIELDS.length} fields equal except ${edgeDrift} digest(s), drifted within the amount-0 profile-identity tolerance (ULP-level GPU codegen, not a law change)".

The plan should: (1) assert the profile rows (cover, ink, dark, print/stations) against the neutral baseline at `2e-4` for the amount-0 `edge-layer` scenario; (2) print the digest comparison (`36a3f71d`) and count differences as `edgeDrift`, failing only if profile rows move; (3) additionally assert G4 structurally - no layer target allocated, no merge draw submitted - since that is what the decision demands ("proven, not assumed"). Structural proof options: expose a test-only counter/flag on the engine (`layerAllocated`, `mergeDraws`) read by the probe, or infer from `gl.getParameter` allocations. A counter is simpler and does not change shader source.

## Q7 - Pitfalls the plan must encode

1. **`alphaLawFailures` bristle predicate** - `compare.mjs:220` only exempts scenarios starting with `bristle-`; the new scenario name must be added or the visible-alpha law fails it (the pre-revert code extended it to `edge-transparency`).
2. **Do not widen `struct Gathered`** (`shaders.ts:1080-1086`) - it is shared by six bristle programs; recompute `abs(across)` in the new program (Q2).
3. **`gl.clearTarget` writes 0** (`gl.ts:131-138`) - the lateral field must start at 1.0 or the MIN blend collapses `u` to 0.
4. **Ping-pong write-back** - merge into `write` then swap makes `read` stale outside the merge rect (`Engine.ts:4128`, `:4157`, capture at `:1008-1014`); copy back over the rect, no swap (Q4).
5. **Build before app tests** - the app resolves `packages/efx-watercolor` through `dist` (package `exports` map); run `pnpm --dir packages/efx-watercolor build` before `app` vitest/typecheck. Package scripts: `build: tsup`, `check: tsc --noEmit`, `test: vitest run`; app `test: vitest` is watch by default - always `vitest run` (CLAUDE.md).
6. **Determinism** - the engine pins its RNG (`setRandom(seededRandom(1))` in the adapter reset); use the ADAPTER's `resetSheet()`, not the engine's, for a from-scratch replay (it rewinds the virtual clock and re-seeds). The engine carries `lastDir`/`lastAngle` into the next stroke's first dab (`Engine.ts:521-522`, `:1494`, `:2433`); pin them for Q4-style digests.
7. **Capture crop drift** - the crop is the `everPainted` bbox and drifts by a band between in-process replays (7 px at 540 squared, 16-17 px at 2K) while the paint is byte-identical; compare display bytes or the union, never two differently cropped arrays. `lastTouch` is the one layer not zero outside the crop.
8. **`gl.finish()` is not a fence** - use a 1x1 `readPixels`; run-to-run timing drift is +/-10 % at 2K, so gate on the fused numbers or interleave candidates.
9. **`readHalf` returns half bit patterns** - decode with `fromHalf` before comparing.
10. **The merge at 4K** - DESIGN section 5 says measure before shipping; the layer set plus the merge scratch at 4K should be budgeted explicitly (the 160 MiB ceiling).
11. **Do not reintroduce any of the six rejected parameter laws** (ujb SUMMARY); `bristleEdgeShift` from `1c5a27f4b` is part of the rejected dissolve and MUST be excluded from the re-application.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coefficient fit | Any new encoder | The frozen shader in `probe/merge.ts` (8 bands `[1,3,5,7,9,10,11,13]`, rank-one Jacobian, 4 LM iterations, seed `mix(base, layer, aEff)`) | Measured `<=2/255`; alternatives measured worse |
| Live band math | A CPU mirror | `${displayBasisGLSL()}` (or a renamed instantiation) + the spike's `rgbOf(a,b,s)` pattern | Guarantees the layer and the sheet reconstruct the same 16 bands |
| Undo coverage | A new history pool for layer paint | Existing `touch()`/`protectHistory(0, ...)` on every dab rect | The merge rect is already protected pre-stroke |
| Probe scenario | A new harness | `lineProfileSet`, `driveBristleEnd`, the adapter loop, the reverted `edge-transparency` sources | Every seam exists; a new harness would fork the determinism rules |
| Identity comparison | A new comparator | The reverted `EDGE_IDENTITY_TOLERANCE = 2e-4` machinery | Proven through ujb UAT #4 |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 (package), vitest (app) |
| Config file | none - default include (`vitest` collects `*.test.ts`, which includes `probe/medium-engine/harness.test.ts`) |
| Quick run command | `pnpm --dir packages/efx-watercolor test` (script `test: vitest run`), `pnpm --dir app exec vitest run` |
| Full suite command | package `pnpm --dir packages/efx-watercolor check && pnpm --dir packages/efx-watercolor test && pnpm --dir packages/efx-watercolor build && pnpm --dir app typecheck && pnpm --dir app exec vitest run` |
| Probe gate | `node packages/efx-watercolor/probe/medium-engine/run.mjs --scenario edge-layer --size 2048 --gate edge-layer-neutral` then `node .../compare.mjs --gate edge-layer-neutral` (mode 1) |

### Phase Requirements -> Test Map

| Gate | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|--------------|
| G1 | Pointer stroke merges once at stroke end before the next stroke reads the sheet | probe | `run.mjs --scenario edge-layer --size 2048` (pointer drive) | Wave 0 |
| G2 | Scripted stroke (`applyStroke`) runs the same merge | probe | `run.mjs --scenario edge-layer --size 2048` (adapter drive) | Wave 0 |
| G3 | Bake replay renders byte-identical/within tolerance of the live display | probe | `run.mjs --scenario edge-layer --size 2048` + replay comparison | Wave 0 |
| G4 | Amount 0: no layer allocation, no merge draw, capture == `36a3f71d` | probe + unit | `run.mjs --scenario edge-layer --edge 0` + engine counter assert | Wave 0 |
| G5 | Merge fed the summed base (`ink.read + fixed`) | probe | `run.mjs --scenario edge-layer` same-visit two-stroke scene | Wave 0 |
| Bars 1-4 | Identity, continuity, glaze-not-wash, falloff ordering | probe | `run.mjs --scenario edge-layer` profiles | Wave 0 |
| Bar 5 | Encoder/re-render `<=2/255`; live vs merged within 2/255 | probe | `run.mjs --scenario edge-layer` | Wave 0 |
| Regression | Package + app unit suites, both typechecks | unit | commands above | exists |
| Plumbing | Params/UI rows re-applied, pins updated (18-key bag, 15-row table, 16-key reset) | unit | app vitest | exists (pins move per `e08e356f9`) |

### Sampling Rate
- Per task commit: package `tsc --noEmit` + `vitest run`.
- Per wave merge: the full suite above; the probe scenario once at 2048 (the ~21 ms merge is stable in-process, +/-10 % cross-run).
- Phase gate: full suite green plus `edge-layer` baseline comparison; live UAT rows stay with the artist (automated-ready only).

### Wave 0 Gaps
- `probe/medium-engine/probe.ts` - `edge-layer` scenario + `edgeTransparencyMetrics`-family metrics (recovered).
- `probe/medium-engine/compare.mjs` - alpha-law predicate, `SCENARIO_INVARIANTS`, the `2e-4` identity machinery.
- `probe/medium-engine/run.mjs` - scenario whitelist + any `--edge`/`--falloff` flags.
- `probe/medium-engine/baselines/edge-layer-*.json` - captured from the PRE-change tree.
- Engine test-only counters for G4 (allocation and merge-draw proof).

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`; the domain is a local, offline GPU paint engine with no auth, sessions, network or crypto surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes | Clamp both new knobs at the boundary: `edgeFade`/`edgeFalloff` through `clamp01(... / 100)` in `toEngineParams` (from `1c5a27f4b`) and `clamp(this.params.edgeFade, 0, 1)` in `bindGather`; the falloff exponent guards non-finite input (`edgeFalloffExponent` returns 1 for non-finite) |
| V6 Cryptography | no | - |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| NaN/Inf uniform poisons the LM fit or the band math | Tampering | Finite clamp at the param boundary; the merge's exact-endpoint tests (`aEff >= 1 - 1e-4`) already short-circuit |
| Shader recompile changing the amount-0 path | Tampering (integrity) | New programs only; profile identity gate (Q6) |
| Stuck layer targets after an interrupted stroke leaking into the next stroke | Information disclosure (paint) | Clear layer targets on every non-ending stroke drop (Q1) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests, probe | yes | v24.15.0 | - |
| pnpm | workspace build/test | yes | 10.27.0 | - |
| Google Chrome (headless) | probe harness | yes | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | Chromium candidate list in `run.mjs` |
| esbuild | probe bundling | yes | 0.27.7 (`node_modules/.pnpm/esbuild@0.27.7/.../bin/esbuild`, first candidate in `run.mjs:479-483`) | `node_modules/.bin/esbuild` |
| WebGL2 (Metal / SwiftShader) | engine + probe | yes (spike 006 ran Q1-Q4) | - | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Sources

### Primary (HIGH confidence)
- `packages/efx-watercolor/src/playground/Engine.ts` - stroke lifecycle (:2748-2755), input (:2420-2442), script begin/end (:1484-1515), tick (:1572-1574), targets (:798-839, :879-895), deposit (:3715-3764), stamp (:2950-3019), touch/history (:3845-3865, :4018-4021), advect swaps (:4128, :4157), capture (:994-1016), display bind (:4226-4300), interruption seams (:2155-2210, :1169).
- `packages/efx-watercolor/src/playground/shaders.ts` - `Gathered` (:1080-1086), `gatherBristle` lateral (:1095-1098, :1163), `bristleCoverFS` (:1410-1440), `displayFS` (:1842-2064).
- `packages/efx-watercolor/src/playground/spectral.ts` - `displayBasisGLSL` (:152-196).
- `packages/efx-watercolor/src/playground/gl.ts` - Target/DoubleTarget (:22-37), target/double (:84-129), clearTarget (:131-138), draw (:147-159), blit (:184-191), readHalf (:200-238).
- `packages/efx-watercolor/src/playground/bristles.ts` - `BRISTLE_FEATHER_EDGE = 0.66` (:236).
- `.planning/spikes/006-stroke-layer-transparency/probe/merge.ts` - merge shader (:117-130, :177-214), pass (:356-498), display mirror (:726-765).
- `.planning/spikes/006-stroke-layer-transparency/probe/q4.ts` / `sheet.ts` - write-back provenance (:32, :758, :790; sheet :148-178).
- `.planning/spikes/006-stroke-layer-transparency/RESUME.md` - frozen encoder, G1-G5, digests `36a3f71d` / `3170f21b`, known rough edges.
- `SPECS/v2.2.0-medium-engine/DESIGN-stroke-layer-transparency.md` - section 3 law, section 4 seams, section 6 verification, section 8 stages.
- `.planning/quick/261125-kvl-.../261125-kvl-CONTEXT.md` - locked decisions (copied verbatim above).
- `packages/efx-watercolor/probe/medium-engine/probe.ts`, `compare.mjs`, `run.mjs` - scenario surface and comparator contract.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - scripted feed and `applyStroke`.
- `git show 1c5a27f4b`, `git show e08e356f9`, `git show 5e6e7a37a` (and `5e6e7a37a^` for the reverted comparator machinery).

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` and `.planning/PROJECT.md` - milestone context (v2.2.0 medium engine, phase 64 complete, ujb reverted).
- `.planning/quick/261124-ujb-.../261124-ujb-SUMMARY.md` - the six rejected parameter laws (do not reintroduce).

### Tertiary (LOW confidence)
- None used for a locked decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WebGL2 guarantees at least 4 draw buffers/colour attachments, so a 4-attachment merge draw (or 3 + scratch) is portable | Q4 | Low; the fallback is 3 passes with 2/1/1 attachments, still correct |
| A2 | `gl.blitFramebuffer` copies half-float colour attachments on Metal and SwiftShader with `NEAREST` | Q4 | Medium; fallback is a trivial copy program per target - verify in Wave 0 |
| A3 | `touch()`'s `active`/`painted` extension over a layer-only stroke is acceptable (pickup stays sheet-side); no separate bookkeeping call is needed | Q4 | Medium; if the wet gate misbehaves, use a bookkeeping-only touch (`wake = false`) and a dedicated `everPainted`/dirty union |
| A4 | A `#define`-split display program is acceptable within the design's "uLayerOn branch" intent | Q3 | Low; the alternative (uniform branch in `displayFS`) requires the profile-identity gate |
| A5 | The Studio's key-leave/tool-switch interruption routes through `abortStroke()` (or one of the four stroke-nulling seams) | Q1 | Medium; verify every Studio caller and add the layer clear to any seam that bypasses them |

**If this table is empty:** not applicable - see rows above.

## Open Questions

1. **Which pool the composite lands in** (DESIGN 7.8) - the merge reads `ink.read + fixed` and writes `fit - fixed` into `ink` only. The spike wrote the mobile pool only and flagged it; the plan must prove the next stroke's pickup and the bake replay read the same value (G5 + UAT).
2. **Relief write-back target** - `relief` is a single target; the plan needs a transient R16F scratch (Q4). Confirm the 4K memory budget with the layer set plus scratch against the 160 MiB ceiling.
3. **Bristle gaps** - `A_eff = A * cover_L` deliberately lets the base survive in the layer's gaps (print retention 95-96 % at the band edge). This must be an explicit UAT row, not a tuning target (DESIGN 7.9).
4. **The caps** (DESIGN 7.2) - `lateral` ignores the along-axis caps; verify no seam at the caps; the fallback is multiplying the layer alpha by the cap's `alongFade` in the lateral write.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; all seams read from the working tree.
- Architecture: HIGH - the frozen law is fixed, the hook points are exact line ranges.
- Pitfalls: HIGH for the verified seams (ping-pong, lateral clear, shared-struct source drift); MEDIUM for the blit/attachment-count portability assumptions (A1, A2).

**Research date:** 2026-11-25
**Valid until:** 2026-12-25 (stable internal codebase; re-verify line numbers after any engine change)
