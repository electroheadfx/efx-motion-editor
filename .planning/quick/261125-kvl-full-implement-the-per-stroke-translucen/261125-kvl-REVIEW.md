---
phase: quick-261125-kvl
reviewed: 2026-11-25T17:40:35Z
depth: quick
files_reviewed: 24
files_reviewed_list:
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
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase quick-261125-kvl: Code Review Report

**Reviewed:** 2026-11-25T17:40:35Z
**Depth:** quick
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the per-stroke translucent stroke layer ("Edge transparency") across the engine (deposit routing, stroke-end merge, GPU target lifecycle), the shaders, the probe/comparator/gate, and the host parameter plumbing, plus their tests. The frozen composite law and encoder were treated as out of scope for design, as instructed; this review targets wiring, lifecycle, numerics, and test teeth.

Focus-area verdicts:

1. **GPU resource lifecycle — sound.** Every recreate path (`createDocument` Engine.ts:1189-1199, `resizeDocument` Engine.ts:1244-1265, `applyWhole` Engine.ts:1356-1361, `restore` Engine.ts:1468-1483) calls `forgetLayer()` before `disposeTargets()`/`allocateTargets()`, and `gl.ts`'s `resources` Map frees every registered target, so the five layer targets cannot leak even though `forgetLayer` nulls them first. `discardLayer()` (Engine.ts:1028-1039) clears only while `layerOpen` and resets bookkeeping unconditionally — idempotent and safe after `forgetLayer` (no clear of a freed target). History pools, `snapshotLayers()` (Engine.ts:4261-4267), and `travel()`'s layer map never include the layer targets, so lazy allocation cannot desynchronize undo/redo.
2. **Stroke lifecycle hooks — sound.** The single commit site is `processInput`'s `s.ending` branch (Engine.ts:3064-3074): `commitLayer(s)` runs after the end-cap dab and BEFORE `this.stroke = null` and the `onStrokeTool`/`onStrokeEnd` callbacks — one merge, never after the callback. `commitLayer` (Engine.ts:1058-1067) discards on a foreign stroke. All other `this.stroke = null` sites are accounted for: `clear`/`resetSheet`/`abortStroke`/`travel` discard; the four recreate paths forget. No double merge found.
3. **Amount-0 bypass — structural.** `openLayer` early-returns (Engine.ts:1007) before `ensureLayer`; `layerTargets()` returns `[]` while unallocated; `commitLayer` early-returns while closed; no merge draw or clear is submitted; `bindGather`'s unconditional `uEdgeStart/uEdgeFade/uEdgeFalloff` sets are documented no-ops on programs that do not declare them (`Program.u` is an active-uniforms `Record`). The identity and counter bars are enforced by the gate.
4. **Numerical safety — no unguarded division, NaN path, negative `pow` base, or unbounded loop.** `k` floored at 1e-3 (shaders.ts:165), lateral/cover clamped before division (shaders.ts:1535-1540), `t` denominator floored 1e-4, KM branch guarded (`scatter <= eps`, `kk <= 0`), `solve8` 1e-12 pivot, `denA` 1e-12, `ha = max(1e-5, ...)`, 4-attempt step rejection, `uMaxIter = 4` with the 32-iteration hard cap, `x[7] = max(x[7], 0.0)`.
5. **Test quality.** Falloff-ordering and linear-light-50 % pins genuinely discriminate (executed failing fixtures, harness.test.ts:2323-2360 and 2414-2473). The Studio lifecycle rows (G1, G2, undo/redo, I1-I5, memory) do NOT: no executed test breaks any of them, and there is no source pin of the comparator function either (WR-02). Tuple identity is near-tautological (IN-01); the layer cover shader is a hand copy pinned at only five lines (IN-02); the engine lifecycle pins are lexical (IN-03).
6. **Security — bounded.** Local GPU paint engine: no network, auth, filesystem, or user-controlled shader source; all inputs are clamped at `params.ts`/`bindLayerAlpha` before reaching uniforms. No security threats to report.

No BLOCKERs found. Two warnings and three info items follow.

## Narrative Findings (AI reviewer)

### WR-01: Committed Edge strokes leave the merged paint reading dry to the next stroke (lastTouch is never stamped at merge)

**Severity:** WARNING — incorrect behavior relative to the shipped deposit path; not data loss, and a one-function fix.
**File:** `packages/efx-watercolor/src/playground/Engine.ts:4143-4147` (skip), `Engine.ts:3335-3338` (shipped stamp), `Engine.ts:1125-1186` (merge has no touch pass); `packages/efx-watercolor/src/playground/shaders.ts:806`, `shaders.ts:1040` (age law), `shaders.ts:1492-1499` (touch program)

**Issue:** While a layer is open, `bristleTouch` deliberately returns early (Engine.ts:4143-4147) so paint that has not landed on the sheet does not record a touch — correct. But nothing stamps `lastTouch` when the layer later commits. `mergeStrokeLayer` writes ink (pass 1), cover (pass 2), and relief (pass 3), then copies back over the rect — no last-touch pass anywhere in Engine.ts:1125-1186. The next bristle stroke's gather reads wetness from `age = max(uNow - texture(uTimes, uv).r, 0.0)` (shaders.ts:806, 1040); over the merged region that age is the pre-stroke value (up to the one-week dry sentinel), so Edge-committed paint behaves as fully dry even one tick later, while the shipped path stamps `uNow` after every dab (Engine.ts:3338). The documented scope (CONTEXT line 56; SUMMARY UAT row 8) covers only within-stroke self-pickup and wet-on-wet; the post-commit read is neither documented nor listed in `deferred-items.md`. The PLAN (line 208) ordered the skip for the open layer, but no UAT row or deferred entry records this consequence.

**Fix:** Stamp the merged region once, after pass 2's copy-back, with the merged `cover.read` as the weight — the same law and carry discipline as `bristleTouch`. Undo is already covered: each dab's prologue called `touch(rect)` (Engine.ts:4054) and `snapshotLayers()` includes `lastTouch.read` as the fifth entry (Engine.ts:4266), so the saved tiles revert the stamp with the merged paint.

```ts
// in mergeStrokeLayer, after the pass-3 copy-back (Engine.ts:1179-1185)
const t = this.programs.bristleTouch!;
const carry = takeCarry(this.touchCarry);
if (carry) {
  g.blit(this.lastTouch.read.views[0]!, carry.x0, carry.y0,
    this.lastTouch.write.views[0]!, carry.x0, carry.y0,
    carry.x1 - carry.x0, carry.y1 - carry.y0);
}
t.bind();
gl.disable(gl.BLEND);
gl.uniform1i(t.u.uTimes!, g.bindTex(0, this.lastTouch.read.tex[0]!));
gl.uniform1i(t.u.uCover!, g.bindTex(1, this.cover.read.tex[0]!)); // merged by pass 2
gl.uniform1f(t.u.uNow!, this.nowSec());
g.draw(this.lastTouch.write, rect);
this.lastTouch.swap();
recordStamp(this.touchCarry, rect);
```

Minimal acceptable alternative if the dry read is intended: document it (CONTEXT/SUMMARY/`deferred-items.md`) and add a UAT row, as the quick's own convention requires for the wet/pickup gap.

### WR-02: The Studio lifecycle comparator bars (G1, G2, undo/redo, I1-I5, memory) have no discriminating test

**Severity:** WARNING — a dropped or renamed bar in `edgeStudioFailures` passes every executed test; a broken Studio lifecycle (double merge, merge after callback, leaking layer, non-idempotent discard) would ship green.
**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:1675-1863` (bars), `compare.mjs:1597-1663` (EDGE_STUDIO_FIELDS); `packages/efx-watercolor/probe/medium-engine/harness.test.ts:2089-2474` (tests), `harness.test.ts:2159-2226` (valid fixture)

**Issue:** `edgeStudioFixture` supplies valid G1/G2/undo/redo/I1-I5/memory rows to every capture, and every executed failing case breaks only other rows: amount-0 identity (2299-2312), absent/missing readings (2323-2342), core/continuity/over/half/p95 (2344-2360), `--edge-structural` counters (2376-2411), and sweep ordering/falloff/missing/cover drift (2432-2472). No test mutates or deletes an `edgeG1*`, `edgeG2*`, `edgeAbort*`, `edgeUndo*`, `edgeRedo*`, `edgeRestore*`, `edgeResize*`, `edgeCreate*`, or `edgeMemory*` field, and there is no lexical pin of `edgeStudioFailures` itself. The repo's own doctrine (harness.test.ts:892-899) says a source pin cannot fail when a relation is inverted — but here there is neither a pin nor a behavioral fixture.

**Fix:** Add failing fixtures in the existing style, each asserting exit 1 and the named invariant — for example:

```ts
it('fails a callback with the layer still open', () => {
  const { status, output } = compareSynthetic('nyquist-studio-g1',
    { ...validEdgeLayerCapture(100, 50), edgeG1LayerOpenAtCallback: true })
  expect(status, lawVerdict(status, output)).toBe(1)
  expect(output).toContain('edgeG1LayerOpenAtCallback')
})
// same shape for: edgeG1MergeDraws: 2, edgeG2MergeDraws: 0,
// edgeAbortNextMerge: 0 at amount>0, edgeUndoRestoreMax: 3,
// edgeRestoreLayerFieldsNull: false, edgeCreateDiscardIdempotent: false,
// edgeMemoryLayerBytes: 1, and one `delete capture.edgeCreateReallocated`.
```

### IN-01: The display-basis tuple identity compares two emitters from the same generator — near-tautological

**Severity:** INFO
**File:** `packages/efx-watercolor/src/playground/shaders.test.ts:186-196`

**Issue:** Both `displayBasisGLSL()` and `displayBasisFnGLSL()` are built from the same `displayBandStatementsGLSL` generator (spectral.ts), so the equality at line 196 holds for any generator output. Only the count pin (`shipped.length === 96`, line 195) has teeth; a wrong numeric band value would pass. The numeric teeth for the band law live in the probe residual/gate, which is acceptable — but the test's name implies an independence it does not have.

**Fix:** Either document that the identity is structural and the numbers are covered only by the gate, or assert against an independent expected-tuple table (16 bands × six tuples from `STROKE_LAYER_BANDS`-derived math).

### IN-02: `bristleCoverLayerFS` is a hand copy of `bristleCoverFS`; only five lines are pinned

**Severity:** INFO
**File:** `packages/efx-watercolor/src/playground/shaders.ts:1568-1598` (copy), `shaders.ts:1410-1440` (original); pins at `shaders.test.ts:168-184`

**Issue:** The layer cover shader duplicates the shipped cover law (target math, smear block, guards). The pins cover the two layouts, `o0`, the lateral line, the gather guard, and the clear pass — but not the smear block or the `samePaint` guard. A future edit to `bristleCoverFS`'s smear law silently diverges the layer path, and no test would notice.

**Fix:** Pin the shared body (e.g. assert every non-layout line of `bristleCoverFS`'s main body appears verbatim in `bristleCoverLayerFS`, modulo `o0`/`o1`), or extract the common body into one exported snippet that both shaders interpolate.

### IN-03: The engine lifecycle pins are lexical; combined with WR-02 the Studio lifecycle has no behavioral coverage at all

**Severity:** INFO
**File:** `packages/efx-watercolor/src/playground/coverageLifecycle.test.ts:537-731`

**Issue:** `countOccurrences(body, 'this.layerInk!')).toBe(2)` (line 656), the `commitLayer`/`openLayer`/`mergeStrokeLayer` occurrence counts (539, 583, 606), and the forget-before-dispose orderings (663-692) are source-text pins. By the repo's stated doctrine (harness.test.ts:892-899) this is only acceptable because the probe carries behavior — but the Studio rows that would catch a semantic regression have no failing fixtures yet (WR-02), so for those paths neither layer has teeth.

**Fix:** Keep the lexical pins, and land the WR-02 fixtures so the lifecycle behavior is exercised end to end.

---

_Reviewed: 2026-11-25T17:40:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
