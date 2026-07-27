---
phase: 37-multi-select-physical-roto-keys
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/types/physicPaint.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 37 multi-select physical Roto keys implementation: the pure multi-selection reducers, the resolver's group intents (`move-key-group`, `delete-key-group`, scoped `force-spacing`), the timeline action bundle extensions, the workflow-strip drag/selection UI, the keyboard dispatcher additions, the Studio wiring, and the post-UAT regression tests.

The core resolver logic is strong: group-move candidate builders (GD-1 whole-cell, GD-3 occupied caret) were traced by hand against the locked mappings and are correct — destination collisions, capacity bounds, ripple conflict checks after each ascending placement, and the finalizer's uniqueness proof all hold. The selection reducers are pure, fail-closed on unknown identities, and match the UAT-approved Q1/Q2 rulings. No security issues, no injection surfaces, no hardcoded secrets.

The findings are robustness/contract issues concentrated at the integration seams: an unguarded throw reachable from the keyboard Delete route, a keyboard Select All route that bypasses the pending-operation availability guard, a paint-barrier undo/redo path that mutates history stacks before the engine call without exception protection, selection-signal updates in the new Studio handlers that skip the store sync every other selection mutation performs, and a "stable" action bundle that is not actually stable across renders.

No blockers. The UAT-passed behavior is consistent with the code as written; the warnings below are latent defects and contract inconsistencies rather than failures the UAT would have exercised.

## Warnings

### WR-01: Keyboard Delete route can throw an unhandled exception when no real key is selected

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:357-379, 784-790` and `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:92-104`
**Issue:** `deleteRotoFrame` (and `insertRotoFrame`) obtain the selection via `ensureSelectedKeyId`, which **throws** `'No selected Roto key.'` when `getSelectedKeyId()` returns null. The guarded toolbar icon is safe because it is aria-disabled via `canDeleteFrame`, but the Backspace/Delete keyboard route (`dispatchPhysicsPaintStudioKeyDown`) calls `actions.deleteRotoKey()` directly without consulting any availability signal. On an empty timeline (zero real keys, null selection) pressing Backspace reaches the single-key branch and throws inside the window keydown dispatcher — an uncaught exception in a global event handler. The throw path also bypasses the graceful `publishStatus` feedback every other guard in `runPhysicalAction` uses.
**Fix:** Replace the throw with a graceful guard inside `deleteRotoFrame`/`insertRotoFrame`:
```ts
const deleteRotoFrame = useCallback((): Promise<boolean> => {
  const selectedKeyIds = input.getSelectedKeyIds?.() ?? [];
  if (selectedKeyIds.length >= 2) { /* group branch unchanged */ }
  const selectedKeyId = input.getSelectedKeyId?.() ?? null;
  if (!selectedKeyId) {
    input.publishStatus?.('Select a real Roto key to delete.');
    return Promise.resolve(false);
  }
  return runPhysicalAction({ /* ... */ });
}, [runPhysicalAction, input]);
```
Alternatively (or additionally), have the dispatcher's Delete branch check `canDeleteFrame.value` before invoking the action, matching the guarded-icon contract.

### WR-02: Cmd/Ctrl+A Select All bypasses the pending-operation availability guard

**File:** `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:106-114` and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:98-110`
**Issue:** The D-03 availability contract (`computeSelectAllKeysAvailability`, useRotoTimelineActions.ts:872-884) declares Select All ineligible while a physical edit is in flight (`pendingOperationId !== null`). The guarded strip icon honors that computed, but the keyboard route checks only `state.mutationLocked` (the paint/script lock) — not the coordinator's pending signal — and `selectAllRotoKeys` in the Studio has no pending guard either. During an in-flight physical edit the user can still mutate the selection set via Cmd/Ctrl+A, contradicting the guarded-action contract the rest of the row enforces. The outcome is benign today (selection is session-only and the D-17 aftermath repairs it at acceptance), but the two routes for the same action now enforce different guards.
**Fix:** Gate the keyboard route on the same availability port, e.g. in the Studio callback:
```ts
const selectAllRotoKeys = useCallback(() => {
  if (physicalEditCoordinator.pendingOperationId.value !== null) return;
  // ...existing body
}, [rotoKeyRecords, physicalEditCoordinator]);
```
or pass `canSelectAllKeys` into the keyboard state and check it in the dispatcher branch, mirroring how the icon is gated.

### WR-03: Paint-barrier undo/redo mutates history stacks before the engine call, with no exception protection

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:368-379 (undo), 421-432 (redo)`
**Issue:** The paint-barrier path pops the entry from `appliedRef` and pushes it onto `redoRef` **before** calling the engine's synchronous `undoPaint()`/`redoPaint()`. If the engine call throws, the entry has already moved stacks: availability now reports an undoable paint step as redoable while the paint itself was never undone — a silent history/availability desync, and the exception propagates through the Studio's `undo()` caller. The no-change rollback (`!changed`) is handled, but the throw path is not.
**Fix:** Wrap the engine call and restore the stacks on throw:
```ts
appliedRef.current.pop();
redoRef.current.push(entry);
let changed = false;
try {
  changed = inputRef.current.undoPaint();
} catch (error) {
  redoRef.current.pop();
  appliedRef.current.push(entry);
  publishAvailability();
  throw error;
}
if (!changed) { /* existing restore */ }
```
Apply symmetrically to the redo paint branch.

### WR-04: New Studio selection handlers update the selection signal without the paired store sync

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1092-1108 (onToggleRotoKeySelection), 1112-1121 (onExtendRotoKeySelection)`
**Issue:** Every other mutation of `selectedKeyId.value` in this component is paired with `physicPaintStore.setRotoPhysicalSelection(layerId, keyId, frame)` (lines 80, 411, 738). The two Phase 37 handlers change the current editing key — Q1 toggle-out transfers current to the next selected key (line 1101), Q2 shift-click makes the clicked key current (line 1120) — but never sync the store. The store's physical selection therefore diverges from the signal until an unrelated navigation or accepted edit re-syncs it. Visual UAT passed because the strip reads the signal, but any store-driven selection reader (parent authority state, launch restore) sees the stale keyId in the interim.
**Fix:** Mirror the existing pattern in both handlers:
```ts
selectedKeyId.value = result.currentKeyId;
const launch = launchContextRef.current;
if (launch) physicPaintStore.setRotoPhysicalSelection(launch.layerId, selectedKeyId.value, launch.startFrame);
```
(guard for the `result.currentKeyId === null` no-change case in the extend handler as it does today).

### WR-05: "Stable" action bundle is not stable — availability computeds and fallback signal are re-created every render

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:280-292`
**Issue:** The module documentation promises a "stable physical timeline action bundle", but all eleven availability `computed(...)` signals are constructed in the hook body on every render, and `input.pendingOperationId ?? signal<string | null>(null)` creates a fresh signal per render whenever the optional input is absent. Because every one of these signals is in the `physicalActions` `useMemo` dependency array (line 743), the memo is invalidated on every render and the bundle identity churns — defeating the memoization contract the strip and keyboard dispatcher rely on for stable prop identity. (Pre-existing pattern from 36.14, but Phase 37 extended it with two more computeds and the bundle is now consumed by more surfaces.)
**Fix:** Wrap the computeds so they are created once per input identity, e.g.:
```ts
const availability = useMemo(() => ({
  canInsertFrame: computed(() => computeInsertAvailability(input).eligible),
  // ...etc
  pendingOperationId: input.pendingOperationId ?? signal<string | null>(null),
}), [input]);
```
or hoist the fallback signal into a `useMemo(() => signal(null), [])` and memoize each computed individually.

## Info

### IN-01: `isBoundedKeyId` implemented three times

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:391-393`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:771-773`, `app/src/types/physicPaint.ts:195-197`
**Issue:** Three identical copies of the bounded-keyId guard (non-empty string, length ≤ 256). If the bound ever changes, one copy will be missed.
**Fix:** Export one canonical helper from `physicsPaintRotoPhysicalModel` (or the types module) and import it in the other two sites.

### IN-02: Redundant nested condition in `buildDeleteCandidate`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:775-781`
**Issue:** The successor-tracking check `if (successorKeyId === null && identity.appFrame > selectedFrame)` sits inside the `identity.appFrame > selectedFrame` branch, so the frame comparison is dead. Harmless, but it reads as if a distinct condition were intended (the group-delete builder at line 847 carries the same shape without the outer branch, suggesting a copy/paste origin).
**Fix:** Simplify to `if (successorKeyId === null)`.

### IN-03: Select All busy reason falls back to the Delete action's message

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:407-411`
**Issue:** When the Select All icon is unavailable due to the shared busy lock, the disabled reason is computed as `getRotoKeyUtilityDisabledMessage('delete')` — borrowing the Delete action's copy path to obtain the generic busy line. It produces the right string today only because the busy branch of that helper is action-agnostic; any future Delete-specific wording in that branch silently leaks into the Select All tooltip.
**Fix:** Use the literal busy copy (`ROTO_KEY_BUSY_STATUS_TEMPLATE`-style message) directly instead of routing through the Delete action's reason helper.

### IN-04: Formatting artifacts — merged brace and statement on single lines

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:448, 886`
**Issue:** Line 448 reads `...RotoDragPreparationResult => {    const launch = input.getLaunchContext?.() ?? null;` and line 886 reads `...ActionAvailability {  if (!input.getLaunchContext ...` — a statement merged onto the opening-brace line, inconsistent with the rest of the file (a style commit `5bd19577` restored one such newline but missed these two). Purely cosmetic, but it trips readers and linters.
**Fix:** Split the statements onto their own lines.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
