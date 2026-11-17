---
phase: quick/261117-tq7
verified: 2026-11-17T22:29:17Z
status: human_needed
score: 4/7 must-haves verified
covered_files:
  - ".planning/quick/261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and/261117-tq7-PLAN.md"
  - ".planning/quick/261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and/261117-tq7-SUMMARY.md"
  - "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
  - "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
  - "app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx"
  - "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx"
  - "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx"
  - "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts"
  - "app/src/components/physic-paint/roto/aquarelleLiftCoverageCore.test.ts"
  - "app/src/components/physic-paint/roto/aquarelleLiftErase.ts"
  - "app/src/components/physic-paint/roto/aquarelleLiftPreview.ts"
  - "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-prefix.json"
  - "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-subtract.json"
  - "packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json"
  - "packages/efx-watercolor/probe/medium-engine/compare.mjs"
  - "packages/efx-watercolor/probe/medium-engine/probe.ts"
  - "packages/efx-watercolor/probe/medium-engine/run.mjs"
  - "packages/efx-watercolor/src/playground/Engine.ts"
  - "packages/efx-watercolor/src/playground/coverage.test.ts"
  - "packages/efx-watercolor/src/playground/shaders.ts"
covered_digest: "v4:sha256:df5e448f36977dfd3a0abfc6dc51c74f86d182b5cffb90dd143170f0248463c8"
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "A Brush dab with coverAmount > 0 replaces the paint under its solid core in the mobile ink: red underneath a light-gray Body-100 crossing shows no red at the centre while the rim transitions progressively."
    test: "Fresh frame: red Acrylic stroke, then a light-gray Acrylic Body-100 stroke across it; repeat zoomed 4x (UAT rows 1-2)."
    expected: "Crossing centre is uniform gray with no red coefficient; the rim transitions progressively."
    why_human: "The law is present and wired (shader, per-dab draw, cover amount), but the rendered colour at the crossing is a GPU visual outcome no vitest/probe assertion in this phase samples."
  - truth: "On a reopened (cooked) frame the same stroke punches the cached base live through the Lift preview sink with the solid-core profile, and the punched base is committed with the stroke so leave/reopen and export show the covered result."
    test: "Cooked frame: leave the key, return, repeat the row-1 crossing; then export and compare against the live view (UAT rows 3 and 7)."
    expected: "The cover survives a leave/reopen cycle and the exported sheet matches the live view."
    why_human: "The punch/commit chain is present and wired end to end, but leave/reopen persistence and export parity are app-level behaviours no automated test exercises."
  - truth: "Undo restores the pre-cover underlayer and redo removes it again, in both the engine sheet and the cached base, through the same edit/ledger entry the Lift erase uses."
    test: "Undo then Redo the covering stroke (UAT row 6)."
    expected: "The underlayer returns on undo and disappears again on redo, in both the engine sheet and the cached base."
    why_human: "The cover rides the stroke's existing undo step and the Lift commit coordinator, but no automated test performs an undo/redo cycle through the ledger and inspects both surfaces."
human_verification:
  - test: "UAT 1 — Fresh frame: red Acrylic stroke, then light-gray Acrylic (Body 100) across it."
    expected: "At the crossing the centre shows only gray; no red remains."
    why_human: "Visual colour outcome at the crossing; no automated render assertion in this phase."
  - test: "UAT 2 — Same crossing, zoomed 4x."
    expected: "Centre uniform (no underlayer); rim transitions progressively."
    why_human: "Spatial rim gradient is a visual property."
  - test: "UAT 3 — Cooked frame: leave the key, return, repeat UAT 1."
    expected: "Same as UAT 1, and it survives another leave/reopen."
    why_human: "Persistence across frame navigation is an app-level flow."
  - test: "UAT 4 — Watercolor (Body 0) painted over a colour."
    expected: "No cover; wet-on-wet mixing unchanged."
    why_human: "Body 0 neutrality is code- and probe-verified; the visual wet-on-wet result is a human texture judgement."
  - test: "UAT 5 — Body 0 vs the tuned Acrylic; neutral-identity byte gate."
    expected: "neutral-identity stays byte-identical 6/6."
    why_human: "Automated and already PASSED in this verification (6/6 byte-identical, d2bd637a/291d4a11/6ba88334); listed for UAT completeness only."
  - test: "UAT 6 — Undo / Redo the covering stroke."
    expected: "The underlayer returns, then disappears again, in both the engine and the cached base."
    why_human: "Undo/redo state restoration across two surfaces has no automated behavioral test."
  - test: "UAT 7 — Export / frame cache vs the live view."
    expected: "The exported sheet matches what the user saw."
    why_human: "Export parity is an end-to-end visual comparison."
gaps: []
---

# Phase quick/261117-tq7: Cover pass erases pre-stroke wet ink and the cached base — Verification Report

**Phase Goal:** A high-Body Brush stroke replaces the paint it crosses — erasing the pre-stroke mobile ink inside the engine and punching the cached base of a reopened frame, using the solid core to erase and the rim to mix.
**Verified:** 2026-11-17T22:29:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A Brush dab with coverAmount > 0 replaces the paint under its solid core: crossing centre carries no red, rim transitions progressively | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN)` at `Engine.ts:2109`; exactly two `coverAmount > 0` guards at `:2114`/`:2133`; `this.inkCover(dx, dy, dr, angle, coverAmount)` at `:2137` precedes `this.brushInk(...)` at `:2138`; `inkCover()` at `:2396-2412` draws full-document with the bounded per-channel share; `inkCoverFS` at `shaders.ts:355-371`. Visual centre/rim outcome only observable live (UAT 1-2). |
| 2 | The covering stroke erases the PRE-STROKE ink only: its own dabs accumulate, never erases itself | ✓ VERIFIED | `preInk` is a single stroke-start snapshot (`:1968` arms before the first `stampScripted` at `:1969`; `armInkCover()` `:2355-2360` blits `ink.read` positionally once). The law `ink * (1 - f * share(pre, ink))` leaves own pigment (`ink - preInk`) intact and repeated overlapping dabs keep eroding the remaining preInk. Behaviorally: real-engine probe run region invariants `own 3.47 > 0` and `cross 32.31 > own`; `--differs-from cover-over-wet-subtract` PASS (crossing 30.74 → 32.31), i.e. the unbounded subtract erased own pigment and the shipped law does not. |
| 3 | On a reopened (cooked) frame the stroke punches the cached base live with the solid-core profile and the punched base commits with the stroke so leave/reopen and export show the result | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired end to end: `coverPass` → `onCoverDab` (`Engine.ts:2333`) → `AquarelleCanvasLayer:649-651` → `PhysicsPaintCanvasMount:238` → Studio `handleAquarelleCoverDab:8049-8066` → `beginAquarelleLiftPreview(frame, 'core')` → `AquarelleCachedBaseLayer.flushPreview:72-78` → `buildLiftCoverage(..., 'core')` → commit at `:8498-8507` (`baseCanvas: punchedCover.canvas`, `cachedBase: coverBase`, `mergeBlend: 'pigment-alpha'`). Leave/reopen/export parity is not exercised by an automated test (UAT 3, 7). |
| 4 | Undo restores the pre-cover underlayer and redo removes it again, in both the engine sheet and the cached base, through the same edit/ledger entry the Lift erase uses | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Stroke undo step opens at pointerdown (`beginStep('stroke', ...)` `:1740`); `touch(coverRect)` `:2124` (plus fixed protect `:2129`) precedes the cover draw, so the cover joins the stroke's existing step; `preInk` is excluded from `snapshotLayers()` (`:2448-2451`) and `docTargets()` (`:537-540`); the cached-base commit rides the same `captureLivePixels` coordinator transaction as the Lift erase with no separate ledger entry. The undo/redo cycle itself has no automated test (UAT 6). |
| 5 | Body 0 allocates no snapshot, draws no cover, emits no cover callback; neutral-identity stays byte-identical 6/6 | ✓ VERIFIED | Arming gate requires raw `this.params.body > 0` (`:1968`); `inkCover()` early-returns on `preInk === null` (`:2399`); `bodyCurve(0) = 0` (`scattering.ts`, `pow(clamp01(body), 6)`) makes both `coverAmount > 0` guards fail, so no cover draw; `coverPass`'s `onCoverDab` emission is gated by `amount > 0` (`:2332-2333`). Independently ran the probe: **6/6 byte-identical** (d2bd637a/291d4a11/6ba88334). |
| 6 | preInk is released at stroke end, clear, resetSheet, abortStroke, history travel, resize and document teardown, and never enters the undo layers or document target list | ✓ VERIFIED | Nine release sites re-derived by scanning `this.dropPreInk();`: `createDocument:544`, `resizeDocument:586`, `restore:740`, `clear:1529`, `resetSheet:1556`, `abortStroke:1570`, `travel:1597`, `destroy:1702`, stroke end `:2009`. All three `disposeTargets()` callers (`:549`, `:743`, `:1703`) release first. `docTargets()` and `snapshotLayers()` exclude `preInk`. The derived set and the dispose ordering law are pinned in `coverage.test.ts` (the "cover seam" block). |
| 7 | Every pre-existing contract literal survives byte-identically (liftFS/tip law, one-arg begin, pending trio, 3-arg dispatch, counts, cover curve) | ✓ VERIFIED | `Engine.ts` and `shaders.ts` diffs are pure additions (zero deleted lines) → `lift()` (`uCover = 0`, tip law) and `liftFS` are byte-identical. Counts re-derived: `this.programs = {` literal = 21 entries with `inkCover` registered AFTER the literal (`:453`); `bodyCurve(` in Engine.ts = 1; `uTipRotation` = 2; whole-Studio `cachedBase: null` = 2; whole-Studio durable `.set(` = 10; `.delete(` = 2. `FUNC_REVERSE_SUBTRACT` = 0 (the user-approved deviation from spec Law 2). Default-profile `begin(frame)` stays one-argument; plan pending trio, pinned preflight literal and 3-argument dispatch intact. |

**Score:** 4/7 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/Engine.ts` | preInk snapshot, inkCover draw, onCoverDab emission, lifecycle release | ✓ VERIFIED | Field `:373`; callback `:127`; arming `:1968`; `inkCover()` `:2396-2412`; `dropPreInk()` `:2415-2419`; `coverPass` emission `:2333`; excluded from `docTargets`/`snapshotLayers`. Substantive, wired, data flows. |
| `packages/efx-watercolor/src/playground/shaders.ts` | `inkCoverFS` sharing `liftFS` untouched | ✓ VERIFIED | `inkCoverFS` `:355-371` with `share(pre, ink) = clamp(pre / max(ink, 1e-6), 0, 1)` and `o = ink * (1 - f * share)`; no discard; `liftFS` `:307-334` byte-identical (additions only). |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` | `core` coverage profile + profile passthrough | ✓ VERIFIED | `LiftCoverageProfile` `:352`; `buildLiftCoverage(..., profile = 'tip')` `:365-462` with core branch `t = min(1,max(0,(d-0.35)/0.65)); f = amount*(1 - t*t*(3-2*t))`; passthrough in `punchTransmittanceCanvas` `:530/:553` and `punchTransmittanceBytes` `:622`; tip branch and mask untouched. Pinned by `aquarelleLiftCoverageCore.test.ts` (7/7). |
| `app/src/components/physic-paint/roto/aquarelleLiftPreview.ts` | profile discriminator on the sink begin | ✓ VERIFIED | `begin(frame, profile?)`; `beginAquarelleLiftPreview(frame, profile = 'tip')` calls `begin(frame)` for tip and `begin(frame, 'core')` for core — the one-arg Lift path is preserved (`aquarelleLiftPreview.test.ts` still sees `begin(42)`). |
| `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` | profile-aware preview flush | ✓ VERIFIED | `profileRef` `:60`; snapshot on `begin(frame, profile)`; `flushPreview:72-78` passes the profile to `buildLiftCoverage`; `revert()` restores the snapshot. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | cover plan, dab handler, mode-aware commit | ✓ VERIFIED | `planAquarelleCoverErase:7928-7954` (returns `mode: 'cover'`); `handleAquarelleCoverDab:8049-8066`; `runAquarelleLiftErase` reads `plan.mode ?? 'lift'` `:8247`; cover branch `:8380-8573` with `punchTransmittanceBytes(..., { profile: 'core' })` `:8426-8430`, `coverDurableDefined` gate `:8450-8479`, `captureLivePixels` `:8498-8507`, durable write `:8535-8540`, stroke-generation skip `:8541-8558`; stroke-end dispatch `:9365`. |
| `packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-prefix.json` | pre-fix baseline | ✓ VERIFIED | Digests d2065878/756b0e4b/d52408c9, crossing 34.05; added `gate` field for the directional claim. |
| `packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json` | standing post-fix baseline | ✓ VERIFIED | Digests 929b126d/dffee2c5/047bc5aa, crossing 32.31; standing equality gate PASS. |
| `packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet-subtract.json` | (review-fix WR-01) pre-CR-01 subtract baseline | ✓ VERIFIED | Digests a3957ebd/9bcdf005/297c3a01, crossing 30.74; drives the "own deposit survives" directional claim. |
| `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts` | cover seam contract | ✓ VERIFIED | New suite, 11/11 green (CR-03 durable three-state, CR-04 generation guard, forwarding chain). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `Engine.ts` | `Engine.ts` | processInput stroke-start → `armInkCover()` blits `this.ink.read` into `preInk` before the first `stampScripted` | WIRED | Arming at `:1968`, first `stampScripted` at `:1969`; positional full-document blit at `:2359`. |
| `Engine.ts` | `shaders.ts` | stamp eachDab → `inkCover()` binds `programs.inkCover` (`inkCoverFS`) | WIRED | Call `:2137`; program registered at `:453` (after the 21-entry literal); binds `uPreA/uPreB/uInkA/uInkB` and draws into `ink.write` with BLEND disabled, then `ink.swap()`. The approved deviation replaces "reverse-subtracts into `ink.read`" with the bounded multiplicative law; the link itself is intact and pinned (`FUNC_REVERSE_SUBTRACT` absent). |
| `Engine.ts` | `AquarelleCanvasLayer.tsx` → `PhysicsPaintCanvasMount.tsx` → Studio | `coverPass` → `callbacks.onCoverDab` → prop → mount → handler | WIRED | Emission `Engine.ts:2333`; layer callback `:649-651`; mount forward `:238`; Studio prop `:11062`. |
| `PhysicsPaintStudio.tsx` | `AquarelleCachedBaseLayer.tsx` | `handleAquarelleCoverDab` → `beginAquarelleLiftPreview(frame, 'core')` → `flushPreview` → `buildLiftCoverage(..., 'core')` → `punchTransmittanceRgba` | WIRED | Handler `:8049-8066`; preview bus; `flushPreview:72-78`; core branch in `aquarelleLiftErase.ts:365-462`. |
| `PhysicsPaintStudio.tsx` | `aquarelleLiftErase.ts` | stroke end → `runAquarelleLiftErase(coverPlan, stroke, dabs)` with `plan.mode = 'cover'` → `punchTransmittanceBytes(..., { profile: 'core' })` → `captureLivePixels` (same ledger) | WIRED | Dispatch `:9365`; mode read `:8247`; punch `:8426-8430`; commit `:8498-8507`; no separate ledger allocation — relies on the stroke recorded at `:9353`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Engine.ts` ink cover | `preInk` | Positional blit of the live `ink.read` at stroke start (`:2359`) | Yes — real GPU target, no literal/mock | ✓ FLOWING |
| `Engine.ts` → Studio | `onCoverDab` args `(x, y, r, amount, angle)` | Per cover draw in `coverPass` (`:2312-2335`), amount from `bodyCurve(P.body) * COVER_GAIN` | Yes — real per-dab geometry | ✓ FLOWING |
| Studio cached base | punched cover canvas (`punchedCover.canvas`) + pre-punch `coverBase` | `punchTransmittanceBytes(..., { profile: 'core' })` over the decoded cached base bytes | Yes — real punched pixels, `mergeBlend: 'pigment-alpha'` | ✓ FLOWING |
| Studio durable base | `punchedDurableBytes` | Written only when `coverDurableDefined` (KNOWN / KNOWN-EMPTY); UNKNOWN leaves the entry untouched | Yes — three-state gate, pinned by the seam contract test | ✓ FLOWING (guarded) |
| Body 0 | — | No allocation, no draw, no emission | Expected neutral (identity) | ✓ NEUTRAL (by construction) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Body 0 byte neutrality | `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity` then `compare.mjs neutral-identity` | 6/6 byte-identical (d2bd637a / 291d4a11 / 6ba88334) | ✓ PASS |
| Cover-over-wet standing baseline | `run.mjs --gate cover-over-wet --scenario cover-over-wet --body 100` then `compare.mjs cover-over-wet` | Digests match the committed baseline; region invariants hold (crossing 32.31, own 3.47, under 55.36, paper 0) | ✓ PASS |
| Underlayer erased vs pre-feature engine | `compare.mjs cover-over-wet --differs-from cover-over-wet-prefix` | PASS — crossing 34.05 → 32.31 (cross ≤ ref − 0.5), all three digests differ | ✓ PASS |
| Own deposit survives vs clamped subtract | `compare.mjs cover-over-wet --differs-from cover-over-wet-subtract` | PASS — crossing 30.74 → 32.31 (cross ≥ ref + 0.5), all three digests differ | ✓ PASS |
| Engine package suite | `pnpm --filter @efxlab/efx-watercolor test` | 31 files / 561 passed, 8 skipped (includes the "cover seam" block and the spec-06 Body cover block) | ✓ PASS |
| Targeted app suites | `pnpm --filter efx-motion-editor exec vitest run` on cover seam (11), lift coverage core (7), Lift erase/contract/ribbon/selection suites | 94 passed; `PhysicsPaintStudio.test.ts` 438/438 | ✓ PASS |
| Typecheck | `pnpm --filter @efxlab/efx-watercolor run check` and `pnpm --filter efx-motion-editor run typecheck` | clean | ✓ PASS |
| Function usage wiring | `Engine.ts:453` program registration used at `:2396`; `onCoverDab` emitted `:2333`, forwarded through layer/mount, consumed at Studio `:11062` | Imported and used on both sides | ✓ PASS |

Note: six app-suite failures reported at HEAD (`mediumSelection.test.ts` ×2, `AquarelleGlobalsPanel.test.ts` ×1 stale `body: 90`; `aquarelleLayerContract.test.ts` ×2, `viteBuild.test.ts` ×1 stale display-shader markers) are pre-existing from commit `fe4b2531e` and none of those files is in this task's changed-file set. No failure occurs in any file this task touched.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `neutral-identity` (declared in PLAN verification) | `run.mjs --gate neutral-identity` + `compare.mjs neutral-identity` | exit 0; 6/6 fields byte-identical | ✓ PASS |
| `cover-over-wet` (declared in PLAN verification) | `run.mjs --gate cover-over-wet --scenario cover-over-wet --body 100` + `compare.mjs cover-over-wet` | exit 0; standing equality gate PASS | ✓ PASS |
| `cover-over-wet` vs `cover-over-wet-prefix` | `compare.mjs cover-over-wet --differs-from cover-over-wet-prefix` | exit 0; three digests differ, dimensions agree, directional claim (erased) holds | ✓ PASS |
| `cover-over-wet` vs `cover-over-wet-subtract` | `compare.mjs cover-over-wet --differs-from cover-over-wet-subtract` | exit 0; three digests differ, directional claim (own survives) holds | ✓ PASS |

### Requirements Coverage

No requirement IDs declared (`requirements: []`) and no REQUIREMENTS.md mapping for this quick task — not applicable.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | Debt-marker scan (`TBD`/`FIXME`/`XXX`, `TODO`/`HACK`/`PLACEHOLDER`, placeholder phrases) over all 18 changed files returns no matches. No empty-return or hardcoded-empty stubs in the new code paths. |

**Documented deviations (not gaps):**

- The ink-cover law is the **bounded multiplicative** form (`share = clamp(pre / max(ink, 1e-6), 0, 1)`), not the spec's literal `FUNC_REVERSE_SUBTRACT` blend. This deviation was explicitly approved by the user; the spec's literal law was measured to over-subtract ~4× and drive absorbance negative. The goal (centre replaced, rim mixes, never negative, own pigment preserved) holds in the code and is probe-evidenced.
- Recorded limitation (per CONTEXT's wet-ink fallback): when advection makes `preInk_c > ink_c` the per-channel share clamps at 1 (full erase for that channel). Accepted and documented in REVIEW-FIX CR-01.

### Human Verification Required

1. **UAT 1 — Fresh-frame cover**
   **Test:** Fresh frame, red Acrylic stroke, then a light-gray Acrylic (Body 100) stroke across it.
   **Expected:** At the crossing the centre shows only gray; no red remains.
   **Why human:** Visual colour outcome; no automated render assertion.
2. **UAT 2 — Zoomed rim**
   **Test:** Same crossing, zoomed 4x.
   **Expected:** Centre uniform (no underlayer), rim transitions progressively.
   **Why human:** Spatial gradient is a visual property.
3. **UAT 3 — Cooked frame**
   **Test:** On a cooked frame, leave the key, return, repeat UAT 1.
   **Expected:** Same as UAT 1, and it survives another leave/reopen.
   **Why human:** Frame-navigation persistence is an app-level flow.
4. **UAT 4 — Body 0 neutrality**
   **Test:** Watercolor (Body 0) painted over a colour.
   **Expected:** No cover; wet-on-wet mixing unchanged.
   **Why human:** Mixing appearance is a texture judgement (the no-cover part is code-verified).
5. **UAT 5 — neutral-identity**
   **Test:** Body 0 vs the tuned Acrylic.
   **Expected:** `neutral-identity` byte gate 6/6.
   **Why human:** Automated and already PASSED in this verification (6/6 byte-identical); listed for UAT completeness.
6. **UAT 6 — Undo / Redo**
   **Test:** Undo then Redo the covering stroke.
   **Expected:** The underlayer returns, then disappears again, in both the engine and the cached base.
   **Why human:** Undo/redo across two surfaces has no automated behavioral test.
7. **UAT 7 — Export parity**
   **Test:** Export / frame cache vs the live view.
   **Expected:** The exported sheet matches what the user saw.
   **Why human:** End-to-end visual comparison.

### Gaps Summary

No automated gaps. All must-have artifacts exist and are substantive and wired; all five key links are connected; the `preInk` lifecycle set includes `restore()` and is pinned structurally; `Body 0` is neutral by construction and by the independent 6/6 byte-identity probe; the probe gate distinguishes the intended outcome from both the pre-feature engine and the pre-CR-01 clamped subtract; Lift's own erase and every pinned contract literal survive byte-identically.

Three truths are present and wired but assert runtime behavior no automated test exercises — the visual centre/rim replacement (truth 1), the cooked-frame punch surviving leave/reopen and export (truth 3), and the undo/redo cycle across both surfaces (truth 4). These are exactly live UAT rows 1-3, 6 and 7 and are the human gate for this quick task. Status is `human_needed`, not `gaps_found`.

---

_Verified: 2026-11-17T22:29:17Z_
_Verifier: Claude (gsd-verifier)_
