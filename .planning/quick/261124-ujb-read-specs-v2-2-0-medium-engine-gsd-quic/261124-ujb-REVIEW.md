---
phase: 261124-ujb
reviewed: 2026-11-24T22:15:03Z
depth: quick
files_reviewed: 21
files_reviewed_list:
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: issues_found
---

# Phase 261124-ujb: Code Review Report

**Reviewed:** 2026-11-24T22:15:03Z
**Depth:** quick
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the full `d509a886d..e08e356f9` diff for Spec 10 (Edge transparency / Edge falloff): the shader lateral film, its `bristles.ts` CPU twin, the Engine uniform binding, the canonical/engine parameter mapping, the medium records, the panel/record plumbing, the probe capture and comparator, the two committed neutral baselines, and the tests. No BLOCKER or WARNING was found. Five INFO items are listed below (comparator guard hygiene and stale documentation).

The two flagged deviations were traced and both hold:

**(a) Plain arithmetic `1.0 - uEdgeFade * pow(edgeT, edgeExp)` is exact at amount 0 and cannot produce NaN/inf for any uniform that can actually be bound.** `edgeT` and `edgeExp` are clamped to [0,1] and [0.5,2] respectively (`shaders.ts:1322-1323`), so `pow` is finite and `pow(0.0, e>0) = 0.0`; multiplying by a zero `uEdgeFade` yields `+0.0` and `1.0 - 0.0 = 1.0` exactly, so `featherFade *= edgeFilm` is an IEEE identity at amount 0 and the amount-0 bytes cannot drift (re-proven empirically: both committed baselines captured from the pre-change commit `d509a886d` carry identical digests, and the two baseline-mode gates compare all fields). NaN could only enter through `Engine.ts:3639-3640`, whose `clamp` (`Engine.ts:443`) is a `Math.min/Math.max` pair that does NOT sanitize NaN — but the only writer paths (`AquarelleCanvasLayer.tsx:358`, `engineAdapter.ts:423`) both map through `toEngineParams`, whose `num()` (`params.ts:126-128`) replaces non-finite input with the canonical default, and `setAquarelleParam` rejects non-finite values (`aquarelleRecordState.ts:597`). No reachable uniform is non-finite, and both fade denominators are floored at `1e-4` (`shaders.ts:1321-1322`).

**(b) The comparator cannot pass vacuously.** A blank coverage profile fails (`compare.mjs:1217-1219`), a missing `edgeAcross` fails (`1197-1199`), a non-run film at amount > 0 fails the floor calibration on either side (`1256-1262`), an uncalibratable amount-0 reference fails (`1269-1275`), a silhouette under 8 px fails (`1279-1285`), a missing enclosure scan fails (`1332-1334`), and unaligned/missing reference offsets fail (`1223-1236`). No branch inside `edgeTransparencyFailures` returns success early on degenerate input. `isBristleCapture` is literal-identical in `probe.ts:3412` and `compare.mjs:197`, and the committed baselines carry exactly the skip fields `alphaLawFailures` requires.

Also verified: the film is applied once per channel (`shaders.ts:1321-1335`); the scatter `S` term is deliberately film-squared because `a` is already film-scaled (`shaders.ts:1418-1422`); the attenuation half (`shaders.ts:1408-1413`) and the threshold block are untouched; `g.film` is initialized at `shaders.ts:1102`, before both early returns; the cover and relief programs are unchanged; neither new key can be dropped by the per-stroke bag or the selection commit (`aquarelleRecordState.ts:129-148,1440`; engine fallbacks `Engine.ts:134-135,152-153`; mapping `params.ts:230-231`; medium records `mediums.ts:155-156`); and the two baselines share `capturedFromCommit: d509a886d`, identical digests, 1080×1080, 281 aligned offsets, and consistent `edgeTiling.enclosed`.

Tests executed: `packages/efx-watercolor` (bristles, params, mediums, scattering, harness) — 337 passed; app view suites (AquarelleGlobalsPanel, aquarelleParamVisibility, brushGroupMedium, mediumSelection) — 95 passed, 3 skipped.

## Narrative Findings (AI reviewer)

### IN-01: The non-object-reference guard records a failure but does not return, and `reference.edgeAcross` is dereferenced afterwards

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:1184-1189`, `1222`
**Issue:** When `reference` is `null` or a non-object, the guard pushes a failure but execution continues to `const referenceProfile = reference.edgeAcross` at line 1222, which throws a `TypeError` for `null`/`undefined` instead of returning a clean `FAIL`. Today this is not reachable through the CLI (every mode dereferences `refData` earlier — e.g. `refData.capturedFromCommit` at line 1791, `printDurations` at line 1804, `refData[field]` at line 1902 — so a `null` JSON capture throws before invariants run), but the guard's whole purpose is fail-closed behavior and it currently does not deliver it for the case it names.
**Fix:** Make the guard terminal:
```js
if (reference === null || typeof reference !== 'object' || reference.width !== data.width) {
  failures.push(...)
  return failures
}
```
(or guard the dereference: `const referenceProfile = reference && reference.edgeAcross`).

### IN-02: Dead `ratio === null` disjunct and `undefined`-as-at-floor handling in the floor-boundary scan

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:1141-1158`
**Issue:** `filmAt` returns `null` only when the station is absent from `offsets`, but `edgeFilmFloorBoundary` iterates rows drawn from the same `offsets` array, so `ratio === null` (lines 1143 and 1152) can never be true; only `undefined` (reference cover 0) can occur. The inner loop then treats an unnormalisable row as "at floor" and widens the boundary across it (lines 1152-1155). That matches the comment ("rows the reference cannot normalise are ignored") only loosely — the row is not ignored, it extends the boundary.
**Fix:** Drop the unreachable `null` disjuncts, keep the `undefined` skip in the outer scan, and either document the boundary-extension choice explicitly or `continue` without setting `boundary` in the inner loop (a 0-baseline row cannot prove the floor).

### IN-03: The `typeof … === 'number'` knob guards accept NaN, which would silently pass every station comparison

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:1178-1183`
**Issue:** `typeof data.edgeAmount !== 'number' || data.edgeAmount < 0 || data.edgeAmount > 100` is false for `NaN`, so a NaN knob would proceed; `amount = NaN` then takes the identity path, and every `Math.abs(measured - NaN) > tolerance` comparison is false — all three station bars would pass vacuously. Not reachable through the tool's own file format (`JSON.stringify` turns NaN into `null`, which the `typeof` check catches, and `readEdgeKnob` at `probe.ts:3254-3265` only yields integers 0..100), so this is defense-in-depth only.
**Fix:** Use `!Number.isFinite(data.edgeAmount)` (and same for `edgeFalloff`) in the guard conditions.

### IN-04: The sweep-path rim station re-asserts the calibration rather than an independent anchor

**File:** `packages/efx-watercolor/probe/medium-engine/compare.mjs:1253-1290`
**Issue:** At amount > 0, `rimStation` is derived from the same film-floor boundary the calibration just asserted to be within `EDGE_FLOOR_EPS` (1e-3) of the floor, and the rim bar then re-checks that row against `1 - amount` with a 0.12 tolerance — close to tautological. The two failure modes it is meant to catch are covered elsewhere (a non-running film fails calibration with a null boundary, lines 1256-1262; colour-only scaling fails the rim-ink direction check, lines 1317-1329; wrong exponent fails the mid bar, line 1288), and the harness pins those paths, so the gate is not vacuous — but the rim bar itself adds little discrimination on this path.
**Fix:** Either note in the comment that the sweep rim bar is a sanity echo of the calibrated floor, or anchor the rim to an independent quantity (e.g. the outermost row where the capture's own cover first reaches 2 % of its peak) so a mis-scaled coverage channel is caught by two independent measurements.

### IN-05: Key-count documentation is now stale in the two panel/visibility modules

**File:** `app/src/components/physic-paint/view/aquarelleParamVisibility.ts:134-138`; `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx:25-41`, `147-149`
**Issue:** `aquarelleParamVisibility.ts` (edited by this diff) still says "The 15-key count is what makes the Reset key set (`rows - lift` + `body`) reproduce the shipped patch" — the Reset now writes the 16-key medium record (`AquarelleGlobalsPanel.tsx:153-160` iterates `record.params`), not `rows - lift` + `body`. `AquarelleGlobalsPanel.tsx` (not in this diff, but invalidated by it) still says "full fourteen-key set", "fourteen keys including `wetSeconds`", "same fourteen values" and omits `edgeFade`/`edgeFalloff` from the param-key list at lines 25-30; the medium record is now 16 keys.
**Fix:** Recount to sixteen (or drop the number and say "the active medium record's full key set"), and add the two edge keys to the panel's param-key list.

---

_Reviewed: 2026-11-24T22:15:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
