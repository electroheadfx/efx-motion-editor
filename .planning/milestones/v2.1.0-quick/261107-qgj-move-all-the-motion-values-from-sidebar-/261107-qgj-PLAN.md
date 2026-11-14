---
phase: 261107-qgj-move-all-the-motion-values-from-sidebar-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/floatingSheetStack.ts
  - app/src/components/physic-paint/view/floatingSheetStack.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
autonomous: true
requirements: [QUICK-261107-QGJ]
user_setup: []

estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Selecting a Motion property in the pinned channel header opens a floating Motion modal; selecting a Motion key with no property selected opens the same modal with the key semantics. Closing it (header X or Escape) clears the property selection AND any Motion-key selection, and the paint tool that was active before and during animate mode is still the active tool."
    - "The modal lists exactly the channels present on the rail (`present === true`) in the fixed D-13 order, with their labels, units and display values; absent channels render no row, no 'not added' marker and no absent note."
    - "Animate mode reads and writes at the playhead's rail-local frame (the same frame the canvas gizmo commits to); the Motion-key path keeps the 59-16 law (read and write at the selected key's frame). A write creates or updates a key through the existing Motion command and is one store commit / one undo step."
    - "A rejected entry shows the command layer's sentence verbatim in a single role='alert' and writes nothing; the modal never authors the reason itself."
    - "No Scripts-panel branch (normal, Key Rail, Loop Clip) renders motion values any more; the panel carries no motion props, no motion transient state, no motion copy and no NumericStepper import."
    - "The Motion modal is a fourth floating sheet: it raises itself when it opens and on any press inside, takes its z-index from the shared stack, fronts over Settings, releases its id when closed, and Escape is front-only with the shared editable-input guard."
  artifacts:
    - path: "app/src/components/physic-paint/view/floatingSheetStack.ts"
      provides: "SHEET_ID_RAIL_MOTION ('rail-motion') appended to the four-sheet order (initial z 50/51/52/53)"
    - path: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts"
      provides: "projectRailMotionInspectorAtFrame (animate-mode projection at any rail-local frame) and the RailMotionDialogBundle contract; one shared field-mapping helper for both projections"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "the railMotionDialog computed (open condition, precedence, frame law), commitRailMotionInspectorValue (frame-bound write) and clearRailMotionSelection (the ONE close path)"
    - path: "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx"
      provides: "the props-driven floating Motion dialog: present-only numeric fields, one rejection alert, sheet mechanics (raise, front-only Escape, release, session drag/resize)"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "the one close callback (clearRailMotionSelection) and the dialog/view-model wiring"
    - path: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx"
      provides: "the Scripts panel with the entire motion inspector removed from all three branches"
  key_links:
    - "property header click -> toggleRailMotionChannelSelection (unchanged) -> railMotionSelectedChannel -> railMotionDialog computed -> the modal reads the signal in its OWN render body -> present-only fields."
    - "field edit -> bundle.commit(channelId, uiValue) -> commitRailMotionInspectorValue -> writeRailMotionChannelValueAtCursor -> setMotionKeyAtCursor -> commitRailMotionRecords (the ONE store door; grouped Position pair atomic)."
    - "header X and Escape -> the same close() -> onClose -> rotoTimelineActions.clearRailMotionSelection -> exitRailMotionEditing() + selectMotionKey(null)."
    - "closeSheetIfFront(SHEET_ID_RAIL_MOTION, close) -> releaseSheet -> the front falls back to the next open sheet, so sibling Escape handlers stay live."
    - "closing writes nothing to the paint tool: animate mode never changed it, so clearing the channel restores the already-selected brush/watercolor tool."
---

<objective>
Move every Motion numeric value out of the right-sidebar Scripts tab into a floating Motion modal opened by the animate-mode property selection (and by a Motion-key selection), and delete the retired inspector from all three Scripts-panel branches.

Purpose: quick UX request against the shipped v2.1.0 motion surface on branch `gsd/phase-59-rail-motion-channels-v7-interface`. The 59-16 inspector is buried in the sidebar Scripts pane, where it competes with the script list and cannot be reached while the user works on the timeline. Selecting a property in the pinned channel header is the animate-mode entry point; that is the moment the values should appear. Closing the modal must also leave animate mode and return the canvas to the paint tool the user already had selected.

Decision contract (exact, load-bearing):
- Open condition: `railMotionSelectedChannel !== null` (property selected = animate mode) OR `railMotionSelectedKey !== null` (a Motion key is selected), on the active track's resolved rail. Property mode takes precedence when both are set.
- Frame law: property mode reads and writes at `state.localCursorFrame` (the playhead's rail-local frame — the same frame the canvas gizmo commits to). Key mode keeps the 59-16 law: read and write at the selected key's `frame`. The bundle binds the displayed frame, so a typed value always writes where it was read.
- Channel law: the modal renders only fields with `present === true`; absent channels are invisible (no ghost row, no 'not added', no absent note). A rejection that still reaches the commit (stale bundle, out-of-domain number) is shown verbatim in one role="alert".
- Close law: ONE path clears the property selection (`exitRailMotionEditing()`), clears the Motion-key selection (`selectMotionKey(null)`) and therefore returns to the previously selected paint tool. Header X and front-only Escape call that same path.

Scope note: the props-driven law matches the sibling sheets — the modal imports no store and reads only the `dialog` signal and its own callbacks. `workflow.tdd_mode` is on: Task 1 is RED-first (`type="tracer" tdd="true"` with `<behavior>`); Task 2 is deletion with its source pins; Task 3 adds the sheet mechanics and the full regression.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Verified anchors at HEAD 346890e51 (the only baseline this plan changes):

- Retired inspector — `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`: copy constants 20-22, props 31-42, destructuring 67-68, transient signal + clearing effect 122-139, `commitMotionValue`/`motionValuesSection` 184-252, branch injections at 270 (Key Rail), 295 (Loop Clip) and 332 (normal). `signal` (4), `NumericStepper` (13), `PhysicPaintRotoRailMotionChannelId` (12) and `RailMotionInspectorPresentation` (11) are used only by that block; `SelectedKeyRailInspectorPresentation` and `PhysicsPaintLoopClipPresentation` stay.
- Studio consumers — `PhysicsPaintStudio.tsx`: `projectRailMotionInspector` import 144, `selectedMotionKeySelection` + `railMotionInspector` memo 4978-4988, `railMotionInspector` memo dep 7303, scripts bundle entries 7396-7400. Motion imports 92-94 (`exitRailMotionEditing`, `railMotionSelectedChannel`); `handleToggleMotionBoundaries` 7015; `rotoTimelineActions` created 3192; view model assembled 11166-11176 and rendered 11396.
- Pure projection — `physicsPaintKeyRailPresentation.ts`: `RailMotionInspectorPresentation`/field types 161-184, input 186-193, labels/units 195-209, `projectRailMotionInspector` 217-250 (returns null without a key at the selection; stored value at a key frame, evaluator value otherwise). `railMotionValueToUi` is the one display conversion.
- Write path — `railMotionCommands.ts`: `writeRailMotionChannelValueAtCursor` 1164-1198 validates presence/domain and delegates to `setMotionKeyAtCursor` 407-454, which creates or updates a key at ANY rail-local frame and writes the grouped Position sibling atomically. `useRotoTimelineActions.ts`: `readActiveRailMotionState` 2184-2259 (returns `localCursorFrame`), `railMotionSelectedKey`/`selectRailMotionKey` 2267-2278, current `commitRailMotionChannelValue` 3029-3062 (writes at `selection.frame`), bundle field 1462-1465, bundle object 4613-4689, return 4698-4706.
- Sheet stack — `floatingSheetStack.ts`: union 15, ids 21-23, INITIAL_ORDER 25-29, base z 50, `bringSheetToFront`/`releaseSheet`/`isFrontSheet`/`closeSheetIfFront`. Current tests pin three sheets at `floatingSheetStack.test.ts` 36-96, the front-only block 103-138 (the handler list at 123-137 must become four), and `PhysicsPaintBrushPicker.test.ts` z pins at 363 (51), 370 (52), 391 (52), 404 (52), 414 (51), 420 (52).
- Modal template — `PhysicsPaintSettingsModal.tsx`: session drag/resize signals 48-54, seat constants 56-62, SURFACE_STYLE 64-86, Escape capture handler with the editable guard keyed to `[data-testid="physics-settings-modal"]` 114-143, `releaseSheet` when closed 115-119, `closeSheetIfFront(SHEET_ID_SETTINGS, ...)` + `preventDefault` + `stopImmediatePropagation` 137-139, raise on `onPointerDownCapture` 224, close-button pointerdown guard 256, header drag 149-185, resize 187-210.
- View seam — `PhysicsPaintStudioView.tsx`: props 435-474, `pickerOpen` 490, canvas region 515-557, Settings sheet mount 556, `Signal` type import 4 (add `ReadonlySignal`). `usePhysicsPaintStudioViewModel.ts` is a plain pass-through of `PhysicsPaintStudioViewProps`.
- Modal harness — `physicsPaintSettingsModal.test.ts` mocks `preact/hooks` (useRef/useEffect/useLayoutEffect/useState) at 22-34, walks vnodes, and asserts closed->null, dialog/testids, close guard, drag, session layout, Escape source pins. `PhysicsPaintScriptsPanel.test.ts` has the cursor-based hooks mock at 7-38 and holds the 59-16 describe at 1427-1693 (delete it and the then-unused `NumericStepper` import at 41).
- Graph/inputs — `PhysicsPaintBrushPicker.test.ts` `openingFromBrushTab` 379-386, and the four-sheet order changes the adverse-order pins 388-421. `PhysicsPaintStudioView.test.ts` `renderView` fixture 72-118 and the 0/1 modal counts 120-132.

Project skill `efx-preact-reactivity`: the Studio body passes the dialog as a SIGNAL REFERENCE and never reads it; the modal is the only reader (narrow subscription, so frame ticks re-render the small modal, not the Studio view). Module-scope sheet layout signals are compared-then-written, event/effect only — never from a render body. The rejection signal is `signal()` in a ref with compare-then-write, exactly like the retired panel, because `useSignal` is unavailable to this harness. No `useState`, no store import in the modal.

Gates: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` and `pnpm --filter efx-motion-editor run typecheck`. Vitest collects only `src/**/*.test.ts` — the new suite must be `.test.ts`, not `.test.tsx`. Never run Vitest in watch mode; never start the dev server.

The scope baseline for Task 3 is the planning HEAD, 346890e51. If execution starts from a different HEAD (for example an isolation worktree), substitute that HEAD for the hash in the Task 3 scope command and record it in the summary.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Property-selected Motion values open, edit and close through a floating modal end-to-end</name>
  <files>app/src/components/physic-paint/view/floatingSheetStack.ts, app/src/components/physic-paint/view/floatingSheetStack.test.ts, app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts, app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts, app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx, app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts</files>
  <behavior>
    - RED first (actions level, the end-to-end slice): seed the 59-19 motion rail (real keys A@0/B@10, Key Rail selection `{firstKeyId:'A', keyIds:['A','B']}`, position pair + scale keyed at 0 and 10, default current app frame 3). With no property and no key selected, `railMotionDialog.value` is null. After `selectRailMotionChannel('scale')` it returns a bundle whose `presentation.frame` is 3 (not a key frame), whose present fields are position-x, position-y and scale (rotation/opacity are present=false), and whose field values are the evaluator values at frame 3. Committing scale 150 writes a Scale key at frame 3 with model value 1.5 through exactly one `replaceRotoPhysicalRailMotions` call.
    - Key law preserved: with only `selectRailMotionKey({railId, channelId:'scale', frame:10})` set (no property), the bundle frame is 10 and the field values are the STORED values at frame 10, even though the playhead is at 3; committing writes at frame 10.
    - Frame binding: a bundle obtained at frame 3 commits at frame 3 even if the harness playhead later moves to 6; a bundle for a rail whose record was replaced/removed refuses with a sentence and writes nothing.
    - Close law: `clearRailMotionSelection()` leaves BOTH `railMotionSelectedChannel` and `railMotionSelectedKey` null; the paint tool signals are never touched.
    - Pure projection: `projectRailMotionInspectorAtFrame` returns the fixed D-13 order at any rail-local frame, present from channel existence only, stored values at a keyed frame, evaluator values at an unkeyed frame, frozen output; non-finite/negative frames normalize to 0.
    - Stack: the order is `['stroke-settings','brushes','settings','rail-motion']` with z 50/51/52/53; raising rail-motion reaches 53; release/front-only close/reset behave like the other sheets.
    - Modal: null dialog -> null; a bundle renders a role="dialog" aria-label "Motion" with testid `physics-rail-motion-modal`, one header and one close button; only present fields render (a 5-field bundle with 2 present renders exactly 2 NumericSteppers, no 'not added' text, no absent note); each field shows `Label (unit)` and the projected display value; onChange commits `(channelId, uiValue)`; a returned reason renders one role="alert" with the exact sentence and remounts the field; the close button's pointerdown stops propagation and click calls onClose; source pins: `closeSheetIfFront(SHEET_ID_RAIL_MOTION`, `releaseSheet(SHEET_ID_RAIL_MOTION)`, `event.stopImmediatePropagation();`, the editable guard keyed to the modal testid, no `physicPaintStore`, no `useState`.
    - View seam: the modal MOUNT vnode is present with no gallery picker open and absent while either picker is open (added to `expectNoParentModals` / `expectAllParentModals`).
    - Brush picker re-baseline: four-sheet z pins (open Settings -> 53; open Brushes after Settings -> brushes 53, settings 52; re-click Settings -> 53).
  </behavior>
  <action>
In `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`, add `describe('261107-qgj floating Motion modal projection and write')` reusing the 59-19 seeding shape (`seedMotionRail`, `actionsHarness`, `storedChannel`, `physicPaintStore.reset()` plus `selectRailMotionKey(null)` and `railMotionSelectedChannel.value = null` in before/after). Import `railMotionSelectedChannel`, `selectRailMotionChannel` and `exitRailMotionEditing` from `../view/railMotionEditingMode`. Write the RED cases from `<behavior>` first; confirm they fail because the computed/close action do not exist, then implement.

In `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts`, add a describe for `projectRailMotionInspectorAtFrame` covering order, present flags, stored-vs-evaluated values, freezing and frame normalization.

In `app/src/components/physic-paint/view/floatingSheetStack.test.ts`, extend every order/z expectation to four ids and add `SHEET_ID_RAIL_MOTION` to the front-only handler pair list so it pins `PhysicsPaintRailMotionModal.tsx`.

In `app/src/components/physic-paint/view/floatingSheetStack.ts`:
1. Add `'rail-motion'` to `FloatingSheetId`, export `SHEET_ID_RAIL_MOTION: FloatingSheetId = 'rail-motion'`, append it after Settings in `INITIAL_ORDER`, and update the header comment to four sheets.

In `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts`:
2. Extract the existing field mapping from `projectRailMotionInspector` into a module-private `projectRailMotionFields(record, readFrame)` returning the frozen field array plus railId/frame, and reuse it from both projections (labels, units, stored-vs-evaluator and the present lookup stay byte-identical; one conversion authority remains).
3. Add `export interface ProjectRailMotionInspectorAtFrameInput { readonly record: PhysicPaintRotoRailMotionRecord; readonly railLocalFrame: number }` and `export function projectRailMotionInspectorAtFrame(input): RailMotionInspectorPresentation` that normalizes the frame with `Number.isFinite ? Math.max(0, Math.floor()) : 0` and returns the frozen presentation. It never requires a key at the frame.
4. Add `export interface RailMotionDialogBundle { readonly presentation: RailMotionInspectorPresentation; readonly commit: (channelId: PhysicPaintRotoRailMotionChannelId, uiValue: number) => string | null }` with a doc comment stating the commit is bound to the displayed frame and returns the visible rejection or null.

In `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`:
5. Import `exitRailMotionEditing` beside `railMotionSelectedChannel`; import `projectRailMotionInspector`, `projectRailMotionInspectorAtFrame` and `type RailMotionDialogBundle` from `../view/physicsPaintKeyRailPresentation`.
6. Rename `commitRailMotionChannelValue` to `commitRailMotionInspectorValue` in the bundle interface (1462), in the implementation (3029) and in the bundle object/dependency list (4637 / 4689). New signature `(channelId, uiValue, keyFrame)` is internal; keep the returned rejection reason and the `setApplyStatus('error')` + `publishStatus` behavior. The implementation re-reads `readActiveRailMotionState(input)`, requires the record still exists and still matches the presentation's rail, validates the frame is finite and at least 0, then calls `applyWriteRailMotionChannelValue` with that frame and funnels the result through `commitRailMotionRecords`. Document that the frame is the one the field displayed (never re-derived from a possibly-moved playhead).
7. Add a private `commitRailMotionInspectorValueAtFrame(presentation, channelId, uiValue)` closure factory used by the bundle: it refuses with 'Select a rail with Motion first.' when the live state/record is gone or the rail differs, refuses with 'Select a Motion key first.' when neither a property nor a key is currently selected, and otherwise commits at `presentation.frame`.
8. Add `const railMotionDialog = computed((): RailMotionDialogBundle | null => ...)` beside `selectedMotionKey`/`railMotionGizmo`: read `readActiveRailMotionState(input)`; null state/view/record -> null; `const propertySelected = railMotionSelectedChannel.value !== null`; `const selection = railMotionSelectedKey.value`; return null when neither is set; property mode wins and projects with `projectRailMotionInspectorAtFrame({ record, railLocalFrame: state.localCursorFrame })`; key mode returns null unless `selection.railId === state.record.railId` and projects with `projectRailMotionInspector({ record, selectedKeyFrame: selection.frame, railLocalFrame: selection.frame })`; wrap in a frozen bundle whose `commit` closes over the presentation frame via step 7. Reading the channel signal subscribes the computed (the modal is its only consumer).
9. Add `const clearRailMotionSelection = useCallback((): void => { selectRailMotionKey(null); exitRailMotionEditing(); }, [])` with a doc comment naming it the ONE modal-close path (no tool restore needed: animate mode never changed the paint tool).
10. Add `railMotionDialog` and `clearRailMotionSelection` to the hook return object (4698-4706) with doc comments.

Create `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx` (modeled on the Settings sheet, no store import):
11. Props `{ dialog: ReadonlySignal<RailMotionDialogBundle | null> | null; onClose?: () => void }`. Read `const bundle = dialog?.value ?? null;` in the render body and `const open = bundle !== null;`. Return null when closed (after the hooks).
12. Session style: SURFACE_STYLE with `position:'absolute'`, `top:'60px'` (the fourth seat of the 12/28/44/60 cascade), `right:'12px'`, `width:'300px'`, `maxWidth:'calc(100vw - 24px)'`, `height:'min(260px, calc(100% - 72px))'`, flex column, hidden overflow, the same radius/border/background/shadow tokens as the Settings sheet, `pointerEvents:'auto'`; z from `sheetZIndex(SHEET_ID_RAIL_MOTION)`; body div `flex:'1 1 auto'`, `overflowY:'auto'`, padding 10px 12px 12px. Root `class="physics-paint-brush-modal"`, `data-testid="physics-rail-motion-modal"`, `role="dialog"`, `aria-label="Motion"`, `onPointerDownCapture={() => bringSheetToFront(SHEET_ID_RAIL_MOTION)}`.
13. One effect keyed on `[open]`: when closed call `releaseSheet(SHEET_ID_RAIL_MOTION)` and return; when open call `bringSheetToFront(SHEET_ID_RAIL_MOTION)` and register a capture-phase window keydown that ignores non-Escape, ignores an editable target (`input, textarea, [contenteditable="true"]`) inside `[data-testid="physics-rail-motion-modal"]`, then `closeSheetIfFront(SHEET_ID_RAIL_MOTION, close)`; on success `preventDefault()` and `stopImmediatePropagation()`; remove the listener in cleanup.
14. Header reuses the photo-reference header classes with a `Move` icon (`lucide-preact`), the title `Motion`, a spacer and a close button with `data-testid="physics-rail-motion-modal-close"`, `aria-label="Close"`, an `onPointerDown` stopPropagation guard and `onClick={close}` where `close = () => onClose?.()`. Header testid `physics-rail-motion-modal-header`.
15. Local rejection state: `const commitStateRef = useRef(signal<{ reason: string | null; rejectionSeq: number }>({ reason: null, rejectionSeq: 0 }));` plus a clearing effect keyed on `[bundle]` (compare-then-write). Map `bundle.presentation.fields.filter((field) => field.present)` to a row: a label span rendering `{field.label} ({field.unit})` and a `NumericStepper` keyed `${field.channelId}:${rejectionSeq}` with `ariaLabel={field.label}`, `value={field.value}`, `freeEntry`, `step={1}`, `precision={3}`, onChange calling `bundle.commit(field.channelId, value)`; on a non-null reason bump `rejectionSeq` and store the sentence. Render one `<p class="physics-paint-motion-rejection" role="alert">{reason}</p>` when set. No absent marker and no absent note exist in this file.

In `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`:
16. Add `ReadonlySignal` to the signals type import; import the modal and `type RailMotionDialogBundle`; add optional props `railMotionDialog?: ReadonlySignal<RailMotionDialogBundle | null> | null` and `onCloseRailMotionDialog?: () => void`; destructure them; render `{!pickerOpen ? <PhysicsPaintRailMotionModal dialog={railMotionDialog ?? null} onClose={onCloseRailMotionDialog} /> : null}` beside the Settings sheet inside the canvas region (self-hiding on the signal, never gated on a `.value` read in this component).

In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
17. Pass `railMotionDialog: rotoTimelineActions.railMotionDialog` and `onCloseRailMotionDialog: rotoTimelineActions.clearRailMotionSelection` in the `usePhysicsPaintStudioViewModel({...})` object at 11166. Keep the old sidebar path compiling for this task by pointing its `onCommitRailMotionValue` at the renamed action; Task 2 removes it.

Create `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts` with the settings-modal harness (`preact/hooks` mock, vnode walk) and the behavior/source pins from `<behavior>`; pass a `signal<RailMotionDialogBundle | null>(...)` as the dialog prop.

In `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts`, add a `railMotionDialogPresent` fixture field passing a closed-compatible signal (or a real `signal(null)`), include `PhysicsPaintRailMotionModal` in both modal-count helpers, and keep the picker step-aside assertions.

In `app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts`, re-baseline the four-sheet z expectations: initial brushes still 51; raise -> 53; open Settings -> 53; open Brushes after Settings -> brushes 53 and settings below it; re-click Settings -> 53.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/floatingSheetStack.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A property selection produces a Motion bundle framed at the playhead and a key selection produces one at the key frame; the modal renders only present channels and commits through the existing Motion command to the displayed frame; closing through one path clears both selections; the fourth sheet participates in the shared stack; every targeted suite and typecheck are green.</done>
  <reversibility rating="reversible">Additive projection, computed and dialog; the existing key-selected semantics and every persisted record shape are untouched.</reversibility>
</task>

<task type="auto">
  <name>Task 2: Remove the Motion inspector from the Scripts panel and delete every dead prop, state, copy and import</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <action>
In `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`:
1. Delete `MOTION_ABSENT_CHANNEL_SENTENCE` and `MOTION_ABSENT_CHANNEL_NOTE_ID` (20-22) and their comment.
2. Delete the `selectedRailMotion` and `onCommitRailMotionValue` props (31-42) from the interface and from the destructuring (67-68).
3. Delete the transient state and the clearing effect (122-139): the ref-held signal, `motionCommit`, and the `[selectedRailMotion]` effect.
4. Delete `commitMotionValue` and the whole `motionValuesSection` (184-252), including its explanatory comment.
5. Delete the three `{motionValuesSection}` injections: Key Rail branch (270), Loop Clip branch (295) and the normal Scripts branch (332). Change nothing else in those branches.
6. Drop the now-unused imports: `signal` from `@preact/signals` (line 4), `NumericStepper` (13) and `PhysicPaintRotoRailMotionChannelId` (12); narrow the presentation type import (11) to `import type { SelectedKeyRailInspectorPresentation } from './physicsPaintKeyRailPresentation';`. Keep `useEffect`, `useId`, `useRef`, `PhysicsPaintLoopClipPresentation` and every other import used by the remaining panel.

In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
7. Delete `selectedMotionKeySelection` and the `railMotionInspector` memo (4978-4988) with its comment.
8. Remove the `projectRailMotionInspector` import (144).
9. Remove `railMotionInspector` from the `rightPanelPropsMemo.resolve` dependency list (7303).
10. Remove the two scripts-bundle entries `selectedRailMotion` and `onCommitRailMotionValue` with their 59-16 comment (7396-7400). Do not touch any other script prop or handler.

In `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`:
11. Delete the entire `describe('Physics Paint Scripts panel Motion value inspector (59-16)')` block (1427-1693) and the now-unused `NumericStepper` import (41).
12. Add one small pin in an existing describe: the panel source contains neither a motion inspector section nor a motion value prop (assert the panel source lacks the motion section class and the two removed prop names), and never imports the shared NumericStepper. Keep every other test untouched.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All three Scripts-panel branches render no motion values; the panel, the Studio memo and the right-panel props carry no motion inspector state; the retired 59-16 tests are gone; the panel suite, the modal/view suites and typecheck are green.</done>
  <reversibility rating="reversible">Deletion of a superseded inspector whose replacement landed in Task 1; no data or command path changes.</reversibility>
</task>

<task type="auto">
  <name>Task 3: Complete the sheet mechanics, pin the close path and prove the regression surface</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx, app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts</files>
  <behavior>
    - Header drag moves the surface by the pointer delta and never closes it; the drag keeps 80px horizontally and the header vertical reachable; release stops the drag.
    - Bottom resize changes the session height with a 240px floor and a viewport-derived max; the session layout survives close/reopen; `resetRailMotionModalLayout()` clears both.
    - The close button's pointerdown never starts a header drag; the root's capture-phase pointerdown raises the sheet.
    - Source pins: the Studio passes `railMotionDialog` and `onCloseRailMotionDialog: rotoTimelineActions.clearRailMotionSelection` to the view model; the Studio contains no `commitRailMotionChannelValue`, no `projectRailMotionInspector` and no `selectedRailMotion`; the modal's Escape path is the shared front gate.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx`:
1. Add module-scope session signals `railMotionModalDragOffset` (null or `{dxPx,dyPx}`) and `railMotionModalResizeHeight` (null or px), plus `export function resetRailMotionModalLayout()`. Compare-then-write in the pointer handlers only.
2. Add the header drag handlers (pointerdown stores pointer start/base offset and the surface rect; pointermove clamps X to keep 80px visible and Y to keep the header on screen; pointerup/pointercancel clear the start ref) and apply `transform` on the root.
3. Add a bottom resize handle (`data-testid="physics-rail-motion-modal-resize"`, `aria-hidden`, ns-resize, touch-action none, a 34x3 grip) whose pointer handlers clamp the height to `max(240, min(viewport - rect.top - 12, startHeight + delta))`; apply it as the root height when set, otherwise the SURFACE_STYLE height. Reuse the Settings sheet's styles for the handle and grip.
4. Keep the Escape/close/fields/rejection behavior from Task 1 byte-identical.

In `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts`:
5. Add drag, resize, session-persistence and reset tests using the settings-modal idiom (invoke handlers with plain event objects, re-invoke the component and read the root style). Add a source-pin block reading `../PhysicsPaintStudio.tsx` and `./PhysicsPaintRailMotionModal.tsx` for the close-path and sheet-mechanics literals from `<behavior>`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/view/floatingSheetStack.test.ts src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>git diff --name-only 346890e51 -- app/src</automated>
  </verify>
  <done>The Motion modal behaves like the sibling sheets (drag, resize, session layout, raise, front-only Escape); the close path and the removed sidebar are pinned in source; the full suite is green, typecheck clean, and the app source diff contains only this plan's files.</done>
  <reversibility rating="reversible">Sheet mechanics and pins; removing the handle and layout signals restores the Task 1 surface exactly.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| property/key selection -> projection bundle | A session UI state selects which rail/frame is readable; a stale selection must never project another rail's values. |
| numeric field -> Motion command | A typed number is untrusted input crossing into the mutation layer; it must be validated and written at the frame the field displayed. |
| modal -> floating-sheet stack | The sheet must take its stacking from the shared order and release its id when closed, or every sibling's front-only Escape gate goes inert. |
| view module -> store | The modal must stay props-driven; a store import would couple presentation to document state and break the harness. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261107-QGJ-01 | Tampering | `railMotionDialog` projection vs. a stale selection | medium | mitigate | The computed re-reads `readActiveRailMotionState`; key mode additionally requires the selection's railId to equal the live record's railId; property mode is the explicit animate-mode signal. |
| T-261107-QGJ-02 | Tampering | typed value written at a moved playhead | high | mitigate | The bundle binds `presentation.frame`; `commitRailMotionInspectorValue` re-reads the live records but writes at the displayed frame, and `writeRailMotionChannelValueAtCursor` independently validates presence/domain and refuses out-of-range numbers. |
| T-261107-QGJ-03 | Repudiation | silent rejection / invisible absent channel | medium | mitigate | Absent channels are filtered out of the modal; a rejection that still reaches the commit is shown verbatim in one role="alert", and the modal authors no sentence of its own. |
| T-261107-QGJ-04 | Denial of service | inert sibling Escape handlers after close | medium | mitigate | Front-only Escape through `closeSheetIfFront` plus `releaseSheet` when closed; the four-sheet source pin list enforces it for every sheet. |
| T-261107-QGJ-05 | Spoofing | overlapping sheets hiding each other | low | mitigate | The z-index comes only from `sheetZIndex(SHEET_ID_RAIL_MOTION)`; the sheet raises on open and on capture-phase pointerdown; the 60px seat keeps the Settings header strip clickable. |
| T-261107-QGJ-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added, upgraded or installed; the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Projection: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` — at-frame projection, present flags, stored-vs-evaluated values, freezing, frame normalization; the existing key projection describe stays green.
2. Action bundle: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — open condition and precedence, frame law for both paths, frame-bound write through the store, one setter call, close clears both selections.
3. Modal: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts` — present-only fields, units/values, commit wiring, rejection alert, close guard, drag/resize/session layout, sheet source pins.
4. Stack: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/floatingSheetStack.test.ts src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts` — four-sheet order, raise/release/close, adverse open order.
5. Panels and view: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — no motion values in any branch, picker step-aside mount gate.
6. Full suite: `pnpm --filter efx-motion-editor exec vitest run` must end with 0 failed. Never watch; never start the server.
7. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
8. Scope tripwire: `git diff --name-only 346890e51 -- app/src` lists only this plan's files; any other path means the scope broke — stop and report.

UAT rows the user will run after execution (live visible UAT; automated-green is not done):
- Select a Motion property in the pinned header: the Motion modal appears, listing only the channels this rail actually carries (no 'not added' ghosts, no absent note).
- Type a value in the modal: the canvas pose updates, a key appears at the playhead on that channel's lane, and the value survives close/reopen.
- Close with the header X: the property deselects, the canvas goes back to the brush, and the paint tool that was active before is still selected. Repeat with Escape.
- Select a Motion key with no property selected: the modal opens on that key's frame; editing writes that key's frame, and closing clears the key highlight without moving the playhead.
- Open Settings, then the Motion modal: the Motion modal is in front. Press Escape: only the Motion modal closes and Settings stays open.
- Type an out-of-domain Scale (0): the command's rejection sentence appears in the modal and no key is written.
- While any gallery picker is open, the Motion modal steps aside and returns when the picker closes.
- The Scripts tab shows no motion fields in the normal list, the Key Rail inspector or the Loop Clip inspector.
</verification>

<success_criteria>
- Motion values live in a floating, props-driven Motion modal, opened by the animate-mode property selection or a selected Motion key.
- The modal shows only channels present on the rail, in the fixed order, with display units and values from the one projection.
- Property mode reads/writes at the playhead frame; key mode keeps reading/writing at the key frame; each write is one Motion command and one store commit.
- Closing through one path clears both selections and returns to the paint tool; header X and front-only Escape share it.
- The Scripts panel has no motion inspector in any branch and no dead motion props/state/copy/imports; the Studio carries no retired projection.
- The modal is a well-behaved fourth floating sheet (raise, z from the stack, release on close, front-only Escape, drag/resize/session layout).
- Targeted suites, the full suite and typecheck are green; the app source diff is confined to this plan's files; three atomic commits, one per task.
</success_criteria>

<output>
Create `.planning/quick/261107-qgj-move-all-the-motion-values-from-sidebar-/261107-qgj-SUMMARY.md` when done. Record the three task commits, the exact open/frame/close law as implemented, `SHEET_ID_RAIL_MOTION`, `projectRailMotionInspectorAtFrame`, `RailMotionDialogBundle`, `railMotionDialog`, `commitRailMotionInspectorValue`, `clearRailMotionSelection`, the new modal component and its sheet mechanics, the deleted sidebar inspector and its dead props/tests, the re-baselined z-index pins, the full-suite/typecheck results, the scope-diff result and the UAT rows handed to the user.
</output>
