---
phase: quick-261022-ujp
plan: 261022-ujp
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 60000
  raw_tokens: 30000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "In Water color Select mode with a stroke selected, pressing Space moves that stroke one step behind the next older stroke of the same edit frame; the sheet resets and re-applies through the shared Apply pipeline (0/N -> N/N pill), and the selection plus its outline survive."
    - "A watercolor reorder plus its re-bake is exactly ONE `aquarelle-script` undo step: Cmd+Z restores the previous order and re-bakes it, Cmd+Shift+Z re-applies the new order, and a stale snapshot fails closed with both stacks untouched."
    - "In Brush mode with the Move tool active and a stroke under the cursor (the preview ribbon), pressing Space sends that stroke one paint step back and redraws the canvas like a move commit; the hover target survives so the next Space steps the same stroke again."
    - "Space keeps its existing playback toggle everywhere else: not in move/select mode, no stroke selected or hovered, while playing, on key repeat, or with a modifier held."
    - "The new stack order survives save/load in both modules: the engine serializes paint order, and the aquarelle capture projection follows the recorded payload timeline."
    - "Brush undo/redo keep working after a reorder: `allActions` stays in acceptance order, no undo checkpoint is pushed, and the redo stack is cleared exactly like a move commit."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
  key_links:
    - "Space keydown -> dispatchPhysicsPaintStudioKeyDown reorder branch (before the playback branch, !repeat, no modifiers, not playing) -> actions.stepSelectedStrokeBackward() -> true consumes the key; false falls through to toggleRotoPlayback."
    - "Watercolor: stepSelectedStrokeBackward -> aquarelleSelectMode.peek() + aquarelleSelectedStrokeMutationId.peek() -> handleAquarelleSendBackward -> beginAquarelleReorderEdit (before snapshot, payload swap, after snapshot) -> aquarelleResetSheetRef -> await applyAquarelleTimeline(getAquarelleEventsForFrame) -> recordAquarelleScriptEdit(editId) on success / restoreAquarelleEditSnapshot(editId,'undo') + refusal message on failure."
    - "Brush: stepSelectedStrokeBackward -> engineRef.current.getMoveTargetMutationId() -> sendStrokeBackward -> swap the stroke's contiguous group with the previous group in the paint-order projection -> redrawAll -> notifyCompletedMutation('move', mutationId) -> Studio completed-mutation path (same as a move commit)."
    - "Save/load: serializeProject and getStrokes read the paint-order projection; buildAquarelleEventsFromCapture walks the payload timeline so a reorder is not undone by the engine capture order."
---

<objective>
Make Space reorder a selected/hovered stroke one step backward in the paint stack, for both Studio modules, re-rendering through the existing move/delete machinery.

1. **Water color**: with Select/Move armed and a recorded stroke selected, each Space press swaps that stroke's payload-timeline entry with the nearest older same-frame stroke, resets the sheet, and re-applies the frame script through the shared Apply pipeline. Reorder + re-bake is ONE `aquarelle-script` undo step.
2. **Brush**: with the Move tool active and a stroke under the cursor, each Space press sends it one paint step back in the engine's paint order and redraws the canvas like a move commit (hover target retained for repeated presses; undo/redo ledger untouched).
3. **Space gating**: the stack action owns Space only in move/select mode with a stroke selected or hovered, stopped playback, and no modifier/repeat; everywhere else the existing playback toggle is unchanged.

Purpose: the user can restack finished strokes without repainting, with the same visible re-render and undo behavior as move and delete.
Output: a keyboard stack-step path, a payload-timeline reorder + ledger edit for watercolor, a paint-order projection in engine-1, and save-order preservation for both modules.

Tracer note: Task 1 is the tracer — it wires Space -> keyboard dispatcher -> Studio action -> recorded payload swap -> shared re-bake -> capture projection, which is one path through every app layer the phase touches. Task 2 expands the same proven key path into the engine-1 paint order. The two module arms share one keyboard entry point, so the key path must land before the engine projection.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Verified in the live tree at HEAD `45118c56` on 2026-10-22 (line numbers drift after edits):

- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
  - 4-20 `PhysicsPaintStudioKeyboardState` (has `isPlaying`; no tool field).
  - 22-77 `PhysicsPaintStudioKeyboardActions`; 46-50 the `deleteSelectedAquarelleStroke?: () => boolean` precedent (optional action, returns true only when it consumed the key).
  - 123-129 dispatch entry; 129 `isPhysicsPaintShortcutTarget` guard.
  - 306-310 the UNCONDITIONAL Space -> `toggleRotoPlayback` branch (always `preventDefault`). The new branch goes immediately BEFORE it.
  - 186-198 the watercolor Delete/Backspace branch: `!event.repeat`, modifier guards, optional action returning true to consume.
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts` 15-20: the callback is recreated from `actions`/`state` each render, so closures read the current settings/signals at keydown time.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
  - 3859-3919 keyboard `state`/`actions` object; 3909-3919 `deleteSelectedAquarelleStroke` (peek-only, returns a boolean). The new `stepSelectedStrokeBackward` belongs beside it.
  - 4796-4859 `handleAquarelleMoveStroke` — the exact gates/order to mirror for the reorder handler.
  - 5054-5070 `canvasMountPropsMemo` (not touched by this quick).
  - 1145 lifecycle `engine`/`engineRef`; 4495 `strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0`.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
  - 262-264 `recordedStrokes` / `recordedStrokeEntries` (same entry object on the timeline and in the map).
  - 284-296 deleted marker set; 302-304 registry read; 364-402 `translateAquarelleStrokeInScript` (object-replacing, same index, bump revision) — the shape to mirror.
  - 540-556 `payloadTimeline` + `getRecordedAquarellePayloadTimeline`; 570-579 `getAquarelleEventsForFrame` (frame-filtered, Dry always kept, deleted honored).
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`
  - 66-89 `aquarelleSelectMode` / `aquarelleSelectedStrokeMutationId` (compare-then-write).
  - 304-322 shared script-edit in-flight guard; 333-361 snapshot capture/apply (registry -> membership -> timeline); 405-416 ledger cap/id counter.
  - 422-436 `beginAquarelleDeleteEdit`; 444-456 `beginAquarelleMoveEdit` (the shape to mirror); 465-477 revision-authoritative restore.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` 1282-1322 `buildAquarelleEventsFromCapture(brushes)` — currently projects in ENGINE capture order and merges Dry by `recordedOrder`; a payload reorder would be lost on save without the Task 1 fix.
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` 47 Brush-mode Move tooltip; 106-119 Water color Select toggle + title.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
  - 642 `allActions` ledger; 1509 physics placeholder push; 2334 `allActions.push(...actions)` in accept; 1548-1624 undo/redo (undo splices the SUFFIX from the action index — this is why the ledger order must never be reordered); 1669-1691 `clear`.
  - 1965-1974 `getStrokes()` / `getStrokeCount()`; 3180-3185 `notifyCompletedMutation`; 3191-3211 erase span splice; 3289-3326 move hover; 3408-3428 `commitMoveGesture` (flush -> mutate -> clear redo -> redrawAll -> notify 'move' -> keep hover).
  - 3894-3918 `redrawAll` (queued-tail COUNT skip + ordered replay); 3967+ `serializeProject`; 4007-4061 `loadProjectData` (reassigns `allActions`, clears history, calls `redrawAll`).
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts` 44-417: the prototype harness (`Object.create(EfxPaintEngine.prototype)` + `Object.assign`) — copy its shape for the new engine test and add `strokeStack: []` to the assigned object. Do NOT modify this file.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` 2936-2937 pins both rail tooltip strings; 3021-3039 pins the delete action (peek-only) and `not.toContain('aquarelleSelectMode.value')`-style render-body subscription guards.
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` 50-109 harness (`actions()`, `eventFor`, `dispatch`), 609-629 the Space -> playback cell, 918-958 the delete-action consume cells — the model for the new Space cells.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` 1366-1444: `recordLiveAquarelle` + `applyCurrentScript` exercises the real capture projection into the aquarelle Apply port — the persistence proof for a reorder.

Discovery result (do not coin a third stack): the Studio has exactly two modules (`ActiveModule = 'brush' | 'watercolor'`). Brush z-order is the engine-1 `allActions` acceptance ledger replayed by `redrawAll`; watercolor z-order is `payloadTimeline` replay order. There is no other stroke stack in the Studio. The main-window inline paint editor (`app/src/stores/paintStore.ts`, `StrokeList.tsx`) is a different surface and is OUT of scope.

Design decisions (locked by this plan):
- **Space is gated by mode + target, and consumes the key when those hold.** In Water color that is persistent Select mode (`aquarelleSelectMode.peek()`) + a selected mutationId; in Brush it is the engine's Move tool + hover target (`getMoveTargetMutationId()`). Held-Cmd temporary move never combines with Space on macOS (Cmd+Space is Spotlight), so it is deliberately not a gate.
- **Playback keeps Space outside that gate.** The branch requires `!state.isPlaying`; when playing, or when the action returns false, the existing playback branch owns the key exactly as today.
- **One step per physical press.** `event.repeat` is refused: each step ends in a full synchronous re-bake/redraw and must not queue from key auto-repeat.
- **Watercolor reorder swaps two stroke entries by index assignment.** Dry events are skipped as swap partners and keep their absolute timeline indices (Dry is a sheet action with no frame anchor, D-15). `recordedOrder`, ticks, points, and the registry insertion order are untouched.
- **Watercolor reorder is one ledger command.** It mirrors move: shared in-flight guard, before/after snapshots, revision authority, one `aquarelle-script` entry, rollback on failed re-bake.
- **Brush keeps the ledger immutable.** `allActions` stays in acceptance order because `undo()` splices the suffix from a stroke's index; reordering it would corrupt undo. Paint order is a separate projection of action object refs used only by rendering and serialization; dead refs stay in the projection so undo -> redo restores the stroke's paint position.
- **Brush reorder inherits the move contract.** Flush pending finalizations first, clear the redo stack (a stale redo would repaint pre-reorder pixels), no new undo checkpoint, one 'move' completed mutation, hover target retained.
- **Persistence follows the visible order.** Engine save serializes the projection; the aquarelle capture walks the live payload timeline (Dry included) so a reorder survives Apply Script and save.

Source audit (quick mode: no ROADMAP requirements, no RESEARCH, no CONTEXT.md):
| Item | Source | Covered by |
|------|--------|-----------|
| G1 Brush Move + Space sends the hovered stroke one step back, re-render like move | user description | Task 2 (+ Task 3 pins) |
| G2 Watercolor Select/Move + Space sends the selected stroke one step back, re-render like move/delete | user description | Task 1 (+ Task 3 pins) |
| G3 Space gated on move mode AND a stroke selected; global playback not stolen | user description | Task 1 (dispatcher), Tasks 2/3 |
| G4 Undo/redo keeps working (watercolor one step; brush no new checkpoint) | orchestrator constraint | Tasks 1, 2 |
| G5 New order survives save/load | user intent ("stack") | Task 1 (capture), Task 2 (serialize) |
| C1 Reuse existing move/delete machinery; never fabricate a reorder path | orchestrator constraint | Tasks 1, 2 design; discovery result above |
| C2 Preact signals only, peek-only in the Studio, no effects | efx-preact-reactivity | Tasks 1, 2, 3 pins |

Scope fences: no new dependencies; no project/package-format changes; no dev-server runs; no pushes. The engine package edit is authorized as live-observed and required (there is no paint-order API today). Preact + @preact/signals only (no useState, no effects, no render-body signal writes); every setter compare-then-write; Studio handler reads are `.peek()` only. Tests: `vitest run` only, never watch; pnpm only.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Water color Space step-back — payload reorder, shared re-bake, one undoable edit, persisted order</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <behavior>
    Write the RED cases first, then implement until green.

    `aquarelleRecordState.reorder.test.ts` (node env; unique mutationIds and playFrames so the shared module state never collides with the delete/move suites):
    - "sends a stroke one step back in the payload timeline": record three strokes on one frame, step the newest back — `getRecordedAquarellePayloadTimeline()` and `getAquarelleEventsForFrame(frame)` both read oldest, newest, middle; every stroke keeps its points, `recordedOrder`, ticks, and playFrame.
    - "each call is one step, and the bottom refuses": three presses on the same id walk it to the front; the fourth returns false with the timeline unchanged.
    - "refuses unknown, deleted, and single-of-frame strokes": each returns false with no revision bump and an unchanged timeline.
    - "Dry events keep their absolute index": timeline stroke-a, Dry, stroke-b; step b back -> stroke-b, Dry, stroke-a, and the Dry object is still at index 1.
    - "a reorder edit restores the previous order on undo and the new order on redo": `beginAquarelleReorderEdit` then `restoreAquarelleEditSnapshot(id, 'undo')` / `'redo'` restore the timeline INDEX ORDER; a newer record makes a stale restore return null with the timeline untouched.
    - "a reorder keeps the selection and the shared in-flight guard": the selected id survives begin/restore; a second begin while the edit flag is set returns null.

    `physicsPaintStudioKeyboard.test.ts` (extend the existing harness; do not add the action to `actions()`):
    - "Space steps the stack when the action consumes it": handlers with `stepSelectedStrokeBackward: vi.fn(() => true)` -> action called once, `toggleRotoPlayback` NOT called, preventDefault once.
    - "Space falls through to playback when the action returns false": action called once, playback called once, preventDefault once.
    - "Space never steps on repeat, a modifier, or while playing": for `repeat: true`, `metaKey`, `ctrlKey`, `altKey`, `shiftKey`, and `isPlaying: true`, the action is NOT called and playback still receives the key.
    - The existing `[' ', {}, 'toggleRotoPlayback', undefined]` cell must remain green unchanged.

    `physicsPaintRotoScriptClipboard.test.ts` (new block; unique ids/playFrame):
    - "a reordered timeline survives the capture projection": record two live strokes, step the newest back, run `applyCurrentScript` with engine-1 groups in the ORIGINAL order — the aquarelle Apply port receives the stroke events in the NEW order.
    - "Dry keeps its timeline position in the projection": record a, Dry, b; step b back; the projected events are b, Dry, a.
  </behavior>
  <action>
    Test first, then implement this single end-to-end path. Do NOT touch the engine package in this task.

    0. Baseline once: `pnpm --filter efx-motion-editor run typecheck > /tmp/ujp-typecheck-baseline-full.txt; grep -c 'error TS' /tmp/ujp-typecheck-baseline-full.txt > /tmp/ujp-typecheck-baseline.txt`. The verify gate fails if the baseline file is missing.

    1. `aquarelleRecordState.ts`: add and export `sendAquarelleStrokeBackwardInScript(mutationId): boolean`. Resolve the entry through `recordedStrokeEntries`; refuse when missing, deleted, or absent from `payloadTimeline`. Walk backward from the entry's index for the nearest PRECEDING event that is a stroke, same `playFrame`, and not deleted — skip Dry events entirely. Refuse when none is found. Swap the two stroke events by index assignment (Dry events stay at their absolute indices; never splice, never touch `recordedOrder`, ticks, points, or the `recordedStrokes` Map insertion order — hit-testing walks that Map newest-last). Bump `aquarelleStrokesRevision` once and return true. Comment why Dry is skipped and why the Map order is untouched.

    2. `aquarelleStrokeSelection.ts`: add `beginAquarelleReorderEdit(mutationId: number): number | null`, mirroring `beginAquarelleMoveEdit` exactly — clear the drag signal, refuse while the shared in-flight guard is set, capture `before`, call the new reorder helper (null on refusal), capture `after`, store one record under the shared 10-entry cap. Keep the selection (the stroke still exists). Import the new helper from `aquarelleRecordState`.

    3. `physicsPaintStudioKeyboard.ts`: add optional `stepSelectedStrokeBackward?: () => boolean` to the actions interface with a doc comment (true = consumed Space). Insert one branch IMMEDIATELY BEFORE the existing Space -> playback branch: key is a single space, `!event.repeat`, no meta/ctrl/alt/shift, `!state.isPlaying`, the action exists, and it returns true -> `event.preventDefault()` and return. Never preventDefault before the action returns true; otherwise the existing playback branch keeps owning Space verbatim. Comment that this branch precedes playback and is mode+selection gated in the action.

    4. `physicsPaintRotoScriptClipboard.ts` `buildAquarelleEventsFromCapture`: keep the presence gate exactly (ANY captured chain member without a record -> undefined; a deleted member is skipped without tripping the fallback). While validating, collect the captured mutationIds into a Set. Replace the "project in capture order then merge Dry by recordedOrder" tail with ONE walk of `getRecordedAquarellePayloadTimeline()`: push each Dry event as-is; push a stroke event only when its `engine.mutationId` is in the captured Set and it is not deleted, projecting it through `aquarelleToStudioStroke(getRecordedAquarelleStroke(id))`. This makes the projection follow the live payload order (so a reorder persists) with Dry at its exact timeline position. Delete the old drys merge; do not change the persisted-script replay path or the undefined contract.

    5. `PhysicsPaintStudio.tsx`: import `beginAquarelleReorderEdit`. Add `handleAquarelleSendBackward = useCallback((mutationId: number) => ...)` right after `handleAquarelleMoveStroke`, mirroring its gates in the same order (physical mutation lock; `rotoScript.applying.peek() || rotoScript.mutationLocked.peek()`; `rotoTimelineModel.currentCell.peek().kind !== 'real'`; shared in-flight guard). Then: `const editId = beginAquarelleReorderEdit(mutationId)` and return on null; set the in-flight flag; capture `playFrame` from `launchContextRef`; `aquarelleResetSheetRef.current?.()`; `const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`. On success call `rotoMoveHistory.recordAquarelleScriptEdit(editId)` and clear the owned refusal/error surface; on failure call `restoreAquarelleEditSnapshot(editId, 'undo')` and surface the same message family with the fallback 'Could not re-apply the watercolor script — the stroke order was restored.'; always clear the in-flight flag in `finally`. Use the same deps array shape as the move handler (stable recorder, peek helpers, no wrapper object).

    6. `PhysicsPaintStudio.tsx` keyboard actions: add `stepSelectedStrokeBackward` next to `deleteSelectedAquarelleStroke`. Watercolor arm only in this task: when `activeModule.peek() === 'watercolor'`, require `aquarelleSelectMode.peek()` and a non-null `aquarelleSelectedStrokeMutationId.peek()`, call `handleAquarelleSendBackward(mutationId)`, and return true (consumed — even when the handler refuses on a lock or the stroke is already at the bottom, so Space never starts playback mid-stack-edit). Return false otherwise. End the action with `return false` for the not-yet-implemented brush arm; do not stub or call engine APIs that Task 2 adds. Peek-only reads; the Studio render body must not subscribe the select-mode or selection signals (the existing pin enforces this).

    Fixed points: delete, move, undo/redo, the Apply pipeline, and the persisted-script replay keep their current behavior; no script mutation or apply runs outside the handler after the key is consumed; the reorder never mutates stroke objects.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/view/aquarelleRecordState.move.test.ts src/components/physic-paint/view/aquarelleRecordState.delete.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/ujp-typecheck-task1.txt; test -s /tmp/ujp-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/ujp-typecheck-task1.txt)" -le "$(cat /tmp/ujp-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    - Space steps a selected watercolor stroke one payload position back, re-bakes through the shared Apply pipeline, and stays consumed in select mode with a selection.
    - Reorder plus re-bake is one `aquarelle-script` entry; undo/redo restore the index order; a stale restore fails closed; the selection survives.
    - Dry events keep their absolute timeline positions; points, ticks, recordedOrder, and the registry order are untouched.
    - The capture projection follows the live payload order, so Apply Script and save preserve the new stack.
    - Space still toggles playback when the action returns false, on repeat, with a modifier, or while playing.
    - Targeted suites pass; typecheck does not exceed the recorded baseline.
  </done>
</task>

<task type="tdd">
  <name>Task 2: Brush Move + Space — engine paint-order projection and step-back</name>
  <files>
    packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <behavior>
    Write `EfxPaintEngine.strokeReorder.test.ts` RED first, reusing the prototype harness shape from `EfxPaintEngine.moveTranslate.test.ts` (read it once; do not modify it) and adding `strokeStack: []` to the assigned object.

    - "paint order is acceptance order": paint A, B, C through the pointer path -> `getStrokes()` ids are A, B, C.
    - "sendStrokeBackward moves a stroke one step back": tool 'move', `sendStrokeBackward(C)` -> true; `getStrokes()` = A, C, B; exactly one completed mutation of kind 'move' carrying C's mutationId; `getHistoryAvailability().undo` unchanged; redo 0.
    - "each call is one step and the bottom refuses": a second call steps C again; the third returns false with the order unchanged and no mutation event.
    - "refuses outside the move tool and for unknown ids": tool 'paint' or an unknown id -> false, no mutation.
    - "the hover target survives so repeated presses step the same stroke": hover C, read `getMoveTargetMutationId()` = C, step twice, assert both steps moved C and the hover target is still C.
    - "continuations travel with their primary": craft `allActions`/`strokeStack` with primary-1, its zero-point continuation, primary-2; step primary-2 back -> primary-2, primary-1, continuation (the zero-point entry stays immediately after its primary).
    - "redrawAll replays in paint order": install an own-property wrapper over `applyStrokeToEngine` after painting, then step C back and assert the captured mutationId sequence is A, C, B.
    - "save and load keep the new order": `serializeProject().tracks[0].strokes` lists A, C, B; a fresh harness `loadProjectData` of that document yields A, C, B.
    - "undo/redo still work after a reorder": paint A, B, C, step C back, `undo()` then `redo()`; no throw, live stroke count is unchanged, and the paint order remains A, C, B.
  </behavior>
  <action>
    Implement the paint-order projection and the step, then wire the Studio brush arm. Do not reorder `allActions`.

    1. `EfxPaintEngine.ts` — projection field: add `private strokeStack: PaintStroke[] = []` next to `allActions` with a comment: paint/z-order projection of ledger object refs; the ledger keeps acceptance order because undo splices its suffix; rendering and serialization follow this projection; dead refs stay so undo -> redo restores a stroke's paint position.

    2. Add two private helpers. `liveStrokeStack()`: if `strokeStack` is not an array, seed it from `allActions` (prototype-based unit harnesses construct instances without field initializers); then append any `allActions` ref missing from the projection in ledger order (load path, redo ledger re-push) using a Set for membership; return the projection. `liveActionsInPaintOrder()`: return the projection filtered to refs still present in `allActions` (build a Set from `allActions`).

    3. Route every paint-order mutation through the projection:
       - `acceptStroke` (the `allActions.push(...actions)` site) also pushes the same actions onto `strokeStack`. Prefer one small private `pushAcceptedActions(actions)` helper used by BOTH push sites (accept and the physics placeholder push near `forceDry`) so the two arrays cannot drift.
       - `redrawAll`: replay `liveActionsInPaintOrder()` instead of indexing `allActions`; keep the queued-action COUNT math and the same skip semantics (queued strokes are the last accepted entries in both arrays; a reorder flushes first).
       - `serializeProject`: map strokes from `liveActionsInPaintOrder()`.
       - `getStrokes`: map from `liveActionsInPaintOrder()`; leave `getStrokeCount()` reading `allActions.length`.
       - `clear`: set `strokeStack` to an empty array.
       - `loadProjectData`: set `strokeStack` to a shallow copy of the freshly assigned `allActions` before `redrawAll()`.
       - Do NOT touch `undo`, `redo`, `removeWetIntersectedStrokes`, or the background-mode `allActions` filter; the liveness filter covers removed refs and the ledger order stays authoritative.

    4. Add public `getMoveTargetMutationId(): number | null` — returns `moveHoverTargetId` only when `state.tool === 'move'`, else null (one law: the hover target IS the brush "selected" stroke; there is no second selection state).

    5. Add public `sendStrokeBackward(mutationId: number): boolean`:
       - refuse when `state.tool !== 'move'`;
       - call `flushPendingStrokeFinalizations()` FIRST (the queued-tail math in `redrawAll` and the group walk both require settled entries; same reason as `commitMoveGesture`);
       - resolve the live paint order; find the primary by matching mutationId, tool 'paint', and non-zero points; refuse when absent;
       - compute the moving group as the primary plus every immediately following zero-point entry;
       - compute the previous group end by walking back over zero-point entries, then its start; refuse when the group is already first;
       - rewrite `strokeStack` to the live order with the moving group spliced before the previous group;
       - clear `redoStack` and notify history availability (a stale redo would repaint pre-reorder pixels — the move-commit law), set `displayCompositeDirty`, `redrawAll()`, `requestRender()`, `notifyCompletedMutation('move', mutationId)`, and keep `moveHoverTargetId` so a repeated press steps the same stroke; return true.

    6. `PhysicsPaintStudio.tsx` — replace the Task 1 `return false` tail of `stepSelectedStrokeBackward` with the brush arm: read `engineRef.current`; `getMoveTargetMutationId()` (null when the engine's tool is not Move or no stroke is hovered) — return false when null so playback keeps Space; otherwise call `sendStrokeBackward(mutationId)` unless `isPhysicalMutationLocked()`, and return true (consumed whenever move mode + a target hold, even when the step is refused). Keep the watercolor arm unchanged and keep all reads peek/ref-based.

    Fixed points: `allActions` order is never changed; undo/redo semantics are untouched; a move commit, erase, clear, background change, load, and save behave as before; only the paint order of strokes changes.
  </action>
  <verify>
    <automated>cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.strokeReorder.test.ts src/engine/EfxPaintEngine.moveTranslate.test.ts src/engine/EfxPaintEngine.redrawAllQueuedFinalizations.test.ts src/engine/EfxPaintEngine.erasePointerDelete.test.ts src/engine/EfxPaintEngine.documentFormat.test.ts</automated>
    <automated>pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint run check</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/ujp-typecheck-task2.txt; test -s /tmp/ujp-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/ujp-typecheck-task2.txt)" -le "$(cat /tmp/ujp-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    - In Brush mode with the Move tool and a hovered stroke, Space sends that stroke one paint step back and the canvas redraws in the new order.
    - Repeated presses keep stepping the same stroke; the bottom refuses without a mutation.
    - The ledger order, undo/redo, erase, clear, load, and move are unchanged; save serializes the new order and load restores it.
    - Continuations travel with their primary; the redo stack is cleared on a successful step; no undo checkpoint is pushed.
    - Engine test file green; package build and package typecheck clean; app typecheck within baseline.
  </done>
</task>

<task type="auto">
  <name>Task 3: Tooltips, Studio source pins, and the full gate report</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    1. Tooltips in `PhysicsPaintToolRail.tsx`: append ' · Space sends the hovered stroke one step back' to the Brush-mode Move tooltip, and ' · Space sends the selected stroke one step back' to the Water color Select title. Update both pinned strings in `PhysicsPaintStudio.test.ts` (the two rail assertions) to the new exact text.

    2. Add one `describe('261022-ujp stroke stack step')` block to `PhysicsPaintStudio.test.ts`, slicing handler/action source with `indexOf` and asserting order, not prose:
       - Keyboard: the Space stack branch appears BEFORE the playback branch; it contains the repeat guard, the four modifier guards, the not-playing guard, `stepSelectedStrokeBackward`, and the conditional preventDefault; the playback branch still contains `toggleRotoPlayback`.
       - Studio action: `stepSelectedStrokeBackward` exists; the watercolor arm checks the module, `aquarelleSelectMode.peek()`, and `aquarelleSelectedStrokeMutationId.peek()`; the brush arm calls `getMoveTargetMutationId` and `sendStrokeBackward`; the Studio render body still has no `.value` read of the select-mode or selection signals.
       - `handleAquarelleSendBackward`: `beginAquarelleReorderEdit` is called before `aquarelleResetSheetRef.current?.()`; the awaited `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` precedes the success branch; `recordAquarelleScriptEdit(editId)` sits inside that branch; `restoreAquarelleEditSnapshot(editId, 'undo')` appears after it; the in-flight flag is cleared in a `finally`; it does not capture the engine or the clipboard.
       - Record state: `sendAquarelleStrokeBackwardInScript` exists, swaps by index assignment, skips Dry, and does not mention `setAquarelleStrokeDiffusionFrames` or `deleteAquarelleStrokeFromScript`.
       - Engine: `strokeStack` is declared, both accepted-action push sites feed it, `redrawAll` and `getStrokes`/`serializeProject` use the paint-order helper, `clear` resets it, `loadProjectData` reseeds it, and `sendStrokeBackward` clears `redoStack` and fires the move mutation.
       - The existing 261022-pim / 261022-tv1 pins still hold unchanged.

    3. Gates and report: run the targeted suites, then the full app suite once and the full package suite once. Known pre-existing app failures are allowed ONLY for these five files (baseline unchanged by this quick): PhysicsPaintRightSidebar, PhysicsPaintWorkflowStrip.viewport, efxPaintCompositorMatrix, exportEngine, paperPass.frameGuard. Any other failing file — especially in physic-paint view/engine/roto/hooks or the engine package — fails this task. Run the package build before the app typecheck (the app reads dist types). Record counts and the live UAT rows as PENDING in the SUMMARY; do not mark the quick complete before the user confirms them.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts</automated>
    <automated>pnpm --filter @efxlab/efx-physic-paint build && cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run > /tmp/ujp-full-suite.txt 2>&1; grep -qE '^[[:space:]]*Test Files' /tmp/ujp-full-suite.txt && ! grep -E '^[[:space:]]*FAIL[[:space:]]' /tmp/ujp-full-suite.txt | grep -vE 'PhysicsPaintRightSidebar|PhysicsPaintWorkflowStrip\.viewport|efxPaintCompositorMatrix|exportEngine|paperPass\.frameGuard' | grep -q .</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/ujp-typecheck-task3.txt; test -s /tmp/ujp-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/ujp-typecheck-task3.txt)" -le "$(cat /tmp/ujp-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    - Both rail tooltips name the Space step and their pins match.
    - The new pins prove branch ordering, the mode+selection gate, the handler ordering (begin -> reset -> await apply -> record on success -> rollback on failure), the engine projection wiring, and the peek-only Studio reads.
    - Target suites green; full package suite green; full app suite shows no failure outside the five-file allowlist; both typechecks within baseline.
    - SUMMARY records exact counts and the live UAT rows as PENDING.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard -> stroke identity | Space resolves a keystroke to a selected/hovered stroke and mutates its stack position. |
| gesture -> script/apply lifecycle | A watercolor step mutates the recorded script and starts an async re-bake while move/delete/undo/apply may be racing. |
| paint order -> ledger | The engine's render/save projection diverges from the undo ledger; a drift would paint or save the wrong stroke on top. |
| save/load -> projection | Serialized order round-trips through disk; a capture-order projection would silently undo the user's stacking. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ujp-01 | Tampering | Space -> stroke identity | high | mitigate | The key is consumed only with the Move/Select mode active AND a concrete target (watercolor selected mutationId; engine hover target). Reorder helpers refuse unknown, deleted, and other-frame ids; the watercolor helper re-resolves the entry in the live map at press time. |
| T-ujp-02 | Tampering | Watercolor reorder + delete/move/apply race | high | mitigate | Reorder shares the one script-edit in-flight guard and the same Studio gates as move/delete (physical lock, apply/mutation lock, real cell); before/after snapshots are revision-authoritative; a failed re-bake restores the previous order and surfaces the refusal message. |
| T-ujp-03 | Tampering | Engine ledger/projection drift | high | mitigate | `allActions` order is never changed; the projection appends on accept and is filtered to live refs for render/save; `clear` and `loadProjectData` reseed it; undo/redo, erase, and move tests run unchanged; the engine test asserts replay order and a save/load round trip. |
| T-ujp-04 | Tampering | Save/load loses the reorder | high | mitigate | The aquarelle capture walks the live payload timeline (Dry included) instead of engine capture order; the engine serializes the paint-order projection; both are pinned by tests. |
| T-ujp-05 | Denial of Service | Key auto-repeat replay storm | medium | mitigate | `event.repeat` is refused; one step per physical press; each watercolor step performs one bounded re-bake and each brush step flushes pending finalizations before one redraw. |
| T-ujp-06 | Repudiation | Silent refusal on a blocked step | low | mitigate | Watercolor refusals/failures reuse the delete/move refusal family and roll the order back; the brush path consumes Space in move mode so a refused step never starts playback unexpectedly. |
| T-ujp-SC | Tampering | npm/pip/cargo installs | high | mitigate | No installs in scope; no dependency or package-format change is authorized by this plan. |
</threat_model>

<verification>
- Targeted app suites: reorder record-state, keyboard dispatcher, clipboard capture, delete, move, selection — all pass.
- Engine suite: new stroke-reorder file plus moveTranslate, redrawAllQueuedFinalizations, erasePointerDelete, documentFormat — all pass; full package suite green; package build + package typecheck clean.
- App typecheck does not exceed the baseline recorded before Task 1's edits.
- Full app suite: no failure outside the recorded five-file pre-existing allowlist.
- Source pins prove branch ordering, the gate set, handler ordering, capture ordering, and peek-only Studio reads.
- Live UAT (user-run, the only completion signal): 1) Watercolor: select a stroke, Space -> progress pill -> stroke is behind the older one; Cmd+Z restores it; 2) Brush: Move tool over a stroke, Space -> redraw with the stroke behind; repeat Space steps again; 3) Space still plays/stops everywhere else. Report automated-ready until the user confirms all three.
</verification>

<success_criteria>
- Watercolor: Space with a stroke selected in Select/Move mode swaps that stroke one payload position back, re-bakes through the shared Apply pipeline, and keeps the selection; reorder + re-bake is one undo step and survives save/Apply Script.
- Brush: Space with the Move tool over a stroke sends it one paint step back, redraws like a move commit, keeps the hover target, and never reorders the undo ledger; undo/redo continue to work.
- Space remains the playback toggle when not in move/select mode, with no target, with a modifier, on repeat, or while playing.
- Both rail tooltips name the shortcut; all automated gates are green within their baselines; live UAT rows are reported PENDING.
</success_criteria>

<output>
Create `.planning/quick/261022-ujp-feat-with-move-tool-for-brush-or-waterco/261022-ujp-SUMMARY.md` when done, recording the automated results and the three live UAT rows as PENDING until the user confirms them.
</output>
