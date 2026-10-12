---
phase: quick-260925-dso
reviewed: 2026-09-25T10:11:41Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - packages/efx-physic-paint/src/brush/erase.ts
  - packages/efx-physic-paint/src/brush/paint.continuation.test.ts
  - packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts
  - packages/efx-physic-paint/src/brush/paint.ts
  - packages/efx-physic-paint/src/core/paper.ts
  - packages/efx-physic-paint/src/core/paperConditioning.test.ts
  - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
  - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.paperHeight.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
findings:
  critical: 1
  warning: 2
  info: 5
  total: 8
status: issues_found
---

# Phase quick-260925-dso: Code Review Report

**Reviewed:** 2026-09-25T10:11:41Z
**Depth:** quick
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Adversarial review of the grain/emboss raster deletion and physics height-field conditioning (4 commits, 140a1801..6200eadd). The core deletion is sound — no `fillPolyGrain`/`applyPaperEmboss`/`ensureHeightMap` residue in production code, no security surface introduced (no new I/O, eval, or trust boundaries; document validation remains fail-closed). One correctness defect found: the grain-off `''` encoding that this quick elevates to a pinned contract is silently dropped by the truthy guard in `loadProjectData`, so a save/load round-trip at engine level restores grain the user turned off. Plus a provably false idempotence claim on `conditionHeightMap` and a setter that now triggers full render flushes for state no rendering code reads. Remaining items are dead code left behind by the cleanup.

## Narrative Findings (AI reviewer)

### CR-01: Grain-off `''` is dropped on document load — save/load round-trip silently restores grain

**File:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:2920`
**Issue:** This quick pins `paperGrain: ''` (grain-off) as the flat-height encoding: `setPaperGrain('')` correctly resolves to `tex?.heightMap ?? null` → null → `sampleH` constant 0.5, and `serializeProject` (line 2891) faithfully writes `paperGrain: this.currentPaperKey`, which can be `''`. But the restore path uses a truthy guard:

```ts
if (settings.paperGrain) this.setPaperGrain(settings.paperGrain)
```

An empty string fails the guard, so `setPaperGrain('')` is never called on load. A fresh engine that already applied its default paper in `init()`/`loadPaperTextures()` (EfxPaintEngine.ts:2962-2976 unconditionally applies `defaultPaper` or the first available key) keeps that grain after loading a document whose author explicitly turned grain off. The quick's pinned contract (`''` → flat, no procedural fallback) is therefore not honored across the round-trip. The Studio main window partially masks this via the `applyBackgroundFallbackToEngine` re-apply on `efxPaintVersion` bumps, but engine-level consumers (standalone round-trips, roto renderers) get the wrong height field with no diagnostic. Classification: incorrect behavior / user-setting loss — must fix before ship.
**Fix:**

```ts
if (settings.paperGrain != null) this.setPaperGrain(settings.paperGrain)
```

(`settings.paperGrain` is a validated string member, so `!= null` restores both `''` and named keys; `setPaperGrain('')` already resolves correctly to null.) Add a round-trip pin: serialize with `currentPaperKey = ''`, reload, expect `paperHeight === null`.

### WR-01: `conditionHeightMap` doc claims idempotence that is false whenever clamping engages

**File:** `packages/efx-physic-paint/src/core/paper.ts:69`
**Issue:** The doc comment states "**Idempotent on its own output.**" The implementation mean-centres to 0.5 then clamps to [0.10, 0.90]. When any element clamps, the output's mean is no longer 0.5, so a second pass re-centres the unclamped elements: input `[0,0,0,1]` → once `[0.25,0.25,0.25,0.9]` → twice `[0.3375,0.3375,0.3375,0.9]` (verified numerically). The conditioning runs once at load so this is not a live-path bug today, but the false claim invites a future double-apply (e.g. re-conditioning on texture resize) that would silently drift the height band, and the test's leg (d) only pins a symmetric non-clamping input (0.7 ± 0.1), giving false confidence in the general claim.
**Fix:** Correct the doc comment to state idempotence holds only while no element clamps (or only claim "run once at load"), and extend leg (d) in `paperConditioning.test.ts` with a clamping input so the actual contract is pinned:

```ts
// Doc: "Idempotent on its own output when no element clamps;
//       clamping shifts the mean — apply exactly once at texture load."
it('is NOT idempotent when clamping engages (documented contract)', () => {
  const clamped = conditionHeightMap(new Float32Array([0, 0, 0, 1]))
  expect(conditionHeightMap(clamped)).not.toEqual(clamped)
})
```

### WR-02: `setEmbossStrength` still triggers full render flushes for state no rendering code reads

**File:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:1066-1071`
**Issue:** After the emboss raster pass deletion, `state.embossStrength` has zero rendering consumers — its only remaining reads are `serializeProject` (2892), `loadProjectData` (2921), the validator (265), and the default (592). Yet the setter still performs `requestRender()` + `flushPendingStrokeFinalizations()` on every call, and the app-side "Grain strength" control still calls it — so dragging a control that produces no visual effect forces pending stroke finalizations and a full re-render each tick. The summary declares the inert *control* deferred to 9b, but the render-churn *side effect* of the setter is not covered by that deferral: a pure state write would be honest for an inert value.
**Fix:** Until 9b wires a consumer, make the setter side-effect-free:

```ts
setEmbossStrength(strength: number): void {
  this.state.embossStrength = clamp(strength, 0, 1)
  // no requestRender/flush: no rendering code reads embossStrength until 9b
}
```

### IN-01: Unused `sampleH` import left in paint.ts

**File:** `packages/efx-physic-paint/src/brush/paint.ts:11`
**Issue:** `import { sampleH } from '../core/paper'` is never referenced in the file (the raster uses the `sampleHFn` parameter only). Left behind by the grain/emboss deletion.
**Fix:** Delete the import.

### IN-02: Dead `paperHeight` parameter kept in `applyEraseStroke`

**File:** `packages/efx-physic-paint/src/brush/erase.ts:36`
**Issue:** This quick dropped `embossStrength` from the erase signature but left `paperHeight: Float32Array | null`, which is never read in the body — a dead positional argument that call sites must keep supplying.
**Fix:** Drop the parameter in the next signature cleanup (or fold it into the 9b pass with the other residuals).

### IN-03: Write-only engine height fields `texHeight` / `physicsHeightMap`

**File:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:377-378, 1060-1062`
**Issue:** Both fields are written in `setPaperGrain` and never read anywhere in production code (verified across `packages/efx-physic-paint/src` and `app/src`); only the new pin test asserts their identity with `paperHeight`, cementing dead state as a contract.
**Fix:** Remove the fields and update the pin to assert on `paperHeight` alone (or keep one alias if a 9b consumer is already planned — then drop the other).

### IN-04: Stale comment in Pin 1 harness

**File:** `packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts:59`
**Issue:** Comment says "Non-null height map so the emboss branch is live at base (default 0.45)" — the emboss branch no longer exists; `paperHeight` now only feeds `transferToWetLayerClipped`. Misleading for future readers of the RED harness.
**Fix:** Reword to "Non-null height map so the wet-transfer height path is exercised."

### IN-05: pyp bottom-side sanity floor weakened 3 → 2

**File:** `packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts:620-621`
**Issue:** The bottom-side distinct-alpha-level floor dropped from 3 to 2 (plan-authorized case (b), documented with before/after numbers — the third level was deleted grain's ±1 plateau noise). The gate still discriminates graduated fringe vs hard cut, but a 2-level side now passes where 3 was required, slightly narrowing the regression net. Acceptable per plan; flagged so the loosened threshold is visible to future gatekeepers.
**Fix:** No change required; consider re-tightening to 3 in 9b once the composite paper pass restores legitimate fringe structure.

---

_Reviewed: 2026-09-25T10:11:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
