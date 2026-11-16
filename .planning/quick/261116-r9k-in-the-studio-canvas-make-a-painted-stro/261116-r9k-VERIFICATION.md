---
phase: quick/261116-r9k
verified: 2026-11-16T19:06:14Z
status: human_needed
score: 7/7 must-haves verified
covered_files: [".planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-CONTEXT.md", ".planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-PLAN.md", ".planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-SUMMARY.md", "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/vectorPathHandles.test.ts", "app/src/components/physic-paint/view/vectorPathHandles.ts"]
covered_digest: "v4:sha256:104ce015fe1ab696aedf14e14d56be5f1b0fba23cb8a313503108337a99bf02e"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT 1 — Fast sparse painted stroke on the Studio canvas → enter path edit (convert) → the paint visibly follows the edited curve; corners are finer or gone; no wash blow-out."
    expected: "The repainted stroke tracks the fitted spline instead of the coarse hand polyline, with no wash blow-out."
    why_human: "Visual judgment on the running Studio canvas; the executor never launches the app or the server."
  - test: "UAT 2 — Compare wash density/lifetime against the pre-conversion look; accept it, or drop VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER to 2 and update its pinned literals."
    expected: "Either the wetter/wider wash is accepted, or the 2x cap change is sanctioned (one production-code line plus its pinned literals)."
    why_human: "The 3x cap is a declared, UAT-judged trade-off (more stations = more engine ticks = wetter wash); no automated check can accept it."
  - test: "UAT 3 — A second anchor drag does not multiply the count again (the paint's weight stays put while the curve moves). Live confirmation."
    expected: "Station count and paint weight stay fixed across subsequent anchor drags."
    why_human: "Visual confirmation of the wetter-weight stability; the underlying no-compounding invariant is deterministically pinned by the quick 261116-r9k seam tests (1.2 uv second spine would demand 45, stored count stays 15)."
  - test: "UAT 4 — Undo/redo restores the exact pre-conversion samples, and one ledger entry covers each gesture. Live confirmation."
    expected: "Undo restores the hand samples and removes both conversion keys in one step; redo reapplies one entry."
    why_human: "The one-write/one-revision/one-snapshot structure is deterministically pinned (revision +1, same timeline index, pointTicks dropped, unchanged beginAquarellePathEdit wrapper); the user confirms the visible undo/redo behavior."
  - test: "UAT 5 — A loop occurrence repaint of the converted stroke matches the source frame."
    expected: "The loop occurrence renders the same geometry as the source frame."
    why_human: "Visual cross-occurrence comparison on the Studio canvas; not observable without running the app."
---

# Phase quick/261116-r9k: Studio painted-stroke conversion re-samples its replay spine at up to 3x Verification Report

**Phase Goal:** In the Studio canvas, make a painted stroke's conversion to a vector path re-sample its replay spine at up to 3x the recorded sample count, so the paint follows the edited curve instead of a coarse polyline.
**Verified:** 2026-11-16T19:06:14Z (HEAD `9ae3d9db6`)
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | A painted (anchorless) stroke's FIRST path-edit write stores a replay spine of `clamp(ceil(spineLength / 0.02 uv), sourceCount, 3 x sourceCount)` stations, evenly by arc length, both ends on the evaluated curve's own ends. | ✓ VERIFIED | `vectorPathHandles.ts:932-943` (resolver) called only from `aquarelleRecordState.ts:1368-1371`; tests `quick 261116-r9k — the conversion re-stations the replay spine`: 15 stations for the 0.8 uv spline spine, ends `toBeCloseTo` `evaluateAquarellePath(anchors,'spline')` first/last, and even spacing (`total/14`). |
| 2   | A later anchor drag keeps the conversion's count, and a curve-mode switch keeps it; no write multiplies the count a second time. | ✓ VERIFIED | Gate `(stroke.anchors?.length ?? 0) === 0` reads the pre-write stroke (`aquarelleRecordState.ts:1340` fetch, `:1368` gate, `:1400` write). Discriminating pin: drag to a 1.2 uv spine (ungated would demand `clamp(60,15,45)=45`) stores exactly 15; `updateAquarelleCurveModeInScript([id],'bezier'/'spline')` (two-argument resampler call, `:1246-1249`) keeps 15 and returns 1. |
| 3   | The recorded pressure is remapped along the ORIGINAL source polyline's arc length with both ends pinned; an all-sentinel stroke stays all-sentinel across the larger station count. | ✓ VERIFIED | `vectorPathHandles.ts:1017-1057`: `sourceStations`/`readings` and the zero-length fallback `count - 1` still index the SOURCE; `pressures[0]`/`pressures[stationCount-1]` pinned to recorded readings; sentinel branch emits `stationCount` sentinels. Tests: ends 0.2/0.9, station 7 = 0.5, converted 3-sample sentinel stroke → 9 × `-1`. |
| 4   | The conversion remains ONE write: same timeline index, one revision bump, one `aquarelle-script` ledger entry, `pointTicks` dropped. | ✓ VERIFIED | Seam has exactly one `toStudioStroke` projection, one `recordedStrokes.set`/`recordedStrokeEntries.set` pair, one `payloadTimeline[index] =` at the same index, one `bumpAquarelleStrokesRevision()` (`aquarelleRecordState.ts:1399-1404`). `beginAquarellePathEdit` unchanged: one snapshot pair + one `storeAquarelleEdit` (`aquarelleStrokeSelection.ts:1075-1086`); sole caller `PhysicsPaintStudio.tsx:10438`. Test pins timeline length 1, same index, revision + 1, `pointTicks` `undefined`. |
| 5   | The draw-time mint, `fitVectorPathAnchors`, `VectorPathOverlay`, `PhysicsPaintStudio.tsx`, the adapter/engine, Roto preview and export are untouched. | ✓ VERIFIED | Commit range `fdd7889bf..HEAD` touches 6 files only (4 code/test + CONTEXT + PLAN). `git log fdd7889bf..HEAD -- <file>` = 0 for `PhysicsPaintStudio.tsx`, `VectorPathOverlay.tsx`, `vectorPathFit.ts`, and all of `packages/efx-watercolor/src` (adapter/engine). `vectorPathHandles.ts` hunks start at line 897; `VECTOR_PAINT_SAMPLE_STEP_UV` (:722) and the draw-time mint are untouched. |
| 6   | The 3x cap and the 0.02 uv target are exported named constants with literal pins, so a 2x drop is one production-code line plus its pinned literals. | ✓ VERIFIED | Exports `VECTOR_CONVERSION_SAMPLE_STEP_UV = 0.02` (:910) and `VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER = 3` (:920); the resolver is the only consumer in production. Test pins both literals (`toBe(3)`, `toBe(0.02)`) plus the 15/16/40/0 count cases; the 15/9 station pins and pressure indices (0/7/14) ride the multiplier as the plan states. |
| 7   | The quick's decision record states the amended D-08 (count no longer preserved at the conversion seam) with the reason. | ✓ VERIFIED | `261116-r9k-CONTEXT.md:24-26` carries "D-08 is AMENDED for the conversion seam only", the clamp law, the reason ("the recorded count is a hand cadence, not a resolution"), the trade-off and the 2x escape hatch. The historical `62-CONTEXT.md` is not edited (0 commits in the range). |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Decision Coverage

Decision coverage verify: **not evaluated (warning)** — the gate returned `reason: could-not-parse` (`total: 0`, `honored: 0`, `not_honored: []`, non-blocking). The quick's `CONTEXT.md` records the decision as a `## Decision revision` blockquote (the quick-task format), not the `<decisions>` list form the gate parses. The single decision (amended D-08) is verified directly under truth 7, so no drift is inferred from this parse miss.

### Required Property Checklist (task request)

| # | Required property | Status | Evidence |
| - | ----------------- | ------ | -------- |
| 1 | Conversion seam ONLY clamps via named constants in `vectorPathHandles.ts` | ✓ | Resolver called only at `aquarelleRecordState.ts:1370`; constants at `vectorPathHandles.ts:910`/`:920`; no other production import of the resolver. |
| 2 | Gate reads PRE-WRITE anchors so later drags never multiply | ✓ | `stroke` fetched at `:1340`, `converting` computed at `:1368`, write at `:1400`; 1.2 uv drag pin stores 15. |
| 3 | `updateAquarelleCurveModeInScript` passes no target count | ✓ | Two-argument call at `aquarelleRecordState.ts:1246-1249`; mode switches keep 15 in tests. |
| 4 | Pressure remap indexes ORIGINAL source polyline, ends pinned; all-sentinel stays | ✓ | `vectorPathHandles.ts:1017-1057`; tests for ends (0.2/0.9), station 7 = 0.5, and 9 sentinel values. |
| 5 | Same timeline index, one revision bump, one ledger entry, `pointTicks` dropped | ✓ | Single write/bump/projection in the seam; unchanged one-entry ledger wrapper; test pins index/revision/pointTicks; `PhysicsPaintStudio.test.ts` byte pins green. |
| 6 | Untouched: draw-time mint, `fitVectorPathAnchors`, `VectorPathOverlay`, `PhysicsPaintStudio.tsx`, adapter, engine | ✓ | Commit-range evidence above; 0 commits on each path. |
| 7 | D-08 amended in the record with reason; count pins in both named test files | ✓ (with note) | Amended D-08 verbatim in `CONTEXT.md`. `aquarelleRecordState.path.test.ts`: three conversion-path pins retargeted 5→15 with the amended header at :1098-1110. `vectorPathHandles.test.ts` (per plan Task 2): existing two-argument pins were deliberately NOT retargeted (still valid, annotated with the two-vs-three-argument split), and NEW conversion-count pins were added (literal constants, 15/16/40/0 resolver cases, 9-station target resample, sentinel). Both files carry the conversion-count pins; only the seam file needed an existing pin retargeted. |

### Deferred Items

None. No gap was identified for deferral.

### Advisory (New Scope, Unevidenced)

Not applicable — initial verification (the evidence gate is a re-verification-only no-op).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | exports the two constants + `resolveVectorConversionSampleCount`; resampler accepts optional target count | ✓ VERIFIED | Exists, substantive (`:900-943`), wired (imported and used at `aquarelleRecordState.ts:58,1370`). Two-argument resampler behaviour is code-identical to HEAD's prior law. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | conversion count applied ONLY when the stroke has no anchors | ✓ VERIFIED | `converting` gate `:1368`; target count passed as the third argument `:1372-1376`. |
| `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | conversion-count pins + retargeted D-07/D-08 block with amended reason | ✓ VERIFIED | New block at `:1216-1320`; retargeted block header `:1098-1110`; suite 29/29 green. |
| `app/src/components/physic-paint/view/vectorPathHandles.test.ts` | conversion-count pins and the law split | ✓ VERIFIED | New `quick 261116-r9k — the conversion sample-count law` block; split annotation at `:1038-1043`; suite 96/96 green. |
| `.planning/quick/261116-r9k-…/261116-r9k-CONTEXT.md` | amended D-08 decision record | ✓ VERIFIED | 59 lines, includes the clamp, reason, trade-off, kept laws, non-goals, historical-artifact note. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `aquarelleRecordState.ts` | `vectorPathHandles.ts` | `updateAquarellePathInScript` → `resolveVectorConversionSampleCount(sampledSpine, stroke.points.length)` → `resampleVectorSpineWithPressureLaw(spine, points, targetCount)` | ✓ WIRED | `:1370`, `:1372-1376`; target count is `undefined` on non-converting writes. |
| `aquarelleRecordState.ts` | `packages/efx-watercolor/src/payload` | `toStudioStroke` projects the re-stationed `points` into payload `pts` | ✓ WIRED | `toStudioStroke.ts:193-217` maps every `s.points` entry into `pts`; test asserts the entry's `pts` is 15 long. `ticks` derives from the index law once `pointTicks` is dropped. |
| `PhysicsPaintStudio.tsx` | `aquarelleStrokeSelection.ts` | `commitAquarelleVectorPathEdit`'s converting branch → `beginAquarellePathEdit` → `updateAquarellePathInScript` (byte-unchanged) | ✓ WIRED | Predicate `(getRecordedAquarelleStroke(mutationId)?.anchors?.length ?? 0) === 0` at `PhysicsPaintStudio.tsx:10437`; `beginAquarellePathEdit` is the sole production caller (`aquarelleStrokeSelection.ts:1084`); both files untouched. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `aquarelleRecordState.ts` conversion seam | `editSpine` → `nextPoints` → `payload.pts` | `evaluateAquarellePath(nextAnchors, effectiveMode)` (real anchor evaluation) re-stationed by the arc-length resampler over the recorded stroke's own sample count | Yes — no static fallback; the test asserts the payload entry's `pts` length and the ends of the evaluated curve | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Conversion + edit-law pins | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | 2 files, 125/125 passed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean, exit 0 | ✓ PASS |
| Boundary (8 suites) | `… vitest run aquarelleRecordState.path vectorPathHandles VectorPathOverlay aquarelleStrokeSelection PhysicsPaintStudio aquarelleVectorPathCommit vectorStrokeExportParity efxPaintCompositeCache` | 8 files, 806/806 passed | ✓ PASS |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 447 files passed, 2 skipped; 9473 passed, 1 skipped, 96 todo; **zero failures** (the flaky `physicPaintBridge.test.ts` baseline did not fail this run) | ✓ PASS |
| RED gate (static evidence) | `git show 750d07753:…/vectorPathHandles.ts \| grep -c VECTOR_CONVERSION` → `0`; RED `aquarelleRecordState.ts` has no `converting`/`targetCount`/resolver | RED tests referenced not-yet-existing exports and demanded 15/9 stations against a 5-station-preserving writer, so they failed for the planned reasons. Not re-run at that commit (that would require a checkout); static evidence only. | ✓ PASS (static) |

No server or app was launched; no dependency install occurred (0 commits touching `pnpm-lock.yaml`, `package.json`).

### Probe Execution

Not applicable — no probes are declared for this quick, and it is not a migration/tooling phase.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `vectorPathHandles.test.ts` | D1 (count law), D3 (resampler target count) | 96 | 0 | None — expected values are literal/mathematical (3, 0.02, 15, 16, 40, 0, 0.1 steps), not captured from the system | Value / Behavioral | ✓ PASS |
| `aquarelleRecordState.path.test.ts` | D2 (seam), D3 (no compounding) | 29 | 0 | None — expectations are literals and `evaluateAquarellePath` oracle identities | Value / Behavioral (multi-step conversion → drag → mode switches) | ✓ PASS |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0.

### Requirements Coverage

Not applicable — the plan declares `requirements: []` and no REQUIREMENTS.md ID is mapped to this quick.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX`, no `TODO`/`HACK`/`PLACEHOLDER`, no stub returns, no hardcoded empty props introduced in the four modified code/test files. | — | None |

### Human Verification Required

The automated gate passed. The following live rows are **user-owned and pending** — reported here as user validation, not as code gaps.

1. **UAT 1 — Paint follows the curve**

   **Test:** On the Studio canvas, paint a fast sparse stroke → enter path edit (conversion) → inspect the repainted stroke.
   **Expected:** The paint visibly follows the curve; corners are finer or gone; no wash blow-out.
   **Why human:** Visual judgment on the running app; the executor never launches it.

2. **UAT 2 — Wash density/lifetime**

   **Test:** Compare the converted stroke's wash density/lifetime with its pre-conversion look.
   **Expected:** Either accepted, or the cap steps to 2x by changing `VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER` to 2 (one production-code line plus its pinned literals).
   **Why human:** The wetter/wider wash is a declared, UAT-judged trade-off.

3. **UAT 3 — No second multiplication (live confirmation)**

   **Test:** Drag an anchor a second time after conversion.
   **Expected:** The paint's weight stays put while the curve moves.
   **Why human:** Visual confirmation; the underlying invariant is deterministically pinned (1.2 uv spine keeps 15 stations, ungated would be 45).

4. **UAT 4 — Undo/redo and one ledger entry (live confirmation)**

   **Test:** Undo then redo the conversion.
   **Expected:** The exact pre-conversion samples return in one step; one ledger entry per gesture.
   **Why human:** Visible undo/redo confirmation; the write count/revision/index are deterministically pinned.

5. **UAT 5 — Loop occurrence repaint**

   **Test:** Repaint a loop occurrence of the converted stroke.
   **Expected:** It matches the source frame.
   **Why human:** Visual cross-occurrence comparison on the canvas.

### Gaps Summary

No gaps. Every must-have truth is verified in the live code and by passing tests; no artifact is missing, stubbed, orphaned or hollow; every key link is wired; no blocker or debt marker was found. The overall status is `human_needed` only because the five live Studio UAT rows remain user validation, with rows 3 and 4 already backed by deterministic pins. There is nothing for `/gsd-plan-phase --gaps`.

---

_Verified: 2026-11-16T19:06:14Z_
_Verifier: Claude (gsd-verifier)_
