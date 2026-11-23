---
phase: 261123-pee-hold-paint-wet-until-dry-no-auto-dry-wet
reviewed: 2026-11-23T19:30:09Z
depth: quick
files_reviewed: 24
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - packages/efx-watercolor/probe/wet-hold/index.html
  - packages/efx-watercolor/probe/wet-hold/probe.ts
  - packages/efx-watercolor/probe/wet-hold/run.mjs
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/holdWet.test.ts
  - packages/efx-watercolor/src/playground/lastTouch.test.ts
  - packages/efx-watercolor/src/playground/liveSeed.test.ts
  - packages/efx-watercolor/src/playground/wetState.ts
  - packages/efx-watercolor/src/playground/wetState.test.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 261123-pee: Code Review Report

**Reviewed:** 2026-11-23T19:30:09Z
**Depth:** quick (changed hunks + their called/calling engine regions traced)
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the hold-wet change (three commits `e5b013159`, `2f34d35ac`, `c7722cb1f`) against the locked laws: the live sheet never auto-dries, explicit Dry is exactly one engine `'dry'` step plus one ledger entry, every commit path is dry-first with the non-mutating export only for a real in-flight stroke, the 1.2 s Dry capture timer invalidates on renewal, and wet bake skips settle while keeping the cook window.

The core design holds up: the reader-side decay bypass (`wetDecay` / `advectWet` uDecay), the `sleep()` wetPeak retention, the `fix(auto)` hold refusal, the no-step `settleForCapture` tail, the `exportSettledCanvas` capture/settle/restore with the `this.stroke` raw-export gate, the `historyRevision` invalidation, the wet-event filtering in the controller, and the adapter `holdWet` pass-through (never on an injected engine) are all consistent with the laws. The Dry ledger wiring keys on `fix()`'s return and both stacks move only on success.

The one blocker is stack divergence: the new Dry ledger entry assumes the engine's next undo step is the matching `'dry'` step, but the layer opens an unledgered `'clear'` engine step on every frame change, so undoing a Dry after navigating away resurrects the other frame's paint. Five warnings cover the Dropped-Dry-capture family (wall clock vs frame time, second Dry inside the window), the missing in-flight-stroke gate on `settleForCapture`, the non-restored `active` region on the settled export, and the windowed last-touch restore under a document-wide clear. Two info items: the now-unreachable settle-cap reopen machinery and the hold lift that precedes `fix()`'s early returns.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Dry undo/redo after a frame change undoes the wrong engine step (BLOCKER)

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:1071-1088` (undo), `:1312-1327` (redo); `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1272`; `packages/efx-watercolor/src/playground/Engine.ts:2143-2161`, `:2225-2247`, `:3987-3998`
**Severity:** BLOCKER (Critical)
**Issue:** The dry branch pops the `'aquarelle-dry'` ledger entry and calls `undoPaint()` → `engine.undo()` → `travel('undo')`, assuming the engine's undo top is the matching `'dry'` step. That holds only while the frame does not change. When the artist navigates, the layer's frame-change handler calls `engine.clear()` (AquarelleCanvasLayer.tsx:1272), and `clear()` opens an unledgered `'clear'` history step whenever `everPainted` is set (Engine.ts:2147-2148). `everPainted` survives a Dry — `step()` clears only `painted`/`wetPeak` (Engine.ts:3992-3998) — so the sequence Dry on frame A → navigate to frame B → Cmd+Z pops the dry entry and `travel('undo')` undoes the `'clear'` step, restoring frame A's post-dry sheet onto frame B. The bogus pixels then commit into frame B's cache on the next capture (`settledSnapshot` on leave), and the ledger and engine stacks stay permanently offset for the remaining entries. Redo is symmetric: it re-applies `'clear'` and wipes frame B. Same-frame Dry undo works, which is why manual UAT would miss this. The codebase already knows this failure class — the recorded-stroke branch refuses to fall back to `undoPaint()` precisely because "engine.clear() is a history step, so an engine undo would resurrect pre-undo pixels" (useRotoPhysicalEditHistory.ts:1114-1115); the new dry branch has no equivalent guard.
**Fix:** Fail closed unless the engine's pending undo step is the dry step. `History.peekUndo()` already returns `{ kind, label, boundary }` (History.ts:88), so expose it:
```ts
// Engine.ts
get peekUndoKind(): StepKind | null { return this.history.peekUndo()?.kind ?? null; }
```
and gate both branches:
```ts
if (inputRef.current.peekUndoKind?.() !== 'dry') return false; // stacks untouched
```
Alternative: reset the engine history and the physical ledger together on frame navigation (`engine.clear()` should also discard undo/redo, or the layer must clear the ledger in the same tick) — the two stacks are only in step while the frame is unchanged.

### Warnings

#### WR-01: Dry settle capture is dropped when the 1.2 s wall clock outruns engine time

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1172-1190` (timer and `settled` gate), `:1025-1027`; `packages/efx-watercolor/src/playground/Engine.ts:4277-4311` (rAF dt clamp)
**Severity:** WARNING
**Issue:** `FIX_SETTLE_MS = 1200` (line 84) is wall-clock and exactly equals `FIX_DURATION` = 1.2 s of *engine* time, but engine time only advances through rAF ticks with `dt` clamped to ≤ 1/30 (Engine.frame). Any frame slower than 1/60 — jank, a 30 fps display, a hidden or backgrounded window where rAF pauses entirely — makes the fix finish after wall-clock 1.2 s, so at timer fire `engine.isFixing` is still true and `settled = !engine.isFixing && !engine.hasStandingWater` (line 1177) returns without capturing. Nothing retries. The in-flight completion loop in `settleSheetNow` (lines 1025-1027), written precisely to finish a settle synchronously, is unreachable from this path because the guard rejects before `settledSnapshot` runs. Effect: the Dry's settled cache commit is silently dropped (telemetry only) until some later capture; the committed frame no longer matches the dry look the artist is looking at.
**Fix:** When the frame and revision are unchanged, do not drop — let `settledSnapshot` drive the settle:
```ts
if (frameChanged || revisionChanged || !hasPaint) return;
onCaptureFrameRef.current?.(dryPlayFrame, settledSnapshot);
```
`settleSheetNow` already drives an in-flight fix through its tick loop and no-ops on an already-dry sheet, so the `settled` guard is redundant with the correct frame/revision guards; keep it as telemetry only.

#### WR-02: A second Dry pressed during the settle window cancels the first capture and schedules none

**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1107-1112`, `:1160-1170`; `packages/efx-watercolor/src/playground/wetState.ts` (fixing branch)
**Severity:** WARNING
**Issue:** `offDry` sets `drySheetWasWet = engine.hasStandingWater` after cancelling every pending timer (line 1108). While the first fix is in flight, `isFixing` is true and `isSheetWet` returns false for a fixing sheet, so a second Dry inside 1.2 s reads `drySheetWasWet = false`; `engine.fix()` then refuses (`fixTimer > 0`, Engine.ts:2073) so no ledger entry is recorded, and `offDryCapture` returns without scheduling (lines 1162-1169). Net: the in-flight settled sheet is never captured on this frame even though the sheet was wet when the first Dry was pressed. Self-heals at frame-leave, but the Dry path silently loses its commit. The live↔capture handoff also depends on `drySinks` Set insertion order (aquarelleRecordState.ts:2614) — correct today, fragile by construction.
**Fix:** Treat an in-flight fix as wet for the capture decision, and let the timer single-shot the settle:
```ts
drySheetWasWet = engine.hasStandingWater || engine.isFixing;
```
(combined with WR-01's fix so the timer no longer drops unsettled sheets).

#### WR-03: `settleForCapture()` lacks the in-flight stroke gate the law requires

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2106-2110` (compare `:2119-2122`); reached from `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1078-1088`, `:1020-1041`
**Severity:** WARNING
**Issue:** The locked law says the raw export is for a real in-flight stroke only, gated on `this.stroke`. `exportSettledCanvas` honors it (line 2122); `settleForCapture` checks only `painted`/`fixTimer`. `flushCapture` and the frame-leave/nav flush call `settledSnapshot` → `settleSheetNow` → `settleForCapture` with no stroke check, so a flush that lands while `engine.stroke !== null` (a save or navigation triggered while a pen stroke is still down — e.g. second input device) calls `beginSettle` and ticks: per the `exportSettledCanvas` comment, settling aborts the stroke, so the in-progress stroke is killed and the commit captures a mid-stroke sheet.
**Fix:** Mirror the export gate:
```ts
settleForCapture(): boolean {
  if (this.stroke !== null) return false;
  if (!this.painted || this.fixTimer > 0) return false;
  this.beginSettle(this.painted, false);
  return true;
}
```
Callers already fall back to `snapshot()` / raw export when it returns false.

#### WR-04: The settled export's restore is not "exactly as wet" — the sim stays asleep after a save/lift

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2131-2139`, `:1143-1160`, `:2174-2187`, `:913-924`, `:1249-1258`
**Severity:** WARNING
**Issue:** `exportSettledCanvas` restores via `restoreSheet` → `resetSheet` → `resetPaintState`, which nulls `active`, zeroes `flowSpeed`, and clears `fixTimer`; `SheetSnapshot` carries no active region, so after the restore `isAwake` is false and the simulation does not resume. The water and `wetPeak`/`lastWet` are restored (the sheet reads wet to the gate), but mobile pigment stops moving until the next stroke touches a region — and pigment outside the new stroke's region never resumes diffusing. The comment at lines 2113-2118 promises the sheet is "exactly as wet afterwards"; it is wet but frozen. The locked law only demands "remains wet", so this is a comment/behavior mismatch with a real artist-visible effect (save mid-diffusion freezes the paint motion).
**Fix:** Carry `active` in the snapshot and restore it with a re-arm, matching what history steps already record via `StepMeta.active`:
```ts
// captureSheet/captureWhole: add active: this.active ? { ...this.active } : null
// restoreSheet: this.active = s.active ? { ...s.active } : null;
//              if (this.active) this.minAwakeUntil = this.clock() + 250;
```
Or amend the law/comment to state that a settled export freezes the sim until the next touch.

#### WR-05: A Dry undo restores the last-touch memory only inside painted ± 24 texels

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2074-2081`, `:3825-3837`, `:849-855`, `:2242-2245`
**Severity:** WARNING
**Issue:** `fix()` clears last-touch document-wide (`clearLastTouch`, line 2081 → 849) but its step snapshot protects pool 0 only over `painted ± PROTECT_MARGIN` (`beginSettle` → `touch(rect, true, true)`, lines 3829-3830). The comment at 2080-2081 claims the pre-dry pair "must land inside the 'dry' step's pool-0 snapshot" — true only within that window. Because `painted` is reset at the end of every fix (3992-3998), a Dry on a sheet painted in several areas protects only the most recent wet region; undoing the Dry cannot restore the pre-dry last-touch memory anywhere else, so dry-edge shading on previously painted areas will not match the pre-dry sheet. This inherits the engine's tile-local undo philosophy for strokes, but the Dry is a document-wide operation, so the asymmetry is new to this feature — and the locked law says one undo restores the exact pre-dry sheet.
**Fix:** Protect the last-touch pool over `everPainted` (the exact extent where a stamp can exist) instead of `painted` for the dry step, e.g. `this.touch(this.everPainted ?? this.painted, true, true)` in `fix()`. Cheap: `everPainted` is maintained by the same `touch` that stamps.

### Info

#### IN-01: Settle-cap reopen machinery is now dead in the application

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2067-2077` (`auto` parameter and hold branch), `:2090-2096` (`cancelAutoFix`), `:636`, `:2077` (`autoFix`)
**Severity:** Info
**Issue:** After this change the layer never calls `cancelAutoFix()` or `fix(true)` — the contract test now pins `engine.cancelAutoFix()` absent (aquarelleLayerContract.test.ts:195) — and no other non-test app caller exists; the only remaining user is the dev `probe/port-comparison` harness. The `auto` branch, `autoFix` state, and `cancelAutoFix()` are unreachable in production, and the hold-wet law supersedes the settle-cap reopen.
**Fix:** Remove the `auto` parameter, `autoFix` field and `cancelAutoFix()` (update the probe), or mark them `@deprecated` with a note that no application caller remains. Removing them also collapses the `if (auto) { if (this.holdWet) return false; }` clause in `fix()`.

#### IN-02: `fix()` lifts the hold before its early returns

**File:** `packages/efx-watercolor/src/playground/Engine.ts:2070-2073`; re-armed at `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1286`
**Severity:** Info
**Issue:** `else this.holdWet = false` runs before `if (!this.painted || this.fixTimer > 0) return false`, so a Dry pressed on a blank sheet or during an in-flight fix clears the hold without opening a step — the ledger is keyed to the return value (fail closed) while the hold is not. Harmless today (nothing wet to decay on a blank sheet; a fixing sheet flash-dries regardless; the next rAF re-arms it), but the invariant "the hold is lifted only by a Dry that actually opened a step" is false by one tick.
**Fix:** Move the lift after the guard:
```ts
if (!this.painted || this.fixTimer > 0) return false;
if (!auto) { this.holdWet = false; this.autoFix = false; }
```

---

_Reviewed: 2026-11-23T19:30:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
