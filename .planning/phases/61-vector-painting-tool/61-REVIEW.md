---
phase: 61-vector-painting-tool
reviewed: 2026-11-11T14:58:19Z
depth: deep
files_reviewed: 39
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
  - app/src/components/physic-paint/view/aquarelleColorPicker.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/shortcutTextTarget.test.ts
  - app/src/components/physic-paint/view/shortcutTextTarget.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/payload/vectorPath.test.ts
  - packages/efx-watercolor/src/payload/vectorPath.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
  necessity: 1
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-11-11T14:58:19Z
**Depth:** deep
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Adversarial, incremental deep review of the eleven gap-closure plans (61-21..61-31) across the 39 files changed since `ab91201d`. The prior report written at that base is treated as closed context: its findings were re-checked against the current source and are genuinely fixed — the Shift+A wireframe refusal (`PhysicsPaintStudio.tsx:2720-2740`), the path-edit rollback reanchor plus honest capsule (`:10271-10291`), the draw-site bake retry (`:8850-8854`), the target-aware `shouldExitPathEdit` (`strokeSettingsModel.ts:968-974`), the widened keyboard predicate (`shortcutTextTarget.ts:15`), the rubber-band cursor read, the settle busy message, and the anchor-width refusal publish. CR-02 is excluded per the review instruction and is not re-reported.

The `curveMode` seam the gap wave added is otherwise carried consistently: AQTL writes the mode byte last and fail-closes on unmapped decode codes; every rebuild touched in this delta (`restoreAquarelleRecordTimeline`, `aquarelleStrokeFromScriptEvent`) conditionally carries the field; the dialog read path reports it; `updateAquarellePathInScript` re-derives points through the stored mode. The third-rebuild audit named in the request found exactly one more rebuild — `aquarelleEventsFromScript` (`physicsPaintRotoPlayScriptController.ts:4364-4418`, unchanged since the base) — which still drops `anchors`/`renderMode`/`curveMode`, but the strokes it rebuilds carry already-evaluated `points`, so the dropped mode cannot change pixels, and its omissions are pre-existing and outside this delta; noted, not reported as a delta finding.

One blocker remains: the previous CR-01's phantom-commit half is closed by 61-28, but its mid-drag Delete half is not — the drag snapshot is never invalidated by a keyboard anchor commit, so a Delete during a live drag is silently undone on release. The widened keyboard predicate also opened a new fall-through: during a path edit, Delete on a focused control reaches the Studio's whole-stroke delete. Three further warnings cover the +Key copy seam (a false failure on an empty source timeline, and the in-flight ref claimed after the first await) and the new curve-mode handler's rollback, which was written to the pre-61-26 shape the path-edit seam just abandoned. One Info is a necessity finding.

No security issues were found in the delta. Performance remains out of scope. No test-file findings are reported (the new tests assert the contracts they name).

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: A mid-drag Delete is still undone on release — the drag snapshot outlives the anchor commit (the remaining half of the previous CR-01)

**Severity:** BLOCKER

**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:309-336` (key commit), `:713-720` (key handler wiring), `:787-804` (edit-lifetime effect), `:1062-1099` (`continueEditDrag` rebuilds from `anchorsAtStart`), `:1101-1123` (`finishEditDrag` commits `drag.latest`)

**Category:** bug

**Issue:** `handleVectorPathEditKey` commits `deleteAnchorsAt(targetAnchors, selection)` straight to `onPathEdit` and never touches `dragRef`. When a pointer drag is live on the same stroke, `drag.anchorsAtStart` is the pre-delete snapshot: `continueEditDrag` rebuilds `next` from it (`:1075` handle branch, `:1095` anchor branch) and `finishEditDrag` commits `drag.latest` (`:1112-1113`) as soon as `moved` was set. The 61-28 lifetime effect does not help here — it returns early exactly while `drag.mutationId === editMutationId` (`:798`), which is the case for the whole gesture.

Reproduction: press an anchor (drag starts, pointer captured), move past the 2 px threshold, press Delete with a non-empty anchor selection (the window capture handler runs because the target is the canvas/section, not a keyboard-owned control). The key commit writes the anchor list minus the selection and clears the selection; `editTargetAnchors` updates from the script. The next pointer move rebuilds the preview from the stale snapshot — the deleted anchors are visibly back — and the release runs `finishEditDrag` → `onPathEdit(drag.mutationId, drag.latest)`, re-inserting every deleted anchor and silently reverting any other anchor-list change that landed mid-drag, while the ledger records the phantom edit. Under Draft the key commit is synchronous and lands well inside the gesture; in Live it lands as soon as the bake settles, both before pointer-up. The 61-28 fix closed the stranded-drag/phantom-commit half; this half survives because the drag is still "owned" by the open edit.

**Fix:** Cancel the gesture whenever an anchor-list commit for its mutation id lands from anywhere other than the drag itself. Extract the cancellation the effect already performs and call it from the key seam:

```ts
const cancelEditDrag = (): void => {
  const drag = dragRef.current;
  if (drag === null) return;
  dragRef.current = null;
  // Compare-then-write (efx-preact-reactivity).
  if (vectorPathEditDrag.peek() !== null) vectorPathEditDrag.value = null;
  releasePointerCapture(surfaceRef.current, drag.pointerId);
};

// The edit key's host seam rides its own ref, like the draft handlers above.
editKeyHandlersRef.current = {
  getRecordedStrokes: props.getRecordedStrokes,
  onPathEdit: (mutationId, anchors) => {
    // A keyboard commit invalidates this gesture's snapshot. Cancel BEFORE
    // the write, or finishEditDrag re-commits anchorsAtStart/latest later.
    const drag = dragRef.current;
    if (drag !== null && drag.mutationId === mutationId) cancelEditDrag();
    props.onPathEdit(mutationId, anchors);
  },
};
```

(Declare `dragRef`/`surfaceRef`/`cancelEditDrag` above the ref assignment, and let the lifetime effect call the same helper.) Defense in depth: have `continueEditDrag`/`finishEditDrag` refuse when the target's current anchor list is no longer the one the drag was derived from (same identity for handle drags, the promoted-list identity for anchor drags).

### Warnings

#### WR-01: The widened keyboard-owner predicate lets Delete fall through to the Studio's whole-stroke delete during a path edit

**Severity:** WARNING

**File:** `app/src/components/physic-paint/view/shortcutTextTarget.ts:15`, `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:346-359`, `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:110-116`, `:233-245`, `app/src/components/physic-paint/view/scriptStrokeEdition.ts:622-630`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx:6810`, `:9556`

**Category:** bug

**Issue:** 61-21 widened `KEYBOARD_OWNED_SELECTOR` to buttons, links and roles so the window capture listener stands down for focused controls (the WR-05 fix). The Studio's own dispatcher runs on the layout `<section onKeyDown>` (`PhysicsPaintStudioView.tsx:550`) with `isPhysicsPaintShortcutTarget`, which excludes ONLY text fields (`physicsPaintStudioKeyboard.ts:110-116`) — so a focused button passes there too. The Delete branch (`:233-245`) calls `deleteSelectedAquarelleStroke` → `deleteSelectedScriptStroke()` (`PhysicsPaintStudio.tsx:6810`), whose port `isActive` is `watercolor && aquarelleSelectMode` (`:9556`) and select mode stays ON during a path edit (`enterPathEdit` no longer disarms it, `vectorPathSession.ts:77-81`). The port's consume law deletes the WHOLE selected stroke (`scriptStrokeEdition.ts:622-630`). With an anchor selection live, Delete on a focused control (Tab focus; click focus on WebKitGTK/WebView2) now deletes the entire stroke instead of the selected anchors, with no confirmation. Before the widening, the overlay's capture handler consumed Delete for every non-text target, so this surface did not exist.

**Fix:** Keep the anchor-delete law authoritative for non-text targets whenever a path edit is open, while still sparing Enter for the focused control. Split the predicate: add a dependency-free `isTextEntryTarget` (same duck-typed walk as `isKeyboardOwnedTarget`) and gate only the DRAFT handler on the wider predicate:

```ts
export function handleVectorPathWindowKey(event, draftHandlers, editHandlers) {
  if (isTextEntryTarget(event.target)) return;      // typing owns every key
  if (!isKeyboardOwnedTarget(event.target)) handleVectorPathKey(event, draftHandlers);
  handleVectorPathEditKey(event, editHandlers);     // anchors win over the Studio delete
}
```

`handleVectorPathEditKey` already requires an open edit and a non-empty anchor selection, so a Delete with no anchor selection still falls through to the existing Studio behaviour (unchanged). The alternative is to make `deleteSelectedScriptStroke` refuse while `pathEditMutationId` is open.

#### WR-02: +Key publishes a copy failure when the previous real key simply has no recorded paint

**Severity:** WARNING

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3854-3881`, `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts:468-477`

**Category:** bug

**Issue:** `copyAquarelleScriptToFrame` returns the number of recorded NON-DRY events; `recordAquarelleScriptCopyForFrames` maps that to `recorded > 0`, and the +Key continuation treats `false` as a copy FAILURE (`publishCopyFailed`). A previous real key can legitimately hold no recorded paint — an empty real key (the +Key blank branch creates one), or a timeline with only dry markers — and copying zero strokes from it is a successful no-op, yet every +Key from such a key publishes `ROTO_ADD_KEY_SCRIPT_COPY_FAILED`. The Duplicate path cannot hit this (its decision table requires a positive non-dry count and re-reads the events), so the false failure is +Key-only. `recorded === 0` with non-dry events is otherwise unreachable: the loop records every non-dry event, and a real failure throws (and is caught as a rejection).

**Fix:** Treat "nothing to copy" as success in the shared seam:

```ts
const events = getAquarelleEventsForFrame(sourceFrame);
if (events.every(isAquarelleDryEvent)) return true;   // empty/dry-only script: no-op SUCCESS
...
return recorded > 0;
```

Keep the missing-`launchContextRef` `return false` — that one is a real failure.

#### WR-03: `addKey` claims its in-flight ref only after the blank-frame await — a double click during the build runs the sequence twice

**Severity:** WARNING

**File:** `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts:425-448`

**Category:** bug

**Issue:** The guard at `:428` reads `keyActionInFlightRef`, but the ref and `keyActionInFlight` are set only at `:447-448`, after `await input.buildBlankRotoFrame(input.currentFrame)` at `:446`. The comment on the guard promises "a second click while the key/copy sequence is still running must be refused synchronously" — on the no-previous-key branch it is not: a second click during the blank build starts a second full sequence, with two `addEmptyKey` calls for the same frame, two payload builds and two independent copy continuations. Depending on the paste machinery's own idempotence the user gets either a duplicate/refused add or a stray failure, and the in-flight badge is false for the whole build.

**Fix:** Claim the latch before the first await and release it on every exit:

```ts
if (blocked || keyActionInFlightRef.current) return;
... // actionState + resolution guards (unchanged, synchronous)
keyActionInFlightRef.current = true;
setKeyActionInFlight(true);
try {
  const payload = resolution.kind === 'clone'
    ? resolution.payload
    : toEmptyKeyPayload(await input.buildBlankRotoFrame(input.currentFrame), input.currentFrame);
  await input.physicalKeyUtilities.addEmptyKey(input.currentFrame, payload, { ... })
    .then(async (added) => { /* existing success continuation */ })
    .catch((error) => { /* existing add-failure surface */ });
} finally {
  keyActionInFlightRef.current = false;
  setKeyActionInFlight(false);
}
```

A build throw now reaches the same `finally` instead of leaving the latch free while a sequence is live.

#### WR-04: The new curve-mode handler repeats the pre-61-26 rollback shape — a foreign revision bump leaves the script half-applied behind a "restored" message

**Severity:** WARNING

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:9289-9294` (the new branch), compared with the fixed sibling at `:10271-10291`

**Category:** bug

**Issue:** `handleAquarelleCurveModeStrokes` (new in 61-31) calls `restoreAquarelleEditSnapshot(editId, 'undo')` on a failed re-bake and DISCARDS its result, publishing "…the curve mode was restored." unconditionally. That restore is revision-authoritative: any script mutation that bumped `aquarelleStrokesRevision` while `applyAquarelleTimeline` was awaited makes it fail closed, leaving the curve-mode write in the script behind a capsule that says it was undone. The path-edit seam closed exactly this class in 61-26 by calling `reanchorAquarelleEditFromLiveContent(editId, 'undo')` first and branching the message on the restore result; the new handler was written to the old shape. (The neighbouring render-mode/delete handlers still carry the old shape too, but they are outside this delta — the curve-mode seam is inside it.)

**Fix:** Copy the proven remedy:

```ts
// Failed re-bake: put the pre-edit curve mode back exactly.
reanchorAquarelleEditFromLiveContent(editId, 'undo');
const restored = restoreAquarelleEditSnapshot(editId, 'undo') !== null;
const error = rotoScript.error.peek();
const message = buildRotoScriptApplyRefusalMessage(error)
  ?? error?.message
  ?? (restored
    ? 'Could not re-apply the watercolor script — the curve mode was restored.'
    : 'Could not re-apply the watercolor script — the curve mode could not be rolled back.');
```

`reanchorAquarelleEditFromLiveContent` is already imported for the path-edit seam.

### Info

#### IN-01: The Curve row discards the commit result, so a refusal is indistinguishable from a success

**Severity:** INFO

**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:1734-1739`

**Category:** code quality

**Issue:** `void bundle.applyCurveMode?.(ids, option.mode)` ignores the boolean. `handleAquarelleCurveModeStrokes` returns false for the physical lock, applying/mutation-locked, a non-real cell, an in-flight edit, an empty frame list, a `beginAquarelleCurveModeEdit` refusal, and a failed re-bake. In all the pre-write guard cases nothing at all is published, and the button does not move (the reading comes from the document), so the click looks broken. This repeats the class the anchor-width control just fixed via `bundle.publishRefusal` (`:1995`).

**Fix:**

```ts
void Promise.resolve(bundle.applyCurveMode?.(ids, option.mode)).then((applied) => {
  if (applied === false) bundle.publishRefusal?.(CURVE_MODE_COMMIT_REFUSED_MESSAGE);
});
```

Add the message next to `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` in `strokeSettingsModel.ts`. Note the failed-re-bake path already publishes its own apply message; if that specificity must survive, have the handler return a discriminated refusal instead of a bare boolean (the anchor-width control overwrites the specific message the same way, so this is an existing trade-off rather than a new one).

#### IN-02: The AQTL curve-mode encode guard fails open on prototype keys

**Severity:** INFO

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:179-182`, `:560-566`, `:590-592`

**Category:** bug (latent)

**Issue:** `VECTOR_CURVE_MODE_CODE` is a plain object and the "unknown value" guard is `VECTOR_CURVE_MODE_CODE[curveMode as string] === undefined`. Prototype keys (`'constructor'`, `'toString'`, `'__proto__'`) resolve to inherited members instead of `undefined`, pass the guard, and are then coerced to `0` by `writer.u8(...)` — silently encoding Bézier for a value the encoder claims to have rejected. The DECODER is fail-closed (`VECTOR_CURVE_MODE_NAMES[modeCode]`, a numeric array index), so corruption is refused on read; the failure is on the write side, where this guard is the only validation of the untyped `engine.curveMode`. Reaching it requires a caller to supply a non-`AquarelleCurveMode` string (a cast, a hand-built payload, or a future seam that skips `isAquarelleCurveMode`), which is why this is Info. `VECTOR_RENDER_MODE_CODE` uses the identical pattern (`:552-558`) — pre-existing, but worth fixing at the same time.

**Fix:** Use an owned-key lookup (or `Object.create(null)` / `new Map`):

```ts
const hasOwn = (table: Readonly<Record<string, number>>, key: unknown): key is string =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

if (curveMode !== undefined && !hasOwn(VECTOR_CURVE_MODE_CODE, curveMode)) {
  fail('invalid-value', `unknown engine.curveMode "${String(curveMode)}"`);
}
...
writer.u8(VECTOR_CURVE_MODE_CODE[curveMode as string]!);
```

#### IN-03: `recordedCurveModeField` has no production caller — the sparse-key rule it owns is duplicated inline at every write seam

**Severity:** INFO

**File:** `packages/efx-watercolor/src/payload/vectorPath.ts:156-160`; the only references are `packages/efx-watercolor/src/payload/vectorPath.test.ts:149-152`; the sibling `recordedRenderModeField` IS instantiated at `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:590`

**Category:** necessity

**Issue:** The helper encodes the conditional canonical term (`{ curveMode }` only when not the default, else `{}`), but nothing spreads it. Every production write site hand-rolls the same rule: `updateAquarelleCurveModeInScript` deletes the key and re-sets it only for non-default modes, `restoreAquarelleRecordTimeline` conditional-spreads the resolved mode, and `aquarelleStrokeFromScriptEvent` conditional-spreads the event's field. There is no missing instantiation to wire at the draw site either — a freshly recorded stroke is always default-shaped (the draw site spreads `recordedRenderModeField` and correctly no curve mode), so this is generality without an instantiation, with a test pinning behaviour nothing depends on.

**Fix:** Remove `recordedCurveModeField` (and its import/assertions in `vectorPath.test.ts`) so each seam owns one implementation, or wire it into the one conditional-key writer (`updateAquarelleCurveModeInScript`) and delete that hand-rolled delete/set. Keeping an exported helper beside three inline copies is exactly the duplication it was meant to own.

---

_Reviewed: 2026-11-11T14:58:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
