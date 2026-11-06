---
phase: 59-rail-motion-channels-v7-interface
reviewed: 2026-11-06T19:02:45Z
depth: deep
files_reviewed: 50
files_reviewed_list:
  - app/src-tauri/src/services/script_library.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
  - app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts
  - app/src/components/physic-paint/roto/railMotionMergeNotice.ts
  - app/src/components/physic-paint/roto/railMotionPersistence.test.ts
  - app/src/components/physic-paint/roto/railMotionPivot.test.ts
  - app/src/components/physic-paint/roto/railMotionPivot.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
  - app/src/lib/__fixtures__/railMotionCanonical.golden.json
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/railMotionCanonicalParity.test.ts
  - app/src/lib/railMotionDependencySurface.test.ts
  - app/src/lib/railMotionGateBEdits.test.ts
  - app/src/lib/railMotionPackageRoundTrip.test.ts
  - app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts
  - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/physicPaint.test.ts
  - app/src/types/physicPaint.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts
  - app/src/components/physic-paint/roto/railMotionEvaluator.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.ts
  - app/src/components/physic-paint/roto/railMotionModel.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/stores/efxPaintStore.ts
findings:
  critical: 4
  warning: 5
  info: 5
  total: 14
  necessity: 0
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-11-06T19:02:45Z
**Depth:** deep
**Files Reviewed:** 50 (42 workflow-scoped files plus 8 cross-file evidence files)
**Status:** issues_found

## Summary

Phase 59 adds a persisted rail-motion model, a five-channel evaluator, a cross-language canonical term, a compositor transform, and timeline/inspector surfaces. The pure model, parser, evaluator and reconciler are tightly specified and internally consistent, and the settlement path (Studio child to parent bridge to `finalizeAccepted`) preserves motion and publishes the merge notice correctly. The defects are concentrated at the seams: one copy path builds its document without the motion collection, one store mutation path discards the reconciler's drop report, the add-channel affordance is never wired into any host, and the rail view for an infinite Loop Clip stops after one occurrence. Each of those is a user-visible motion loss or a missing required behavior.

No `<structural_findings>` block was supplied for this phase, so there is no `## Structural Findings (fallow)` section. The `necessity` assessment found **zero** necessity findings: the reachable-but-dead exports and reducer branches are code-quality issues (reported as Info), not code guarded against a state that cannot occur in this stack.

## Narrative Findings (AI reviewer)

Reviewed at deep depth: per-file analysis of the 42 workflow-scoped files plus cross-file tracing of the store, reconciler, bridge, coordinator, commands, model, identity and view layers. Findings set:

| ID | Severity | Finding | Primary site |
| --- | --- | --- | --- |
| CR-01 | Critical | Rail-set Copy/Duplicate builds a document with no `railMotions`, so motion is silently dropped | `useRotoTimelineActions.ts:4926-4955` |
| CR-02 | Critical | The store removal path discards the merge drop report; no MOTN-10 notice is ever published there | `physicPaintStore.ts:6055-6067` |
| CR-03 | Critical | The `+` add-channel affordance is unreachable and `add-channel` is never dispatched; only Position can animate | `PhysicsPaintWorkflowStrip.tsx:6240-6275`, `railMotionModel.ts:683-717` |
| CR-04 | Critical | An infinite Loop Clip's motion span is truncated to one occurrence; the transform disappears for every later cycle | `railMotionIdentity.ts:163-171`, `physicPaintStore.ts:1268-1338` |
| WR-01 | Warning | Motion-lane curve ignores `railId`, so its wiggle seed differs from the applied transform | `TimelineMotionChannels.tsx:355` |
| WR-02 | Warning | Grouped Position lane only ever addresses `position-x`; `position-y` easing/wiggle are unreachable | `PhysicsPaintTrackRow.tsx:562` |
| WR-03 | Warning | Canonical rail-motion ordering uses `localeCompare` while Rust uses byte order; the parser itself sorts by bytes | `physicsPaintRotoPhysicalModel.ts:1722` |
| WR-04 | Warning | Reveal rail delete/resize and the reveal bake bypass motion reconciliation and persist orphaned records | `efxPaintStore.ts:1817-1970`, `physicPaintStore.ts:2413-2462` |
| WR-05 | Warning | Rail-set copy derives key-rail segments with an empty group-owned set, diverging from the store/resolver projection | `physicsPaintRotoRailSetCopy.ts:376-380` |
| IN-01 | Info | Motion key set/remove use an unclamped rail-local cursor instead of the command layer's clamp | `useRotoTimelineActions.ts:2127-2130` |
| IN-02 | Info | Inspector projects all five channels even when absent; those fields render editable then reject every write | `physicsPaintKeyRailPresentation.ts:220-231` |
| IN-03 | Info | Unused imports `RAIL_MOTION_SELECTION_SCOPES` and `clearSelectionForScope` | `railMotionCommands.ts:226-227` |
| IN-04 | Info | Production-dead exports `describeRailMotionOrphan`, `resolveRecordChannels`, `resolveMotionCommandChannelIds` | `railMotionIdentity.ts:159`, `railMotionCommands.ts:509-533` |
| IN-05 | Info | `RailMotionCommandAvailabilityInput.hasMotionRecord` is declared and supplied but never read | `railMotionCommands.ts:444` |

## Critical Issues

### CR-01: Rail-set Copy/Duplicate builds its document without `railMotions` and silently drops motion

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:4926-4955`
**Category:** code quality / correctness
**Issue:** `buildRailSetCopyDocument` constructs the physical document passed to `buildRotoRailSetCopyPayload` from records, loops, interpolation and breaks only. It never reads the rail-motion collection and it calls `buildPhysicPaintRotoPhysicalRevision` with four arguments (line 4943), so both the document member and the revision term are motion-free. `buildRotoRailSetCopyPayload` reads `document.railMotions ?? PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY` (`physicsPaintRotoRailSetCopy.ts:391-394`) and freezes motion only for members whose `sourceRailId` was bound through those views; with an empty collection no member carries motion, so the payload's `railMotions` is always empty. `copyRailSet` (`useRotoTimelineActions.ts:3036`) and `duplicateRailSet` (line 3140) both use this document, and both are production-wired (`PhysicsPaintStudio.tsx:3943` duplicate, `3951` copy). The paste half is motion-aware (`physicPaintStore.ts:6113-6120` applies `proposal.railMotions`), and the store's own copy path does include motion (`physicPaintStore.ts:4845` reads `railMotions` into `getRotoPhysicalDocument`, used at `5714-5745`), which is why the store unit tests pass while this hook path loses motion. Copy then paste, and Duplicate, therefore reproduce the rails with their drawings but without any animation.

**Fix:** Read the selected track's motion collection and thread it into both the document and the revision:

```ts
function buildRailSetCopyDocument(input: RotoTimelineActionsInput): PhysicPaintRotoPhysicalDocument | null {
  const capacity = input.getCapacity?.() ?? null;
  if (capacity === null) return null;
  const launch = input.getLaunchContext?.() ?? null;
  const layerId = launch?.layerId;
  const trackId = launch?.document?.activeTrackId;
  const railMotions = layerId !== undefined && trackId !== undefined
    ? physicPaintStore.getRotoPhysicalRailMotions(layerId, trackId)
    : [];
  // ...
  revision: buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
    undefined,
    railMotions,
  ),
  loopClips,
  incomingInterpolationBreakKeyIds,
  railMotions,
  // ...
```

Add a regression test that drives `copyRailSet`/`duplicateRailSet` (not `buildRotoRailSetCopyPayload` directly) against a rail with motion and asserts the resulting payload's `railMotions` is non-empty and its `sourceRailId` is present.

### CR-02: The store selection-removal path discards the reconciler's merge report, so MOTN-10 never fires

**File:** `app/src/stores/physicPaintStore.ts:6055-6067`
**Category:** correctness / data loss
**Issue:** `_applyRotoTrackSelectionRemoval` runs `reconcileRailMotionsForDocumentEdit` and then keeps only `.railMotions`:

```ts
const reconciledRailMotions = reconcileRailMotionsForDocumentEdit({
  // previous/next snapshots
  railMotions: store.getRotoPhysicalRailMotions(layerId, trackId),
}).railMotions;
```

`droppedRailId`, `droppedRailFrames` and `adoptedRailId` are discarded. The merge-drop notice is published only by the Studio settlement path: `useRotoPhysicalEditCoordinator.ts:1444-1449` publishes `detail.railMotionMergeNotice`, and that detail is produced by the bridge's forward-edit reconciliation (`physicPaintBridge.ts:1960-1983`, `2226-2242`). The store removal helper is called from `cutTrackSelection` (`physicPaintStore.ts:5780`), `clearTrackFrames` (line 5863) and `moveTrackItems` (line 5945); `moveTrackItems` is production-wired to the WorkflowStrip cross-track/same-track drag commit (`PhysicsPaintWorkflowStrip.tsx:3885-3891`), whose `removeFromSource` is true for every same-track slide and for cross-track rail grabs (`usePhysicsPaintCrossTrackDrag.ts:368-377`). A same-track key slide that deletes the break-owning first key of a second rail produces exactly the reconciler's merge classification (`railMotionDocumentReconciler.ts:238-254`): the tail record is dropped and `droppedRailFrames` is computed at `346-355`, then thrown away. The user is never told that the rail merge removed motion, violating MOTN-10 on a reachable path.

**Fix:** Return the drop report from the helper and publish it at the same surface that owns the notice slot:

```ts
const reconciliation = reconcileRailMotionsForDocumentEdit({ /* ... */ });
const reconciledRailMotions = reconciliation.railMotions;
const mergedDrop = reconciliation.droppedRailId !== null && reconciliation.droppedRailFrames !== null
  ? {
      railId: reconciliation.droppedRailId,
      startFrame: reconciliation.droppedRailFrames.startFrame,
      endFrameExclusive: reconciliation.droppedRailFrames.endFrameExclusive,
    }
  : null;
// ... return { ok: true, mergedDrop };
```

Propagate the field through `moveTrackItems`' result and, in the WorkflowStrip commit closure (`PhysicsPaintWorkflowStrip.tsx:3885-3891`), call `publishRailMotionMergeNotice(result.mergedDrop)` after a successful move. If this direct store path is not undoable, the notice copy must not promise "Undo restores it" — prefer routing the move through the coordinator's settle so undo and the notice travel together.

### CR-03: The add-channel affordance is unreachable; only the Position channels can ever carry motion

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:6240-6275`
**Category:** correctness / missing required behavior (D-10, D-14)
**Issue:** `TimelineMotionBlock` accepts `channelMenuOpen` and `onAddMotionChannel` (`PhysicsPaintTrackRow.tsx:497-543`) and only renders `TimelineMotionChannelMenu` when `channelMenuOpen` is true (`PhysicsPaintTrackRow.tsx:597-603`). The active-lane host in the strip passes `record`, `view`, `laneCount`, `cursorFrame`, `disabledReasons`, `selectedMotionKey`, `onSelectMotionKey`, `onMotionCursorStep` and `onToggleMotionKeyAtCursor` but omits `channelMenuOpen` and `onAddMotionChannel` (`PhysicsPaintWorkflowStrip.tsx:6240-6275`). The non-active `PhysicsPaintTrackRow` branch receives no motion props at all (`PhysicsPaintWorkflowStrip.tsx:6281-6309`). A repository-wide search finds no production writer for `motionChannelMenuOpen`/`channelMenuOpen` and no production dispatch of an `add-channel` edit: `applyAddChannelEdit` and the `'add-channel'`/`'remove-channel'` reducer branches exist only in `railMotionModel.ts` (683-717, 750-763). The menu itself also has no trigger row and passes `onClose={() => {}}` (`PhysicsPaintTrackRow.tsx:601`), so even if it were opened it could not be dismissed. Because `applyAnimateEdit` seeds only `position-x`/`position-y` (`railMotionModel.ts:560-588`) and `writeRailMotionChannelValueAtCursor` refuses a channel that is not already present (`railMotionCommands.ts:838-840`), Scale, Rotation and Opacity motion are impossible to create in the shipped UI. 59-11 explicitly deferred the live commands to 59-12 (`59-11-SUMMARY.md:264`), but no later plan claims the add-channel wiring. The inspector compounds this by projecting all five channels (`physicsPaintKeyRailPresentation.ts:220-231`), so Scale/Rotation/Opacity render as editable fields whose every write is refused (`PhysicsPaintScriptsPanel.tsx:198-221`, `railMotionCommands.ts:838-840`).

**Fix:** Wire the D-14 affordance end to end. Add a `+` row at the end of the expanded block that toggles a session state (a `signal`/ref-held signal in the strip, never `useState`), pass `channelMenuOpen` and `onAddMotionChannel` into `TimelineMotionBlock`, and add a command action:

```ts
const addMotionChannelAtCursor = useCallback((channelId: PhysicPaintRotoRailMotionChannelId) => {
  const state = readActiveRailMotionState(input);
  if (state === null || state.record === null) return;
  const next = applyRailMotionEditToCollection(state.records, {
    kind: 'add-channel',
    railId: state.record.railId,
    channel: channelId,
  });
  if (next === state.records) return;
  commitRailMotionRecords(state, next);
}, [input]);
```

Route the menu's `onClose` to the same session state, and pass the new action through `rotoPhysicalActions` into the strip. Add a test that mounts the active block with the `+` row and asserts the menu lists only keyless lanes and dispatches `add-channel`.

### CR-04: An infinite Loop Clip's motion span is truncated to one occurrence

**File:** `app/src/components/physic-paint/roto/railMotionIdentity.ts:163-171`
**Category:** correctness / data loss (D-16)
**Issue:** `railViewOccurrences` maps `'infinity'` to `1`, so `deriveRailMotionRailViews` gives an infinite loop view `endFrameExclusive = placementStart + sourceKeyIds.length` (`railMotionIdentity.ts:208-212`). The comment calls the real duration a resolver concern, but no consumer extends the motion view: `_resolveRotoRailMotionProjection` (`physicPaintStore.ts:1210-1250`) passes the raw clips, `_railMotionViewAtFrame` is half-open over that truncated span (`physicPaintStore.ts:1268-1279`), and `_trackMotionTransformAtFrame` returns `null` for any frame outside it (`physicPaintStore.ts:1327-1338`). The resolver extends the drawings to capacity or the parent end, so an infinite rail keeps cycling its content while its transform is applied only during the first cycle and then silently disappears. This contradicts D-16 ("Motion plays in rail-local time and holds past its last key on every occurrence", `59-CONTEXT.md:57`) and the phase law "Content cycles, motion continues" (`59-CONTEXT.md:140`). The motion lane width is derived from the same truncated view (`PhysicsPaintTrackRow.tsx:548-551`), so the lane also covers only the first occurrence.

**Fix:** Extend the infinite loop view to the resolved span, using the same boundary the rail draws. Keep identity pure by injecting the resolved end:

```ts
export interface RailMotionRailViewSpanResolver {
  readonly resolveLoopEndExclusive: (loopId: string) => number | null;
}

// in deriveRailMotionRailViews:
const repeatEnd = clip.repeat === 'infinity'
  ? (spanResolver?.resolveLoopEndExclusive(clip.loopId) ?? clip.placementStart + sourceKeyIds.length)
  : clip.placementStart + sourceKeyIds.length * railViewOccurrences(clip.repeat);
```

In `_resolveRotoRailMotionProjection`, supply the resolver from `structural.loopResolution` (the same context the compositor already uses) so the compositor, the lane width and `_railMotionViewAtFrame` share one extended span. Add a test covering an infinite clip whose transform is sampled in cycle 2 and at capacity.

## Warnings

### WR-01: Motion-lane curve ignores `railId`, so its wiggle seed differs from the applied transform

**File:** `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:355`
**Issue:** The lane draws each channel with `buildRailMotionCurvePath(channel, frameCount, laneHeight)` and omits the `railId` option. The evaluator seeds deterministic wiggle from `options.railId ?? RAIL_MOTION_CURVE_PREVIEW_RAIL_ID` (`railMotionEvaluator.ts:220`, `328-332`), and the applied transform uses the record's real `railId`. Any key with `wiggle !== 0` therefore renders a curve computed with a different seed than the transform actually applied to the content, violating the builder's stated "curve and applied transform cannot disagree" contract. `railId` is already available in this component (props at lines 329/337).
**Fix:**
```tsx
d={buildRailMotionCurvePath(channel, frameCount, laneHeight, { railId })}
```

### WR-02: The grouped Position lane always addresses `position-x`; `position-y` easing and wiggle cannot be edited

**File:** `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:562`
**Issue:** Each display lane forwards `laneChannelId = lane.channels[0]?.id ?? 'position-x'`. For the grouped Position lane the first channel is always `position-x` (the parser orders channels by the fixed model order and requires both axes to share one frame set, `railMotionModel.ts:267-277`). Key selection stores that channel (`useRotoTimelineActions.ts:2734-2741`), and `setSelectedMotionKeyEasing`/`setSelectedMotionKeyWiggle` write only `selection.channelId` (`useRotoTimelineActions.ts:2890-2930`), as do the command helpers (`railMotionCommands.ts:397-431`) and the reducer branch that sets easing/wiggle only on the addressed channel (`railMotionModel.ts:611-621`). There is no UI path that selects `position-y`, so its Hold/Ease and Wiggle values can never be changed even though the lane visually represents both axes and the model stores them independently.
**Fix:** Treat the grouped lane as a two-channel selection: when the selected channel is `position-x` or `position-y`, apply the easing/wiggle edit to both axes in one commit (the reducer already supports `pairedValue` for values; extend the same single-commit pattern to easing/wiggle), or store the display lane id in `RailMotionKeySelection` and fan out in the command layer. Add a test asserting both axes' easing changes from one grouped-lane action.

### WR-03: Canonical rail-motion ordering diverges between TypeScript and Rust

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1722`
**Issue:** `encodeCanonicalRailMotions` sorts records with `left.railId.localeCompare(right.railId)`. Rust's `canonical_rail_motions` sorts with byte `cmp` (`app/src-tauri/src/services/script_library.rs:1591-1604`). Even within TypeScript the orders disagree: the parser canonicalizes records with `<`/`>` byte comparison (`railMotionModel.ts:433-435`) and identity's `compareRailIds` does the same (`railMotionIdentity.ts:78-79`). Rail ids are accepted as any non-empty string up to 128 characters with no charset restriction (`railMotionModel.ts:131-133`, `394-404`), so ids that differ in case or punctuation (for example `Z-rail` vs `a-rail`) sort differently under ICU collation and byte order. The parity fixture only covers lowercase hex UUIDs (`__fixtures__/railMotionCanonical.golden.json`, `rail-motion` entry), so the divergence is untested. A document whose motion collection is canonicalized by the two languages can produce different `rail-motions:` terms and therefore different revisions for the same document.
**Fix:** Use the byte-order comparator in the encoder, matching the parser and Rust:
```ts
const ordered = [...records].sort(
  (left, right) => (left.railId < right.railId ? -1 : left.railId > right.railId ? 1 : 0),
);
```
Add a parity fixture entry with mixed-case/punctuation rail ids (the existing lowercase UUID expectations are unchanged by this fix). The loop-clip sort at line 1742 has the same latent divergence and should be aligned at the same time.

### WR-04: Reveal rail delete/resize and the reveal bake bypass motion reconciliation

**File:** `app/src/stores/efxPaintStore.ts:1817-1866` (and `1900-1970`)
**Issue:** The reconciler's contract is that every structural edit which changes which rail exists reconciles the motion collection. Only three production call sites do so: `physicPaintStore.ts:6055`, `useRotoPhysicalEditCoordinator.ts:2497` and `physicPaintBridge.ts:1968`. `deleteRevealRail` removes the Loop Clip (`efxPaintStore.ts:1823-1831`) and its records (`1843-1856`) without reconciling, leaving the rail's motion record (whose `railId` is the deleted `loopId`) in the collection as a permanent orphan; `resizeRevealRail` prunes records and rewrites the clip (`1900-1970`) the same way, and a shrink to no surviving source keys leaves a stale record behind. The reveal bake replaces in-span records with fresh key ids (`physicPaintStore.ts:2413-2462`) without reconciling the rails that owned those keys. Orphans are retained byte-identically by design (`railMotionIdentity.ts:128-152`) and are included in the canonical revision, so they persist into the package and count against the 512-record cap even though they can never display.
**Fix:** Wrap these mutations with `reconcileRailMotionsForDocumentEdit` using the pre/post records, breaks and loop clips, and write `reconciliation.railMotions` inside the same acknowledged transaction (before the records write, or in the same post-order as `_applyRotoTrackSelectionRemoval`). For `deleteRevealRail` the expected result is removal of the orphaned record; for a resize that removes every source key it is the same removal; for the bake it is removal only when the bake removes the rail's anchor key.

### WR-05: Rail-set copy derives segments with an empty group-owned set

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:376-380`
**Issue:** `buildRotoRailSetCopyPayload` calls `deriveKeyRailSegments` with `groupOwnedKeyIds: new Set()`, while the store projection (`physicPaintStore.ts:1228-1244`), the timeline actions (`useRotoTimelineActions.ts:2090-2106`) and the reconciler all build that set from every Loop Clip's `sourceKeyIds` and `frameOverrides[].keyId`. With group ownership omitted, a key rail that begins right after a group-owned key and has no incoming break is not closed into its own segment, so `segmentByFirstKeyId.get(member.firstKeyId)` can miss the selected member and the copy fails with `'stale-member'` (or binds the wrong segment and never freezes its motion). The divergence is invisible in unit tests that pass a document with no Loop Clips.
**Fix:** Derive the set exactly like the store and pass it in:
```ts
const groupOwnedKeyIds = new Set<string>();
for (const clip of document.loopClips) {
  for (const keyId of clip.sourceKeyIds) groupOwnedKeyIds.add(keyId);
  for (const override of clip.frameOverrides ?? []) groupOwnedKeyIds.add(override.keyId);
}
const segments = deriveKeyRailSegments({
  orderedRealKeys: [...document.realKeyRecords].sort(
    (left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId),
  ),
  incomingInterpolationBreakKeyIds: breakOwners,
  groupOwnedKeyIds,
});
```
Add a copy test where the selected key rail directly follows a Loop Clip owner key with no break.

## Info

### IN-01: Motion key set/remove bypass the command layer's rail-frame clamp

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:2127-2130`
**Issue:** `readActiveRailMotionState` computes `localCursorFrame = Math.max(0, floor(cursorFrame - view.startFrame))` with no upper bound. `setMotionKeyAtCursor` (line 2768) and `removeMotionKeyAtCursor` (line 2790) pass that value directly, while the command layer's single conversion, `railMotionCursorFrame` (`railMotionCommands.ts:74-83`), clamps into the rail's keyed span and is used by `animateRail` and the gizmo (`161`, `720`). The UI disables the diamond outside the lane span, so this is currently latent, but any automation or future caller can write a motion key beyond the rail's visible span.
**Fix:** Clamp with the shared helper before calling the command:
```ts
const keyFrame = state.view === null ? 0 : railMotionCursorFrame(state.view, state.cursorFrame);
```
or clamp `localCursorFrame` at its definition site.

### IN-02: Inspector fields have no availability flag, so absent channels look editable

**File:** `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts:220-231`
**Issue:** `projectRailMotionInspector` maps `PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER` unconditionally and returns a `value` for every channel, without indicating whether the channel exists on the record. `PhysicsPaintScriptsPanel.tsx:198-221` renders a `NumericStepper` for every field, but `writeRailMotionChannelValueAtCursor` refuses any channel not present on the record (`railMotionCommands.ts:838-840`). With the add-channel affordance unreachable (CR-03), Scale/Rotation/Opacity are permanent error fields.
**Fix:** Add `readonly present: boolean` (and optionally `readonly editable: boolean`) to `RailMotionInspectorField`, populate it from `record.channels.some((entry) => entry.id === channelId)`, and render absent fields disabled with the channel's reason. Once CR-03 lands, the same flag can drive the add-channel CTA instead.

### IN-03: Unused imports in the command layer

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:226-227`
**Issue:** `RAIL_MOTION_SELECTION_SCOPES` and `clearSelectionForScope` are imported but never referenced in the module (project-wide grep finds only the declaration/import lines).
**Fix:** Remove both imports; if scope handling is meant to be used here, wire it and add a test.

### IN-04: Production-dead exports

**File:** `app/src/components/physic-paint/roto/railMotionIdentity.ts:159-161`, `app/src/components/physic-paint/roto/railMotionCommands.ts:509-533`
**Issue:** `describeRailMotionOrphan`, `resolveRecordChannels` and `resolveMotionCommandChannelIds` have no non-test consumers. They are reachable code with no production instantiation — a maintainability cost, not a necessity finding.
**Fix:** Remove them, or wire the ones the UI is supposed to use (`resolveRecordChannels` is the natural availability source for IN-02). Do not leave documentation claiming they are part of the live surface.

### IN-05: `hasMotionRecord` availability input is dead

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:444`
**Issue:** `RailMotionCommandAvailabilityInput.hasMotionRecord` is declared and supplied by the hook (`useRotoTimelineActions.ts:2219`, `2234`), but `resolveMotionCommandAvailability` never reads it.
**Fix:** Either remove the field or use it: `animate` can be disabled when `hasMotionRecord === true` instead of accepting the click and publishing "This rail already has motion." at runtime (`useRotoTimelineActions.ts:2726-2729`).

---

_Reviewed: 2026-11-06T19:02:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
