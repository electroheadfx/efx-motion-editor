---
phase: 61-vector-painting-tool
reviewed: 2026-11-10T18:10:32Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathSession.ts
  - packages/efx-watercolor/src/payload/vectorPath.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/vector/spine.ts
  - app/src/types/project.ts
findings:
  critical: 6
  warning: 5
  info: 3
  total: 14
  necessity: 1
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-11-10T18:10:32Z
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Adversarial deep review of the Phase 61 "Vector Painting Tool" implementation, scoped to the 15 files above and cross-checked against the phase plans, `61-UI-SPEC.md` and the shipped seams they extend.

Confirmed sound (no finding): the AQTL version law (`scriptTimelineCodec.ts:964-968` refuses every version other than 2, no v1 reader, plus body-length, trailing-byte and summed-point-count reconciliation); the C-03 trap (the `scriptScale` clamp at `Engine.ts:888` still carries no width, `scriptWidthFactor` bounds `Sample.w` to 0.2..2, and `sizeMult` at `Engine.ts:1620` multiplies the factor AFTER `scriptScale`; the ribbon branch is selected explicitly at `Engine.ts:1804`); the spine/handle math and the nearest-sample width mapping in `packages/efx-watercolor/src/vector/spine.ts`; the fail-closed payload normalisation in `packages/efx-watercolor/src/payload/vectorPath.ts`; the absence of any persistence of the wireframe/Draft session latches; Rust/TS declaration parity in `app/src-tauri/src/models/project.rs` vs `app/src/types/project.ts`; and that no runtime dependency was added.

The six blockers below cluster in the two seams the plans treat as load-bearing but which no test exercises end-to-end: the overlay's gesture surface (pointer and keyboard) and the draw/edit commit path into the bake. Four of them are reachable on the first ordinary interaction with the pen or with an open path edit.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Path-edit drags never capture the pointer — releasing outside the overlay silently loses the edit

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:746-815` (start), `:852-874` (finish/cancel), `:876-891` (root div handlers)

**Issue:** `startEditDrag` opens an anchor or a handle drag by writing `dragRef.current` and `vectorPathEditDrag.value`, but never calls `setPointerCapture`. The only `pointerup` / `pointercancel` handlers that can finish the gesture are the root `<div>`'s props (`:890-891`); the overlay registers no window-level pointer listener at all (its only `addEventListener` is the capture-phase `keydown` at `:606`). If the pointer is released outside the overlay rectangle — over the tool rail, over the floating Stroke Settings sheet, or outside the window — the browser dispatches `pointerup` to a different element, `finishEditDrag` never runs, and both `dragRef` and `vectorPathEditDrag` stay live. Consequences: the gesture produces **zero undo entries for a non-zero edit** (direct violation of the phase's one-gesture-one-entry law), the anchor/handle preview keeps following later hovers, and the next press starts a new drag from a `drag.moved` state it never asked for. The shipped `ScriptStrokeOverlay` captures for exactly this reason (`ScriptStrokeOverlay.tsx:200`, `:252`, release at `:300-321`).

**Fix:** capture on press in both branches of `startEditDrag`, release on both exits:

```ts
// in startEditDrag, before returning from each branch
const target = event.currentTarget as HTMLElement;
if (target.setPointerCapture && !target.hasPointerCapture?.(event.pointerId)) {
  target.setPointerCapture(event.pointerId);
}
// in finishEditDrag / cancelEditDrag, before clearing the ref
try { (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
```

`onPointerCancel` must remain wired as the backstop. Add a test that starts a drag, dispatches `pointerup` on `document.body`, and asserts exactly one `onPathEdit` call.

#### CR-02: Un-guarded window capture-phase key listener mutates the path from inside dialog inputs

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:597-611` (listener), `:214-229` (`handleVectorPathKey`), `:244-269` (`handleVectorPathEditKey`)

**Issue:** While the pen is latched or a path edit is open, the overlay binds `keydown` on `window` in the **capture** phase and neither handler checks the event target. `handleVectorPathKey` treats `Enter`/`Escape` as "finish/cancel the draft" whenever a draft exists; `handleVectorPathEditKey` treats `Delete`/`Backspace` as "delete the selected anchors" whenever an anchor selection exists, then calls `preventDefault`/`stopPropagation` and commits an undoable edit. Both are reachable from ordinary dialog typing: path edit is entered from the Stroke Settings sheet, whose `SliderStepper` fields (`allowOutOfRangeEntry`, e.g. Size and the new Anchor width) are text inputs. Select an anchor on the canvas, click into the width field, press Backspace to correct the number → the selected anchor is deleted from the stroke and an edit is stored. Typing Enter in any Studio text field while a draft is pending finishes the path. The shipped dispatcher guards every equivalent shortcut with `isPhysicsPaintShortcutTarget` (`physicsPaintStudioKeyboard.ts:110-116`); this one does not.

**Fix:** bail out before either handler runs when the event target is a text entry surface:

```ts
const target = event.target as HTMLElement | null;
if (target && (target.isContentEditable
  || target.closest('input, textarea, select, [contenteditable="true"]'))) return;
if (event.isComposing) return;
```

Reuse `isPhysicsPaintShortcutTarget` if it is importable without a cycle; otherwise extract that predicate to a shared leaf module.

#### CR-03: Wireframe ON and Draft OFF can coexist — Select and Shift+A escape the Draft suppression

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:209-220`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2692-2700`, `:2709-2719`; `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:355`; `app/src/components/physic-paint/view/scriptStrokeEdition.ts:157-161`; capture gate `PhysicsPaintStudio.tsx:5992`; settle early return `:5382`

**Issue:** `setWireframeMode(true)` (`scriptStrokeEdition.ts:185-189`) forces Draft ON, which is the D-16 mechanism. But the three Select entry points are not wireframe-gated — the rail Select button is disabled only by `railDisabled || !selectAvailable.value`, and bare `A` / Shift+A reach `setAquarelleSelectMode(true)` with no `wireframeMode` check — and `setAquarelleSelectMode` calls `setDraftMode(false)` on the off→on edge (`aquarelleStrokeSelection.ts:355`). `setDraftMode` only refuses to leave while `draftPixelsDirty` is set (`scriptStrokeEdition.ts:157-161`); entering wireframe forces Draft ON while the sheet is clean, so the refusal does not trigger and Draft turns **OFF under wireframe**. Effects: (a) the Stroke Settings Draft switch renders OFF + disabled, contradicting `61-UI-SPEC.md:325` ("forces the Draft switch ON and disabled"); (b) the capture gate `!draftMode.peek()` at `PhysicsPaintStudio.tsx:5992` now passes, so pixels can be captured and strokes re-baked (move/transform/delete take their Live branch) while wireframe is on — the exact D-16 prohibition; (c) when the user turns wireframe OFF, `runWireframeOffTransition` hands the settle to `settleDraftScript`, which early-returns at `:5382` because Draft is already off and pixels are not dirty, so the promised re-bake never runs.

**Fix:** make the Draft suppression authoritative rather than caller-discipline. Two minimal changes:

```ts
// scriptStrokeEdition.ts — Draft cannot leave while the wireframe latch is on
export function setDraftMode(on: boolean): void {
  if (!on && (draftPixelsDirty.value || wireframeMode.peek())) return;
  ...
}
```

and gate the Select entries on wireframe (`disabled={railDisabled || wireframeActive || !selectAvailable.value}`, plus `if (wireframeMode.peek()) return;` in `handleToggleAquarelleSelect` / `handleToggleSelectAllAquarelleStrokes`), matching the existing paint-tool and picker gates. Add a regression test for the wireframe→Select→Draft sequence.

#### CR-04: A drawn vector path and every path edit are recorded but never baked

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:495-509`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8624-8742` (stroke end), `:10044-10056` (path edit); reference implementations at `:8879-8974` (move) and `:9064-9127` (render mode)

**Issue:** `handleVectorCommit` builds a `StudioStroke` and forwards it to the existing `onStrokeEnd` seam. `handleAquarelleStrokeEnd` then only records it (`recordAquarelleStrokeWhenEnabled` at `:8707`, `applyFrameModuleState`, the lift arm) — it never paints, because every shipped caller relies on the engine having painted live during the gesture. A vector stroke has no live gesture in the engine: the overlay only draws its spine, so after commit the stroke exists in the script and in the overlay chrome but **no pigment exists on the live sheet**, and nothing triggers a replay. Synchronously after drawing, the frame is visually unchanged; the path only appears at the next unrelated settle / frame-leave / reopen. `handleAquarelleVectorPathEdit` is worse: it calls `beginAquarellePathEdit` and returns, with no `ensureAquarelleDurableBaseRef`, no `setDraftPixelsDirty(true)` in Draft, and no reset + `applyAquarelleTimeline` in Live — so a drag moves the overlay spine while the painted sheet keeps the old shape. This contradicts `beginAquarellePathEdit`'s own docblock ("path update + its re-bake = ONE aquarelle-script ledger command", `aquarelleStrokeSelection.ts:912-919`) and `61-09-PLAN.md:51-63`. A second consequence: with Script Off, `recordsScript` is false, so a drawn path is neither recorded nor painted — the pen becomes a silent no-op with no feedback, unlike every other tool.

**Fix:** give both commit seams the same shape as `handleAquarelleMoveStrokes`:

```ts
await ensureAquarelleDurableBaseRef.current(playFrame);
const draft = draftMode.peek();               // AFTER the await (WR-03 precedent)
const editId = beginAquarelleVectorCommit(...); // record + ledger
if (editId === null) return;
if (draft) { recordAquarelleScriptEdit(editId); setDraftPixelsDirty(true); return; }
setAquarelleScriptEditInFlight(true);
try {
  aquarelleResetSheetRef.current?.();
  const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
  if (!ok) { restoreAquarelleEditSnapshot(editId, 'undo'); /* refusal message */ }
} finally { setAquarelleScriptEditInFlight(false); }
```

A newly drawn stroke needs the same replay (or a direct single-stroke paint) so the committed path is visible immediately.

#### CR-05: The path-edit target can diverge from the selection — Anchor width then writes to the wrong stroke

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/view/strokeSettingsModel.ts:839-866`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:11388-11410`; `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:532-548`, `:1669-1717`

**Issue:** `resolvePathEditGate` derives `enabled` from the selection only (`selectionSize === 1 && vectorStrokeCount === 1`) and `shouldExitPathEdit` only compares `pathEditActive && !gateEnabled`. Neither compares the path-edit target id with the selected id. Selecting another vector stroke while a path edit is open therefore keeps the gate enabled (1 selection, 1 vector stroke) and the lifecycle effect (`deps [open, bundle, pathEditGateEnabled]`) never re-runs, so the edit on stroke A stays open. The dialog then resolves `selectedVectorAnchors` from the **current selection B** while the anchor selection indices in `vectorAnchorSelection` come from the canvas session on **A**, and `applyAnchorWidths` (`PhysicsPaintStudio.tsx:11398-11410`) commits those indices onto B via `beginAquarellePathEdit(ids[0]!, next)`. The result is a wrong-target mutation stored as a normal undo entry, with no refusal and no visible cue (path edit's own chrome stays on A, so the user believes they are editing A). Closing the sheet is the only exit the user is likely to find.

**Fix:** make `shouldExitPathEdit` target-aware:

```ts
export interface PathEditExitArgs {
  readonly pathEditActive: boolean;
  readonly gateEnabled: boolean;
  /** String(form) of the stroke the open path edit targets. */
  readonly pathEditTarget: string | null;
  readonly selectedMutationId: number | null;
}
export function shouldExitPathEdit(args: PathEditExitArgs): boolean {
  if (!args.pathEditActive) return false;
  if (!args.gateEnabled) return true;
  return args.selectedMutationId === null
    || args.pathEditTarget !== String(args.selectedMutationId);
}
```

and pass `pathEditMutationId.value` plus `selectedMutationId` from the dialog. Alternatively re-target the width commit to the path-edit target instead of the selection, but the exit is the safer law.

#### CR-06: Select entry does not release the vector pen — both surfaces stay latched and the overlay swallows selection clicks

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:209-220`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2692-2700`; `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:330-360`; `app/src/components/physic-paint/view/vectorPathSession.ts:105-121`; `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:647-649` (surface ownership), `:103` (z-index 41 vs the select overlay's 40)

**Issue:** the mutual-exclusion direction that the code documents ("the four input surfaces are mutually exclusive", `PhysicsPaintToolRail.tsx:154-155`) is implemented in only one direction: `enterVectorPen` clears Select, the picker and path edit, but neither `setAquarelleSelectMode(true)` nor `handleToggleAquarelleSelect` / `handleToggleSelectAllAquarelleStrokes` calls `exitVectorPen()`. With the pen latched, pressing Select (or `A`, or Shift+A) leaves **both** latched. `drawInteractive` is still true, the vector overlay is at a higher z-index than the stroke-selection overlay, and its root div keeps `pointerEvents: 'auto'`, so every canvas click appends a draft anchor instead of selecting a stroke: the Select button renders amber but the surface is inert, and a stray draft geometry is accumulated. The stale draft then survives the tool switch (`exitVectorPen` deliberately leaves the draft alone, `vectorPathSession.ts:113-115`) and commits when the pen is re-latched and Enter is pressed.

**Fix:** centralise entry in one direction-agnostic helper, or minimally add `exitVectorPen()` at the top of `setAquarelleSelectMode` when `on && !was` (it is already the single choke point for Select entry, and it must run before `setScriptSelectMode` for the same early-return reason the Draft reset does). Also decide the draft's fate on a paint-tool press; see WR-05.

### Warnings

#### WR-01: `VectorDrawDraft.cursor` is written and never read — dead session state

**Severity:** WARNING
**Category:** necessity
**File:** `app/src/components/physic-paint/view/vectorPathSession.ts:31-34`, `:138-143`, `:146-156`; no production reader anywhere else

**Issue:** `beginVectorDraft` and `appendVectorDraftAnchor` both write `cursor: { x: anchor.x, y: anchor.y }`, and the field is read only by `vectorPathSession.test.ts:139/144` (which asserts the value it just wrote). The overlay's render body reads `draft.anchors` only (`VectorPathOverlay.tsx:573`, `:634-642`). This is state with no consumer — the written value is also degenerate (it always equals the last anchor, so it could not drive a rubber band even if a reader existed). It is needed only if the missing rubber band (WR-02) is implemented; otherwise it should be deleted rather than carried as a phantom field.

**Fix:** either delete `cursor` from `VectorDrawDraft` and its two write sites, or implement WR-02 against it and update the tests to assert a distinct cursor position.

#### WR-02: Draw mode has no live rubber-band spine to the cursor

**Severity:** WARNING
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:889` (`onPointerMove` bound only for `editInteractive`), `:634-642` (draft path built from anchors only)

**Issue:** `61-UI-SPEC.md:287` specifies that in draw mode the canvas shows "anchors placed so far + a live rubber-band spine to the cursor". The overlay binds `onPointerMove` only when `editInteractive`, so while drawing, the rendered `draftPath` is just the polyline through the already-placed anchors; nothing follows the pointer between clicks. `61-UI-REVIEW.md:21/31/108` already records this as missing in the live UI. The dead `cursor` field (WR-01) shows where the intent was lost.

**Fix:** bind a draw-mode pointermove that only updates the draft's cursor (never the anchors), and render one extra span from the last anchor to the cursor through `projectVectorPath` so the preview matches the committed handle law.

#### WR-03: Encoder lookup tables accept inherited `Object.prototype` keys — the fail-closed checks can be bypassed

**Severity:** WARNING
**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:498-502`, `:537-543`, `:561`

**Issue:** `VECTOR_KIND_CODE` and `VECTOR_RENDER_MODE_CODE` are plain object literals, so `VECTOR_KIND_CODE['toString']` (or `'constructor'`, `'__proto__'`) resolves to an inherited function, not `undefined`. The guards `if (kindCode === undefined) fail(...)` and `if (VECTOR_RENDER_MODE_CODE[renderMode] === undefined) fail(...)` therefore pass, and `writer.u8(<function>)` coerces to 0 — silently encoding `auto` / `watercolor` instead of refusing. The same shape exists at the pre-existing `TOOL_CODE_BY_NAME[engine.tool]` (`:574`). Today every caller feeds normalised anchors, so this is a defense-in-depth hole at the persistence boundary, not a live corruption path — but it is exactly the kind of input the codec exists to reject.

**Fix:** use null-prototype tables (`const VECTOR_KIND_CODE = Object.assign(Object.create(null), { auto: 0, bezier: 1 })`) or `Object.hasOwn(VECTOR_KIND_CODE, kind)` before reading.

#### WR-04: The codec's anchor width domain is inconsistent with the payload's — a decoded out-of-domain width silently strips the whole path

**Severity:** WARNING
**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:507-509` (encode), `:777-778` (decode); payload domain at `packages/efx-watercolor/src/payload/vectorPath.ts` (`canonicalAnchor`, width 0.2..2)

**Issue:** the encoder asserts only `assertFinite(width)` and the decoder likewise accepts any finite f32, while the payload layer refuses anything outside 0.2..2. An out-of-domain width therefore round-trips through AQTL "successfully" and then fails `normaliseAquarelleAnchors` at restore, where `aquarelleRecordState.ts:1600-1604` deliberately **omits the malformed anchor list**: the stroke comes back as a hand-painted stroke, its path silently disappears, and it can no longer be path-edited or re-exported as a vector. The domain is validated on neither side of the persistence boundary that the payload layer treats as authoritative.

**Fix:** enforce `width >= 0.2 && width <= 2` in `encodeAnchor` (fail `invalid-value`) and in `decodeAnchor` (fail `invalid-value`), importing the constants from the payload module so the two domains can never drift.

#### WR-05: The draw draft is not tied to its origin frame or tool — it survives navigation and commits onto whatever frame is current

**Severity:** WARNING
**File:** `app/src/components/physic-paint/view/vectorPathSession.ts:113-115`, `:146-161`; commit seam `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:495-509` (`playFrame: getPlayFrameRef.current()`)

**Issue:** neither frame navigation, track switching, nor a paint-tool press clears the draft (`exitVectorPen` explicitly leaves it, and `clearVectorDraft` is documented as "a tool toggle deliberately does not" drop it). A user who starts a path, presses `B` (or navigates to another frame) and later re-latches the pen and presses Enter commits a stroke whose anchors were drawn on a different frame — `handleVectorCommit` stamps the **current** play frame. In the meantime the stale draft keeps rendering as non-interactive chrome (`draftPath !== null` defeats the overlay's null return at `:640-642`), so the canvas carries phantom anchors with no way to tell where they will land.

**Fix:** record the origin frame in `VectorDrawDraft` and either refuse the commit when `getPlayFrameRef.current()` differs or clear the draft on frame/track change. Clearing on any `exitVectorPen` call is the simplest coherent law; if the draft must survive a tool switch, tie it to `(frame, track)` identity.

### Info

#### IN-01: Two different `projectVectorPath` functions in the same feature

**Severity:** INFO
**File:** `app/src/components/physic-paint/view/vectorPathHandles.ts:329-350` vs `packages/efx-watercolor/src/payload/vectorPath.ts:207-218`

**Issue:** the view module exports `projectVectorPath(anchors, width, height, options)` (screen-space geometry) while the payload module exports `projectVectorPath(anchors)` (payload projection that drops an exact-1 width). Both are imported across the feature, and a future import mix-up compiles cleanly while changing semantics (screen-space callers would receive anchors, payload callers would receive geometry).

**Fix:** rename the geometry helper (`projectVectorPathToScreen`) or the payload one (`projectVectorPathPayload`).

#### IN-02: `updateAquarellePathInScript` silently coerces an unknown render mode to watercolor

**Severity:** INFO
**File:** `app/src/components/physic-paint/view/aquarelleRecordState.ts:1005`

**Issue:** `nextMode = renderMode === undefined ? currentMode : resolveAquarelleRenderMode(renderMode)` is a lenient fallback, unlike every other input on this path (`normaliseAquarelleAnchors` fails closed). No current caller passes an unvalidated mode — `beginAquarellePathEdit`'s callers all derive it from a validated source — so this is latent, but a future caller passing a stale string would silently flip a `simple-ribbon` stroke to watercolor inside an otherwise normal undo entry.

**Fix:** fail closed (`return 0` or throw) when `renderMode !== undefined && !isAquarelleRenderMode(renderMode)`.

#### IN-03: Non-wireframe chrome is drawn for every recorded vector stroke regardless of tool state

**Severity:** INFO
**File:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx:613-632` (all strokes of the play frame), `:344-352` (envelope in the accent colour), `:392-412` (accent spine for every path)

**Issue:** whenever the current frame holds any vector stroke, the overlay renders each one's spine, anchors and handles — including the `#38bdf8` accent spine that `61-UI-SPEC.md:157` reserves for "the selected spine and the auto-smooth anchor. Never chrome." With no tool armed this is inert visually noisy chrome over the painting; the spec describes these marks only for draw mode, the spline-pointer edit state, and wireframe. Either the persistent chrome is intended (then the accent reservation needs restating) or the render should gate on `penActive || editInteractive || wireframe`.

**Fix:** confirm intent with the UI review; if unintended, gate `renderPath` for non-selected, non-wireframe strokes.

---

_Reviewed: 2026-11-10T18:10:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
