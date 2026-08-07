# Phase 43: Hold Loop Clips + Integrated Loop Rail - Pattern Map

**Mapped:** 2026-08-07
**Scope:** Correction refresh after native UAT Step 1 host failure
**Planning authority:** `43-CONTEXT.md` D-33..D-49 and `43-UI-SPEC.md`

## Correction Boundary

Loop Clip presentation and edit activation are owned exclusively by EFX Paint/Roto.

- **Retain unchanged:** canonical physical model, persistence, resolver algebra, store resolution, preview/export parity, physical-edit authority, accepted history, Play Script controller, and Play Script dialog.
- **Own inside EFX Paint/Roto:** the integrated 3px Loop Rail, its 12px interaction targets, rail tooltip, local actions popover, contextual Scripts inspector, and Studio-local `openLoopEdit(loopId)` activation.
- **Remove from the Motion Editor:** Loop Clip projection, timeline types, drawing, hit testing, tooltip mounting, keyboard/action routing, and the specialized main-to-child Loop Clip protocol after callers are gone.
- **Preserve generic Motion Editor consumption:** resolved Paint pixels for preview, playback, save/reopen, and export.

The rail is an absolute overlay at the top edge of the existing 38px physical-frame row. It adds zero row height, keeps the workflow strip at 161px, shares the existing horizontal scroller, and never changes physical-cell navigation, selection, multi-selection, drag, linked indicators, or the 34px action toolbar.

## File Classification

| File | Role | Data flow | Closest current analog |
|---|---|---|---|
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | focused Preact component | canonical visible ranges + shared selection → rail paint, tooltip, focus, local actions | `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintStyledTooltip.tsx` |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | pure presentation utility | resolver ranges + visible window → immutable rail geometry/copy/state | `physicsPaintWorkflowPresentation.ts` |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipPopover.tsx` | EFX-local non-modal dialog | selected loop + controller ports → accepted-only operations and focus restoration | `UsagePopover.tsx`, `PhysicsPaintStyledTooltip.tsx` |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | rail host | workflow view model → ruler + physical row containing rail overlay + cells | existing physical-row composition in the same file |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | contextual inspector | selected-loop projection → Play/Edit slot and seven facts | existing Scripts selection, summary, and inline rename patterns |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | coordinator | controller/signals → focused rail, popover, and sidebar ports | existing Roto timeline and Play Script controller wiring |
| `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts` | identity-memo boundary | Signals/controller state → stable workflow/sidebar props | existing dependency-keyed identity memo |
| `app/src/components/physic-paint/physicsPaintStudio.css` | geometry and state styles | rail/sidebar/popover state → paint without layout mutation | existing strip, cell, sidebar, tooltip, and focus tokens |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` | component contract | geometry, events, keyboard, focus, tooltip, accepted-operation focus | `PhysicsPaintWorkflowStrip.test.ts` |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | pure contract | canonical fixtures → geometry, copy, state precedence | pure workflow presentation tests |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipPopover.test.tsx` | interaction contract | operation result fixtures → lifecycle and focus destinations | controller/history tests plus popover tests |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx` | contextual UI contract | normal/loop/busy/error fixtures → inspector and action-slot behavior | existing Scripts panel tests |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | host regression | loop/no-loop fixtures → unchanged strip/cell/toolbar geometry | existing exact CSS/source contracts |
| `app/src/lib/frameMap.ts` | Motion Editor residue removal | generic frame-map output only | no Loop Clip replacement in this tier |
| `app/src/types/timeline.ts` | Motion Editor type removal | generic timeline types only | canonical Loop Clip types remain in physic-paint domain |
| `app/src/components/timeline/TimelineRenderer.ts` | Motion Editor render removal | generic timeline paint only | EFX rail is the sole Loop Clip presentation |
| `app/src/components/timeline/TimelineInteraction.ts` | Motion Editor input removal | generic timeline interaction only | EFX rail/popover own Loop Clip input |
| `app/src/components/timeline/TimelineCanvas.tsx` | Motion Editor mount removal | no Loop Clip floating UI | EFX-local tooltip/popover mount |
| `app/src/components/timeline/TimelineCapsuleTooltip.tsx` | delete obsolete surface | no retained caller | EFX tooltip/popover cover approved facts/actions |
| `app/src/components/timeline/loopCapsuleGeometry.ts` | delete obsolete namespace | no retained caller | `physicsPaintLoopClipPresentation.ts` owns compact rail projection |
| `app/src/lib/physicPaintBridge.ts` | partial protocol removal | generic launch/context/authority/apply/save/frame-sync only | local Studio controller owns Loop Clip actions |
| `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` | partial protocol removal | generic Browser/Tauri transport only | existing generic transport tests |
| `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` | partial hook removal | generic parent bridge lifecycle only | direct local controller calls for Loop Clips |
| `app/src/types/physicPaint.ts` | partial type removal | canonical physical and generic bridge types only | local controller result types |

## Integrated Rail Pattern Assignment

### Host and geometry

Mount `PhysicsPaintLoopClipRail` inside the existing physical-row containing block, alongside the physical cells rather than as another scroller child or workflow row.

Required structure:

```tsx
<div class="physics-paint-lane">
  <div class="physics-paint-roto-cells" role="row">...</div>
  {hasVisibleLoopClips && (
    <PhysicsPaintLoopClipRail
      resolutionContext={rotoLoopResolutionContext}
      visibleWindow={visibleFrameWindow}
      framePitch={18}
      selectedLoopClipId={selectedLoopClipId}
      ...
    />
  )}
</div>
```

Rules:

- The rail host is absolute at `top: 0` inside the 38px row.
- Visible paint is exactly 3px high.
- Each loop has one transparent 12px-high target.
- Effective `0f` uses the approved 8×6 flag and 12×12 target.
- Empty canonical ranges render no rail group, target, label, or reserved space.
- Geometry uses accepted half-open ranges and the existing visible window at 18px per frame.
- Long ranges clip at the existing horizontal viewport and return on shared scroll.
- No repeated-frame DOM, repeated asset, repeated cache, or Infinity list is created.

### Pure projection

`physicsPaintLoopClipPresentation.ts` owns host-neutral derivation:

- derived display name without persisting a new field;
- finite/infinity Cycle copy;
- Effective duration and status copy;
- visible-window clipping;
- normal, truncated, unresolved, busy, rejected, and Effective `0f` presentation state;
- canonical placement ordering;
- action applicability and accessible names.

Follow the exhaustive helper pattern from `physicsPaintWorkflowPresentation.ts`:

- no store or Signal reads;
- no DOM access;
- immutable inputs and outputs;
- exhaustive discriminated-union switches;
- no duplicated boundary algebra;
- no raw identifier fallback in product copy.

### Preact state boundary

Use one Studio/session selected-loop Signal shared by the rail and Scripts inspector.

- Prefer direct/computed projection from canonical state.
- Do not mirror Signal values into hook state with synchronization effects.
- Keep pending/rejection/focus intent in Signals when multiple EFX-local controls consume it.
- Use hooks only for external document listeners, measured viewport placement, and focus cleanup.
- Keep presentation algorithms out of `PhysicsPaintStudio.tsx`; expose focused ports through `usePhysicsPaintStudioViewModel.ts`.

### Tooltip pattern

Reuse `PhysicsPaintStyledTooltip.tsx` conventions:

- existing 1000ms pointer delay;
- immediate keyboard-focus visibility;
- fixed viewport placement above the rail when space permits;
- 8px viewport clamp and existing flip behavior;
- exact line order: display name, Cycle, Effective, status;
- escaped text and full accessible values;
- Escape hides transient tooltip state without changing loop selection.

### Local actions popover

Use the portal/outside-click isolation pattern from `UsagePopover.tsx`, adapted as a non-modal labelled dialog.

- Facts appear before actions.
- Actions follow Duplicate, Repair, Relink, Unlink, Delete order when applicable.
- Forward only existing EFX-local controller ports.
- Await explicit accepted results; never infer success from dispatch or pending state.
- Rejection keeps the surface open, preserves selection/focus/input/geometry, and announces the exact reason.
- Pointer-open preserves the rail trigger; Space-open focuses the first applicable action.
- Escape restores the invoking rail target.
- Accepted Duplicate/Repair/Relink restore the surviving selected rail target.
- Accepted Unlink/Delete select and focus the nearest visible loop by canonical placement order.
- If no loop survives, clear loop selection, restore normal Scripts context, and focus the Scripts tab.

### Edit activation

Rail double-click, focused Enter, and contextual sidebar Edit all call:

```ts
physicsPaintRotoPlayScriptController.openLoopEdit(loopId)
```

The call is Studio-local and occurs exactly once. Double-click closes tooltip/popover and suppresses the second single-click effect. No Motion Editor request, retry, listener, or launch bridge participates.

## Contextual Scripts Inspector Pattern

Reuse the existing Scripts tab, toolbar slot, resizer, scrollbar, and inline rename behavior.

- Normal selected script keeps `Play Script`.
- Selected Loop Clip replaces that same primary slot with Lucide Pencil/Edit.
- Inspector order is display name, source script, placement, Cycle, Effective, mode, status.
- Use an 88px label column and `minmax(0, 1fr)` values.
- Long values ellipsize without horizontal scrolling; styled tooltip and ARIA expose full text.
- Source script rename remains a text-button interaction; no rename Pencil is added.
- Busy/rejected state preserves accepted facts and exposes discoverable reasons.
- Clearing loop selection restores normal script context without mutating records.

## CSS Pattern

The existing strip geometry remains authoritative:

```css
.physics-paint-studio {
  grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px;
}

.physics-paint-workflow-strip {
  height: 161px;
  overflow-y: hidden;
}

.physics-paint-lane {
  position: relative;
  height: 38px;
  min-width: 2160px;
}

.physics-paint-loop-clip-rail {
  position: absolute;
  inset: 0 auto auto 0;
  width: 2160px;
  height: 12px;
  overflow: visible;
  pointer-events: none;
}

.physics-paint-loop-clip-target {
  position: absolute;
  top: 0;
  height: 12px;
  pointer-events: auto;
  cursor: pointer;
}

.physics-paint-loop-clip-segment {
  height: 3px;
  pointer-events: none;
}
```

Apply existing UI-SPEC colors and precedence without changing geometry. Do not add a loop-present height modifier, another scrollbar, another grid row, or vertical canvas allocation. Preserve the accepted blue linked-cell inset border and 4px dot exactly.

## Interaction Isolation Pattern

The rail target owns only Loop Clip intent in the top 12px band.

- Stop `pointerdown`, `click`, `dblclick`, Enter, Space, and Escape propagation before cell handlers.
- Single click selects only the loop, focuses the target, and may open local actions.
- Pointer down does not navigate, select a real key, alter multi-selection, arm drag, or capture the pointer.
- Enter edits; Space selects and opens actions; Escape closes transient UI.
- Delete/Backspace do not mutate the loop from rail focus.
- Arrow keys do not move the loop.
- Existing physical-cell behavior remains unchanged below the rail band and for full-cell keyboard activation.
- No placement drag threshold, preview, drop target, or mutation is introduced per D-41.

## Accepted-Only Authority Pattern

All mutations continue through `physicsPaintRotoPlayScriptController.ts`, the physical-edit coordinator, parent authority, exact acknowledgement, atomic commit, and history.

- No presentation component duplicates guards, revision checks, source validation, publication construction, or resolver algebra.
- No canonical rail width, Cycle, Effective, status, source reference, or inspector fact changes before accepted state.
- Undo/Redo replays complete accepted physical snapshots.
- Delete and Unlink remain unlink-only and preserve source keys.

## Motion Editor Removal Assignments

After the EFX replacement is green:

1. Remove `loopCapsules` projection/builders from `frameMap.ts`.
2. Remove main-timeline capsule fields/types from `types/timeline.ts`.
3. Remove Loop Clip drawing from `TimelineRenderer.ts`.
4. Remove Loop Clip hit, hover, focus, selection, keyboard, and operation routing from `TimelineInteraction.ts`.
5. Remove the Loop Clip tooltip mount/state from `TimelineCanvas.tsx`.
6. Delete `TimelineCapsuleTooltip.tsx` and `loopCapsuleGeometry.ts` after zero callers are proven.
7. Remove specialized Loop Clip bridge clients/events/envelopes/senders/listeners only after all callers are gone.
8. Retain generic launch/focus, project context, authority/apply-result, save, and frame-sync transport.

The Motion Editor may consume resolved pixels but must not retain a read-only Loop Clip summary, hidden hit region, keyboard shortcut, navigation adapter, or edit route.

## Regression Test Assignments

### Tracer: all nine checks

Primary files:

- `PhysicsPaintLoopClipRail.test.tsx`
- `PhysicsPaintWorkflowStrip.test.ts`
- `PhysicsPaintScriptsPanel.test.tsx`
- existing `TimelineRenderer.test.ts`
- existing `TimelineInteraction.test.ts`

Prove together:

1. strip 161px and physical row 38px with loops and without loops;
2. cells, outlines, linked indicators, drag feedback, and toolbar remain operable;
3. 3px paint, 12px target, and no-loop DOM absence;
4. tooltip placement and exact facts;
5. loop-only single-click selection;
6. double-click and Enter open local Edit once;
7. Play-to-Edit contextual sidebar with seven facts;
8. accepted blue linked indicators unchanged;
9. zero Motion Editor Loop Clip UI or input.

### Rail state and accessibility

`physicsPaintLoopClipPresentation.test.ts` and `PhysicsPaintLoopClipRail.test.tsx` own:

- normal, hover, selected, focused, busy, truncated, unresolved, rejected, and 0f states;
- exact state precedence without geometry changes;
- one tab stop per loop in placement order;
- accessible names, pressed/busy/described-by semantics;
- tooltip order, viewport clamp, long text, and reduced motion;
- no placement drag behavior.

### Popover and focus restoration

`PhysicsPaintLoopClipPopover.test.tsx` owns:

- facts/action order and applicability;
- accepted-only close/update;
- rejection preservation and exact reason;
- outside click and Escape;
- viewport overflow and long text;
- Duplicate/Repair/Relink focus to the surviving selected target;
- Unlink/Delete focus to the nearest loop by placement order;
- empty result focus to Scripts with normal context restored.

Controller/history suites remain verification oracles unless production behavior genuinely requires an added assertion.

### Sidebar and modal

`PhysicsPaintScriptsPanel.test.tsx` owns contextual inspector, Play/Edit slot, seven facts, loading/error/partial/overflow/long-text states, and text-only rename distinction. `PhysicsPaintPlayScriptDialog.test.tsx` remains the carried-forward modal oracle for loading, rejection, unresolved recovery, focus/input preservation, and compact overflow.

### Structural removal

- `frameMap.test.ts`: no Loop Clip projection while generic ordering/layout remains.
- `TimelineRenderer.test.ts`: no Loop Clip draw route while generic paint remains.
- `TimelineInteraction.test.ts`: former coordinates and keys emit no Loop Clip intent.
- TimelineCanvas source contract: no Loop Clip tooltip mount/state.
- Bridge tests: no specialized Loop Clip protocol while generic Browser/Tauri transport remains.
- Repository reference checks: zero callers for removed tooltip, geometry, event, client, sender, hook, and envelope identifiers.

### Retained canonical regressions

Continue running resolver, persistence, controller, history, materialization, linked-cell, preview, export, determinism, typecheck, build, and dependency-diff gates. These suites prove the UI correction did not rewrite HOLD-01..05 authority or D-24..D-32 algebra/performance.

## Retained Unchanged

| Area | Retained responsibility |
|---|---|
| `physicsPaintRotoPhysicalModel.ts` | persisted compact Loop Clip records and revision authority |
| `physicsPaintRotoPhysicalResolver.ts` | canonical ranges, boundaries, lazy modulo, unresolved handling |
| `physicPaintStore.ts` | structural/render-source resolution and source-scoped cache identity |
| physical edit coordinator/history | accepted-only atomic commit and Undo/Redo |
| `physicsPaintRotoPlayScriptController.ts` | Loop/Source Edit and Duplicate/Repair/Relink/Unlink/Delete operations |
| `PhysicsPaintPlayScriptDialog.tsx` | existing Studio-local modal lifecycle |
| `previewRenderer.ts` / `exportEngine.ts` | valid-loop parity and unresolved placeholder/export block |
| generic Physics Paint bridges | launch, context, authority, apply-result, save, frame sync |

## No New Dependency

No package install, registry block, schema field, persisted loop name, state library, tooltip system, modal system, or alternate mutation path is introduced.
