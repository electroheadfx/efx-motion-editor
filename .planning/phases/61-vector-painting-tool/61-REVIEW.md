---
phase: 61-vector-painting-tool
reviewed: 2026-11-10T22:24:25Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
  - app/src/components/physic-paint/view/aquarelleColorPicker.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/shortcutTextTarget.test.ts
  - app/src/components/physic-paint/view/shortcutTextTarget.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathLatches.test.ts
  - app/src/components/physic-paint/view/vectorPathLatches.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
  necessity: 0
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-11-10T22:24:25Z
**Depth:** deep
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Gap-closure review of the six plans 61-15..61-20 against the previous review (`2025f3ef3`). All five original blockers are genuinely closed in the current source. CR-01: pointer capture on both drag branches, honoured `hasPointerCapture`, release AFTER the commit decision, release on cancel. CR-02: one capture-phase `handleVectorPathWindowKey` dispatcher plus a dependency-free `isTextEntryTarget`. CR-03: `setDraftMode` refuses to leave under `draftPixelsDirty`/`wireframeMode`, `setWireframeMode(true)` forces Draft, Select entry is refused under wireframe, and the rail, paint keys, picker and Dry are all gated. CR-04: the draw route records then bakes; the path-edit route records exactly once (defer branch XOR `onSuccess`, never both) and a failed bake restores the pre-edit snapshot. CR-05: `resolveAnchorWidthTarget` fails closed to null unless the single selected stroke IS the open edit, and the control reads empty with a stated reason. The CR-06-class input-surface exclusivity is closed too (`setAquarelleSelectMode(true)` releases the pen and the path edit; picker entry and paint-tool presses do likewise).

Two regressions remain in the new seams. The first is a stranded path-edit drag: the overlay's drag state is cleared only by its own pointer-up/cancel handlers, and those handlers unbind the moment the path edit closes — so a drag interrupted by a rail key, the picker, a paint tool or the sheet's close leaves `vectorPathEditDrag` and `dragRef` alive, the stroke renders at the uncommitted position, and the next path edit on that stroke can commit an edit the user never made (an empty-space press plus release is enough, because `startEditDrag` returns without clearing the stale drag). The second is in the new commit seam: it guards the shared in-flight latch, then awaits `ensureAquarelleDurableBaseRef` before claiming it — the exact anti-pattern the file's own WR-01 comment (lines 5952-5956) forbids. A concurrent commit inside that window writes the script through `beginAquarellePathEdit`, is then refused by `runAquarelleScriptRebake`'s fail-closed branch (which calls no terminal callback), and returns null with the edit still in the document and no ledger entry.

Confirmed sound and deliberately not reported: the bake seam never double-applies (one latch, reset → apply → exactly one terminal callback, `finally` releases); the Draft settle joins its single flight and closes both its success and failure paths; `runWireframeOffTransition` clears `wireframeSettleInFlight` in a `finally`, so no refusal leaks a spinner or a stuck latch; every new latch writer is compare-then-write and every handler reads with `.peek()` (no render-body signal writes — the one render-body write is 61-11's documented plain-flag marker); and the wireframe/pen coexistence is coherent (the pen's draw routes through `defer-pixels`, so nothing bakes behind the construction view).

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: An interrupted path-edit drag is never cleared — deleted anchors come back and a stranded drag commits a phantom edit

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:942-967` (the only clears), `:981-984` (handlers bound only while `editInteractive`), `:700-702` (stale preview wins over the recorded anchors), `:899-900` (empty-space press returns without clearing `dragRef`)

**Category:** bug

**Issue:** `dragRef.current` and the `vectorPathEditDrag` signal are cleared ONLY in `finishEditDrag` (pointer-up) and `cancelEditDrag` (pointer-cancel), and both handlers are attached only while `editInteractive` is true (`onPointerMove`/`onPointerUp`/`onPointerCancel` become `undefined` the instant `pathEditMutationId` goes null). Neither `exitPathEdit` (`view/vectorPathLatches.ts:91-94`) nor `resetForStudioOpen` (`view/vectorPathSession.ts:101-106`) touches the overlay's gesture state, and the overlay does not unmount while any vector stroke remains on the frame (`:721`). Two consequences:

1. **Resurrection.** While a drag is live its snapshot `anchorsAtStart` is frozen. `handleVectorPathEditKey` (`:300-327`) commits Delete/Backspace against the REAL recorded anchors without clearing or rebasing the drag. Under Draft (the normal watercolor mode) that commit is synchronous, so the next `continueEditDrag` rebuilds from `anchorsAtStart` — the deleted anchor is back in the preview — and `finishEditDrag` commits `drag.latest` (`:949-950`), re-inserting the anchor the user just deleted.
2. **Phantom commit.** Any action that closes the path edit mid-drag (V / A / I / B / W / P / E via `physicsPaintStudioKeyboard.ts:386-393` and `PhysicsPaintStudio.tsx:2613-2624` → `exitPathEdit()`; the sheet's close at `PhysicsPaintStrokeSettingsDialog.tsx:623`; picker entry `aquarelleColorPicker.ts:45`) leaves the drag alive and the stroke drawing at the uncommitted position. Reopening a path edit re-binds the handlers: a plain hover runs `continueEditDrag` with the stale snapshot (setting `moved` past the threshold), a press on empty canvas returns at `:900` WITHOUT clearing the stale drag, and the release runs `finishEditDrag` → `onPathEdit(drag.mutationId, drag.latest)` on a stroke the user may not even be editing. `handleAquarelleVectorPathEdit` (`PhysicsPaintStudio.tsx:10184-10196`) accepts any recorded mutationId, so the phantom edit lands in the script (and, under Draft, in the ledger).

**Fix:** Terminate the drag whenever the open edit changes, and never act on a drag whose target is not the current edit. In `VectorPathOverlay`:

```ts
const captureTargetRef = useRef<EventTarget | null>(null);
useEffect(() => {
  if (editMutationId !== null) return;
  const drag = dragRef.current;
  dragRef.current = null;
  vectorPathEditDrag.value = null;
  if (drag !== null) releasePointerCapture(captureTargetRef.current as never, drag.pointerId);
}, [editMutationId]);
```

and guard both continuations: `if (drag.mutationId !== editTargetMutationId) { dragRef.current = null; vectorPathEditDrag.value = null; return; }` at the top of `continueEditDrag` and `finishEditDrag`. Also clear `dragRef` at the START of `startEditDrag`, so an empty-space press can never inherit one. (Clearing `vectorPathEditDrag` from the session exit is the alternative, but the overlay is its only writer today, which is why the effect is the minimal fix.)

#### CR-02: The path-edit commit claims the in-flight latch only after `ensureAquarelleDurableBaseRef` — a concurrent commit writes the script with no ledger entry and no rollback

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10115-10166` (guard at 10118, await at 10120, `beginAquarellePathEdit` at 10124, `runAquarelleScriptRebake` at 10139), `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts:48-49`, `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:939-951`

**Category:** bug

**Issue:** `commitAquarelleVectorPathEdit` checks `isAquarelleScriptEditInFlight()` and THEN awaits the durable-base recovery, which can run a real base bake. `beginAquarellePathEdit` mutates the script synchronously but only READS the flag (it never claims it), and the flag is not set until `runAquarelleScriptRebake` runs `beginInFlight()`. So two commits — e.g. a pointer-up drag commit followed by an Anchor-width stepper commit, or a Delete key commit while a drag commit is settling — can both pass the guard and both write the script. The loser then hits `runAquarelleScriptRebake`'s fail-closed `if (sequence.isInFlight()) return false;`, which deliberately calls NO terminal callback, so `commitAquarelleVectorPathEdit` returns `null` with:

- its `updateAquarellePathInScript` write still in the document,
- no `rotoMoveHistory.recordAquarelleScriptEdit` entry (the ledger is written only in the defer branch or `onSuccess`),
- no rollback (the fail-closed branch never reaches `onFailure`).

The same file already states the correct law for this exact seam — "WR-01: hold the in-flight flag across the WHOLE replay (set after the guard so a re-entrant call still refuses itself, before the first await)" at lines 5952-5956 — so this violates an in-repo precedent rather than a new design choice. Secondary damage: if the winner's rebake then FAILS, its `onFailure` restore is authority-checked (`aquarelleStrokeSelection.ts:1057` compares `aquarelleStrokesRevision`), and the loser's write bumped that revision — so the rollback silently no-ops while the capsule publishes "…the path edit was restored." (see WR-02).

**Fix:** Claim the latch BEFORE the first await and release it on every exit, mirroring the replay seam:

```ts
if (isPhysicalMutationLocked()) return null;
if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return null;
if (isAquarelleScriptEditInFlight()) return null;
setAquarelleScriptEditInFlight(true);          // claim before the await
try {
  const playFrame = launchContextRef.current?.startFrame ?? 0;
  await ensureAquarelleDurableBaseRef.current(playFrame);
  ...                                          // beginAquarellePathEdit / defer branch unchanged
  const ok = await applyDirectly(playFrame);   // the reset/apply half, without re-claiming
  ...
} finally { setAquarelleScriptEditInFlight(false); }
```

If the direct apply stays inside `runAquarelleScriptRebake`, give the sequence an explicit "already held" mode so the fail-closed branch cannot fire after a write; alternatively make that branch call `sequence.onFailure?.()` so the caller can restore.

### Warnings

#### WR-01: Shift+A writes a stroke selection while Select entry is refused under wireframe

**Severity:** WARNING
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2717-2727`; `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:341`

**Category:** bug

**Issue:** `setAquarelleSelectMode(true)` returns EARLY when `wireframeMode.peek()` is on (61-17's refusal), but `handleToggleSelectAllAquarelleStrokes` treats that call as unconditional and then always writes `setAquarelleStrokeSelection(...)`. Under wireframe, Shift+A therefore mutates `scriptSelectedStrokeIds` while select mode stays off. Nothing renders the selection (`ScriptStrokeOverlay` returns null at `ScriptStrokeOverlay.tsx:146` without `selectMode`), and `setScriptSelectMode(false)` clears only on an actual transition (`scriptStrokeEdition.ts:321-330`), which never happens here — so the selection survives the wireframe session, appears the next time Select is entered, and the stroke-settings sheet (which follows `selection.size`, `PhysicsPaintStrokeSettingsDialog.tsx:501`) opens in multi-selection mode from a shortcut that appeared to do nothing.

**Fix:** Refuse up front, before any write:

```ts
const handleToggleSelectAllAquarelleStrokes = useCallback(() => {
  if (wireframeMode.peek()) return;             // 61-17: no selection surface under wireframe
  if (!aquarelleSelectMode.peek()) {
    if (!watercolorMoveAvailable.peek()) return;
    setAquarelleSelectMode(true);
    if (!aquarelleSelectMode.peek()) return;    // defense: the entry choke point is authoritative
  }
  ...
}, []);
```

#### WR-02: A failed path-edit bake rolls back through the authority-checked restore — an interleaved bump skips the rollback while the capsule says it succeeded

**Severity:** WARNING
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10153-10164`; `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:1049-1061`, `:1124-1135`

**Category:** bug

**Issue:** `onFailure` calls `restoreAquarelleEditSnapshot(editId, 'undo')` and ignores its return. That restore is revision-authoritative: it returns `null` without touching the script whenever `aquarelleStrokesRevision` moved past the edit's `after` side. A failed re-bake is precisely the case the module documents for the raw rollback ("a failed re-bake must restore the pre-attempt script it just left", `:1063-1069`), and the repo already ships the remedy for a stale attempt: `reanchorAquarelleEditFromLiveContent(editId, 'undo')` re-seats the revision only when the live content is still provably the attempted side (`:1115-1135`). Here neither is used, so after any interleaved script mutation the path edit is left half-applied (script written, pixels not) while the user is told "the path edit was restored."

**Fix:**

```ts
onFailure: () => {
  // Re-seat the attempted side at the live revision when the content still
  // matches, so the rollback cannot fail closed on a foreign bump.
  reanchorAquarelleEditFromLiveContent(editId, 'undo');
  restoreAquarelleEditSnapshot(editId, 'undo');
  ...
}
```

#### WR-03: The draw-site bake refuses silently and its result is discarded

**Severity:** WARNING
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8807`; `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts:48-49`

**Category:** bug

**Issue:** `if (isVectorAquarelleStroke(stroke)) void bakeAquarelleVectorCommit();` discards the boolean, and `runAquarelleScriptRebake`'s in-flight branch calls neither `onSuccess` nor `onFailure`. If a vector path is drawn while another aquarelle script edit is still baking (the pen can be latched and the overlay drawn on immediately after leaving a path edit, whose rebake is async), the stroke is recorded in the timeline but the sheet is never re-rendered and nothing is published: no message, no dirty flag. The overlay still draws the path from the registry, so the user sees the geometry, but any capture/save before a later settle freezes pixels without it. `draftPixelsDirty` is the existing retry mechanism — the defer route already uses it — and it is not set here.

**Fix:** Distinguish "skipped because another edit holds the lock" from "applied", and arm the retry:

```ts
if (isVectorAquarelleStroke(stroke)) {
  void bakeAquarelleVectorCommit().then((baked) => {
    if (baked) return;
    // A concurrent script edit held the latch: the record landed, the pixels did not.
    setDraftPixelsDirty(true);
  });
}
```

(The same treatment applies to `commitAquarelleVectorPathEdit`'s in-flight refusal at line 10118: no script write happened there, so a message rather than a dirty flag is appropriate.)

#### WR-04: An open path edit survives the selection moving to a different vector stroke

**Severity:** WARNING
**File:** `app/src/components/physic-paint/view/strokeSettingsModel.ts:886-888`; `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:1274-1300`, `:637-659`

**Category:** bug

**Issue:** `shouldExitPathEdit` only asks whether the path edit is active and the gate closed. The gate is `selectionSize === 1 && vectorStrokeCount === 1` (`strokeSettingsModel.ts:840`) — it never compares the selected id with the open edit's id. With stroke A's path edit open, clicking stroke B's row in the stroke list (`selectAquarelleStroke` at `:1298`) keeps the gate enabled, so the edit stays on A: the sheet shows B's settings while every canvas drag still edits A's anchors and handles, and the header button correctly flips to unpressed (`pressed` compares the ids). CR-05's wrong width write is prevented (`resolveAnchorWidthTarget` returns null and the control reads empty), but the edit surface and the sheet now name different strokes.

**Fix:** Make the exit predicate target-aware, using ids both sides already read:

```ts
export interface PathEditExitArgs {
  readonly pathEditActive: boolean;
  readonly gateEnabled: boolean;
  readonly selectedMutationId: number | null;
  readonly pathEditMutationId: string | null;
}
export function shouldExitPathEdit(args: PathEditExitArgs): boolean {
  if (!args.pathEditActive) return false;
  if (!args.gateEnabled) return true;
  return args.pathEditMutationId !== String(args.selectedMutationId);
}
```

#### WR-05: The capture-phase key guard only knows text fields — Enter on a focused button is swallowed by the draft handler

**Severity:** WARNING
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:337-350`; `app/src/components/physic-paint/view/shortcutTextTarget.ts:13`, `:23-40`

**Category:** bug (accessibility)

**Issue:** The `window` capture listener runs before the focused element and calls `preventDefault()`/`stopPropagation()`. `isTextEntryTarget` refuses only INPUT/TEXTAREA/SELECT/contenteditable, so a focused BUTTON is not spared: while a vector draft exists (`handleVectorPathKey` only acts when `vectorDrawDraft.peek() !== null`), pressing Enter on a focused rail or sheet button commits the draft instead of activating the button — the button's click is suppressed. This is the same class as the closed CR-02, just with the remaining focusable target set.

**Fix:** Broaden the predicate (or add a parallel `isInteractiveTarget`) to `button, a[href], [role="button"], [role="menuitem"], [role="link"]`, included in the same `closest()` walk:

```ts
const NON_TEXT_INTERACTIVE_SELECTOR = 'button, a[href], [role="button"], [role="menuitem"], [role="link"]';
```

### Info

#### IN-01: `VectorDrawDraft.cursor` is still written and never read (repeat of the previous WR-01/WR-02)

**Severity:** INFO
**File:** `app/src/components/physic-paint/view/vectorPathSession.ts:42`, `:78`, `:91`; only readers are `vectorPathSession.test.ts:139`, `:144`

**Category:** code quality

**Issue:** The field is maintained on every anchor placement and is used by no production code; the draft is drawn from `anchors` alone (`VectorPathOverlay.tsx:714-719`), so there is still no rubber-band to the cursor. Either the field is the seed of the missing preview or it is dead payload in a session object.

**Fix:** Draw the rubber band from `cursor`, or remove the field and the two test assertions that pin it.

#### IN-02: `settleDraftScript` refuses silently when a mutation holds the gates, and `switchActiveTrack` assumes a message was surfaced

**Severity:** INFO
**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5402-5407`; comment at `:5496-5498`

**Category:** code quality

**Issue:** The wireframe/settle-message branches publish a bounded refusal, but the physical-lock / applying / mutation-locked / script-edit-in-flight branch resolves `false` with no message and no status change. `switchActiveTrack` explicitly relies on "the settle has already surfaced its refusal message" before aborting, which is untrue on this branch: the track switch silently does nothing. Adding `isAquarelleScriptEditInFlight()` to this gate widened that window.

**Fix:** Publish a bounded refusal (e.g. "Another edit is settling — try again.") before `return Promise.resolve(false)`, or return a discriminated result so callers can distinguish "refused" from "blocked".

#### IN-03: The Anchor width commit's result is discarded, so a refusal is indistinguishable from a success

**Severity:** INFO
**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:1713-1718`

**Category:** code quality

**Issue:** `void bundle.applyAnchorWidths?.(ids, …)` ignores the boolean. `applyAnchorWidths` returns false for the wrong or missing target, a missing stroke, an unreadable path, and an in-flight refusal; in every case the stepper simply snaps back to the document reading with no explanation — and in the CR-02 race the document may in fact hold the new value.

**Fix:** Await the result and publish a bounded caption or status on `false` (the sheet already renders a refusal caption for the empty case), or at minimum surface it through the shared status capsule.

---

_Reviewed: 2026-11-10T22:24:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
