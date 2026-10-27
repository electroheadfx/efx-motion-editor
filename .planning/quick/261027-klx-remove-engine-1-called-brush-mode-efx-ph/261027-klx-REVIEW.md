---
phase: quick-261027-klx
reviewed: 2026-10-27T20:13:18Z
depth: quick
files_reviewed: 111
files_reviewed_list:
  - app/package.json
  - app/src-tauri/src/services/script_library.rs
  - app/src-tauri/src/services/studio_script_snapshot.rs
  - app/src-tauri/tests/script_library_filesystem.rs
  - app/src-tauri/tests/script_library_lifecycle.rs
  - app/src-tauri/tests/script_library_schema.rs
  - app/src-tauri/tests/script_library_transaction_contract.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts
  - app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.purity.test.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.test.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
  - app/src/components/physic-paint/performance/moveProvenanceCapture.ts
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
  - app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
  - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/paintMutationRotoPort.test.ts
  - app/src/components/physic-paint/roto/paintMutationRotoPort.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts
  - app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts
  - app/src/components/physic-paint/roto/rotoFramePersistTruth.test.ts
  - app/src/components/physic-paint/roto/rotoFramePersistTruth.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/types/paintCore.ts
  - app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
  - app/src/components/physic-paint/view/aquarelleScriptRecording.test.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.test.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.ts
  - app/src/components/physic-paint/view/panelSplitShell.test.tsx
  - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
  - app/src/components/physic-paint/view/recordedStrokeGroups.ts
  - app/src/components/physic-paint/view/stackOrder.test.ts
  - app/src/components/physic-paint/view/stackOrder.ts
  - app/src/components/shared/ModuleSwitcher.test.tsx
  - app/src/components/shared/ModuleSwitcher.tsx
  - app/src/components/shared/activeModule.test.ts
  - app/src/components/shared/activeModule.ts
  - app/src/components/shared/frameModuleLock.test.ts
  - app/src/components/shared/frameModuleLock.ts
  - app/src/efx-paint/efxPaintCleanBreakContract.test.ts
  - app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts
  - app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts
  - app/src/lib/__fixtures__/paperConditioning.golden.json
  - app/src/lib/paperConditioning.test.ts
  - app/src/lib/paperConditioning.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/lib/paperPass.ts
  - app/vite.config.ts
  - package.json
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
status: issues_found
---

# Phase quick-261027-klx: Code Review Report

**Reviewed:** 2026-10-27T20:13:18Z
**Depth:** quick
**Files Reviewed:** 111
**Status:** issues_found

## Summary

Scope: the 111 surviving files of the engine-1 (`@efxlab/efx-physic-paint`) removal. The deleted package is out of scope. Review focused on the three new load-bearing modules (app-owned `paintMutationLedger`, the memoized `paintMutationRotoPort`, the `AquarelleEnginePort`), the SNAP v5 codec/controller, the Roto script clipboard, the Studio wiring, the paper conditioner port, and the Rust script library / snapshot service.

Clean results worth recording: no production import of the retired package survives (only a comment in `fakeEngine2Fixture.ts:14` and test negative-guards); the SNAP v5 retired-version check correctly precedes the generic version check (`studioScriptSnapshotCodec.ts:558-566`); the Rust snapshot path-traversal defenses (`validate_snapshot_key_component`, validate-before-join, atomic temp+rename, 64 MiB metadata check, digest-of-actual-bytes) are sound; the Rust engine-identity collapse refuses a legacy document without a migration branch; `AquarelleEnginePort.undo/redo` correctly gate on the engine's `canUndo`/`canRedo` getters; Trash purges the script record state so deleted strokes cannot resurrect onto the sheet; and `paperConditioning.ts` reproduces the golden fixture semantics (NaN/-0 included).

Two BLOCKERs remain, both in the Roto script clipboard seam that the quick rewired from engine-1's asynchronous stroke queue to the ledger's synchronous acceptance:

1. **CR-01** — the ledger emits a completion synchronously *inside* `enqueueRecordedStroke`, before the clipboard has registered the returned id in `expectedMutationIds`. Every Copy→Apply burst therefore drops all of its completions and the apply operation never settles: `busy`, the mutation lock, the "Applying 0/N" pill, and the input lock all latch, and launch replacement/disposal await a promise that never resolves.
2. **CR-02** — the ledger's accepted list is session-global, append-only, and never seeded from a restore or cleared on navigation/track switch. Copy/Save Script therefore reads strokes from every frame and track painted in the session (and reads none of a restored script), and after any single stroke the Copy gate stays true on every real key for the rest of the Studio session.

The test suite cannot see either bug: `paintMutationRotoPort.test.ts:73-82` pins the synchronous emission, while `physicsPaintRotoScriptClipboard.test.ts` uses a fake engine that completes asynchronously and drives `observeCompletedMutation` by hand.

## Critical Issues

### CR-01: Roto Copy→Apply deadlocks because the ledger completes before the id is registered

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:776-800`
**Related:** `app/src/components/physic-paint/engine/paintMutationLedger.ts:140-147`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:1150-1173`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5750-5758`

**Issue:** The ledger emits the completion synchronously from inside `allocateStrokeMutation` (line 146), and the Studio subscription forwards it to `rotoScript.observeCompletedMutation(rotoMutationPort, mutation)` in the same call stack (Studio line 5758). In `enqueueNextBrush` the ordering is inverted:

```ts
const mutationId = operation.engine.enqueueRecordedStroke(transformed); // ledger fires completion HERE
...
operation.expectedMutationIds.add(mutationId);                          // registered only AFTER
```

`observeCompletedMutation` consumes an id only when `operation.expectedMutationIds.has(mutation.mutationId)` (line 1156). At emission time the id is not yet in the set, so every completion is dropped. `consumedMutationIds` never fills, the `consumedMutationIds.size === expectedMutationIds.size` finish conditions (lines 1168, 751, 773, 798, 1189, 1231, 1286) never hold, and `finishApply` never runs.

Consequences, all reachable through the normal Copy→Apply buttons:

- The returned promise from `dispatchApply` (line 1108) never settles, so `handleApplyScript` (`PhysicsPaintStudio.tsx:2205-2225`) awaits forever.
- `beginOperation`'s lease is never released (`endOperation` runs only in `finishApply`), so `busy`, `mutationLocked`, `applyProgressState` ("Applying 0/N"), `setNavigationLocked(true)`, and the engine input lock all latched. Every later Copy/Apply/Delete/Move is refused by the busy gates.
- `cancelApply` (line 1226-1232) cannot unstick it: sizes are unequal, so its finish condition is false.
- `prepareLaunchReplacement` awaits `operation.settled` (line 1247) → a track/project switch hangs (`usePhysicsPaintLaunchIntegration.ts:278-286` awaits it).
- `dispose()` never resolves because `finalizeDisposalIfReady` requires `activeApply === null` (lines 447-457, 1276-1290).

Reachability is guaranteed by the Copy path itself: `snapshotBoundSource` (lines 504-512) builds a script with `brushes` and **no `aquarelleEvents`**, so `dispatchApply` skips the aquarelle branch (line 1049-1054) and always takes the brush-burst promise. (Script Off painted strokes have no record either, which forces the same branch for `applyCurrentScript`, though that function currently has no caller.)

The suite misses it because the fake engine in `physicsPaintRotoScriptClipboard.test.ts` completes asynchronously and the tests call `observeCompletedMutation` manually, while `paintMutationRotoPort.test.ts:73-82` pins the synchronous emission that breaks the clipboard.

**Fix:** Register the id before any listener can run. Cleanest is a ledger callback invoked after acceptance and before the listener loop, so the ordering guarantee lives in one place:

```ts
// paintMutationLedger.ts
allocateStrokeMutation(group, onAccepted?: (mutationId: number) => void): number {
  ...
  accepted.push(Object.freeze({ mutationId, kind: primary.tool, accepted: Object.freeze(actions), acceptedAt: Date.now() }));
  acceptedStrokeCount += actions.length;
  onAccepted?.(mutationId);                 // clipboard registers expected id + accepted target here
  for (const listener of Array.from(listeners)) listener(completion);
  return mutationId;
}
```

and in the clipboard pass the registration into `enqueueRecordedStroke`. If the ledger signature must stay, buffer instead:

```ts
// physicsPaintRotoScriptClipboard.ts
let enqueueInFlight = false;
const deferredCompletions: CompletedPaintMutation[] = [];

function observeCompletedMutation(engine, mutation) {
  if (enqueueInFlight && engineState.peek() === engine) { deferredCompletions.push(mutation); return; }
  ...existing body...
}

// enqueueNextBrush
let mutationId: number;
enqueueInFlight = true;
try { mutationId = operation.engine.enqueueRecordedStroke(transformed); }
finally { enqueueInFlight = false; }
operation.expectedMutationIds.add(mutationId);
// ...acceptedTargets bookkeeping...
for (const completion of deferredCompletions.splice(0)) observeCompletedMutation(operation.engine, completion);
```

Drain in the throw path too, so a mid-burst `TypeError` still closes the operation exactly once.

### CR-02: the ledger is session-global and never frame-scoped, so Copy/Save capture the wrong strokes

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/engine/paintMutationLedger.ts:81-156`
**Related:** `app/src/components/physic-paint/roto/paintMutationRotoPort.ts:48-49`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:389-391, 504-512, 547-597`, `app/src/components/physic-paint/view/aquarelleRecordState.ts:1127-1190`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4433-4457, 4744-4751, 4216-4227`

**Issue:** Engine-1's `getStrokes()` returned the *loaded document's* live actions — installed per frame by `restoreStrokesBaseline`/`hydrateBrushScriptFrame`. The replacement ledger has no equivalent: `accepted` is a session-lifetime append-only array (line 81), `getAcceptedStrokes()` clones all of it (line 150-156), and there is no clear/reset/baseline API at all. Every consumer of the port still treats it as per-frame truth:

- `refreshSourceHasBrushes` (clipboard line 390) gates `canCopy` on `getStrokeCount() > 0`. It is recomputed only on completion, on engine update, and on `notifySourceRevision` — never on frame navigation (`updateSource`, lines 1193-1198). After a single stroke anywhere in the session, `sourceHasBrushes` stays true and Copy is enabled on every real key, including frames with no paint at all.
- `snapshotBoundSource` (line 506) and `captureScriptForPersistence` (line 569) read `normalizeLogicalBrushes(engine.getStrokes())` — the whole session across frames (and across tracks, because a track switch calls `resetAquarelleRecordState()` at Studio line 4433 but leaves the ledger untouched). Copying frame B after painting frame A silently captures A's strokes; saving frame B persists a script containing A's strokes.
- The inverse is equally broken: after a Studio reopen the restored watercolor script lives only in the record state — `restoreAquarelleRecordTimeline` (aquarelleRecordState.ts:1127-1190) clears and reseeds the timeline but never touches the ledger, and the snapshot restore only max-raises the clock (Studio lines 4450-4457, 4744-4751). The watercolor replay suppresses `onStrokeEnd` for scripted strokes, so the ledger stays empty. Result: `canCopy` is false on a fully scripted restored key, Copy Script is disabled, and `saveActiveFrame` (physicsPaintRotoScriptLibrary.ts:500-502) fails with the misleading "Paint at least one brush on a real Roto key." After the user paints one new stroke on that frame, Save succeeds but persists a script truncated to that one stroke (the restored strokes have no ledger entry and are dropped by the capture).
- Trash is also affected: `clearActiveSource` purges the record state (Studio line 4216) then calls `notifySourceRevision()` (line 4227), which recomputes `sourceHasBrushes` from the *unpurged* ledger — so Copy stays enabled on a frame the user just cleared, and copies the purged strokes back into the clipboard.

**Fix:** Stop treating the session ledger as per-frame truth, and make capture frame-scoped:

1. Drive Copy/Save availability from the record state for the source frame — `hasAquarelleScriptForFrame(source.appFrame)` — and attach `aquarelleEvents` from `getAquarelleEventsForFrame(source.appFrame)` in `snapshotBoundSource` instead of producing a brush-only script (which also removes CR-01's only reachable path).
2. When brushes are still needed, filter the ledger capture by the frame's recorded ids:
```ts
const frameIds = new Set(getAquarelleEventsForFrame(source.appFrame)
  .filter((event) => !isAquarelleDryEvent(event))
  .map((event) => (event.engine as { mutationId?: number }).mutationId));
const brushes = normalizeLogicalBrushes(engine.getStrokes())
  .filter((group) => frameIds.has(group.primary.mutationId as number));
```
3. If the ledger is meant to stay the parity replacement for `getStrokes()`, add an explicit baseline install/clear (`installAcceptedBaseline(strokes)` / `clearAccepted()`) called on frame navigation, on track switch, on Trash, and from the snapshot restore (seeding the restored strokes), so `getStrokes()` matches "the loaded document's live actions for this frame" like engine-1 did.
4. Refresh `sourceHasBrushes` whenever `sourceState` changes frame/key (in `updateSource`).

## Warnings

### WR-01: one throwing completion listener aborts the rest and is swallowed by an empty catch

**Severity:** WARNING
**File:** `app/src/components/physic-paint/engine/paintMutationLedger.ts:146`
**Related:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5860-5862`

**Issue:** `for (const listener of Array.from(listeners)) listener(completion);` is not isolated. `listener` here is the Studio's `canvasCompletedMutationImplRef.current` chain (`physicPaintVersion.value++`, `rotoScript.observeCompletedMutation`, `rotoMoveHistory.observePaintMutation`). A throw in any of them aborts the remaining listeners and propagates out of `allocateStrokeMutation` — after the entry has already been appended, so the ledger and the record state silently disagree. `handleAquarelleStrokeEnd`'s `catch { /* drop it */ }` then hides the failure entirely (no diagnostic, no counter), which is exactly the class of failure the record-split probe exists to catch.
**Fix:** Wrap each listener invocation in `try { listener(completion) } catch (cause) { recordPaintMutationListenerFailure(cause) }` so acceptance and completion stay independent, and replace the empty catch in `handleAquarelleStrokeEnd` with a `recordAquarelleRenderSplitEvent('stroke-end-rejected', ...)` diagnostic.

### WR-02: `isEmpty` is always false — computed after the counter increment

**Severity:** WARNING
**File:** `app/src/components/physic-paint/engine/paintMutationLedger.ts:138-144`

**Issue:** `acceptedStrokeCount += actions.length` runs before `isEmpty: acceptedStrokeCount === 0`, so the emitted `CompletedPaintMutation.isEmpty` can never be true (every accepted group has at least a primary). The field is part of the persisted contract in `paintCore.ts:85-89`, and the ledger header claims exact engine-1 parity. There is no production reader today, so nothing breaks yet — but any future consumer of the documented field gets inverted semantics.
**Fix:** Compute the flag from the pre-increment count (`const wasEmpty = acceptedStrokeCount === 0;` before the increment) or delete the field from the ledger's completion and leave a note that no accepted mutation is ever empty.

### WR-03: Rust `validate_brush_pack` accepts any `kind` string

**Severity:** WARNING
**File:** `app/src-tauri/src/services/script_library.rs:2255-2266`

**Issue:** The validator only checks that `brushPack.kind` is *a* string and that `entries` is an array. Every other engine discriminator now enforces `SCRIPT_ENGINE_ID_AQUARELLE` (document filter at line 2154, stroke `brushId` at line 2330), but a document carrying `"brushPack": { "kind": "efx-physic-paint", ... }` still validates. Wave 5's summary claims `validate_brush_pack` is the "watercolor tip pack" guard; it is not. Since this is the trust boundary for files in the user's scripts folder, an engine-1 pack descriptor should be refused like an engine-1 document.
**Fix:**
```rust
if pack.get("kind").and_then(Value::as_str) != Some(SCRIPT_ENGINE_ID_AQUARELLE) {
    return Err("Invalid brushPack kind".to_string());
}
```

### WR-04: Rust `brush_count` counts Dry markers while the TS row builder excludes them

**Severity:** WARNING
**File:** `app/src-tauri/src/services/script_library.rs:2506-2520`
**Related:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:322`, `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:289`, `app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx:161`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:567`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3686`

**Issue:** The Rust row filter is `cuisson > 0` (excluding continuations only). Dry markers are persisted with `cuisson: 0` (`physicsPaintRotoScriptSchema.ts:145-160`), so every Dry event is counted as a brush. The TS builder uses `!isAquarelleDryMarker(stroke.engine)` and does not count them. The same document therefore shows N brushes through the Rust manifest and N-dry through `rotoScriptLibraryRow`. The number is user-visible in the Scripts panel, the picker, the "Loaded … — N brushes" status, and `getScriptNaturalDuration`, which seeds the Reveal default frame count (`physicsPaintRotoPlayScriptController.ts:619,667`).
**Fix:**
```rust
.filter(|stroke| {
    let cuisson = stroke.get("cuisson").and_then(Value::as_u64).unwrap_or(0);
    let is_dry = stroke.get("engine").and_then(|e| e.get("kind")).and_then(Value::as_str) == Some("dry");
    cuisson == 0 && !is_dry
})
```

### WR-05: the ledger's input lock has no reader — the port's `setInputLocked` is a no-op

**Severity:** WARNING
**File:** `app/src/components/physic-paint/engine/paintMutationLedger.ts:62-65, 181-188`
**Related:** `app/src/components/physic-paint/roto/paintMutationRotoPort.ts:55-57`

**Issue:** `beginOperation` calls `engine.setInputLocked(true)` (clipboard lines 421, 425), which routes to `ledger.setInputLocked`, which only writes a local boolean. Nothing in production ever calls `isInputLocked()`; the Studio gates paint through `mutationLocked`/`rotoInputDisabled` instead (`PhysicsPaintStudio.tsx:2234, 6876-6877`). The engine-level lock that engine-1 enforced during script operations no longer exists, and the port's surface advertises a guarantee it does not provide. Today the UI-level gate covers it; any future caller that relies on the port contract (or the auto-key exemption window at `PhysicsPaintStudio.tsx:3053-3058`) would be unprotected.
**Fix:** Either read `inputLocked` at the canvas pointer entry (pass `isInputLocked` into the mount props and swallow pointer events while true), or delete `setInputLocked`/`isInputLocked`/`isActive`/`setActive` from the ledger and port and document that `mutationLocked` is the single lock.

### WR-06: `getRotoPort` replaces the whole seams object on every call

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/paintMutationRotoPort.ts:39-43`

**Issue:** `existing.seams = seams;` overwrites rather than merges. The memoized-identity contract means a later call with the default `{}` (or with only one seam) silently drops `copyLiveAlphaCanvas`, after which `captureScriptForPersistence` bails at `engine.copyLiveAlphaCanvas === null`-equivalent path (`!engine.copyLiveAlphaCanvas` → `return null`, clipboard line 570) and Save Script fails for the rest of the mount. The Studio currently calls `getRotoPort` exactly once (`PhysicsPaintStudio.tsx:597-603`), so this is latent, but it is one accidental second call away from a silent data-path failure.
**Fix:** `existing.seams = { ...existing.seams, ...seams };` and make the comment state the merge law.

## Info

### IN-01: dead APIs in the new ledger/port and the clipboard

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:1234-1239`, `app/src/components/physic-paint/engine/paintMutationLedger.ts:54, 60, 64-65`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:827`
**Issue:** `getAcceptedTarget` is exported by the controller and has zero production callers, and `acceptedTargets` is written (lines 781-791, including `publishPixels`) but never read — the Studio comments at 585-592 and 5742-5745 assert this WeakMap identity is load-bearing, which is no longer true. `applyCurrentScript` (line 827) also has no production caller. On the ledger, `seedFromRestoredMax`, `lookupAcceptedTarget`, `setActive`, and `isActive` are unreferenced. Dead machinery that documents a contract it does not enforce invites re-wiring mistakes.
**Fix:** Delete the unused members (or mark them `@internal` with a test-only note), and update the Studio comments so the identity rationale matches reality.

### IN-02: `guideProxy` is documented as a refusal flag but nothing reads it

**File:** `app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts:133-139`
**Issue:** The comment states "capture, restore and the Move overlay all refuse it by this flag". A repository-wide grep finds the flag only at its declaration (`types/paintCore.ts:73`) and this assignment. `normalizeLogicalBrushes` does not filter it, `snapshotBoundSource` captures every ledger stroke, and `buildAquarelleEventsFromCapture` keys off the record state instead. Either the refusal behavior was lost with engine-1 or the comment is stale.
**Fix:** Drop the flag and comment, or implement the refusal at the two named seams (`normalizeLogicalBrushes` and the Move provenance filter) and pin it with a test.

### IN-03: duplicated `shouldPersistRotoFrame` definitions

**File:** `app/src/components/physic-paint/roto/rotoSaveTransactions.ts:48-54`, `app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts:41-47`
**Issue:** Two exported functions with the same name, same signature, and the same body exist in sibling modules; only the `rotoEditBufferTransactions` one has a production importer (`useRotoFrameEditingController.ts:10`). Two names for one law invites divergence the next time the persist rule changes.
**Fix:** Delete the `rotoSaveTransactions` copy (its callers, if any appear, can use the shared helper) or re-export the single definition.

### IN-04: pointless `let _ = brush_id;`

**File:** `app/src-tauri/src/services/script_library.rs:2429-2434`
**Issue:** `brush_id` is bound with a full validation chain and then discarded via `let _ = brush_id;`. The validation runs for its side effect only, which is fine, but the binding name and the `let _` read as a leftover from an edit that was supposed to use the value.
**Fix:** Inline it: `engine.get("brushId").and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or_else(|| "Invalid brushId".to_string())?;` and drop the binding.

### IN-05: `MAX_CONTINUATIONS` now only feeds a dead count bound

**File:** `app/src-tauri/src/services/script_library.rs:27, 2276`
**Issue:** With continuations removed from the watercolor envelope, the only remaining use of `MAX_CONTINUATIONS` is the pre-loop array bound `MAX_BRUSHES + MAX_BRUSHES * MAX_CONTINUATIONS` (6600 entries) — a limit whose name describes a construct the format no longer has. The per-stroke rules below it cap real primaries at `MAX_BRUSHES`.
**Fix:** Rename it to describe the strokes-array bound (e.g. `MAX_STROKE_ENTRIES`) and document that it bounds Dry markers plus primaries, or derive the bound from `MAX_BRUSHES` plus an explicit Dry allowance.

### IN-06: stale cross-port comments about clipboard WeakMap identity

**File:** `app/src/components/physic-paint/engine/aquarelleEnginePort.ts:65-72`, `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:298-303`
**Issue:** Both comments claim "the Roto clipboard keys its accepted-target WeakMap by port identity, so a second port over the same engine reads null". The clipboard's WeakMaps are keyed by the `PaintMutationRotoPort` (`paintMutationRotoPort.ts`), not by `AquarelleEnginePort`; a second aquarelle port would not affect any lookup. The requirement ("do not construct a second port") may still be right for other reasons, but the stated reason is wrong and misleads the next maintainer.
**Fix:** Replace the rationale with the actual constraint (one engine accessor per live engine; consumers must observe teardown through `onEnginePortReady(null)`), and drop the clipboard reference.

---

_Reviewed: 2026-10-27T20:13:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
