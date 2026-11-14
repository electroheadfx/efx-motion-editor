---
phase: quick-261024-vga
plan: 261024-vga
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-physic-paint/src/engine/stackOrder.ts
  - packages/efx-physic-paint/src/index.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
  - app/src/components/physic-paint/view/stackOrder.ts
  - app/src/components/physic-paint/view/stackOrder.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/brushScriptEditionPort.ts
  - app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 62000
  raw_tokens: 50000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "With exactly one stroke selected, Brush Move and Water color Select both show a Stack section between Geometry and Paint: a colour dot plus #<serial>, a '<position>/<total>' readout, a 'Position (1 = top)' release-commit stepper, an 'Above #<serial>' / 'Below #<serial>' pair (em dash at the stack edges) and Top/Bottom buttons. The position law is the SAME as the existing Move badge: 1 = topmost, stackTotal = bottom."
    - "A typed commit, a plus/minus press, a slider release, Top and Bottom each call bundle.reorderStroke AT MOST ONCE for that gesture with the clamped position: the Enter commit and the blur commit SliderStepper fires right after it collapse to one call through a ref-held last-emitted value that clears on the next microtask, while a later gesture is never swallowed; Top commits 1, Bottom commits stackTotal, Above is position-1 and Below is position+1. Committing the stroke's current position calls nothing (no engine edit, no re-bake). With two or more strokes selected, or a selected id absent from the listing, the section renders the disabled hint 'Select one stroke to change stack order' plus disabled Top/Bottom controls and issues no reorder."
    - "Every Stack commit that is not a same-position no-op re-syncs the control at the live stackPosition: a refused commit (brush lock or engine false; watercolor lock, in-flight, or async re-bake failure) never leaves the typed text in the position input and never feeds it back into the next +/- step. The mechanism is a ref-held nonce signal bumped inside commitStackPosition plus the `Stack position` SliderStepper keyed by that nonce, so Preact REMOUNTS the input at the live value — a re-render with an unchanged value prop does not reset the DOM input. No useState and no render-body signal write."
    - "Brush: one placement is one engine commit + one retained-script flush. The strokeStack projection moves; the acceptance ledger allActions never reorders; the redo stack dies; one 'move' completed mutation names the stroke; queued finalizations are drained first; undo/redo and save/load keep the new order; a primary travels with its zero-point continuations; group boundaries match the dialog listing exactly (every points-bearing entry, including erase, starts a group), so a committed position lands on that row; non-Move tool, unknown id, already-at-position and physical-lock refusals do nothing."
    - "Water color: one placement is one snapshot edit plus one re-bake and ONE aquarelle-script ledger entry. Dry events and other-frame strokes keep their exact objects and absolute timeline indices; the same-frame stroke entries are replaced (never mutated) at their collected indices; recordedOrder / engine.timestamp are re-stamped by position across the moved-and-crossed window so the bake's settle gaps stay monotonic; undo/redo restore the previous/new orders; unknown/deleted/out-of-timeline, same-position, in-flight and locked refusals change nothing and bump no revision."
    - "One index implementation exists: packages/efx-physic-paint/src/engine/stackOrder.ts, consumed by the engine, re-exported for the app adapters. Neither adapter reimplements the clamp or the remove/insert math."
    - "The dialog stays selection-driven: no local stroke-list state, no render-body signal writes, no React-style state hooks; the ONLY added signal is the ref-held stack-sync nonce, which holds a counter and never stroke data. It re-reads bundle.listStrokes on every render (that call reads brushScriptRevision / aquarelleStrokesRevision, so the dialog re-renders on the backend bump), which refreshes position, Above and Below after every accepted commit."
  artifacts:
    - "packages/efx-physic-paint/src/engine/stackOrder.ts — clampStackPosition, targetIndexForStackPosition, reorderForStackPosition (the single index law; bottom -> top arrays, position 1 = top)"
    - "app/src/components/physic-paint/view/stackOrder.ts — the app-facing re-export of the same three helpers plus their result type"
    - "app/src/components/physic-paint/view/strokeSettingsModel.ts — StrokeSettingsDialogBundle.reorderStroke?: (mutationId, positionFromTop) => boolean | void, documented 1 = top"
    - "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx — the Stack section, its disabled state, the single hoisted bundle.listStrokes read, and the ref-held nonce plus last-emitted guard that re-key the position stepper after every commit"
    - "app/src/components/physic-paint/PhysicsPaintStudio.test.ts — the watercolor structural pins for the reorderStroke bundle member, the memo dependency and the handleAquarellePlaceStroke edit order"
    - "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts — public moveStrokeToStackPosition under the stepStrokeInStack commit contract"
    - "app/src/components/physic-paint/view/brushScriptEditionPort.ts — placeBrushScriptStroke (lock gate, declareEditBase, one engine call, one flush)"
    - "app/src/components/physic-paint/view/aquarelleRecordState.ts — placeAquarelleStrokeInScript (same-frame collection, positional slot re-stamp, one revision bump)"
    - "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts — beginAquarellePlaceEdit (snapshot edit mirroring beginAquarelleReorderEdit)"
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx — handleAquarellePlaceStroke and the reorderStroke member of BOTH dialog bundles"
  key_links:
    - "Dialog Stack commit -> bundle.reorderStroke -> (brush) placeBrushScriptStroke -> engine.moveStrokeToStackPosition -> strokeStack reorder -> flushBrushScriptFrame -> brushScriptRevision bump -> dialog re-reads listBrushScriptStrokes, so position/Above/Below follow."
    - "Dialog Stack commit -> bundle.reorderStroke -> (water color) handleAquarellePlaceStroke -> beginAquarellePlaceEdit -> placeAquarelleStrokeInScript -> payloadTimeline reorder + revision bump -> applyAquarelleTimeline -> recordAquarelleScriptEdit (one edit) -> dialog re-reads listSelectableAquarelleStrokes."
    - "Both adapters -> stackOrder.reorderForStackPosition: the engine over paint-order groups, the watercolor record state over same-frame timeline entries. No second index law."
    - "Stack readout <- bundle.listStrokes: serial, stackPosition, stackTotal and color are the same fields the Move badges and 'Above/Below' derive from; the dialog stores none of them."
    - "Dialog commitStackPosition -> stackSyncRef nonce bump -> keyed `Stack position` SliderStepper -> Preact remounts the input with the live stackPosition, so a refused commit cannot keep the typed text; lastStackEmitRef (cleared on a microtask) collapses the Enter+blur pair into one bundle.reorderStroke call."
---

<objective>
Add an exact paint-order placement control to the shared Stroke Settings dialog for the selected stroke, for BOTH Brush Move and Water color Select: a compact Stack section with a position stepper, Above/Below readouts and Top/Bottom, backed by ONE shared index law and two thin adapters (engine strokeStack reorder; watercolor payload-timeline reorder + one re-bake).

Purpose: let the user place a stroke at an exact stack position instead of stepping it one neighbour at a time, without adding a stack list, drag UI, persisted field or version bump, and without diverging from the existing badge law (1 = topmost).

Output: a pure stackOrder module (package source, app re-export), a documented bundle member, the dialog Stack section, engine moveStrokeToStackPosition, brush port placeBrushScriptStroke, watercolor placeAquarelleStrokeInScript + beginAquarellePlaceEdit, the Studio handler and both bundle wirings, and targeted truth-table/contract tests. No new dependency, no schema or persistence change, no change to the existing '<' / '>' step behavior, no dev server.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Read before editing (do not @-inline the large Studio or engine files):
- app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx (686 lines — the whole file)
- app/src/components/physic-paint/view/strokeSettingsModel.ts (394 lines — bundle type ~235-246)
- app/src/components/physic-paint/view/strokeSettingsModel.test.ts (1060 lines — harness 60-171, createBundle 205-229, findComponent 155)
- app/src/components/shared/SliderStepper.tsx (props 28-75)
- app/src/components/physic-paint/view/scriptStrokeEdition.ts (READ ONLY — SelectableScriptStroke fields: mutationId, pointsPx, bounds, serial, stackPosition, stackTotal, color)
- app/src/components/physic-paint/view/brushScriptEditionPort.ts (stepBrushScriptStroke 340-356; engine interface 45-77)
- app/src/components/physic-paint/view/brushScriptEditionPort.test.ts (fake engine 78-133; flush asserted through getStrokes call count)
- app/src/components/physic-paint/view/aquarelleRecordState.ts (stepAquarelleStrokeInScript 706-751; withRecordedSlot 754-763; bumpAquarelleStrokesRevision 287-291)
- app/src/components/physic-paint/view/aquarelleStrokeSelection.ts (beginAquarelleReorderEdit 547-558; restoreAquarelleEditSnapshot 567-579)
- app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts (helpers 60-103; the step suites)
- packages/efx-physic-paint/src/engine/EfxPaintEngine.ts (stepStrokeInStack 3971-4033; liveStrokeStack 4799-4808; liveActionsInPaintOrder 4811-4814; strokeStack field 727)
- packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts (harness 216-372, existing suites 374-641)
- app/src/components/physic-paint/PhysicsPaintStudio.tsx (handleAquarelleMoveStrokes 5701-5762; handleAquarelleStepStroke 5924-5969; stroke settings bundle memo 7329-7374)

WIRING CONTRACT (verified in the live tree on 2026-10-24 — do not re-derive):

1. Package boundary
   - The engine lives in packages/efx-physic-paint and CANNOT import app code. The one index implementation therefore lives in the package, and app/src/components/physic-paint/view/stackOrder.ts re-exports it from the package root. The app resolves '@efxlab/efx-physic-paint' through packages/efx-physic-paint/dist (exports map -> dist/index.mjs / dist/index.d.ts), so `pnpm --dir packages/efx-physic-paint build` MUST run before any app test or typecheck that consumes a NEW package export. dist/ is gitignored; never commit it.
   - Live arrays are bottom -> top everywhere in this feature (strokeStack, payloadTimeline, the badge derivation). The public position is 1 = TOPMOST.

2. Dialog
   - The dialog currently returns null unless `bundle` exists, the surface is active, the selection is non-empty and `readAppearance` yields rows. It reads `scriptSelectedStrokeIds.value` in the render body (the narrow-leaf subscription) and calls `bundle.listStrokes(bundle.playFrame, bundle.canvasSize)` ONCE inline at ~line 311 for `scriptStrokeSelectionBox`. Hoist that call into one `strokes` const and reuse it for both the selection box and the Stack section.
   - Section order today: Color -> Geometry (only when a live centre resolves) -> Paint. The Stack section goes between Geometry and Paint, rendered for BOTH modules whenever `bundle.reorderStroke` exists.
   - SliderStepper supports label, value, min, max, step, freeEntry, commitOnRelease, disabled, mixed and ariaLabel. Passing `allowOutOfRangeEntry` is off-limits for this control by spec; the adapters clamp regardless.
   - SliderStepper.commitInput writes `element.value` directly after emitting onChange (SliderStepper.tsx:412-427) and nothing re-syncs it when the `value` prop is unchanged; `stepBy` then uses that stale input text as its base (309-328). Enter ALSO blurs, so onKeyDown's commitInput and onBlur's commitInput both run in the same tick (468-481). Both facts drive the dialog contract: a ref-held nonce signal (the geometrySessionRef pattern) bumped inside commitStackPosition, the `Stack position` SliderStepper keyed by that nonce so Preact 11 remounts the input at the live value, and a ref-held last-emitted position cleared with queueMicrotask so the Enter+blur pair emits once while a later gesture is free.
   - Harness note: `findComponent` returns the vnode, so a test reads `slider.key`; `findByTestId(findByTestId(tree, 'stroke-settings-stack-stepper'), 'slider-stepper-value')` returns the rendered input vnode and `props.value` is the mounted readout.
   - Test harness: `strokeSettingsModel.test.ts` renders components by invoking them as plain functions (`renderDialog`), walks host vnodes with `findByTestId` and function components with `findComponent`. SliderStepper is found by `ariaLabel`; buttons by `data-testid`. Vitest collects only `src/**/*.test.ts` — extend the existing `.test.ts` files, never add a `.test.tsx` target.

3. Brush
   - `strokeStack` is the paint-order projection of the SAME action object refs held by `allActions` (the acceptance/undo ledger, which never reorders). `liveStrokeStack()` seeds on demand and appends missing ledger refs; `liveActionsInPaintOrder()` filters it to refs still in the ledger.
   - `stepStrokeInStack` is the commit-law template: move-tool gate, `flushPendingStrokeFinalizations()` first, no undo checkpoint, `redoStack = []`, `notifyHistoryAvailability()`, `displayCompositeDirty = true`, `redrawAfterScriptEdit()`, `requestRender()`, ONE `notifyCompletedMutation('move', mutationId)`, `moveHoverTargetId` deliberately kept.
   - A group starts at EVERY live entry with `points.length > 0`, regardless of tool, plus the immediately following zero-point entries. This is the SAME boundary `normalizeLogicalBrushes` uses to build the dialog rows (recordedStrokeGroups.ts:32-34), so a group index and a dialog row index stay 1:1. Erase gestures DO enter `allActions` with points (EfxPaintEngine.ts:4679-4694), so an erase stroke is its own row and must never be absorbed into a neighbouring paint group. Physics placeholders are pushed as `tool: 'paint'` with `points: []` (line ~1641), so they are continuations, not group starts. `stepStrokeInStack` remains the movable-stroke precedent: its moving predicate stays `tool === 'paint'` with points (erase rows are listed but not movable by the step control).
   - `getStrokes()` returns the paint order with deep point copies; `save()` serializes it and `load()` restores `strokeStack` from it.
   - The port flush asserts are made through `engine.getStrokes` call counts (one flush = one getStrokes call).

4. Water color
   - `payloadTimeline` IS the paint order; `recordedStrokeEntries` maps mutationId -> the SAME entry object pushed onto the timeline; `recordedStrokes` holds the AquarelleStroke. `stepAquarelleStrokeInScript` swaps two entries by index assignment, trades their recording slots (`recordedOrder` and `engine.timestamp`) through `withRecordedSlot`, replaces (never mutates) every affected object, and bumps the revision once.
   - Dry events are sheet actions with no frame anchor (`isAquarelleDryEvent`) and keep their absolute index. Other-frame strokes are never swap partners. The registry Map insertion order is never reordered (hit-testing walks it newest-last).
   - `bumpAquarelleStrokesRevision()` is the single bump site; `captureAquarelleSnapshot` / `storeAquarelleEdit` / `restoreAquarelleEditSnapshot` give one undo entry per edit; `aquarelleScriptEditInFlight` is the shared in-flight guard read by the begin functions.
   - Studio handler template `handleAquarelleStepStroke`: peek-only guards (physical lock, rotoScript.applying / mutationLocked, currentCell real, in-flight), begin edit, set in-flight, reset sheet, await `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`, on success `recordAquarelleScriptEdit(editId)` + clear error, on failure `restoreAquarelleEditSnapshot(editId, 'undo')` + refusal message, finally clear in-flight.

5. Commands (all validated today; cwd = checkout root)
   - App typecheck: `pnpm --dir app typecheck`
   - App tests: `pnpm --dir app exec vitest run <app-relative test paths>` (plain `pnpm --dir app vitest` is not a valid pnpm form here)
   - Engine tests: `pnpm --dir app exec vitest run --root ../packages/efx-physic-paint src/engine/<file>.test.ts`
   - Package build: `pnpm --dir packages/efx-physic-paint build`
   - Never watch mode; never start the dev server or Tauri (live UAT is the user's).

GUARDRAILS (locked):
- Preact rules from efx-preact-reactivity: signals/ref-held signals only, compare-then-write setters, no React-style state hooks, no signal writes in the render body, no effect that applies selection. The dialog derives everything from the live bundle reads; no local stroke-list state.
- No full stack list, no click-rows, no drag reorder, no multi-stroke block reorder, no new persisted field, no version bump, no change to '<' / '>', no debug logging.
- Water color: never touch dry or other-frame events, never reorder the registry Map, never double-record or double-flush, never leave the in-flight flag set, never mutate a stored entry or stroke in place (snapshots hold live refs).
- The index math, the runtime reorderStroke contract and the Stack UI each have exactly one implementation.
- Every path in this body is repo-root-relative; every `<automated>` command assumes cwd at the checkout root.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The shared stack-position law and the Stack section for both modules</name>
  <files>packages/efx-physic-paint/src/engine/stackOrder.ts, packages/efx-physic-paint/src/index.ts, app/src/components/physic-paint/view/stackOrder.ts, app/src/components/physic-paint/view/stackOrder.test.ts, app/src/components/physic-paint/view/strokeSettingsModel.ts, app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/view/strokeSettingsModel.test.ts</files>
  <behavior>
    RED first — create stackOrder.test.ts and extend strokeSettingsModel.test.ts before the implementations; record the failing output.

    Shared index law (stackOrder.test.ts, bottom -> top A B C D E = [A,B,C,D,E]):
    - reorderForStackPosition(items, 2, 1) => [A,B,D,E,C]; reorderForStackPosition(items, 2, 5) => [C,A,B,D,E]; reorderForStackPosition(items, 0, 3) => [B,C,A,D,E].
    - The target index is total - clamped(position): position 1 is the LAST index (top), position total is index 0 (bottom).
    - Same position returns changed false and the SAME items reference (no allocation).
    - Out-of-range positions clamp: 0 behaves as 1, 99 behaves as total.
    - Invalid fromIndex (negative, >= length, non-integer, empty array) returns changed false with the items untouched.
    - clampStackPosition truncates to an integer and clamps into 1..total (total <= 1 resolves to 1).
    - targetIndexForStackPosition(1, 5) = 4, (5, 5) = 0, (0, 5) = 4, (9, 5) = 0; a zero/negative total resolves to 0.
    - A moved group keeps its internal order and every item appears exactly once.

    Dialog (strokeSettingsModel.test.ts, the existing cursor-hooks harness):
    - Brush and water color both render `stroke-settings-stack` between Geometry and Paint when the bundle provides reorderStroke; the section is absent when it does not.
    - Single stroke at position 2 of 3, serial 12, colour #ff0000: the dot carries that colour, `stroke-settings-stack-serial` reads `#12`, `stroke-settings-stack-position` reads `2/3`, `stroke-settings-stack-above` reads `Above #13`, `stroke-settings-stack-below` reads `Below #11`.
    - Edges: at position 1 the Above row is an em dash; at position total the Below row is an em dash.
    - The Position row is a SliderStepper with label `Position (1 = top)`, ariaLabel `Stack position`, value 2, min 1, max 3, step 1, freeEntry true, commitOnRelease true, and no allowOutOfRangeEntry.
    - onChange(1) calls reorderStroke exactly once with (12, 1); onChange(2) (the current position) calls nothing; SEPARATELY — after `await Promise.resolve()`, which models the next user task — the Top button calls (12, 1) and the Bottom button calls (12, 3). Distinct gestures in a test must be separated by that microtask, because the same-tick coalescing guard (next cell) is deliberately still armed otherwise.
    - Exactly once per gesture: two synchronous onChange(3) emissions from the same rendered control (the Enter commit plus the blur commit SliderStepper fires right after it) reach reorderStroke ONCE; after `await Promise.resolve()` (the guard's microtask) a further onChange(3) is not swallowed.
    - A refused commit re-syncs: with reorderStroke returning false (brush lock / engine false) and with it returning undefined (the watercolor handler is void), onChange(3) from position 2 calls reorderStroke once; the next render exposes a DIFFERENT `key` on the `Stack position` SliderStepper (the remount) while its `value` prop is still 2, and the freshly rendered `slider-stepper-value` input under `stroke-settings-stack-stepper` reads `2` — the typed 3 never survives into the readout.
    - In its own cell (fresh render, no prior commit), a same-position commit (onChange(2)) leaves the slider key unchanged as well as the call count at zero.
    - Two selected strokes: `stroke-settings-stack-disabled` exists with the hint text, Top/Bottom carry disabled, no Stack position SliderStepper exists and no reorder call is made. A single selected id absent from listStrokes behaves the same.
  </behavior>
  <action>
    Step 1 — create packages/efx-physic-paint/src/engine/stackOrder.ts (pure, no imports). Export `clampStackPosition(position: number, total: number): number`, `targetIndexForStackPosition(position: number, total: number): number` and `reorderForStackPosition<T>(items: readonly T[], fromIndex: number, positionFromTop: number): StackReorderResult<T>` with `interface StackReorderResult<T> { readonly items: readonly T[]; readonly changed: boolean }`. READONLY ON BOTH SIDES — do not mix `readonly T[]` input with a mutable `T[]` result: `readonly T[]` is not assignable to `T[]`, so the unchanged case could not return the input reference and the package dts build (tsup) run by this task's verify would fail. With both sides readonly, the unchanged case returns the SAME reference untouched and the moved case returns a fresh array; every consumer only needs `.slice()`, `.flat()` and element reads, which keep working (`.flat()` on `readonly T[][]` still yields `T[]`). Never cast and never widen the result. Document at the top: arrays are bottom -> top; position 1 = topmost, total = bottom; target = total - clamped. Clamp truncates with Math.trunc, tolerates non-finite input by treating it as the nearest bound (non-finite total resolves to 1 / index 0). reorderForStackPosition returns the SAME items reference with changed false when the fromIndex is invalid or equals the target; otherwise returns a NEW array with the item removed at fromIndex and inserted at the target index.

    Step 2 — export the helpers and the result type from packages/efx-physic-paint/src/index.ts.

    Step 3 — create app/src/components/physic-paint/view/stackOrder.ts as a thin re-export from '@efxlab/efx-physic-paint': the three helpers as VALUES and StackReorderResult with `export type` (isolatedModules is on, so a type re-export must be explicit). Header comment: this is the app-facing name of the ONE index law; the implementation lives in the package because the engine consumes it too, and the app resolves the package through dist (build before app gates).

    Step 4 — strokeSettingsModel.ts: add `readonly reorderStroke?: (mutationId: number, positionFromTop: number) => boolean | void;` to StrokeSettingsDialogBundle, documented as 1 = topmost / stackTotal = bottom, optional so the section simply does not render for a bundle without it.

    Step 5 — PhysicsPaintStrokeSettingsDialog.tsx. Import clampStackPosition from './stackOrder'. Add two refs beside geometrySessionRef, using the SAME ref-held-signal pattern: `const stackSyncRef = useRef<Signal<number> | null>(null); if (!stackSyncRef.current) stackSyncRef.current = signal(0);` and `const lastStackEmitRef = useRef<number | null>(null);`. Read `const stackSyncNonce = stackSyncRef.current.value;` in the render body next to `dismissed` (a narrow read; the ONLY write is inside commitStackPosition — never in the render body). Hoist one `const strokes = bundle.listStrokes(bundle.playFrame, bundle.canvasSize);` and pass `strokes.filter((stroke) => selection.has(stroke.mutationId))` to scriptStrokeSelectionBox. After the Geometry block and before the Paint section, when `bundle.reorderStroke` is defined, render a SECTION_STYLE block whose header is `RuleSectionHeader text="Stack"` with `data-testid="stroke-settings-stack"`. Resolve `const single = selection.size === 1 ? strokes.find((stroke) => stroke.mutationId === ids[0]) : undefined;` and `const stackTotal = single?.stackTotal ?? 0;` and `const neighbors = (position) => strokes.find((stroke) => stroke.stackPosition === position);`. Implement one `commitStackPosition(target: number)`: return early unless single and bundle.reorderStroke exist; clamp with clampStackPosition(target, single.stackTotal); return when the clamped value equals single.stackPosition (no call, no nonce bump, no re-key); return when `lastStackEmitRef.current === clamped` (SliderStepper commits on Enter and then again from the blur it triggers, both in the same tick, and both would otherwise pass the stale-position guard); set `lastStackEmitRef.current = clamped` and schedule `queueMicrotask(() => { if (lastStackEmitRef.current === clamped) lastStackEmitRef.current = null; })` so only same-tick duplicates collapse and a later gesture is never swallowed; bump `stackSyncRef.current.value += 1` — this is the reset that also covers a watercolor refusal the dialog cannot observe synchronously; then call `void bundle.reorderStroke(single.mutationId, clamped)` exactly once. Enabled branch: a row with a small colour square (`data-testid="stroke-settings-stack-dot"`, background single.color, inline style matching the dialog chrome), `#<serial>` (`stroke-settings-stack-serial`) and a tabular `p/total` readout (`stroke-settings-stack-position`); inside a `<div data-testid="stroke-settings-stack-stepper">`, a SliderStepper labelled `Position (1 = top)` with ariaLabel `Stack position`, a key built from the nonce (template literal `stack-position-` + stackSyncNonce), value single.stackPosition, min 1, max single.stackTotal, step 1, freeEntry, commitOnRelease, onChange commitStackPosition, and NO allowOutOfRangeEntry. The key is load-bearing: Preact 11 remounts a keyed child whose key changed, and a remount is the only thing that rewrites the input DOM value when the `value` prop is unchanged (a plain re-render does not); without it a refused commit keeps the typed text, and stepBy then uses that text as its next base; an Above/Below pair (read-only rows, `stroke-settings-stack-above` / `-below`) reading `Above #<serial of position-1>` and `Below #<serial of position+1>`, or `Above —` / `Below —` when the neighbour does not exist; and a two-button row (Top -> commitStackPosition(1), Bottom -> commitStackPosition(single.stackTotal)) with `data-testid="stroke-settings-stack-top"` / `-bottom`, short labels Top/Bottom and aria-labels `Move stroke to top` / `Move stroke to bottom`. Disabled branch (selection size other than 1, or the id not found): render only a hint (`data-testid="stroke-settings-stack-disabled"`) with the exact text `Select one stroke to change stack order`, plus the Top/Bottom buttons rendered with the disabled attribute, and no serial row, slider or neighbour rows. All styling inline on the existing constants; no CSS file change and no local stroke-list state — every Stack render value comes from the hoisted list, and the ONLY added signal is the ref-held sync nonce counter.

    Step 6 — create stackOrder.test.ts with the exact truth table above. Extend strokeSettingsModel.test.ts: add a small stack-stroke fixture helper (mutationId, serial, stackPosition, stackTotal, color, bounds) and a new describe that drives createBundle with `listStrokes` returning 3 strokes plus a `reorderStroke` spy, covering both modules (watercolor via setScriptSelectMode(true), module 'watercolor', brushMoveActive false), the enabled readouts, the edge em dashes, the slider props (including a defined `key`), one call per commit for the slider and Top/Bottom, the no-call current position, the disabled 2+ and missing-id branches, the absent section when reorderStroke is undefined, AND the reset/coalescing cells: (a) a refused commit (spy returning false, then a second bundle whose spy returns undefined) keeps `props.value` at the live position, changes `findComponent(...).key`, and the mounted input under `stroke-settings-stack-stepper` reads the live display; (b) two synchronous onChange(3) calls produce ONE reorder call, and after `await Promise.resolve()` a further onChange(3) is not swallowed; (c) in a fresh cell, onChange(currentPosition) leaves both the call count and the key unchanged. Separate EVERY distinct gesture in this describe with `await Promise.resolve()` so the same-tick guard is not mistaken for a bug. Read the key from the SliderStepper vnode (`findComponent` returns the vnode; Preact stores the key on `vnode.key`, not in props) and the mounted input via `findByTestId(findByTestId(tree, 'stroke-settings-stack-stepper'), 'slider-stepper-value')`.

    Also revise the pre-existing assertion at strokeSettingsModel.test.ts:773-779 ('lets every dialog slider accept typed values beyond the track range'). It currently requires the `allowOutOfRangeEntry` occurrence count to equal the `<SliderStepper` opening count (8/8 today); the new Stack stepper intentionally omits that prop, so scope the assertion to the PRE-EXISTING sliders (e.g. `expect(freeEntry).toHaveLength(sliders.length - 1)` with a comment naming `Stack position` as deliberately range-clamped). Do not add `allowOutOfRangeEntry` to the Stack stepper to satisfy the old count — the new Stack cell must keep asserting the prop is absent.

    Step 7 — run the package build first (the app imports the new package export through dist), then the two suites, then the app typecheck. Record RED then GREEN.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-physic-paint build && pnpm --dir app exec vitest run src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts && pnpm --dir app typecheck</automated>
  </verify>
  <done>
    The shared truth table passes; both modules render the Stack section with the badge-consistent position law, the dot/serial/position/Above/Below readouts, a release-commit position stepper and Top/Bottom; each gesture calls reorderStroke at most once (the Enter+blur pair collapses to one call and a later gesture is free), the current position calls nothing, and a refused commit re-keys the stepper so the input remounts at the live position instead of keeping the typed text; 2+ or an unlisted id renders the disabled hint with no call; the package builds, both suites pass and the app typechecks.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Brush end-to-end — engine moveStrokeToStackPosition, port placement and the brush bundle</name>
  <files>packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts, app/src/components/physic-paint/view/brushScriptEditionPort.ts, app/src/components/physic-paint/view/brushScriptEditionPort.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    RED first — extend EfxPaintEngine.strokeReorder.test.ts and brushScriptEditionPort.test.ts before the implementations; record the failures.

    Engine (existing harness: createHarness, paintStroke, hLine, order, captureMutations):
    - Five painted strokes A..E (bottom -> top): moveStrokeToStackPosition(C, 1) => [A,B,D,E,C]; (C, 5) => [C,A,B,D,E]; (A, 3) => [B,C,A,D,E].
    - The acceptance ledger allActions keeps its original order after every placement.
    - One placement = exactly one 'move' completed mutation naming the stroke; the redo stack is cleared; undo availability is unchanged; redrawAfterScriptEdit and requestRender run; the undo checkpoint count does not grow.
    - Same position returns false with no notification, no redo-stack change and no reorder.
    - Out-of-range positions clamp (0 moves to the top, 99 to the bottom).
    - A primary and its zero-point continuation travel together and stay contiguous; a physics placeholder (tool 'paint', points []) is never a group start.
    - An erase stroke between two paints is its OWN listing row and is never absorbed: with ledger [A(paint), X(erase), B(paint)] (three rows, A at 3), moveStrokeToStackPosition(A, 1) yields [B, A, X], so A reads position 1 and X stays a separate row. A leading zero-point entry stays pinned at the bottom and is not counted as a row.
    - save()/load() keep the placed order (mirror the existing save/load cell); undo then redo keeps it.
    - Outside the Move tool and for an unknown mutationId the call returns false with no mutation and no notification.
    - A queued finalization is drained before the reorder (the placed group includes the just-finished pending stroke).

    Brush port (existing fake-engine harness):
    - `placeBrushScriptStroke` is lock-gated: a locked context performs no engine call and no flush.
    - An accepted placement calls engine.moveStrokeToStackPosition ONCE with (mutationId, positionFromTop), declares the edit base, and flushes the frame ONCE (engine.getStrokes called once).
    - A refused placement (engine returns false, including same-position) performs no flush and returns false. The boolean is the whole refusal channel: the dialog's own sync nonce (Task 1) re-syncs the readout, so the port adds no extra signal or callback.
    - No context and no engine return false without touching anything.
  </behavior>
  <action>
    Step 1 — packages/efx-physic-paint/src/engine/EfxPaintEngine.ts. Import reorderForStackPosition from './stackOrder'. Add `public moveStrokeToStackPosition(mutationId: number, positionFromTop: number): boolean` beside sendStrokeBackward/sendStrokeForward, documented as the exact-placement sibling of stepStrokeInStack. Implementation: return false unless `state.tool === 'move'`; `flushPendingStrokeFinalizations()` first; `live = liveActionsInPaintOrder()`; find `primaryIndex` for the entry with the same mutationId, `tool === 'paint'` and points, returning false when absent. Partition `live` into groups walking once, with NO new grouping law: start a new group at EVERY entry with `points.length > 0` regardless of tool — the SAME boundary `normalizeLogicalBrushes` uses for the dialog rows (recordedStrokeGroups.ts:32-34), so an erase stroke between two paints is its own group and is never absorbed — and append every zero-point entry to the current group so continuations follow their primary. Entries before the first points-bearing entry go into a separate `leading` array (the listing drops them, so they are never counted as a group) and are re-prepended on flatten. Record each live index's group index during the walk; fromIndex is the group of primaryIndex (the moving entry must still be `tool === 'paint'` with points, matching stepStrokeInStack's movable predicate). Call `const { items, changed } = reorderForStackPosition(groups, fromIndex, positionFromTop)`; return false when unchanged; assign `this.strokeStack = [...leading, ...items.flat()]`. Then apply the stepStrokeInStack commit contract verbatim: `redoStack = []`, `notifyHistoryAvailability()`, `displayCompositeDirty = true`, `redrawAfterScriptEdit()`, `requestRender()`, ONE `notifyCompletedMutation('move', mutationId)`, keep moveHoverTargetId, return true. Do not touch allActions, the undo stack or the serial map.

    Step 2 — extend EfxPaintEngine.strokeReorder.test.ts with a new describe for exact placement using the existing harness, paintStroke/hLine/order/captureMutations and the direct allActions/strokeStack injection pattern for continuation cases. Cover the truth table, ledger immutability, single notification, redo clear, same-position and out-of-range behavior, group travel, save/load, undo/redo, tool and unknown-id refusals.

    Step 3 — brushScriptEditionPort.ts. Add `moveStrokeToStackPosition(mutationId: number, positionFromTop: number): boolean;` to BrushScriptEditionEngine. Add `placeBrushScriptStroke(mutationId: number, positionFromTop: number): boolean` mirroring stepBrushScriptStroke exactly: resolveEdition, refuse when null or locked, declareEditBase, one engine call, and only on true one `flushBrushScriptFrame(resolved.frame, resolved.engine.getStrokes(), resolvePaintSettings(resolved.engine))`; return the engine verdict. Do not touch the shared ScriptStrokeEditionPort.

    Step 4 — extend brushScriptEditionPort.test.ts: add moveStrokeToStackPosition to createFakeEngine, import placeBrushScriptStroke, and add the lock/accepted/refused/no-context cells with the existing getStrokes call-count flush assertion.

    Step 5 — PhysicsPaintStudio.tsx. Import placeBrushScriptStroke and add `reorderStroke: (mutationId, positionFromTop) => placeBrushScriptStroke(mutationId, positionFromTop)` to the brush StrokeSettingsDialogBundle object. Do not touch the watercolor branch in this task.

    Step 6 — run the engine suite, then the package build (the app runtime consumes dist), then the app port suite and the app typecheck. Record RED then GREEN.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.strokeReorder.test.ts && pnpm --dir packages/efx-physic-paint build && pnpm --dir app exec vitest run src/components/physic-paint/view/brushScriptEditionPort.test.ts && pnpm --dir app typecheck</automated>
  </verify>
  <done>
    In Brush Move, committing a Stack position reorders strokeStack to the exact target in one engine commit plus one flush, keeps the ledger and undo availability intact, clears a stale redo, notifies one 'move', travels with continuations, survives save/load and undo/redo, refuses off-tool/unknown/same/locked; engine and port suites plus the package build and app typecheck pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Water color end-to-end — script placement, snapshot edit, Studio handler and live wiring</name>
  <files>app/src/components/physic-paint/view/aquarelleRecordState.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.ts, app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    RED first — extend aquarelleRecordState.reorder.test.ts before the implementations; record the failures.

    Record state (existing helpers: recordAquarelleStroke, emitAquarelleDry, getRecordedAquarellePayloadTimeline, getRecordedAquarelleStroke, getAquarelleEventsForFrame, aquarelleStrokesRevision):
    - Four strokes on one frame (bottom -> top 9101..9104): placing 9104 at 1 (already top) and 9102 at 3 (its live position) both return false with the order unchanged; placing 9102 at 1 gives [9101,9103,9104,9102]; placing 9102 at 4 gives [9102,9101,9103,9104]; placing 9101 at 1 gives [9102,9103,9104,9101]; an out-of-range position 99 clamps to the bottom.
    - Dry events keep the SAME object and the SAME absolute index; other-frame strokes keep the SAME object and absolute index; the returned timeline slots for same-frame strokes are the collected slots.
    - recordedOrder and engine.timestamp across the affected window stay sorted ascending in the new paint order (the bake settle-gap invariant); every other stroke field (pts, ticks, playFrame, cuisson, points) is unchanged; recorded strokes' timestamps match their new entries.
    - The registry Map insertion order is unchanged; listSelectableAquarelleStrokes reports the new top-relative positions.
    - Revision bumps exactly once on an accepted placement; same-position, out-of-range-that-clamps-to-the-same-position, unknown id, deleted id and an entry absent from the timeline return false and bump nothing; the timeline array is object-identical in every refusal.
    - beginAquarellePlaceEdit returns an edit whose undo restores the previous order and whose redo restores the new order; the selection is kept; the in-flight guard returns null; a single-stroke frame cannot place anywhere and returns null without storing an edit.

    Studio wiring (structural pins appended to app/src/components/physic-paint/PhysicsPaintStudio.test.ts, which reads PhysicsPaintStudio.tsx as a source string — the existing positive-contains style plus the file's usual not.toContain guards):
    - The watercolor StrokeSettingsDialogBundle carries `reorderStroke: (mutationId, positionFromTop) => handleAquarellePlaceStroke(mutationId, positionFromTop),`.
    - The `strokeSettingsDialogPropsMemo.resolve(` dependency region (up to the factory's `() => {`) contains `handleAquarellePlaceStroke`.
    - The handler slice from `const handleAquarellePlaceStroke = useCallback(` to `// 261023-g4p: register BOTH module ports` contains, in this order: `beginAquarellePlaceEdit(mutationId, positionFromTop)`, `aquarelleResetSheetRef.current?.();`, `await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`, `rotoMoveHistory.recordAquarelleScriptEdit(editId)`, `restoreAquarelleEditSnapshot(editId, 'undo')`; the four peek-only guards verbatim (`if (isPhysicalMutationLocked()) return;`, `if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;`, `if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;`, `if (isAquarelleScriptEditInFlight()) return;`) and `setAquarelleScriptEditInFlight(false)` inside a `finally`; and none of `engineRef`, `clipboard`, `applyCurrentScript`.
  </behavior>
  <action>
    Step 1 — aquarelleRecordState.ts. Import reorderForStackPosition and targetIndexForStackPosition from './stackOrder'. Add `export function placeAquarelleStrokeInScript(mutationId: number, positionFromTop: number): boolean` beside stepAquarelleStrokeInScript, documented with the same recording-slot law. Steps: resolve the moving entry from recordedStrokeEntries, refusing when absent, deleted, or not in payloadTimeline. Walk payloadTimeline once and collect the absolute indices of every same-frame non-dry stroke entry: skip `isAquarelleDryEvent(event)`, skip `event.playFrame !== entry.playFrame`, skip entries without an engine mutationId and deleted ids; keep the collected entries in their timeline order (bottom -> top). Locate fromIndex = collected.indexOf(entry) and return false when negative. Call `const { items: next, changed } = reorderForStackPosition(collected, fromIndex, positionFromTop)`; return false when unchanged. Compute lo/hi = min/max(fromIndex, targetIndexForStackPosition(positionFromTop, collected.length)); take `slots = collected.slice(lo, hi + 1).map((event) => event.recordedOrder)` sorted ascending; take `window = next.slice(lo, hi + 1)`; for each k, build `withRecordedSlot(window[k], slots[k])` and write it back at `payloadTimeline[collectedIndices[lo + k]]`; update `recordedStrokeEntries` and `recordedStrokes` (replace the stroke object with the same fields and the new timestamp) for every affected stroke id. Entries outside the affected window, all Dry events and every other-frame entry are never touched. Call `bumpAquarelleStrokesRevision()` once and return true. Never mutate an entry or stroke object, never reorder the registry Map, never write engine units.

    Step 2 — aquarelleStrokeSelection.ts. Import placeAquarelleStrokeInScript. Add `export function beginAquarellePlaceEdit(mutationId: number, positionFromTop: number): number | null` mirroring beginAquarelleReorderEdit exactly: clearAquarelleStrokeDrag, return null while aquarelleScriptEditInFlight, capture the before snapshot, return null when placeAquarelleStrokeInScript reports false, capture the after snapshot, store and return the edit id.

    Step 3 — PhysicsPaintStudio.tsx. Import beginAquarellePlaceEdit. Add `handleAquarellePlaceStroke = useCallback((mutationId: number, positionFromTop: number) => { ... })` mirroring handleAquarelleStepStroke: the same guard chain in the same order (isPhysicalMutationLocked, rotoScript.applying.peek() / mutationLocked.peek(), currentCell.peek().kind !== 'real', isAquarelleScriptEditInFlight), beginAquarellePlaceEdit, null => return, set in-flight, fire the async block that resets the sheet, awaits rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame)) with `playFrame = launchContextRef.current?.startFrame ?? 0`, records rotoMoveHistory.recordAquarelleScriptEdit(editId) + clears the error on success, or restores restoreAquarelleEditSnapshot(editId, 'undo') plus the refusal message ending in '— the stroke order was restored.' on failure, and clears the in-flight flag in finally. Reuse the exact dependency list shape of handleAquarelleStepStroke. Insert the handler immediately AFTER handleAquarelleStepStroke's closing `], );` and BEFORE the `// 261023-g4p: register BOTH module ports` comment (the structural pins slice to that anchor). Add `reorderStroke: (mutationId, positionFromTop) => handleAquarellePlaceStroke(mutationId, positionFromTop),` to the watercolor bundle and append handleAquarellePlaceStroke to the strokeSettingsDialogPropsMemo dependency array.

    Step 4 — extend aquarelleRecordState.reorder.test.ts with a new describe using fresh frames per cell (the existing file's isolation practice) covering the truth table, dry/other-frame identity and indices, slot monotonicity, field preservation, registry order, revision bumps, refusals and the snapshot undo/redo + in-flight cells.

    Step 5 — extend PhysicsPaintStudio.test.ts (a new describe beside the 261022-tv1 watercolor stroke move wiring one) with the structural pins listed in <behavior>: the watercolor bundle `reorderStroke` arrow, the memo dependency region containing handleAquarellePlaceStroke, and the handler slice with its ordered edit sites, four guards and finally clear. Anchor the handler end at `// 261023-g4p: register BOTH module ports` and keep the existing positive-contains style (a few not.toContain guards, as the step-handler pins already do).

    Step 6 — run the five targeted app suites and the typecheck; record RED then GREEN.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/view/brushScriptEditionPort.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --dir app typecheck</automated>
  </verify>
  <done>
    In Water color Select, committing a Stack position reorders the same-frame stroke entries to the exact target, re-stamps the recording slots by position, leaves dry and other-frame entries object-identical at their indices, bumps one revision, resets the sheet and re-bakes once as ONE aquarelle-script edit; undo/redo restore the two orders; refusals (lock, in-flight, same position, unknown/deleted) change nothing, leave the live readout on the real order (the Task 1 nonce remount) and issue no second call; both bundles are wired, the Studio structural pins cover the watercolor handler order and the memo dependency, and all five targeted app suites plus typecheck pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

None. This plan touches a local desktop UI control, in-memory engine paint order and the in-memory watercolor script order. There is no authentication, network transport, IPC payload parsing, user-supplied file parsing or persisted-format change; the saved document already serializes the same paint order through the existing save/load path.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261024-vga-01 | Tampering | stroke stack order (in-memory) | low | accept | Order is user-authored local state; the same trust level as the existing '<' / '>' step and the Move drag. No new surface. |
| T-quick-261024-vga-SC | Tampering | package installs | high | mitigate | No new dependency is added by this plan; the package build uses the already-installed tsup. Keep the blocking package-legitimacy gate if any install is proposed mid-execution. |
</threat_model>

<verification>
Automated (cwd = checkout root):
1. `pnpm --dir packages/efx-physic-paint build` — the new package export is visible to the app through dist.
2. `pnpm --dir app exec vitest run src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/brushScriptEditionPort.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
3. `pnpm --dir app exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.strokeReorder.test.ts`
4. `pnpm --dir app typecheck`

Native UAT (user-driven; record the verdicts in the SUMMARY):
1. Brush: one stroke -> dot/#serial/position match the Move badge; Above/Below correct with an em dash at the edges.
2. Brush: type 1 then stackTotal -> top/bottom; badge + Above/Below update; one re-bake per commit; committing the current position changes nothing.
3. Water color: same Stack section; type 1 then stackTotal -> the sheet re-bakes in the new order; badges + Above/Below update.
4. Water color: Undo/Redo is ONE script edit; a refused placement (in-flight/lock) leaves both the readout text and the control at the live position (the typed value never persists and never feeds the next +/- step); rapid Top then Bottom refuses the second cleanly and the control settles on the real order.
5. Both: 2+ selected -> disabled + hint; '<' / '>' still step one stroke and Stack follows; Stack alone does not change '<' / '>'.
6. Both: Save -> reopen -> the order persists and matches the badges.
7. Both: physical lock -> refuse, order unchanged, and the Stack position readout snaps back to the live position instead of keeping the typed text.
</verification>

<success_criteria>
- Exactly one index implementation (`reorderForStackPosition`) is consumed by the engine and both app adapters; the shared truth table is green.
- The Stack section renders for both modules from the existing listStrokes rows, with no local list state (the only added signal is the ref-held sync nonce); 2+ or an unlisted id disables it with the hint and issues no reorder.
- One user gesture issues at most one bundle.reorderStroke call (the Enter+blur pair collapses, later gestures stay free), and every commit attempt re-keys the `Stack position` stepper so a refused commit remounts the input at the live stackPosition — pinned by unit tests that read the vnode key and the mounted input's value, not just a re-render.
- `reorderForStackPosition` is `readonly T[]` in and out, so the unchanged case returns the input reference with no cast and the package dts build passes.
- Brush placement obeys the Move-commit contract and survives save/load and undo/redo; watercolor placement is one snapshot edit plus one re-bake with dry and other-frame entries untouched.
- Package build, the five app suites, the engine suite and the app typecheck pass from the checkout root; no watch mode, no server, no new dependency, no persisted field, no version bump, no change to '<' / '>'.
</success_criteria>

<output>
Create `.planning/quick/261024-vga-stack-order-control-for-brush-move-and-w/261024-vga-SUMMARY.md` when done
</output>
