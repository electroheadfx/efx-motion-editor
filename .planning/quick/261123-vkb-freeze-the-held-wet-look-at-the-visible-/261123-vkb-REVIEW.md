---
phase: 261123-vkb-freeze-the-held-wet-look-at-the-visible-
reviewed: 2026-11-23T22:54:00Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - packages/efx-watercolor/probe/wet-hold/probe.ts
  - packages/efx-watercolor/probe/wet-hold/run.mjs
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/holdWet.test.ts
  - packages/efx-watercolor/src/playground/settleCap.test.ts
  - packages/efx-watercolor/src/playground/settleCap.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 261123-vkb: Code Review Report

**Reviewed:** 2026-11-23T22:54:00Z
**Depth:** quick (pattern position scans plus targeted full reads — the delivered diff is small enough that every changed hunk was read in context)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the full diff `a11704700..HEAD` (commits d12a95650, 6036152e5, cecd10021): the held awake window bounded at the visible settle cap (`Engine.awakeUntil()`), the formula's move to the zero-import `playground/settleCap.ts`, the layer's sleep-transition cuisson floor, and the probe's cap/hold-off/freeze/wetSession arms.

**No Critical finding was provable.** The core law checks out:

- `awakeUntil()` is the strict min of `wetUntil()` and `lastWet + cap * SETTLE_TICK_MS`, measured from `lastWet` (updated at every water deposit: stamp/fill/lift paths); the unheld branch returns `this.wetUntil()` exactly, so no unheld window is shortened or extended.
- Exactly three awake predicate sites exist (getter 1261, `tick()` 1577, `frame()` 4329) and all three read `awakeUntil()`; no `now < this.wetUntil()` comparison survives.
- No wake loop: only a stroke, a fix timer, or `touch()` (250 ms floor, below the minimum 500 ms cap at dry 100) can keep the held sheet awake past the cap, and `sleep()` is reached from the existing tick paths; `frame()` reschedules only when awake or stroking.
- The sleep/gate/decay machinery is untouched: `sleep()` keeps `wetPeak` while held, so the Water gate stays open and the probe confirms gate-open at peak 0.028906 after the frozen advance.
- Units are consistent end to end: the layer's stamp and the bake's `settleCap` both consume Dry Speed in canonical percent (recorded via `snapshotAquarelleRecord`, `engine.params = { ...s.params }` in `toStudioStroke`); the engine's internal fraction is multiplied by 100 at the one call site. Both call the same function object (pinned by `settleCap.test.ts`).
- The layer's cap floor is correct in the normal case: while held, the measured window from `endedAt` is always <= the cap, so the floor lands exactly on the same value the bake's `settleCap` will compute, and the commit path's existing `stampPendingSettle(capTicks)` is unchanged.
- Tests executed and green: `settleCap.test.ts` + `holdWet.test.ts` (2 files / 30 tests), and `aquarelleLayerContract.test.ts` (30 tests).
- Probe evidence read from disk: `/tmp/wet-hold/hold-hold.json` (ticks 30, windowTicks 30, peak 0.028906, gate open, `frozen`/`frozenAfter` raw digests identical, 7 layer digests identical), `/tmp/wet-hold/hold-nohold.json` (211 ticks, peak 0, gate closed), `/tmp/wet-hold/bake.json` (wet 0 / dry 72 / wetSession settleTicks 0, peak 0.028906).

Two warnings follow: the probe's exact cap-window equality is decided by float accumulation parity (deterministic today, but one tick away from a false failure), and the sleep-transition cuisson floor reads the live Dry Speed instead of the stroke's recorded one, leaving a timing window that reopens the washed-settle fallback the floor exists to close. Three Info items cover a stale comment number, an unexercised cap branch, and the freeze proof's scope.

Downstream behavior that was checked and is consistent with the law (not a finding): held bake seams (`settle: 'wet'` + `holdWet`, the Apply Script / Shift+R path) now sleep at the cap, so `stepGap` skips earlier and the committed wet look freezes at the cap; the new `wetSession` arm certifies exactly that (`settleTicks` 0, mobile water retained), and the SUMMARY's UAT row 4 covers it.

Necessity was not assessed (`quick` depth per the review contract).

## Warnings

### WR-01: The cap-window assertion is decided by float accumulation parity, not by the law

**File:** `packages/efx-watercolor/probe/wet-hold/run.mjs:537-541` (measure built in `packages/efx-watercolor/probe/wet-hold/probe.ts:535-561`)
**Issue:** `idle.windowTicks === result.config.capTicks` (30) and `idle.ticks === NATURAL_HOLDOFF_WINDOW_TICKS` (211) are exact equalities on emergent float durations. The adapter's virtual clock is accumulated add-by-add (`virtualNow += 1000 * (1/60)`, `engineAdapter.ts:343-346`), while the engine's bound is a single product (`lastWet + 30 * SETTLE_TICK_MS`). Whether the last awake top-of-loop observation lands at offset 29 or 30 depends on which side of that ULP difference the accumulated clock falls. Reproducing the exact accumulation in Node: across last-deposit phases 1..5000, 2612 phases read 30 and 2388 read 29 — the current scene (lastWet ≈ 300 ms) sits in the passing branch. Any innocuous change that shifts the last deposit by one host tick (sample count, pressure, scene length, an extra warm-up tick) flips `windowTicks` to 29 and fails the run while the law is fully intact. The 211 hold-off pin is the same class of emergent-duration exactness (it is a threshold-crossing tick count, not a constant).
**Fix:** Assert the quantized law instead of the exact count — the sleep lands in the half-open window `(cap - 1, cap]`:
```js
check(
  'cap window: the last awake observation is within one tick of the cap',
  idle.windowTicks <= result.config.capTicks &&
    idle.windowTicks >= result.config.capTicks - 1,
  `window ${idle.windowTicks} vs cap ${result.config.capTicks}`,
)
```
Keep `capTicks === 30` as the formula pin. For the hold-off control, keep the exact 211 as a printed regression readout (or a documented tolerance) rather than a hard gate.

### WR-02: The sleep-transition cuisson floor reads the live Dry Speed, not the stroke's recorded Dry Speed

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1302` (same source at the commit stamp, `:1029`)
**Issue:** The bake derives `settleCap` from the LAST stroke's recorded params (`aquarelleBake.ts:646-647` reads `lastEntry.stroke.engine.params.dry`, a canonical percent), but the awake-to-asleep stamp floors with `aquarelleVisibleSettleTicks(aquarelleParams.value.dry)` — the live bag at sleep time. The stroke snapshotted its own `params` at record time (`:755`) and already carries `diffusionFrames = aquarelleVisibleSettleTicks(snap.params['dry'] ?? 50)` (`:777`). If Dry Speed (or the active medium/preset, `aquarelleRecordState.ts:236-241`) changes between stroke end and the cap sleep — a window of up to 300 ticks ≈ 5 s at low dry — a raised dry makes the floor LOWER than the bake's `settleCap`, so `settleCapped` flips false (`aquarelleBake.ts:654`) and `applySettle` falls into the uncapped `while (seams.isAwake())` loop (`aquarelleBake.ts:913-920`): exactly the washed re-render the floor was added to prevent. The stamp also silently lowers the correct record-time value.
**Fix:** Floor from the pending stroke's own recorded percent, mirroring line 777 and the bake's read (the pending stroke is in scope at the call site):
```ts
if (wasAwake && !awake) {
  stampPendingSettle(
    pendingSettle
      ? aquarelleVisibleSettleTicks(pendingSettle.stroke.params['dry'] ?? 50)
      : 0,
  )
}
```
Apply the same source to `settleSheetNow`'s `capTicks` (`:1029`) so the commit and sleep stamps can never disagree with the bake's `settleCap`. Update the `aquarelleLayerContract.test.ts` pin accordingly.

## Info

### IN-01: The new comment cites a fallback number no current path can produce

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1293-1300` (line 1299)
**Issue:** The comment says a below-cap cuisson would "make a dry re-render fall back to the washed 237-tick cook". 237 is the pre-vkb HELD baseline (`/tmp/wet-hold/hold-hold.pre-vkb.json`), which the probe's own header documents as "a different physical setup". The actual dry re-render seam is unheld (`physicsPaintRotoPlayScriptRenderer.ts:162-172` passes no `holdWet`), and the hold-off control measured its natural window at 211 ticks (`/tmp/wet-hold/hold-nohold.json`). No held path can run 237 ticks anymore — the vkb engine caps it at 30 at this lens.
**Fix:** Name the fallback instead of the stale number — "falls back to the uncapped natural settle (`while (seams.isAwake())`), the washed window" — or cite the measured 211.

### IN-02: Only the cap-shorter branch of the held min is exercised at runtime

**File:** `packages/efx-watercolor/probe/wet-hold/probe.ts:132` (`DRY_PARAM = 100`), `run.mjs:537-541`
**Issue:** The scene's natural held window (≈237 ticks) is longer than the cap (30), so the probe exercises only `Math.min`'s cap branch. The other branch — a nearly-dry held sheet whose `wetUntil()` is shorter than the cap (reachable: `ln(wetPeak/threshold) < 0.25` at dry 100) — has no runtime witness; it is pinned only by the source-scan string in `holdWet.test.ts`. A probe run at a low-water lens (or an assertion on `wetUntilMs < lastWetMs + cap * SETTLE_TICK_MS` for a water-light stroke) would cover the "never extends a natural window" half of the law.
**Fix:** Either add one water-light probe arm (asserting the shorter window ends before the cap and the log text/`wetUntilMs` shows the wetUntil bound), or acknowledge the gap in the probe header.

### IN-03: The freeze proof covers the engine asleep, not the live layer's per-frame re-arm loop

**File:** `packages/efx-watercolor/probe/wet-hold/probe.ts:1131-1140`
**Issue:** The freeze proof runs on the manual, adapter-driven engine after `settledExportProof`, with `active === null` — it proves clock-driven immutability of the asleep sim (a genuine test: a stray wake would move the wet layer). It does not exercise the live layer's per-frame sequence that keeps the sheet asleep in the app (`setHoldWet(true)`, `applyLiveConfig` → `setParams`/`setTool`/`setBrush`, `setPigment`, `applyPaper` at `AquarelleCanvasLayer.tsx:1292-1308`). Those are side-effect-free today (`setHoldWet` assigns; `setParams` is `Object.assign`; no setter calls `schedule()`/`touch()`), but no test would catch a future setter that schedules a frame or resets `lastWet`, which would resurrect a wake loop or restart the cap.
**Fix:** Extend the layer contract source scan to pin the ordering (the `setHoldWet(true)` re-arm line precedes `const awake = engine.isAwake`) and to assert the per-frame setters issue no `schedule(`/`touch(` calls; or drive a probe arm through the layer's exact per-frame call sequence after sleep.

---

_Reviewed: 2026-11-23T22:54:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
