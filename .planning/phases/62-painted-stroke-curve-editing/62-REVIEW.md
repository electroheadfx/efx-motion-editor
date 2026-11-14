---
phase: 62-painted-stroke-curve-editing
reviewed: 2026-11-14T15:21:57Z
depth: deep
files_reviewed: 31
files_reviewed_list:
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
  - app/src/components/physic-paint/view/vectorPathFit.test.ts
  - app/src/components/physic-paint/view/vectorPathFit.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathLatches.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.ts
  - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
  necessity: 0
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-11-14T15:21:57Z
**Depth:** deep
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the complete phase-62 diff against `2b05506be320df3abe5e065f7aa3e7bb7bd4f345`, with targeted full reads of every new large region (curve bracket, fitter, pressure re-sample, overlay wiring, dialog gate, commit/undo/cancel sequencing), and ran all 14 in-scope test files through `pnpm --filter efx-motion-editor exec vitest run` — 1121 tests pass. The line numbers below are from the current tree.

The central defect is a teardown race in the new curve bracket: the only exit path that awaits (the dirty-Draft settle) is also the only window a second entry can interleave with, and the teardown unconditionally clears a capture it does not own, leaving the newer session permanently unable to exit. The second theme is the conversion write: it now rewrites a hand-painted record's samples and silently zeroes real recorded data (stylus tilt) that the replay consumes. The third theme is the new commit/undo/cancel sequencing, which has three failure windows where a script edit can be left unrecorded or a lock can be lost across an await.

Verified sound, for the record: the roto cache-revision refactor produces byte-identical identity strings at all eight call sites including the paper suffix; the fitter is bounded (DP + turn anchors + a doubling cap + index decimation, 40-anchor ceiling), deterministic, and preserves endpoints; the five `resolveCurveExitAction` cases match the D-06/D-14 table; the eligibility/gate matrix is coherent (empty anchors is not "vector", lift and degenerate refuse with named copy); and the D-09 band selection cannot regress drawn vector strokes because `buildVectorStroke` mints every drawn sample with the `-1` pressure sentinel (`vectorPathHandles.ts:869-874`), so `hasRecordedPressureProfile` is false for them and Phase 61's anchor-width envelope is retained.

No security findings (no injection, secret, or trust-boundary defect in scope). Performance is out of v1 scope. The necessity rubric was read and applied: no necessity findings — the payload-shaped defensive reads sit on deserialized-record data (negative space: trust boundary) and the two single-instantiation seams (`AquarellePathWriteOptions.curveMode`, `beginCurveWireframeBracket`'s return value) are test seams (negative space: test seams).

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: The curve-bracket teardown destroys a newer session's capture, stranding the wireframe, the Draft and a stale held fit

**File:** `app/src/components/physic-paint/view/vectorPathCurveBracket.ts:179-198`
**Issue:** `endCurveBracket` reads the capture once (line 185), performs the exit actions, then — in the `action.settle` branch — `await options.settle()` (line 195) before the unconditional `clearCurveEntrySnapshot()` at line 197. The settle is a full reset + replay with painted host yields (`PhysicsPaintStudio.tsx:5463-5503`, `aquarelleVectorPathCommit.ts:83-100`), so it can take hundreds of milliseconds to seconds, and nothing blocks re-entry during it: the dialog's spline button stays enabled, and `enterPaintedCurve` → `armDraftBase` does not consult `isAquarelleScriptEditInFlight` (`PhysicsPaintStudio.tsx:5400-5421, 10317-10335`). A user who edits a painted stroke and then selects/enters another painted stroke while the settle runs hits this sequence:

1. The old teardown has already turned the wireframe off (line 193), so `beginCurveWireframeBracket` for the new stroke sees the OLD capture still present and deliberately does not overwrite it (lines 164-168), then forces the wireframe on and opens the latch.
2. The old settle resolves; the old teardown's `clearCurveEntrySnapshot()` (line 197) destroys the only capture the NEW session has.
3. The new session can never be torn down: its own exit returns at line 186 (`snapshot === null`), so the held fit is never cleared, `setWireframeMode(false)` never runs, and a dirty Draft never settles. `settleDraftScript` then refuses forever on its first guard (`PhysicsPaintStudio.tsx:5436-5440`, wireframe still on), while the overlay keeps drawing the stale held-fit anchors for that stroke whenever structure is shown (`VectorPathOverlay.tsx:1040-1057`). The user is left in a construction view they cannot exit without manually toggling the wireframe.

The old settle also fights the new bracket inside the same window: `setDraftMode(false)` is refused while the wireframe is on (`scriptStrokeEdition.ts:165-166`), so the settle's Draft-off is discarded. Reachability needs `preWireframe === false && draftPixelsDirty === true` at exit — the default first-use path (wireframe off, one committed gesture) — and the code and tests cover neither a rejecting settle nor an overlapping bracket.

**Fix:** Only ever clear the capture this call opened, and release it before the await so a re-entry captures its own state (this also fixes WR-01):

```ts
const snapshot = curveEntrySnapshot.peek();
if (snapshot === null) return;
const action = resolveCurveExitAction({ /* unchanged */ });
clearCurveFitSession();
setWireframeMode(false);
if (curveEntrySnapshot.peek() === snapshot) clearCurveEntrySnapshot(); // release before the await
if (action.leaveDraft) setDraftMode(false);
try {
  if (action.settle) await options.settle();
} finally {
  if (action.restore) setWireframeMode(true);
  if (curveEntrySnapshot.peek() === snapshot) clearCurveEntrySnapshot();
}
```

### Warnings

#### WR-01: `endCurveBracket` has no try/finally around the awaited settle, and the hook's `void` call swallows a rejection

**File:** `app/src/components/physic-paint/view/vectorPathCurveBracket.ts:195` (call site: `app/src/components/physic-paint/PhysicsPaintStudio.tsx:11509-11514`)
**Issue:** If `options.settle()` rejects, lines 196-197 never run: the user's wireframe is not restored and the capture is left open, while the exit hook's `void endCurveBracket({ settle: settleDraftScript })` converts the rejection into an unhandled promise rejection. Rejection is a recognized possibility elsewhere in the Studio — other settle callers attach `.catch` (`PhysicsPaintStudio.tsx:5549-5559`, `9098`) — and the bracket's option type (`() => void | Promise<unknown>`) admits any callback, so the teardown invariant should not depend on the callback being non-throwing. The exact effect shape is pinned by `PhysicsPaintStudio.test.ts:8116`, so the pin needs updating with the fix.
**Fix:** Wrap the state-changing tail in `try/finally` as shown in CR-01, and attach `.catch` (or an internal `try/catch` that completes the teardown) at the hook so no exit can produce an unhandled rejection.

#### WR-02: The conversion silently zeroes recorded per-sample tilt (`tx`/`ty`)

**File:** `app/src/components/physic-paint/view/aquarelleRecordState.ts:1148-1155` (same defect in the curve-mode rewrite at `1044-1051`)
**Issue:** The new write path rebuilds every sample as `{ x, y, p, tx: 0, ty: 0, tw: 0 }`. For 61's vector strokes that was lossless — every minted sample already carries zero tilt/width (`vectorPathHandles.ts:1017-1024`). Phase 62 makes the same write the conversion for a HAND-PAINTED record, and those samples carry real data: the live recorder interpolates the pointer's tilt into every tick sample (`AquarelleCanvasLayer.tsx:236-269`), and the aquarelle replay feeds `tx`/`ty` to the engine (`engineAdapter.ts:346-359`), where `processInput` turns magnitude > 12 into `s.azimuth` (`Engine.ts:1746`) and `brushAngle` prefers it for every `rotation: 'fixed'` brush (`Engine.ts:1726-1730`). Several shipped presets are fixed-rotation and anisotropic (`brushes.ts:230, 254, 314`), so a stylus-painted stroke repaints with a different dab orientation across its whole length after conversion. The wireframe band consumes the same tilt for its station angles (`aquarelleLiftRibbon.ts:129`), so the D-09 envelope orientation changes too. `tw` is genuinely zero for hand-painted records (`AquarelleCanvasLayer.tsx:246, 266`), so only tilt is lost.
**Fix:** Carry or remap `tx`/`ty` alongside the pressure (nearest-source carry is enough — tilt varies slowly relative to the re-spaced samples); keep `tw: 0`.

#### WR-03: `commitAquarelleVectorPathEdit` does not re-check the busy gates after its await — a stolen latch leaves an unrecorded script edit and a stuck `applying` status

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10346-10354`
**Issue:** The three busy guards are read before `await ensureAquarelleDurableBaseRef.current(playFrame)` (lines 10350), and only the Draft/wireframe pair is re-read afterwards (10352-10353, the WR-03 comment). If another script edit or settle takes the shared latch during that await, the commit still writes the path at line 10354, then arms the token and calls `runAquarelleScriptRebake`. That sequence fails closed at its entry when `isInFlight()` is true — `return false` at `aquarelleVectorPathCommit.ts:126-128`, before its `try/finally`, so it invokes no terminal callback. Consequences: `onFailure` never restores the snapshot, the ledger never records the edit, `setApplyStatus('applying')` (line 10373) is never reset, and the sheet keeps pre-edit pixels over a mutated script. The caller sees only `null`, i.e. an ordinary refusal.
**Fix:** Re-read `isPhysicalMutationLocked()`, `rotoScript.applying`/`mutationLocked` and `isAquarelleScriptEditInFlight()` after the await and return `null` before `beginAquarellePathEdit` — exactly the post-await pattern the function already applies to the Draft latch.

#### WR-04: A refused cancelled-bake undo replay is silent and leaves the cancelled edit applied and unrecorded

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:6366-6392`
**Issue:** The D-13 undo branch cancels the pending token, awaits the bake, then replays the edit as `undo` with one reanchor retry. `runScriptReplay` refuses silently on every busy gate (`PhysicsPaintStudio.tsx:5996-6006`), so when both attempts return false the branch returns false with no copy. If the cancellation landed at the commit turn, the apply already succeeded: the script holds the edit, the sheet shows it, no ledger entry exists (by design, `onCancelled` published nothing), and the user's Cmd+Z appears to do nothing. The next Cmd+Z finds no pending record, falls through to `rotoMoveHistoryUndo()`, and consumes the PREVIOUS history entry — silently reverting two visual edits with one visible undo.
**Fix:** When both attempts fail, fall back to `restoreAquarelleEditSnapshot(record.editId, 'undo')` directly (the same revision-authoritative primitive `onFailure` uses) and, if that also fails, publish the shared refusal line via `setApplyMessage`/`setApplyStatus('error')` so the user is never left with a silent no-op over an applied edit.

### Info

#### IN-01: Redo during an in-flight path-edit bake is a silent no-op

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:6393-6401`
**Issue:** `redo` has no pending-apply branch, deliberately pinned by `PhysicsPaintStudio.test.ts:8194-8198` ("leaves redo exactly as shipped"). The behavior is fail-closed — the aquarelle-script route's replay refuses while the bake holds the script-edit latch and the entry is preserved (`useRotoPhysicalEditHistory.ts:1272-1284`) — so this is not incorrect. The only gap is feedback: the shortcut silently does nothing. If a future change adds a branch, it must not reintroduce `pendingPathEditApply` into `redo` without updating that pin.
**Fix:** Optional: publish the shipped busy reason when an in-flight path-edit bake is the cause, without changing the stack behavior.

#### IN-02: `hasRecordedPressureProfile`'s doc claims fail-closed malformed input, but a null element throws

**File:** `app/src/components/physic-paint/view/aquarelleStrokeBand.ts:191-205`
**Issue:** The doc promises "an empty, malformed or all-sentinel list is false", but the loop reads `point.p` without an element guard (lines 200-202), so a `null` element would throw a TypeError from the overlay's render path. The repository's restore path dereferences every element first (`aquarelleRecordState.ts:1767-1774`), and the type is `readonly AquarellePoint[]`, so the state is not reachable through the document loader — this is a doc/behavior mismatch, not a live crash.
**Fix:** Either softens the doc to "a non-array is false" or add `if (typeof point !== 'object' || point === null) continue;` to match `countDistinctFiniteSamples`'s law.

#### IN-03: The Studio-open reset omits the two phase-62 session latches

**File:** `app/src/components/physic-paint/view/vectorPathSession.ts:210-216` (reset) and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:11499-11514` (effect order)
**Issue:** `resetForStudioOpen` is documented as resetting "every session latch", but it does not clear `curveFitSession` or `curveEntrySnapshot`. On mount the reset effect runs BEFORE the exit-hook registration (declaration order), and the hook is detached by the previous mount's cleanup, so if the Studio ever unmounts with a path edit open, the remount's `exitPathEdit()` fires with no hook: the capture and the held fit survive, the forced wireframe survives, and the next entry silently reuses the stale capture. Under today's topology the Studio is rendered once per webview (`app/src/main.tsx:102-103`) and a reload also clears module state, so this is latent rather than live justification for the reset contract itself.
**Fix:** Clear both signals in the same mount effect (the Studio already imports the module's clear helpers), or register the exit hook before the reset effect so the reset's `exitPathEdit()` can tear the bracket down.

---

_Reviewed: 2026-11-14T15:21:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
