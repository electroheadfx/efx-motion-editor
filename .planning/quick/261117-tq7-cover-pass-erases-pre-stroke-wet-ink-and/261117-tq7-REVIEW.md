---
phase: 261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and
reviewed: 2026-11-17T21:53:24Z
depth: quick
files_reviewed: 15
files_reviewed_list:
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/coverage.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-prefix.json
  - packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json
  - app/src/components/physic-paint/roto/aquarelleLiftErase.ts
  - app/src/components/physic-paint/roto/aquarelleLiftPreview.ts
  - app/src/components/physic-paint/roto/aquarelleLiftCoverageCore.test.ts
  - app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts
  - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
findings:
  critical: 4
  warning: 2
  info: 2
  total: 8
status: issues_found
---

# Quick 261117-tq7: Code Review Report

**Reviewed:** 2026-11-17T21:53:24Z
**Depth:** quick
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The change adds a stroke-start `preInk` snapshot, a per-dab `inkCoverFS` reverse-subtract pass in the live engine, a new `core` coverage profile in the cached-base punch seam, and a Studio `cover` transaction mode that commits the punched cached base with the stroke. Two of the four BLOCKERs are in the engine itself: the per-dab reverse-subtract is repeated 4.5-13x per texel with a constant snapshot and an amount that is not spacing-scaled (CR-01, breaks invariant #2 - the covering stroke's own pigment is erased), and `restore()` disposes the GL targets without dropping `preInk` (CR-02, dangling target, next stroke's mobile cover silently corrupts). Both surviving BLOCKERs are in the Studio cover transaction: the durable-base map is written with `null` when the pre-stroke state is merely unknown (CR-03, converts UNKNOWN to KNOWN-EMPTY and later Lift/Apply drops the key's pre-script paint), and the post-ack sheet reset wipes a stroke that is in progress during the async commit and discards its pointerup (CR-04, stroke neither recorded nor captured). The Level-2 WARNINGs are test gaps that let CR-01 and CR-02 ship green.

The tip-shaped Lift path, the preview snapshot/revert lifecycle, the WebGL blend/unit hygiene, the `core`-profile parity with `liftFS` (aspect squeeze, square cull, square-corner margin), and undo coverage of the ink cover all check out.

## Critical Issues

### CR-01: Per-dab reverse-subtract with a constant snapshot over-subtracts the underlayer and erases the covering stroke's own pigment

**Severity:** BLOCKER
**File:** `packages/efx-watercolor/src/playground/Engine.ts:2368-2385` (call site `2132`; shader `packages/efx-watercolor/src/playground/shaders.ts:344-358`)
**Issue:** `inkCover()` runs once per dab with `FUNC_REVERSE_SUBTRACT` / `blendFunc(ONE, ONE)`, i.e. `ink -= preInk * f`. The snapshot is the stroke-start `preInk` and `f = uAmount * core(q)` is constant across the gesture, so every dab subtracts the SAME underlayer again. Dabs are spaced `b.spacing * sqrt(b.aspect)` of the radius (Engine.ts:2062-2067; BASE spacing 0.3 at `brushes.ts:249`, presets 0.1-0.3), so a centerline texel receives the core-weighted sum of ~4.5-13 dabs. The deposit path scales by `Math.min(b.spacing, 1)` (Engine.ts:2087) but the subtract amount at 2104 does not, and `coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN)` reaches 1 at typical high Body. Net `ink = P*(1 - sum f) + sum deposits`: where `sum f > 1` the underlayer goes negative, and because the display basis clamps with `max(basis, 0.0)` (`packages/efx-watercolor/src/playground/spectral.ts:131,134`) the covering stroke reads as blank paper where its deposit is smaller than the overshoot. The signed negative lobe then survives because `advectInkFS` deliberately does not clamp (`shaders.ts:282-284`), so it diffuses/advects across the sheet. This violates invariant #2 (the cover must never erase the covering stroke's own pigment), and it diverges from every other erase law in the feature: the settled `coverPass` is multiplicative `dst*(1-src)` (Engine.ts:2317-2320), the punch is `coverage *= 1 - f` then `t^K` (`aquarelleLiftErase.ts:451,470-479`). The cached-base preview (multiplicative) and the live engine (linear repeated subtract) therefore disagree, breaking the k03b "preview mirrors the engine" contract.
**Fix:** Make the live subtract law multiplicative so repeated dabs converge instead of accumulating. In `inkCover()` replace
```ts
gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
gl.blendFunc(gl.ONE, gl.ONE);
```
with the same law `coverPass()` already uses:
```ts
gl.blendEquation(gl.FUNC_ADD);
gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
```
and have `inkCoverFS` emit `o0 = texture(uPreA, vUv) * f; o1 = texture(uPreB, vUv) * f;` (unchanged). `dst*(1 - f)` composes to `dst * prod(1 - f_i)`, matching the punch and the preview, and it can never take the underlayer negative. Add a coverage pin asserting `inkCover` uses `ZERO/ONE_MINUS_SRC_COLOR` (the existing blend-state pin at `coverage.test.ts:265-295` covers `coverPass` only).

### CR-02: `restore()` disposes the GL targets without dropping `preInk`, leaving a dangling target that corrupts the first post-restore stroke

**Severity:** BLOCKER
**File:** `packages/efx-watercolor/src/playground/Engine.ts:730-741`
**Issue:** `restore(s)` does `this.g.disposeTargets()` at 738 and then `this.allocateTargets()` / `this.allocateHistory()` / `this.resetPaintState()` - but never calls `this.dropPreInk()`, and `preInk` is not in `disposeTargets()`'s registry sweep (it is allocated through `g.target(...)` in `armInkCover()` at 2350-2355 and only released by `dropPreInk()` at 2388-2392). After a restore during a live high-Body stroke, `this.preInk` remains non-null while its GL textures are deleted. The next stroke's `armInkCover()` early-returns on the non-null field (2351), so no fresh snapshot is taken, and `inkCover()` binds deleted texture names on units 2/3 - incomplete textures sample `(0,0,0,1)` on the attachment A path, so the mobile cover silently does nothing while still subtracting `f` from attachment A's alpha coefficient. Only the first post-restore stroke is corrupted (stroke end at 2004 nulls the field), which makes it a low-reproduction-frequency but real data-loss-grade paint defect. The path is production-reachable: `PhysicsPaintStudio.tsx:3189` (`engineState.loadEngineState`) calls `aquarelleEnginePortRef.current?.restore(state)`, which is `requireEngine(getEngine).restore(snapshot)` at `app/src/components/physic-paint/engine/aquarelleEnginePort.ts:78`, driven from `useRotoPhysicalEditCoordinator.ts:1416`. `disposeTargets()` frees every tracked target and clears the registry (`packages/efx-watercolor/src/playground/gl.ts:258-261`), so the stale `preInk` can never be reclaimed by a later sweep.
**Fix:** Add the release beside the other restore teardown, before the dispose sweep:
```ts
restore(s: …) {
  this.stroke = null;
  this.restoreStrokePigment();
  this.dropFill();
  this.dropPreInk();          // preInk is not in the disposeTargets registry
  this.queue = [];
  …
  this.g.disposeTargets();
```
and extend the release-site pin at `coverage.test.ts:321-350` to include `restore` (see WR-02).

### CR-03: The cover branch writes `null` into the durable-base map when the pre-stroke state is UNKNOWN, turning it into KNOWN-EMPTY

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8437-8462` and `8509-8514`
**Issue:** The durable-base truth table distinguishes three states: a present entry (KNOWN), a proven-empty `null` (KNOWN-EMPTY), and a missing entry (UNKNOWN). `recordAquarelleOrdinaryDurableBaseRef` (10134-10223) is careful to write `null` only when emptiness is proven (10181-10199) and refuses without writing for `script-already-present` (10153-10161) and payload/record unavailable (10200-10207). The cover branch then discards that discipline: when `coverDurableBase.get(plan.keyId)` is `undefined` it records the diagnostic `cover-durable-base-unavailable`, computes `punchedDurableBytes` from an unavailable source, and at 8511 executes `coverDurableBase.set(plan.keyId, punchedDurableBytes)` unconditionally - writing `null`. The state is now KNOWN-EMPTY where it was UNKNOWN. Downstream, `planAquarelleLiftErase`'s recovery arm (7993-8003) only recovers when `plan.scripted && !has(keyId)`; `has()` is now true, so the Lift skips the recovery and the publish composites the wash over a base it believes is empty, dropping the key's pre-script paint. Same hazard for any later Apply that consults the map. This is silent paint loss on scripted keys, and the plan's own comment at 7983-7988 states the distinction is load-bearing.
**Fix:** Guard the write on a proven value:
```ts
if (punchedDurableBytes !== null) {
  coverDurableBase.set(plan.keyId, punchedDurableBytes);
} else {
  coverDurableBase.delete(plan.keyId);   // stay UNKNOWN, never KNOWN-EMPTY
}
```
and add a seam pin: with an undefined durable entry the map must remain absent after the cover commits.

### CR-04: The post-ack sheet reset wipes a stroke in progress during the async cover commit and discards its pointerup

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8515` (chain: `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:906-914` -> `packages/efx-watercolor/src/playground/Engine.ts:1523-1526` and `1750-1753`)
**Issue:** After the cover commit ack the Studio calls `aquarelleResetSheetRef.current?.()`, which runs the layer's `resetSheet` (`stampPendingSettle()`, `onSheetSessionEnd`, `engine.clear()`, `painting = false`). `engine.clear()` executes `dropPreInk(); this.stroke = null; …` (Engine.ts:1523-1526) - it nulls a stroke that may already be in progress, because the cover commit is async (`await` on the commit + one retry) and the user can start the next stroke during that window. The pointerup handler then returns early when `this.stroke` is null (1750-1753), so `onStrokeEnd` never fires for that stroke: it is neither recorded in history nor captured, and its live pixels are wiped by the clear. Before this change only the rare Lift gesture reached this reset; now every high-Body brush stroke does, so the exposure is routine. The stroke is silently lost - a data-loss-grade defect.
**Fix:** Do not reset the sheet while a stroke is live. Gate the reset on the layer's painting state and defer it to the next stroke end (or expose a `resetSheetIfIdle` that returns a boolean and re-arms). Minimal form in the cover success path:
```ts
if (aquarelleResetSheetIfIdleRef.current?.() === false) {
  aquarellePendingSheetResetRef.current = true;   // drained in handleAquarelleStrokeEnd
}
```
and in `handleAquarelleStrokeEnd`, drain the pending flag after the stroke's own reset. Add a seam pin that a cover commit ack never calls `engine.clear()` with a live stroke.

## Warnings

### WR-01: The cover probe gate cannot distinguish the intended outcome from the regression it is meant to catch

**Severity:** WARNING
**File:** `packages/efx-watercolor/probe/medium-engine/probe.ts:255-267` and `packages/efx-watercolor/probe/medium-engine/run.mjs:37-41,52-59`
**Issue:** `coverOverWetScript` paints a dark stroke with `fixAfter: false`, then a light stroke over it, and the report carries only three digests and durations (365-372). The gate asserts only that all three digests differ from the pre-fix baseline and that dimensions agree. It cannot tell "underlayer erased, covering pigment intact" (the target behavior) from "covering stroke erased" or "colors inverted" (CR-01's symptom), so the gate passes with CR-01 present. A digest-differs gate on a visual property needs at least one quantitative invariant on the result, not just inequality.
**Fix:** Have the probe emit a bounded region statistic the runner can assert on - e.g. mean luminance of a centerline sample band of the covering stroke and of a band inside the dark underlayer away from the stroke - and assert `coverBand > 0` (covering pigment survives) and `underBand` increased vs prefix (underlayer erased). Keep the digest-differs check as a change detector only.

### WR-02: The "eight release sites" pin omits `restore()`, which is why CR-02 ships green

**Severity:** WARNING
**File:** `packages/efx-watercolor/src/playground/coverage.test.ts:321-350`
**Issue:** The pin asserts exactly eight `this.dropPreInk();` occurrences and names each site in a table. The table omits `restore()` - the third `disposeTargets()` caller (Engine.ts:738, alongside createDocument 549 and destroy 1698) - so the invariant it encodes is "eight sites exist", not "every dispose site drops preInk". CR-02 passes silently. The pin also does not tie the release set to the `disposeTargets()` caller set, which is the structural relationship that matters.
**Fix:** Add `restore` as a ninth named site (after the `dropPreInk()` fix from CR-02) and add an assertion that the set of lines calling `this.g.disposeTargets()` is a subset of the lines whose enclosing method calls `this.dropPreInk()`. The named-site table should be derived from the source, not hand-listed.

## Info

### IN-01: The Studio memo dep array omits `handleAquarelleCoverDab` though it is passed

**Severity:** INFO
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10997` (passed at `11028`)
**Issue:** The memoized prop object at 10997 does not list `handleAquarelleCoverDab` in its dependency array, though the handler is passed at 11028. This is safe only because the handler is currently identity-stable (`useCallback(..., [planAquarelleCoverErase])` and `planAquarelleCoverErase` is `useCallback(..., [])`). Any future dep added to either will silently serve a stale handler through the memo.
**Fix:** Add `handleAquarelleCoverDab` to the dep array so the invariant is stated rather than implied.

### IN-02: The tip mask is computed per pixel and discarded in core mode

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/aquarelleLiftErase.ts:437,443-449`
**Issue:** `buildLiftCoverage` computes `sampleTipBilinear` into `mask` at 437 for every pixel in the union bbox, then the `profile === 'core'` branch at 443-449 overwrites `f` without using it. Dead per-pixel work on the cover gesture's hottest loop; harmless for correctness.
**Fix:** Hoist the profile branch above the mask computation - compute `mask` only on the `'tip'` path.

---

_Reviewed: 2026-11-17T21:53:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
