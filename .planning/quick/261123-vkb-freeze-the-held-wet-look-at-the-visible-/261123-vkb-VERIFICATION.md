---
phase: quick/261123-vkb
verified: 2026-11-23T22:58:00Z
status: passed
score: 7/7 must-haves verified
covered_files: [".planning/quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/261123-vkb-PLAN.md", ".planning/quick/261123-vkb-freeze-the-held-wet-look-at-the-visible-/261123-vkb-SUMMARY.md", "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx", "app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts", "packages/efx-watercolor/probe/wet-hold/probe.ts", "packages/efx-watercolor/probe/wet-hold/run.mjs", "packages/efx-watercolor/src/bake/aquarelleBake.ts", "packages/efx-watercolor/src/playground/Engine.ts", "packages/efx-watercolor/src/playground/holdWet.test.ts", "packages/efx-watercolor/src/playground/settleCap.test.ts", "packages/efx-watercolor/src/playground/settleCap.ts"]
covered_digest: "v4:sha256:9766dd82ce70fcd9db4d0055bd64a6d9156ae49ccc0af71b8aa09cae97570b6b"
behavior_unverified: 0
overrides_applied: 0
---

# Phase quick/261123-vkb: Freeze the held wet look at the visible settle cap — Verification Report

**Phase Goal:** While the live Studio sheet is held (`holdWet`), cap the engine's awake window after the last wet input at the retired visible settle timing `round(30 + 270 × (1 − dry))` ticks at 60 Hz, then SLEEP — no `fix()`, no wetness decay, no mobile-to-fixed. The Water gate stays open (`hasStandingWater true`), `wetPeak` survives sleep, water/mobile pigment remain. The next stroke or water dab re-arms the window. No infinite wake loop. Unheld sheet awake window byte-identical. Dry (F), dry-first captures, wet replay and the CR-01 Dry-ledger guard unchanged. ONE shared formula in the package consumed by engine and layer; no new recorded event type; no shader/medium/UI change; no stroke replay.
**Verified:** 2026-11-23T22:58:00Z
**Status:** passed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | While held, the awake window after the LAST WET INPUT is capped at the visible settle timing then the sim SLEEPS (no fix, no decay, no mobile→fixed); at dry 100 the recorded `windowTicks` equals `capTicks` = 30, not the natural ~237 | ✓ VERIFIED | `Engine.ts:3992-3995` — `awakeUntil()`: held branch `Math.min(this.wetUntil(), this.lastWet + aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS)`. `/tmp/wet-hold/hold-hold.json`: `config.capTicks 30`, `idle {ticks:30, engineMs:500, windowTicks:30, lastWetMs:300, wetUntilMs:4255.527}`, `fix:null`; pre-change `/tmp/wet-hold/hold-hold.pre-vkb.json` recorded `ticks:237` (natural window). `probe.ts:528-561` measures to the last AWAKE clock read (before `stepTick`), so the sleep-detection tick is excluded by construction. Predicate `windowTicks === capTicks` re-evaluated: PASS |
| 2 | The frozen sheet is immutable: raw canvas digest AND the seven paint-layer digests (`inkA`, `inkB`, `fixedA`, `fixedB`, `wet`, `relief`, `cover`) byte-identical across +30 s (1800 `stepTick`), with `isAwake` false, `hasStandingWater` true, `wetPeak` above `WET_THRESHOLD`, `active`/`stroke` null; `lastTouch` excluded (stored as ages) | ✓ VERIFIED | `hold-hold.json` `frozen` vs `frozenAfter`: raw `1868fee3` both; all seven layer digests identical (inkA 67855.241/37836, inkB −7442.466/35875, fixedA/fixedB/relief 0/0, wet 115.018/12518, cover 5379.386/9459); exactly the seven ids, no `lastTouch`; `frozenAfter {isAwake:false, hasStandingWater:true, wetPeak:0.028906, activeNull:true}`; `postSleep.strokeNull true`. Implementation: `probe.ts:171` `PAINT_LAYER_IDS` (7), `probe.ts:637-650` `frozenRead` excludes `lastTouch` (ages law documented), `probe.ts:1138-1140` 1800-tick advance. All 13 freeze predicates re-evaluated: PASS |
| 3 | A next wet input re-arms the window: the second acrylic stroke after the freeze wakes the sim, opens a history step and keeps the carried canvas colour at the no-idle control's level | ✓ VERIFIED | `hold-hold.json` `second {activeNonNull:true, depthBefore:2, depthAfter:3, pickupDragDeg:22.27, carried.loadedHueDeg:73.023}` vs control `72.705` (Δ 0.32° ≤ 5°); `settledAwake` proof (raw/settled differ, restored exactly, gate/peak/depth unchanged). Matches the pre-change second-stroke readout (22.27°) exactly, so the +30 s advance did not disturb the re-wake |
| 4 | An unheld sheet is byte-identical to today: the hold-off control walks with the hold lifted, records the natural window under the SAME last-awake measure, and the unheld sleep closes the gate and zeroes `wetPeak` | ✓ VERIFIED | `Engine.ts:3993` — `if (!this.holdWet) return this.wetUntil();` (byte-identical unheld value at all three awake sites; `sleep()`/`wetUntil()`/`wetDecay()`/gate/`fix()` untouched in the diff — comment-only hunks). `/tmp/wet-hold/hold-nohold.json`: `idle {ticks:211, windowTicks:211, lastWetMs:300, wetUntilMs:4255.527}`, `postSleep {hasStandingWater:false, wetPeak:0, activeNull:true}`; repeat run `hold-nohold-repeat.json` = 211 (deterministic). **Documented deviation:** the plan's literal `windowTicks === 237` was the HELD pre-change baseline — proven by `hold-hold.pre-vkb.json` (ticks 237, no `windowTicks` field, i.e. a held run) — while an unheld sim decays the wet field and sleeps at its own trim window (211). Exact-equality assertions kept at 211; no range widened |
| 5 | ONE formula definition: `aquarelleVisibleSettleTicks` lives only in the zero-import `playground/settleCap.ts`; `aquarelleBake.ts` re-exports it; `Engine.ts` imports the neutral module; no second copy of the 30/270 constants; bake sub-entry and main entry resolve the same function | ✓ VERIFIED | `settleCap.ts`: zero imports, one export pair (`SETTLE_TICK_MS`, `aquarelleVisibleSettleTicks`), `30 + 270` at line 38. `aquarelleBake.ts:42` imports it and `:287` re-exports the same binding; `Engine.ts:39` imports the neutral module. `grep -c "30 + 270"`: settleCap.ts = 1, aquarelleBake.ts = 0, tree-wide = 1. `settleCap.test.ts` asserts `toBe` identity (passes). `playground/index.ts` deliberately does NOT export it (no duplicate star-export); `dist/bake.d.ts` and `dist/index.d.ts` both export the same declaration |
| 6 | The held awake-to-asleep settle stamp is floored at the cap, so a dry re-render of a held sheet records a cuisson at or above the bake's `settleCap` (`settleCapped` stays true) instead of the washed fallback | ✓ VERIFIED | `AquarelleCanvasLayer.tsx:1302` — `if (wasAwake && !awake) stampPendingSettle(aquarelleVisibleSettleTicks(aquarelleParams.value.dry));`; `stampPendingSettle(minTicks = 0)` emits `Math.max(minTicks, measured)` (`:704-711`); bake derives the same cap from the recorded dry (`aquarelleBake.ts:646-654`, `settleCapped = rawSettle <= 0 || rawSettle >= settleCap`). `aquarelleLayerContract.test.ts` 30/30 green including the floored-call pin and the no-argument count 3→2. Residual edge case recorded as warning WR-02 below (live vs recorded dry when params change mid-window; same pattern as the pre-existing commit-path stamp at `:1029`) |
| 7 | The bake law is unchanged: `settle:'wet'` commits `settleTicks === 0` and `wetPeak > WET_THRESHOLD`; `settle:'dry'` forces exactly 72 ticks and zero peak; the same-session `wetSession` arm commits wet; its live-vs-bake digests/begin ticks are REPORTED, never asserted | ✓ VERIFIED | `/tmp/wet-hold/bake.json`: `wet {settleTicks:0, wetPeak:0.028906, path:timed}`, `dry {settleTicks:72, wetPeak:0}`, `wetSession {settleTicks:0, wetPeak:0.028906, path:timed, strokes:2, recordedOrder:[1000,1200], beginTicks:[0,12], endTicks:[3,15]}`; all 7 internal assertions `ok:true`. Cross-run against pre-change `/tmp/wet-hold/final-bake.json`: key wet/dry values + ink digests IDENTICAL. `run.mjs assertBake` gates only `settleTicks`/`wetPeak`; `reportParity` prints (`parity: reported`) and never calls `check`/throws on digest divergence (`run.mjs:410-446, 479-486`). Bake source diff = import + re-export + JSDoc only |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Documented Deviations (plan figures corrected, no law loosened)

| # | Plan expectation | Measured / implemented | Where |
| --- | --- | --- | --- |
| 1 | Hold-off control `windowTicks === 237` | 211 ticks, deterministic across two independent runs; the 237 figure was the HELD pre-change baseline (`hold-hold.pre-vkb.json` has no `windowTicks` field), not an unheld measurement. The unheld window is byte-identical by construction (`awakeUntil` returns `wetUntil()` when unheld) and the control demonstrates the natural decay/sleep path (gate closed, peak zeroed) | `run.mjs:141, 508-522`; SUMMARY "Deviations" #1 |
| 2 | Probe readouts are the assertions' own evidence | The readouts are written before the assertion block runs, so every one of run.mjs's 49 assertion predicates was re-evaluated deterministically against the four recorded JSONs at HEAD: 49/49 PASS, 0 FAIL | this report |
| 3 | Task-3 readouts postdate Task 2's commit and predate Task 3's commit (23:37-23:38 vs 23:39:32) | The committed probe/run code is what the readouts structurally reflect (all new fields present, the read-before-walk fix already in `hold-nohold.json`), and every committed predicate passes against the recorded values; the files are clean at HEAD | this report |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/playground/settleCap.ts` | The ONE formula home, zero imports | ✓ VERIFIED | 39 lines, one definition, `SETTLE_TICK_MS`, unit law in JSDoc; imported by bake, engine and probe |
| `packages/efx-watercolor/src/playground/settleCap.test.ts` | Formula + identity pins | ✓ VERIFIED | 5 tests pass (0/50/100, NaN/Infinity→165, clamps, tick ms, bake `toBe` identity) |
| `packages/efx-watercolor/src/bake/aquarelleBake.ts` | Re-export, no local copy | ✓ VERIFIED | Import `:42`, re-export `:287`, internal settle cap still uses it `:647`; `30 + 270` count 0 |
| `packages/efx-watercolor/src/playground/Engine.ts` | `awakeUntil()` + three substitutions | ✓ VERIFIED | Helper `:3992-3995`; sites `get isAwake :1261`, `tick() :1577`, rAF `frame :4329`; sleep/`wetUntil`/`wetDecay`/gate/`fix()` untouched |
| `packages/efx-watercolor/src/playground/holdWet.test.ts` | Re-expressed awake pins, never deleted | ✓ VERIFIED | Pins `awakeUntil` at all three sites, unheld early return, held strict-min expression, retired comparison count 0; wetUntil literal byte-identical; file green in the package suite |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | Single cap-floored stamp | ✓ VERIFIED | Only behavioral layer edit is the stamp argument at `:1302` plus comment prose; helper imported from `@efxlab/efx-watercolor` (present in built dist) |
| `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts` | Floored-stamp pins | ✓ VERIFIED | 30/30 pass; floored call pinned, no-arg count 3→2, `stampPendingSettle = (minTicks = 0)` pin unchanged |
| `packages/efx-watercolor/probe/wet-hold/probe.ts` | cap window, freeze read, holdoff, wetSession | ✓ VERIFIED | `settleCap` import `:93`, `idleWalk` last-awake measure `:528-561`, `PAINT_LAYER_IDS` `:171`, `frozenRead` `:637-650`, `FREEZE_ADVANCE_TICKS 1800` `:127`, `holdoff` `:469-495, 1068+`, `wetSessionArm` `:850+` |
| `packages/efx-watercolor/probe/wet-hold/run.mjs` | Cap/freeze/holdoff/parity assertions | ✓ VERIFIED | `--holdoff` flag, `reportHeld`/`reportHeldoff`/`reportBake`, gated bake laws, non-gating `reportParity`; all predicates pass against the recorded JSONs |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `playground/settleCap.ts` | `playground/Engine.ts` | ONE definition imported by `awakeUntil()` | ✓ WIRED | `Engine.ts:39` import; use at `:3994`; module has zero imports so no Engine↔adapter↔bake cycle |
| `bake/aquarelleBake.ts` | `playground/settleCap.ts` | Re-export of the SAME binding | ✓ WIRED | Import `:42` + `export { aquarelleVisibleSettleTicks } :287`; `settleCap.test.ts` `toBe` identity green; `dist/bake.*` and `dist/index.*` export it |
| `Engine.ts` awake sites | `Engine.awakeUntil()` | Three sites delegate; sleep via existing paths | ✓ WIRED | `:1261`, `:1577`, `:4329`; retired `now/clockNow < this.wetUntil()` comparisons count 0 (holdWet.test.ts green); `sleep()`, `wetUntil()`, `wetDecay()`, `uDecay`, the gate inputs and `fix()` have no behavioral diff |
| `AquarelleCanvasLayer.tsx` | `bake/aquarelleBake.ts` cap law | Awake→asleep `stampPendingSettle(...)` passes the shared helper's cap | ✓ WIRED | `:1302`; `Math.max(minTicks, measured)` contract `:704-711`; the bake's `settleCap` (`:647`) uses the same helper |
| `probe/wet-hold/probe.ts` | `probe/wet-hold/run.mjs` | Records `windowTicks`/`capTicks`/`frozen`/`frozenAfter`/`holdoff`/`wetSession`; run.mjs asserts cap, freeze (paint layers only), holdoff and gated bake laws, reports parity | ✓ WIRED | Fields present in all four readouts; 49 predicates re-evaluated green; parity printed, never asserted |
| Unheld path | Today's window | `awakeUntil()` returns `wetUntil()` exactly when not held | ✓ WIRED | `Engine.ts:3993`; hold-off control measures the natural decay window (211 ticks) with gate closed/peak zeroed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `Engine.awakeUntil()` | `lastWet + cap × SETTLE_TICK_MS` | Engine `params.dry` (0..1, `params.ts:196`) ×100 → helper; `lastWet` stamped at every wet deposit (`Engine.ts:1440, 3360, 3901`) | Yes — probe measured the engine window at exactly the helper's 30 ticks and `wetUntilMs` 4255.527 from the same `lastWet` | ✓ FLOWING |
| Layer stamp | `minTicks` from `aquarelleVisibleSettleTicks(aquarelleParams.value.dry)` | `aquarelleParams` signal (`aquarelleRecordState.ts:182`, dry percent default 50) — same source the commit path has used since 261019c (`:1029`) | Yes — recorded cuisson feeds `onStrokeSettled` → stroke `cuisson` → bake `settleCapped` | ✓ FLOWING |
| Probe `capTicks` / freeze read | helper(DRY_PARAM 100) = 30; paint-layer digests | Real engine `captureSheet()` / `exportCanvas` on the WebKit-WebGL run | Yes — recorded 30; seven layers with non-zero ink/wet/cover sums | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Package unit suite (formula pins, re-expressed awake pins, bake pins) | `pnpm --dir packages/efx-watercolor exec vitest run` | 43 files / 1023 passed / 8 skipped (2.23 s) | ✓ PASS |
| Layer contract (floored stamp + no-arg count) | `pnpm --dir app exec vitest run src/components/physic-paint/engine/aquarelleLayerContract.test.ts` | 30/30 passed | ✓ PASS |
| Probe assertion predicates vs recorded JSONs (49 checks: cap window, freeze, holdoff, bake A/B, wetSession, dry control, cross-run) | node re-evaluation of `hold-hold.json`, `hold-nohold.json`, `bake.json`, `hold-dry.json` at HEAD | 49/49 PASS, 0 FAIL | ✓ PASS |
| Recorded pre-change regressions (bake A/B + Dry control) | key-value diff vs `final-bake.json` / `verify-dry.json` | IDENTICAL both | ✓ PASS |
| Headless-Chrome probe re-run | not run — dispatch instructed to read the recorded JSON instead; no dev server started, no watch mode | — | ? SKIP (recorded readouts + predicate re-evaluation used instead) |

### Probe Execution (recorded readouts, verified from disk)

| Probe / readout | Recorded | Key values verified | Status |
| --------------- | -------- | ------------------- | ------ |
| `run.mjs --scene hold --dry 100 --label hold-hold` → `/tmp/wet-hold/hold-hold.json` | 23:37:01 | `capTicks 30`; `idle.ticks 30`, `windowTicks 30`, `lastWetMs 300`, `wetUntilMs 4255.527`; `postSleep {isAwake:false, hasStandingWater:true, wetPeak:0.028906, strokeNull:true, activeNull:true}`; raw digest `1868fee3` identical after 1800 ticks, 7 layers identical, no `lastTouch`; second stroke pickup Δ0.32°, drag 22.27°, depth 2→3; `captureSettle` 72 ticks; `fix:null` | ✓ PASS |
| `run.mjs --scene hold --holdoff --label hold-nohold` → `/tmp/wet-hold/hold-nohold.json` | 23:37:52 | `idle.ticks 211 === windowTicks 211`; `postSleep {hasStandingWater:false, wetPeak:0, activeNull:true}`; entry `wetUntilMs 4255.527` vs `lastWetMs 300` | ✓ PASS |
| repeat hold-off → `/tmp/wet-hold/hold-nohold-repeat.json` | 23:37:32 | 211 ticks again — deterministic | ✓ PASS |
| `run.mjs --scene bake --label bake --compare hold-hold` → `/tmp/wet-hold/bake.json` | 23:37:56 | wet `settleTicks 0` / peak 0.028906; dry `settleTicks 72` / peak 0; `wetSession settleTicks 0` / peak 0.028906, 2 strokes, begin [0,12]; 7 internal assertions ok; parity reported only | ✓ PASS |
| `run.mjs --scene hold --dry --label hold-dry --compare hold-hold` → `/tmp/wet-hold/hold-dry.json` | 23:38:00 | fix 72 ticks, depth 2→3, gate closed, peak 0, hold lifted; capture 72 ticks; second carries the canvas colour (Δ0.78°); cross-run depths 2 / 3 | ✓ PASS |
| Task-1 gate readout → `/tmp/wet-hold/hold-cap.json` | 23:29:33 | `idle.ticks 30`, `awakeToAsleep true`, gate open, peak 0.028906 (the tracer gate's 29-30 tick check) | ✓ PASS |

### Requirements Coverage

No requirement IDs declared: the PLAN frontmatter carries `requirements: []`. Not applicable to this quick task.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the nine changed files | — | Debt-marker gate clean |
| — | — | No stub patterns introduced (the `return null` hits in `aquarelleBake.ts`/`Engine.ts` are pre-existing invalid-input guards) | — | — |
| `AquarelleCanvasLayer.tsx` | ~1299 | Comment cites the "washed 237-tick cook" fallback; 237 was the pre-vkb HELD baseline (the unheld seam measures 211) | ℹ️ Info | Stale comment number only; no behavioral effect (review IN-01) |

### Non-Gating Warnings (from REVIEW.md, independently corroborated)

These do not fail any must-have; recorded for human decision.

| # | Warning | Corroboration |
| --- | ------- | ------------- |
| WR-01 | The probe's exact `windowTicks === capTicks` (30) and `ticks === 211` equalities ride float-accumulation parity (accumulated virtual clock vs one-product bound). Deterministic today; an innocuous scene shift could read 29 while the law is intact. Suggested hardening: assert `(cap - 1, cap]` and keep 30 as the formula pin | `Engine.ts:3994` single product vs `engineAdapter` add-by-add clock; recorded 30/30 passes today |
| WR-02 | The sleep-transition cuisson floor uses the LIVE `aquarelleParams.value.dry`, while the bake's `settleCap` reads the LAST STROKE's recorded `engine.params.dry`. If Dry Speed rises between stroke end and the cap sleep, the floor can land below the bake's cap and `settleCapped` flips false. Same source choice the pre-existing commit path uses (`:1029`); fix per review: floor from `pendingSettle.stroke.params['dry'] ?? 50` at both sites | `aquarelleBake.ts:646-654` reads the recorded dry; layer `:1302` passes the live signal; record-time `diffusionFrames` uses `snap.params['dry']` (`:777`) |
| IN-02 | Only the cap-shorter branch of the held `Math.min` has a runtime witness; the "nearly-dry held sheet keeps its shorter window" half is pinned by source scan only | `probe.ts:132` `DRY_PARAM = 100` lens; `holdWet.test.ts` string pins |
| IN-03 | The freeze proof covers the asleep engine, not the live layer's per-frame re-arm sequence (`setHoldWet(true)`, `applyLiveConfig`, `setPigment`, `applyPaper`) | `probe.ts:1131-1140`; layer `:1292-1308` side-effect-free today |

### Handover Notes

The seven live UAT rows (held freeze at ~1 s and ~10 s, pickup over the frozen sheet, dense Dry + undo, wet re-render/Apply, PlayScript, wet-key leave, optional Dry→Apply within 1.2 s) remain artist-run and deliberately pending. They are not part of the plan's `must_haves` (the plan hands them over as automated-ready under `<verification>`/`success_criteria`), so they do not gate this verdict. No dev server, watch mode, push or headless-Chrome re-run was performed during verification.

### Gaps Summary

No gaps. Every must-have truth is backed by code at HEAD (`cecd10021`) and by the recorded probe readouts whose 49 assertion predicates re-evaluate green against the data. The plan's literal 237-tick hold-off figure was corrected to the measured 211 with the diagnosis proven by the pre-change backup (237 was the held baseline); the unheld window remains byte-identical by construction. The two review warnings (WR-01 probe float brittleness, WR-02 live-vs-recorded dry source for the cuisson floor) are non-gating follow-up candidates, not goal failures — WR-02 mirrors the pre-existing commit-path pattern and no threshold was loosened anywhere.

---

_Verified: 2026-11-23T22:58:00Z_
_Verifier: Claude (gsd-verifier)_
