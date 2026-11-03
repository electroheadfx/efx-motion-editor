---
phase: 58-rail-editing-regressions
reviewed: 2026-11-03T12:44:14Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
findings:
  critical: 2
  warning: 2
  info: 3
  total: 7
  necessity: 1
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-11-03T12:44:14Z
**Depth:** deep
**Files Reviewed:** 19 (10 production, 9 test)
**Status:** issues_found

## Summary

Deep review of the Phase 58 "rail-editing-regressions" diff across the resolver, the Play Script controller, the Key Rail strip/inspector surfaces, and the reduced Cycle dialog, plus the phase's tests. The span law (`lastKeyFrame - firstKeyFrame + 1`), the frozen-target revalidation, and the single loop-only commit are implemented consistently across the controller, stacking builder, bridge publication, and tests. The Key Rail segmentation/double-click/Enter wiring and the rail-set move-member split behave as designed.

Two blockers remain: (1) the new `confirmKeyRailCycle` path ignores cancellation during `'preparing'`, so the footer's "Cancel generation" (and Escape) still creates a cycle; (2) the Law A single-loop move guard permits moves that break the loop's strictly increasing source order, leaving a "Source missing" Standard rail with no in-UI repair path. Two warnings cover a dialog-target/commit interleaving that strands the reduced modal, and an Enter-to-confirm guard that is fed a stale frames validation in `key-rail-create`. Three info items cover a stale footer readout, a dead CSS rule, and one unreachable necessity guard.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Cancel during `'preparing'` does not cancel the Key Rail conversion

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1822-1875` (with `:3609-3623`, `:830`, `:3625`)
**Severity:** BLOCKER

**Issue:** `confirmKeyRailCycle` never participates in the controller's generation contract. It sets `phase.value = 'preparing'` (line 1833), awaits `ports.requestAuthority(...)` (1835), and then continues unconditionally into `resolveKeyRailFrames`, clip construction, `phase.value = 'committing'`, and `await ports.commit(...)` (1863). It never captures an accepted generation, never calls `assertCurrent`, and never touches `abortController`.

What the user sees is the opposite. `canCancel` (line 830) is true during `'preparing'`, so the footer renders the ghost button labeled "Cancel generation" (`PhysicsPaintPlayScriptDialog.tsx:544-550`) and Escape routes to `playScript.cancel()` (`PhysicsPaintPlayScriptDialog.tsx:276-280`). `cancel()` (3609-3623) bumps `generation` and calls `abortController?.abort()` (a no-op here because this path never assigns an `abortController`). Because nothing in `confirmKeyRailCycle` reads the generation, the awaited authority resolves and the conversion commits anyway: the user pressed Cancel and a Loop Clip plus an undo entry were created.

The existing `assertCurrent(acceptedGeneration)` machinery is exactly the intended guard (defined at 3625, used by the render/bake paths at 2809, 3179, 3246, 3277). The phase's cancel test only covers `cancel` *after* open, before any authority request (`physicsPaintRotoPlayScriptController.test.ts:4049-4059`), so the in-flight case is untested.

**Fix:**
```ts
const acceptedGeneration = ++generation;   // before phase.value = 'preparing'
ports.stopPlayback();
phase.value = 'preparing'; status.value = 'Preparing Key Rail cycle…'; error.value = null;
try {
  const authority = await ports.requestAuthority(nextOperationId('key-rail-cycle'), target.firstKeyFrame);
  assertCurrent(acceptedGeneration);       // cancel() now aborts the conversion
  ...
  phase.value = 'committing';
  const result = await ports.commit(publication);
  assertCurrent(acceptedGeneration);
  ...
} catch (cause) {
  if (isAbort(cause)) {                    // helper already exists at :4271
    if (generation === acceptedGeneration) { phase.value = 'cancelled'; progress.value = null; status.value = 'Key Rail cycle cancelled'; }
    return false;
  }
  fail(cause);
  return false;
}
```
`requestAuthority`/`commit` do not accept an `AbortSignal`, so generation checks (not `abortController`) are the correct mechanism here. Add a controller test that calls `confirm()` and `cancel()` while `requestAuthority` is still pending and asserts `commit` was never called.

### CR-02: Law A single-loop move can invalidate the loop's source order

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4463-4469` (guard), `:5531-5543` and `:5633-5638` (derivation)
**Severity:** BLOCKER

**Issue:** The Phase 58 Law A guard only counts referencing loops:
```ts
if (countLoopsReferencingSourceKey(loopClips, intent.movedKeyId) > 1) {
  return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
}
```
It never checks that the moved key's new frame keeps the single referencing clip's `sourceKeyIds` positions strictly increasing. `derivePhysicPaintRotoLoopRanges` requires exactly that (`sourcePositions.every((position, index) => index === 0 || sourcePositions[index - 1]! < position)`, 5535) and otherwise returns `unresolved.invalidSourceTiming` with `cycleLength = sourceFrameCount` (5541-5543, 5633-5638).

The phase's own Law A test proves the accepted destructive case: source keys A..E at frames 10..14, moving C (12) to 22 is accepted and persisted (`physicsPaintRotoLoopGuards.test.ts:281-298`, `expect(proposal.mapping.get('C')).toBe(22)`). The unchanged clip now orders its sources A(10), B(11), D(13), E(14), C(22), the range resolves as unresolved, and the presentation labels the rail "Source missing" (`view/physicsPaintLoopClipPresentation.ts:341,352`). Real-key drags reach this path through `useRotoTimelineActions.prepareRotoKeyDrag` (intent `'move-key'`), so this is user-reachable, and the stale comment above that call still says "D-11 rejects single-key ripple drags on linked source keys".

Recovery is effectively Undo only. Standard merged clips (`scriptId === undefined`, `railKind !== 'reveal'`) are refused by every source-repair entry: `groupRegenerateReason` (1926), `openSourceEdit` (2040), and `repairLoop` (2072-2074) return `STANDARD_RAIL_REGENERATE_REASON` or "no source-cycle provenance". `unlinkLoop` (2280-2286) exists on the controller but has no UI consumer anywhere in `app/src` (only a test mock), so the broken clip cannot be unlinked or regenerated from the interface.

**Fix:** After the destination frame is resolved (from `intent.target` for `physical-cell`, or from the candidate produced by `buildMoveCandidate`), substitute the moved frame into the single referencing clip's source positions in `sourceKeyIds` order and reject unless the sequence stays strictly increasing:
```ts
// when exactly one clip references the moved key
const nextPositions = clip.sourceKeyIds.map((keyId) =>
  keyId === intent.movedKeyId ? destinationFrame : appFrameByKeyId.get(keyId)!);
const ordered = nextPositions.every((position, index) =>
  index === 0 || nextPositions[index - 1]! < position);
if (!ordered) {
  return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
}
```
Re-sorting `sourceKeyIds` instead would silently change the cycle's playback sequence, so rejection is the safe fix. Update the Law A test to a destination that preserves order (e.g., move A from 10 to 9) and add a rejection test for C 12→22.

## Warnings

### WR-01: Cancel/Close during `'committing'` nulls the target while the dialog stays open

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:3609-3622` (with `:3603-3607`)
**Severity:** WARNING

**Issue:** `canCancel` excludes `'committing'`, so `cancel()` takes the else branch while the commit is in flight:
```ts
if (dialogMode.peek() === 'key-rail-create') keyRailCycleEditTarget.value = null;
closeConfirmation();
```
`closeConfirmation()` immediately returns because `isBusyPhase(phase.peek())` is true for `'committing'` (3604, 4270). The target has already been cleared, but the dialog stays open with `dialogMode` still `'key-rail-create'`, so the footer still reads "Create Cycle". If the in-flight commit then fails, `fail()` moves the phase to `'failed'` with `keyRailCycleEditTarget` null; `confirmKeyRailCycle` returns `false` at line 1824 on every subsequent press, and the enabled primary button is dead until the user closes and reopens the modal. Escape during `'committing'` reaches the same path (`PhysicsPaintPlayScriptDialog.tsx:276-280`).

**Fix:** Do not mutate the target unless the close will actually happen:
```ts
function cancel(): void {
  if (canCancel.peek()) { generation += 1; abortController?.abort(); abortController = null; return; }
  if (isBusyPhase(phase.peek())) return;      // closeConfirmation would no-op
  if (dialogMode.peek() === 'key-rail-create') keyRailCycleEditTarget.value = null;
  closeConfirmation();
}
```
Add a test that calls `cancel()` while `commit` is pending and then fails the commit, asserting the Create Cycle button remains functional.

### WR-02: Enter-to-confirm in the reduced form is blocked by an unrelated stale frames error

**File:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:290-293` (with `:568-570`; `physicsPaintRotoPlayScriptController.ts:715,718,819-820,840-861`)
**Severity:** WARNING

**Issue:** The dialog-level Enter handler requires `tabValidationError` to be null:
```ts
const tabValidationError = revealTab ? playScript.revealValidationError.value : playScript.validationError.value;
if (tabValidationError || playScript.repeatError.value) return;
```
In `key-rail-create`, `validationError` is `parsedCount.countText/capacity` (819-820), but `openKeyRailCycleEdit` never primes `countText`, `capacity`, `canonicalStart`, or `layerEndExclusive` (1786-1804). In a fresh controller those are `'3'` and `0` (715, 718), so `validationError` is the frozen "Maximum available count is 0." Meanwhile the primary button for the reduced form is gated only on `repeatError` (568-570) and is enabled. Result: pressing Enter in the Cycle field does nothing while clicking "Create Cycle" works; after any prior Apply/Loop-Edit the stale values happen to mask the bug, making the behavior session-history dependent.

**Fix:** Exempt the reduced key-rail form from frames validation in the Enter guard (and keep button/Enter gates identical):
```ts
const tabValidationError = keyRailCreate
  ? null
  : revealTab ? playScript.revealValidationError.value : playScript.validationError.value;
```
Alternatively have the controller's `validationError` return null when `dialogMode === 'key-rail-create'`, and drive both the Enter guard and the primary disabled state from one shared `confirmDisabledReason`.

## Info

### IN-01: "Run details" readout in the reduced modal is stale dialog state

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:885-931` (rendered by `PhysicsPaintPlayScriptDialog.tsx:241,488-513`)
**Severity:** INFO

**Issue:** `loopReadout` branches on `'stack'` and `'loop-edit'`, then falls through to the creation branch that reads `activeParsedCount`, `canonicalStart`, and `layerEndExclusive` (918-921). None of those are primed for `'key-rail-create'`; they retain values from the last Apply/Loop-Edit in the same controller instance. After any prior dialog, the reduced Cycle modal shows a "Run details" tooltip whose Requested/Effective math uses `countText` rather than the frozen `cycleFrameCount`, so it describes an unrelated creation. With no prior dialog the values are null and the readout disappears, making the defect intermittent.

**Fix:** Return `null` at the top of `loopReadout` when `dialogMode.value === 'key-rail-create'`, or add a dedicated branch that uses `keyRailCycleEditTarget.value` (e.g., `Cycle ${cycleFrameCount}f × ${repeat}`). Add a reduced-form assertion that the readout is absent.

### IN-02: Dead CSS rule after the Standard read-only value was removed

**File:** `app/src/components/physic-paint/physicsPaintStudio.css:2840` (rule `.physics-paint-play-script-standard-rail-value`)
**Severity:** INFO

**Issue:** This phase removed the only consumer of the class from `PhysicsPaintPlayScriptCards.tsx`; the dialog test now pins the class name's absence from the component source (`PhysicsPaintPlayScriptDialog.test.ts:1406`), but the stylesheet rule and its comment remain. Grep over `app/src` shows no other reference, so the rule is dead.

**Fix:** Delete the `.physics-paint-play-script-standard-rail-value` rule block and its comment.

### IN-03: Open-time `loopClipsOwnAnyKey` is unreachable from production call sites

**Category:** necessity
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1780-1782`
**Severity:** INFO

**Issue:** Every key owned by a loop clip (`sourceKeyIds` plus `frameOverrides`) is excluded from Key Rail segmentation: `PhysicsPaintStudio.tsx:1134-1141` builds `keyRailGroupOwnedKeyIds`, `deriveKeyRailSegments` drops exactly those keys (`view/physicsPaintKeyRailPresentation.ts:53-57`), and the only production caller passes a segment from that derivation (`PhysicsPaintStudio.tsx:4814-4822`). A segment therefore cannot contain a loop-owned key, so the open-time ownership check is only reachable by tests that hand-assemble keyIds (e.g., `physicsPaintRotoPlayScriptController.test.ts:4078-4094`). The confirm-time check at 1839-1841 is a legitimate TOCTOU guard against a loop added between open and confirm and must stay.

**Fix:** Remove the open-time check, or replace it with a short comment/assertion documenting that the segment derivation already excludes owned keys. Keep the confirm-time check.

---

_Reviewed: 2026-11-03T12:44:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
