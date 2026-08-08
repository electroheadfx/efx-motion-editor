# Phase 43: Hold Loop Clips + Integrated Loop Rail - Pattern Map

**Mapped:** 2026-08-07
**Scope:** Correction refresh after native UAT Step 1 host failure
**Planning authority:** `43-CONTEXT.md` D-33R..D-58 and `43-UI-SPEC.md`

## Correction Boundary

Loop Clip identity, presentation details, and edit activation are owned exclusively by EFX Paint/Roto. The Motion Editor owns only passive interval paint.

- **Retain and extend narrowly:** canonical physical model, persistence, resolver algebra, store resolution, preview/export parity, physical-edit authority, accepted history, Play Script controller/dialog, and the current-document background field. Extend only the existing physical publication to carry Play Script background and complete `nextLoopClips` staging.
- **Own inside EFX Paint/Roto:** the integrated 3px Loop Rail, its 12px interaction targets, plural rail selection plus one primary inspector identity, rail tooltip, contextual Scripts inspector, Studio-local `openLoopEdit(loopId)` activation, and mode-specific Key Spacing authorization. The proposed dedicated actions popover is superseded.
- **Retain minimally in the Motion Editor:** a paint-only interval type `{startFrame, frameCount, mode}`, projection from canonical effective ranges, and a pure Canvas painter for 3px purple/cyan strips with white canonical endpoint cuts inside the existing PPaint FX bar.
- **Remove from the Motion Editor:** `loopCapsules`/`loopClips`, IDs, source keys, repeat metadata, status, selection, callbacks, commands, rich capsule drawing, hit testing, tooltip mounting, hover/focus, keyboard/action routing, navigation, mutation, and the specialized main-to-child Loop Clip protocol after callers are gone.
- **Preserve generic Motion Editor consumption:** resolved Paint pixels for preview, playback, save/reopen, export, and generic FX-track behavior beneath the passive paint.

The rail is an absolute overlay at the top edge of the existing 38px physical-frame row. It adds zero row height, keeps the workflow strip at 161px, shares the existing horizontal scroller, and never changes physical-cell gesture semantics, drag behavior, linked indicators, or the 34px action toolbar. Rail activation clears physical selection only to enforce the explicit mutually exclusive selection modes.

## File Classification

| File | Role | Data flow | Closest current analog |
|---|---|---|---|
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | focused Preact component | canonical visible ranges + shared selection → rail paint, tooltip, focus, and Studio-local Edit activation | `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintStyledTooltip.tsx` |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | pure presentation utility | resolver ranges + visible window → immutable rail geometry/copy/state | `physicsPaintWorkflowPresentation.ts` |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | rail host | workflow view model → ruler + physical row containing rail overlay + cells | existing physical-row composition in the same file |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | contextual inspector | selected-loop projection → Play/Edit slot and seven facts | existing Scripts selection, summary, and inline rename patterns |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | coordinator | controller/signals → focused rail and sidebar/Edit ports | existing Roto timeline and Play Script controller wiring |
| `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts` | identity-memo boundary | Signals/controller state → stable workflow/sidebar props | existing dependency-keyed identity memo |
| `app/src/components/physic-paint/physicsPaintStudio.css` | geometry and state styles | rail/sidebar state → paint without layout mutation | existing strip, cell, sidebar, tooltip, and focus tokens |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` | component contract | geometry, events, keyboard, focus, tooltip, and exact-once Edit activation | `PhysicsPaintWorkflowStrip.test.ts` |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | pure contract | canonical fixtures → geometry, copy, state precedence | pure workflow presentation tests |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.tsx` | contextual UI contract | normal/loop/busy/error fixtures → inspector and action-slot behavior | existing Scripts panel tests |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | host regression | loop/no-loop fixtures → unchanged strip/cell/toolbar geometry | existing exact CSS/source contracts |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | timing/provenance authority | ordered real source keys → offsets/cycle duration; selected linked frames → exact source-position provenance | existing canonical per-frame loop resolution |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` | D-11/D-57 guard contract | valid rail/one-cycle physical scope → atomic ordered ripple; every other linked structural mutation → fail closed | existing Force Spacing and source-key guard suite |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Apply-time scope authority | current rail or physical selection + records/Loop Clips/interpolation/capacity/launch → immutable mode-specific resolver intent | existing timeline action snapshot/publication path |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` | atomic staging and background publication | records + complete Loop Clips + Play Script background → deferred accepted settlement/rollback | existing complete snapshot and history boundary |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts` | timed-loop contract | spaced source positions → finite/Infinity repeats, generated interiors, shared-loop cadence | existing lazy modulo/boundary suite |
| `app/src/lib/frameMap.ts` | Motion Editor minimal projection | canonical effective ranges → paint-only `{startFrame, frameCount, mode}` markers | no identity or authoring metadata in this tier |
| `app/src/types/timeline.ts` | Passive marker type boundary | minimal paint marker type only; rich `TimelineLoopCapsule` types removed | canonical Loop Clip types remain in physic-paint domain |
| `app/src/components/timeline/TimelineRenderer.ts` | Passive marker paint | pure Canvas painter draws 3px purple/cyan strips and white canonical endpoint cuts inside the existing PPaint FX bar | EFX rail remains the sole interactive Loop Clip presentation |
| `app/src/components/timeline/TimelineInteraction.ts` | Motion Editor input removal | generic timeline interaction only; marker is never hit-tested | EFX rail/sidebar own Loop Clip input |
| `app/src/components/timeline/TimelineCanvas.tsx` | Motion Editor mount removal | no Loop Clip floating UI | EFX-local tooltip/sidebar/Edit surfaces |
| `app/src/components/timeline/TimelineCapsuleTooltip.tsx` | delete obsolete surface | no retained caller | EFX tooltip/sidebar cover approved facts |
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

### No dedicated actions popover

D-59 supersedes the proposed `PhysicsPaintLoopClipPopover` and its anchored facts/actions lifecycle.

- Plain/range/toggle rail gestures update session selection and contextual Scripts inspector state only.
- Do not add portal placement, outside-click listeners, popover focus state, action ordering, or trigger-to-action keyboard flow.
- Canonical Duplicate, Repair, Relink, Unlink, and Delete controller methods remain internal authority and regression oracles; Phase 43 does not expose them through a new component.
- Do not compensate with a specialized bridge, hidden menu, context menu, or rail keyboard shortcut.

### Edit activation

Rail double-click, focused Enter, and contextual sidebar Edit all call:

```ts
physicsPaintRotoPlayScriptController.openLoopEdit(loopId)
```

The call is Studio-local and occurs exactly once. Double-click hides the tooltip and does not create another transient surface. No Motion Editor request, retry, listener, or launch bridge participates.

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

## Timed Source Cycle and Rail-Owned Key Spacing Pattern

### Runtime source offsets and cycle duration

The ordered real source keys are the only timing authority.

```ts
const sourceStart = sourceKeys[0].appFrame
const sourceOffsets = sourceKeys.map((key) => key.appFrame - sourceStart)
const cycleDuration = sourceOffsets[sourceOffsets.length - 1] + 1
```

Requirements:

- `sourceKeyIds` keeps canonical order; each ID resolves to one real key and its authoritative `appFrame`.
- Offsets are normalized from the first source key. Non-uniform gaps are intentional timing, not missing records.
- Runtime finite/Infinity repeat resolution uses `cycleDuration`; exact offsets resolve source keys and interior frames use the existing generated path without materialized records.
- Rail duration, preview, playback, export, cache regeneration, and save/reopen consume the same accepted timing.
- A source-attached Loop Clip may change `placementStart` when its first source key moves. Repeat, Infinity, ordered source IDs, mode, loop ID, script provenance, motion, and override color never change during Key Spacing.

### Mutually exclusive session selection model

Keep physical and rail selection outside the persisted document:

```ts
type PhysicalSelection = Readonly<{
  selectedKeyIds: readonly string[]
  anchorKeyId: string | null
}>

type LoopRailSelection = Readonly<{
  selectedLoopClipIds: readonly string[]
  anchorLoopClipId: string
  primaryLoopClipId: string
}>
```

Semantics:

- Rail mode means physical IDs, physical anchor, and physical proxy scope are empty. Physical mode means rail IDs and rail anchor are empty.
- Plain rail click replaces the selection with one clip; Shift selects the inclusive anchor-to-target range in canonical placement order; Cmd/Ctrl toggles one rail. The primary ID drives the Scripts inspector/Edit target.
- Plain/Cmd/Shift physical selection remains unchanged for ordinary operations and partial same-cycle spacing. Select All clears rail/proxy mode and installs every current real key in physical order.
- Render rail selection from selected Loop Clip IDs only. Derive complete selected-rail source membership from current Loop Clip records at Apply time; do not project that membership into frame-selection props or copy source IDs into another hidden Signal.
- Equivalent linked occurrences mirror selected source identity only during explicit physical proxy selection and remain non-draggable and non-durable. Rail selection paints only the line; generated interiors, gaps, and unresolved frames remain navigation-only.
- Launch reset, deletion/unlink, source regeneration, and stale-cycle reconciliation clear invalid IDs and anchors.

### Apply-time authorization snapshot

Snapshot physical selection, rail selection, records, Loop Clips, interpolation, capacity, and launch identity once.

Rail mode:

1. require rail IDs to be unique, current, and already ordered canonically;
2. derive each selected clip's complete ordered source cycle;
3. reject missing, duplicate-covered, reordered, ambiguous, or overlapping different-cycle authorization;
4. deduplicate identical source cycles;
5. flatten complete cycle IDs as the immutable spacing scope.

Physical mode:

1. use visible `selectedKeyIds` exactly—no hidden proxy may override them;
2. permit linked authorization for at most one current ordered source cycle and at least two selected source positions;
3. reject cross-cycle physical selection with guidance to select Loop Rails;
4. reject mixed linked/unlinked scope, generated interiors, gaps, unresolved frames, stale mapping, reordered selection, and ambiguous provenance;
5. retain legacy unlinked zero/one-key full-timeline fallback only for ordinary non-loop Key Spacing.

### Ordered cumulative ripple

Build one complete immutable key-to-frame mapping:

1. order authorized cycle groups left-to-right;
2. for each group, order its selected source identities by current physical frame;
3. anchor the group's first selected key at its original frame plus cumulative growth from earlier groups;
4. place selected group keys at `anchor + index * (emptyFrames + 1)`;
5. compute `growth = newTail - (oldTail + cumulativeGrowth)`;
6. add that signed growth to every real key strictly after the group's original tail;
7. accumulate growth before processing the next group;
8. reject a selected key crossing a fixed unselected key inside its group's interior;
9. validate final global identity order, unique destinations, non-negative frames, and capacity before proposal creation.

Interpolation is an input, never a side effect: Off leaves empty gaps; On derives generated in-betweens. Do not toggle it automatically.

### Source-attached placement and atomic settlement

A clip is source-attached when its pre-edit `placementStart` equals the pre-edit frame of its first source key. If that key moves, copy the clip with only the accepted placement delta; duplicated placements not attached to the source start remain fixed. Attach the complete changed collection as `candidate.nextLoopClips`; use `null` only when no placement changes.

Stage records first and then the complete Loop Clip collection before publication. Any record replacement failure, Loop Clip replacement failure, transport error, timeout, rejection, or settlement mismatch restores the complete before snapshot and creates no history. Acceptance produces one complete history command; Undo restores rhythms and placements together, and Redo reapplies them together. No occurrence write, optimistic placement, separate Loop Clip transaction, persisted selection/provenance, or partial shared-loop publication is permitted.

### Play Script background snapshot

`PhysicsPaintStudio` exposes a live `getBackgroundMetadata()` port backed by `buildRotoBackgroundMetadata(settings)`. Snapshot it when generation builds the physical publication and forward it through the Play Script controller, hook, coordinator input, strict physical payload, and parent bridge. The strict guard requires `rotoBackground` for `operationKind === 'play-script'` and rejects it for every ordinary physical edit kind. `applyPhysicPaintRotoPhysicalMap` uses the submitted value when creating or replacing the accepted document; do not add a second background mutation or persistence migration.

## Interaction Isolation Pattern

The rail target owns only Loop Clip intent in the top 12px band.

- Stop `pointerdown`, `click`, `dblclick`, Enter, Space, and Escape propagation before cell handlers.
- Plain click selects the loop and its complete source cycle, clears physical selection/proxy scope, focuses the target, and updates the contextual Scripts inspector; Shift/Cmd gestures update the rail set without starting drag.
- Pointer down does not navigate, select a real key, arm drag, or capture the pointer.
- Enter edits; Space selects; Escape hides the tooltip. No rail gesture opens a dedicated actions surface.
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

## Motion Editor Minimal Projection and Removal Assignments

After the EFX replacement is green:

1. Replace `loopCapsules`/`loopClips` projection and rich builders in `frameMap.ts` with paint-only `{startFrame, frameCount, mode}` markers derived from canonical effective ranges.
2. Retain one minimal passive marker type in `types/timeline.ts`; remove rich `TimelineLoopCapsule` source/layout/identity/status/action types.
3. Replace old capsule drawing in `TimelineRenderer.ts` with a pure Canvas painter for 3px Progressive-purple or Static/Hold-cyan strips plus white actual endpoint cuts inside the existing PPaint FX bar.
4. Remove Loop Clip hit, hover, focus, selection, keyboard, navigation, context-menu, Edit, drag, and operation routing from `TimelineInteraction.ts`; markers are never hit-tested.
5. Remove the Loop Clip tooltip mount/state from `TimelineCanvas.tsx`.
6. Delete `TimelineCapsuleTooltip.tsx` and `loopCapsuleGeometry.ts` after zero callers are proven, while protecting the new passive marker type/projection/painter and their tests.
7. Remove specialized Loop Clip bridge clients/events/envelopes/senders/listeners only after all callers are gone.
8. Retain generic launch/focus, project context, authority/apply-result, save, frame-sync transport, and generic FX-track behavior.

The Motion Editor may consume resolved pixels and passive effective intervals but must not receive Loop Clip identity, source keys, repeat metadata, status, selection state, callbacks, or commands, and must not retain a hidden hit region, tooltip, keyboard shortcut, navigation adapter, edit route, or mutation path.

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
9. exact passive Motion Editor marker paint and zero Loop Clip-specific input.

### Rail state and accessibility

`physicsPaintLoopClipPresentation.test.ts` and `PhysicsPaintLoopClipRail.test.tsx` own:

- normal, hover, selected, focused, busy, truncated, unresolved, rejected, and 0f states;
- exact state precedence without geometry changes;
- one tab stop per loop in placement order;
- accessible names, pressed/busy/described-by semantics;
- tooltip order, viewport clamp, long text, and reduced motion;
- no placement drag behavior.

### Selection, Edit activation, and no-popover boundary

`PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintScriptsPanel.test.tsx`, and `PhysicsPaintStudio.test.ts` own:

- plain/range/toggle rail selection and line-only selection paint;
- exact-once double-click, focused Enter, and sidebar Edit activation;
- tooltip/selection isolation from physical-cell navigation and drag;
- contextual inspector close/normal-context restoration;
- source contracts proving no `PhysicsPaintLoopClipPopover` mount or specialized bridge listener.

Controller/history suites remain verification oracles for canonical unexposed loop operations unless production behavior genuinely requires an added assertion.

### Sidebar and modal

`PhysicsPaintScriptsPanel.test.tsx` owns contextual inspector, Play/Edit slot, seven facts, loading/error/partial/overflow/long-text states, and text-only rename distinction. `PhysicsPaintPlayScriptDialog.test.tsx` remains the carried-forward modal oracle for loading, rejection, unresolved recovery, focus/input preservation, and compact overflow.

### Structural removal

- `frameMap.test.ts`: only `{startFrame, frameCount, mode}` effective-interval markers are projected; no `loopCapsules`, `loopClips`, IDs, source keys, repeat metadata, status, selection, callbacks, or commands.
- `TimelineRenderer.test.ts`: exact 3px purple/cyan marker paint and white actual endpoint cuts appear inside the existing PPaint FX bar with no row/height change, text, badge, tooltip, or status styling.
- `TimelineInteraction.test.ts`: marker coordinates and keys emit no Loop Clip-specific hover, focus, selection, navigation, Edit, drag, context-menu, keyboard, or mutation intent while generic FX behavior remains.
- TimelineCanvas source contract: no Loop Clip tooltip mount/state.
- Bridge tests: no specialized Loop Clip protocol while generic Browser/Tauri transport remains.
- Repository reference checks: zero callers for removed tooltip, geometry, event, client, sender, hook, and envelope identifiers.

### Timed-loop, selection, ripple, and background regressions

`physicsPaintRotoSpacingSelection.test.ts`, `PhysicsPaintStudio.test.ts`, `PhysicsPaintLoopClipRail.test.tsx`, `useRotoTimelineActions.test.ts`, `physicsPaintRotoLoopGuards.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, history/controller, bridge/type-guard, and preview/export suites own:

- contiguous and non-uniform source offsets plus `lastOffset + 1` cycle duration;
- plain/range/toggle rail selection, stable anchor, complete cycle derivation, identical-cycle deduplication, and mutually exclusive physical selection;
- exact Select All scope and unchanged ordinary plain/Cmd/Shift physical-key behavior;
- partial physical spacing within one current source cycle and explicit multi-cycle physical rejection;
- selected rail cycles processed left-to-right with cumulative signed downstream ripple;
- fixed keys before or inside an unselected group interior protected from crossing;
- source-attached downstream `placementStart` follow with every other Loop Clip field unchanged;
- Interpolation Off leaving gaps and On deriving generated interiors without automatic toggling;
- generated interiors, gaps, unresolved frames, stale/reordered/duplicate/ambiguous provenance, collisions, crossings, and capacity failure rejecting without publication;
- records and Loop Clips staged/rolled back/accepted/history-recorded together;
- one Undo/Redo restoring/reapplying source positions, placements, timed repeats, rail duration, preview/playback/export, and cache resolution;
- valid Play Script background required and persisted in fresh/current documents, ordinary physical background injection rejected, and preview/export composite parity retained.

### Retained canonical regressions

Continue running selection, resolver, coordinator, persistence, controller, history, materialization, linked-cell, background, preview, export, determinism, typecheck, build, and dependency-diff gates. These suites prove the UI correction did not loosen any authority beyond D-57's explicit mode-specific Key Spacing exception and did not rewrite D-24..D-32 algebra/performance.

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
