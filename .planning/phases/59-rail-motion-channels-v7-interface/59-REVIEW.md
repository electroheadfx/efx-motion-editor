---
phase: 59-rail-motion-channels-v7-interface
reviewed: 2026-11-06T21:39:55Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
  - app/src/components/physic-paint/roto/railMotionIdentity.ts
  - app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts
  - app/src/components/physic-paint/roto/railMotionMergeNotice.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/lib/railMotionExportParity.test.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
  necessity: 2
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-11-06T21:39:55Z
**Depth:** deep
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Deep re-review of the five Phase 59 gap-closure plans (59-17 add-channel row + menu, 59-18 rail-set copy carries motion, 59-19 infinite Loop Clip motion span, 59-20 reconciler merge-drop reporting + reveal doors, 59-21 motion inspector honesty). The earlier full-phase review artifact (reviewed 19:02:45Z, 50 files) is superseded by this gap-closure re-review; its CR-01..CR-04 blockers and WR-04/IN-02 findings are verified addressed in the current tree (copy document carries `railMotions` into both the revision and the parser, `moveTrackItems` reports and the strip publishes the merge drop, the `+` affordance and menu are wired end to end, and the span resolver is injected at all three production projection sites). Its still-present warnings and infos that were not addressed by the gap-closure plans are carried forward below with explicit provenance.

One BLOCKER remains in the 59-20 family: reveal creation reconciles rail motion against a loop-clip snapshot that cannot contain the reveal clip, because the clip is appended after the bake returns. A neighbouring Key Rail continuing past the bake span is classified as a merge, adopted onto a baked key, and immediately orphaned when the new clip takes ownership of that key — its authored motion silently stops applying and cannot be recovered after a later reveal delete.

The two necessity warnings cover dead API surface introduced by these plans (the `add-motion-channel` availability branch/`hasKeylessChannel` input and the `mergedDrop` reporting on `cutTrackSelection`/`clearTrackFrames`), and one new Info covers the missing reducer `try/catch` guard in `addMotionChannel`.

Verified sound in the changed code: the three-view span-resolver injection, the 59-18 copy/revision/parser agreement and paste re-keying, 59-21's `present`/disabled/aria/note wiring, the 59-17 two-writer menu signal and layout/outline parity, the session-only merge-notice signals (no store write, no revision, no undo entry), the reveal delete/resize/replay read-before-write reconciliation order, and the reactivity rules in the touched components (no `useState`, no unguarded render-body signal writes; the `railSetSelection` render-phase echo in `PhysicsPaintStudio.tsx:1786-1787` is the sanctioned guarded compare-then-write).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Reveal creation reconciles motion against a loop-clip snapshot that omits the clip appended after the bake — a neighbouring Key Rail's motion is silently orphaned

**Severity:** BLOCKER
**File:** `app/src/stores/physicPaintStore.ts:2457-2513` and `app/src/stores/efxPaintStore.ts:1598-1669`

**Issue:** `commitRevealBake` builds its `next` snapshot from `currentLoopClips` (with in-span source keys substituted for baked keys) and reconciles rail motion from that snapshot before writing — but on the creation path the reveal clip does not exist yet. `createRevealRail` calls the bake at `efxPaintStore.ts:1598`, builds the clip from `bakeResult.records` (`1636-1666`), and appends it in a second store write (`1667-1669`). During reconciliation the freshly baked keys are therefore UNOWNED, so `deriveKeyRailSegments` merges them with any neighbour Key Rail that continues past the bake span.

Provable trace (a Key Rail with motion, its first key inside the bake span):

1. Existing Key Rail keys `A@10` (motion record `{railId: R, anchorKeyId: A}`) and `B@14`, no break at `B`. Create a reveal over frames `[10, 12)`.
2. The bake produces fresh keys `A'@10`, `B'@11`; `merged` keeps `B@14`; `finalBreaks` seeds a break on `A'` (`physicPaintStore.ts:2453-2456`). The reveal clip does not exist in `nextLoopClips` (`2457-2471`).
3. The next Key Rail segment is `[A'@10, B'@11, B@14]` (group ownership is empty; the seeded break starts the segment). The reconciler's merge row fires: the segment contains the surviving prior key `B`, is strictly larger than the prior segment, and starts on a non-prior key (`railMotionDocumentReconciler.ts:234-254`).
4. `onMergeRails` takes the tail-only adoption path and re-anchors the record to `A'` (`railMotionIdentity.ts:424-436`), since no record is anchored at the merged head.
5. The clip is appended owning `A'`/`B'`. The live Key Rail segment is now `[B@14]`; assignment binds views by `railId` plus the anchor-only first bind (`railMotionIdentity.ts:287-317`), and the record (`railId: R`, `anchorKeyId: A'`) matches no view — it is orphaned and never evaluated (`railMotionIdentity.ts:156-191`). The Motion lanes disappear and the authored transform stops applying. Deleting the reveal later cannot revive it: the clip delete prunes `A'` and its break, leaving the record anchored to a key that no longer exists.
6. A loop-aware snapshot would have classified the same edit as `delete-first-key` — the successor `[B]` is a suffix of the prior `[A, B]` (`railMotionDocumentReconciler.ts:204-215`) — re-anchoring to `B` and keeping the motion live.

The code's own comment at `physicPaintStore.ts:2446-2452` names exactly this hazard ("Skipping it would leave the new baked keys unowned in the snapshot, merge a neighbouring Key Rail segment into them and silently drop that rail's motion"), but only the replay path is covered: `replayRevealRail` rewrites an already-existing clip, so the substitution in `nextLoopClips` supplies the ownership, while creation supplies none. The existing reveal-motion test (`efxPaintStore.reveal.test.ts:1472-1519`) only exercises replay with a neighbour anchored OUTSIDE the span, so this creation case is untested and the reconciliation's own guard comment is not honoured on the path that needs it most.

**Fix:** Make the bake reconcile against the clip it is about to create. Add an optional pending-clip template to `RevealBakeInput` (everything except `sourceKeyIds`: loopId, placementStart, repeat, mode, railKind and provenance fields) and, after `bakedRecords` are minted, append `{ ...input.pendingLoopClip, sourceKeyIds: bakedRecords.map((record) => record.keyId) }` to `nextLoopClips` before `reconcileRailMotionsForDocumentEdit` (`physicPaintStore.ts:2472`). `createRevealRail` already knows all of those fields — generate the `loopId` before the bake and pass the same clip it later appends at `efxPaintStore.ts:1636-1669`; `replayRevealRail` keeps its current substitution. Add a regression test: seed a Key Rail with keys at frames 10 and 14 plus a motion record anchored at the frame-10 key, create a reveal over `[10, 12)`, and assert the record survives with the same `railId`, an anchor at the frame-14 key, and a live view binding.

## Warnings

### WR-01: The `add-motion-channel` availability branch and `hasKeylessChannel` input are dead code

**Severity:** WARNING
**Category:** necessity
**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:472-502,526-544` (with `useRotoTimelineActions.ts:2240-2252`)

**Issue:** `RailMotionCommandId` gained `'add-motion-channel'`, `RailMotionCommandAvailabilityInput` gained `hasKeylessChannel`, and `resolveMotionCommandAvailability` grew a branch for it — but no production caller ever exercises that branch. The doc block at `railMotionCommands.ts:526-528` claims "the add-channel row derives it from the same display projection the block renders"; in fact the row computes its own gate with `resolveKeylessMotionDisplayLanes` (`PhysicsPaintTrackRow.tsx:593`) and renders/outlines from that boolean (`643-648`, `649-671`, `677`). `motionAvailability` never passes `hasKeylessChannel` (`useRotoTimelineActions.ts:2240-2252`), no computed availability requests the command (`2391-2413`), and `CONTEXTUAL_COMMANDS_BY_SCOPE.rail` excludes it (`railMotionCommands.ts:598`), so the action bar can never surface it either. The "Every Motion channel is already present on this rail." refusal and the input field are reachable only from unit tests.

**Fix:** Either delete the union member, the input field and the branch, or route the `+` row through the one availability authority (T-59-35): pass `hasKeylessChannel` from the host into `resolveMotionCommandAvailability({ command: 'add-motion-channel', ... })` and use its answer/reason for the row's disabled state. Do not keep a doc claim that names a caller which does not call it.

### WR-02: `mergedDrop` on `cutTrackSelection`/`clearTrackFrames` has no production consumer

**Severity:** WARNING
**Category:** necessity
**File:** `app/src/stores/physicPaintStore.ts:3265-3274,5846-5854,5935-5940,6114-6167`

**Issue:** 59-20 adds `mergedDrop?: RotoTrackMergedDrop` to `RotoTrackCopyResult`/`RotoTrackClearResult` and spreads it from `_applyRotoTrackSelectionRemoval` in `cutTrackSelection` and `clearTrackFrames` — but the only production reader of a `mergedDrop` result is `PhysicsPaintWorkflowStrip.tsx:3921-3932`, and that reads the `moveTrackItems` result (`physicPaintStore.ts:6022-6029`). A repository-wide search shows `cutTrackSelection` and `clearTrackFrames` have no production call sites at all (only `trackIsolation.test.ts` and `physicPaintStore.rotoRailMotions.test.ts:669-745`), so those two new report fields can never reach the settlement/notice row: no UI path consumes them, and a real merge drop produced through these methods would still be silent. Note the `moveTrackItems` half of the same plan is correctly wired.

**Fix:** Remove the `mergedDrop` members from `RotoTrackCopyResult` and `RotoTrackClearResult` (and the conditional spreads at `5853`/`5939`), keeping the helper's report for `moveTrackItems`. If cut/clear are intended to gain a UI surface, wire the consumer in the same change and publish through `publishRailMotionMergeNotice` exactly like the move wrapper.

### WR-03: The motion-lane curve ignores `railId`, so its wiggle seed differs from the applied transform

**Severity:** WARNING
**Provenance:** carried forward from the earlier full-phase review; still present, outside the gap-closure diff.
**File:** `app/src/components/physic-paint/view/TimelineMotionChannels.tsx:356`

**Issue:** The lane draws each channel with `buildRailMotionCurvePath(channel, frameCount, laneHeight)` and omits the `railId` option, even though `railId` is a prop of the lane component (`TimelineMotionChannels.tsx:212`, `330`). The evaluator seeds deterministic wiggle from `options.railId ?? RAIL_MOTION_CURVE_PREVIEW_RAIL_ID` (`railMotionEvaluator.ts:210-220`), and the applied transform uses the record's real `railId`. Any key with `wiggle !== 0` therefore renders a preview curve computed with a different seed than the transform actually applied to the content, contradicting the option's own contract ("the record's railId so the curve samples the exact applied wiggle seed").

**Fix:**

```tsx
d={buildRailMotionCurvePath(channel, frameCount, laneHeight, { railId })}
```

### WR-04: The grouped Position lane only edits `position-x`; `position-y` easing and wiggle are unreachable

**Severity:** WARNING
**Provenance:** carried forward from the earlier full-phase review; still present, outside the gap-closure diff.
**File:** `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:608` (with `useRotoTimelineActions.ts:2941-2981`)

**Issue:** Each display lane forwards `laneChannelId = lane.channels[0]?.id ?? 'position-x'`. For the grouped Position lane the first channel is always `position-x` (the display projection keeps the fixed `position-x`, `position-y` order, `TimelineMotionChannels.tsx:119-141`), so a selected Position key always stores `channelId: 'position-x'`. `setSelectedMotionKeyEasing` and `setSelectedMotionKeyWiggle` pass only `selection.channelId` (`useRotoTimelineActions.ts:2952-2980`), and the command layer/reducer update only the addressed channel for easing/wiggle (`railMotionCommands.ts:420-468`, `railMotionModel.ts:616-646`). There is no UI path that selects `position-y`, so its Hold/Ease and Wiggle can never be changed even though the lane visually represents both axes and the model stores them independently — setting Hold on the Position lane makes X hold while Y keeps easing.

**Fix:** Treat the grouped lane as a two-channel selection: when the selected channel is `position-x` or `position-y`, apply the easing/wiggle edit to both axes in one commit (the command layer already has `resolveMotionCommandChannelIds` and the reducer already supports `pairedValue` for values; extend the same single-commit fan-out to easing/wiggle), or store the display-lane id in `RailMotionKeySelection` and fan out in the command layer. Add a test asserting both axes change from one grouped-lane action.

### WR-05: Canonical rail-motion ordering diverges between TypeScript and Rust

**Severity:** WARNING
**Provenance:** carried forward from the earlier full-phase review; still present, outside the gap-closure diff.
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1722` (and `1742`)

**Issue:** `encodeCanonicalRailMotions` sorts records with `left.railId.localeCompare(right.railId)` (and loop clips with `a.loopId.localeCompare(b.loopId)` at `1742`). Rust's `canonical_rail_motions` sorts with `str::cmp` (byte order) at `app/src-tauri/src/services/script_library.rs:1596-1601`. Even within TypeScript the orders disagree: the parser canonicalizes records with `<`/`>` byte comparison (`railMotionModel.ts:433-435`) and `railMotionIdentity.ts:116-118` does the same. Rail ids are accepted as any non-empty string up to 128 characters with no charset restriction (`railMotionModel.ts:131-133`), so ids that differ in case or punctuation (for example `Z-rail` vs `a-rail`) sort differently under ICU collation and byte order. The parity fixtures only cover lowercase hex UUIDs (`app/src/lib/__fixtures__/railMotionCanonical.golden.json`), so the divergence is untested. A document whose motion collection is canonicalized on both sides can produce different `rail-motions:` terms and therefore different revisions for the same document. Today's minted ids are lowercase hex, so this is reachable mainly through imported/crafted packages, but the cross-language contract does not hold.

**Fix:** Use the byte-order comparator in the encoder, matching the parser and Rust:

```ts
const ordered = [...records].sort(
  (left, right) => (left.railId < right.railId ? -1 : left.railId > right.railId ? 1 : 0),
);
```

Apply the same comparator to the loop-clip sort at line 1742 and add a parity fixture entry with mixed-case/punctuation rail ids.

### WR-06: The rail-set copy payload derives Key Rail segments with an empty group-owned set

**Severity:** WARNING
**Provenance:** carried forward from the earlier full-phase review; still present, and directly undermines the 59-18 motion freeze.
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:363-407`

**Issue:** `buildRotoRailSetCopyPayload` calls `deriveKeyRailSegments({ ..., groupOwnedKeyIds: new Set() })` (`376-380`), while the display projection that produced the copy members excludes every Loop Clip-owned key (`clip.sourceKeyIds` plus `frameOverrides[].keyId`) — `physicsPaintKeyRailPresentation.ts:39-80`, `useRotoTimelineActions.ts:2125-2138`, and the member authority `PhysicsPaintStudio.tsx:1777-1800,3180`. With an empty ownership set, a Key Rail that begins after a Loop Clip's owned keys and does not itself own an incoming break is folded into the clip's segment (the clip's leading break starts the segment, and nothing flushes it at the Key Rail's first key). `segmentByFirstKeyId.get(member.firstKeyId)` then misses (`404-407`) and Copy/Duplicate fails closed with the generic `'stale-member'` refusal. The same wrong segmentation feeds `assignRailMotionRailViews` (`389-395`), so even when the lookup succeeds the 59-18 motion freeze can fail to bind the member's record. This state is produced by the CR-01 scenario itself (a Loop Clip inserted mid-Key-Rail leaves a trailing Key Rail with no break), and by any clip whose following Key Rail is not break-marked.

**Fix:** Derive the ownership set exactly like the store and the reconciler before segmenting:

```ts
const groupOwnedKeyIds = new Set<string>();
for (const clip of document.loopClips) {
  for (const keyId of clip.sourceKeyIds) groupOwnedKeyIds.add(keyId);
  for (const override of clip.frameOverrides ?? []) groupOwnedKeyIds.add(override.keyId);
}
const segments = deriveKeyRailSegments({
  orderedRealKeys: document.realKeyRecords,
  incomingInterpolationBreakKeyIds: breakOwners,
  groupOwnedKeyIds,
});
```

Add a copy test where the selected Key Rail directly follows a Loop Clip's owned keys with no break on its first key, and assert both the member lookup and the frozen motion.

## Info

### IN-01: `addMotionChannel` is the only motion command that does not guard the reducer call

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:191-211`

**Issue:** Every sibling command wraps `applyRailMotionEditToCollection` in `try/catch` and converts a throw into a refusal string — `setMotionKeyAtCursor` (`356-370`), `removeMotionKey` (`390-400`), `setMotionKeyEasing` (`430-441`), `setMotionKeyWiggle` (`457-468`) — because the reducer contract is "invalid values throw; the store action catches and refuses them" (`railMotionModel.ts:742-748`). `addMotionChannel` calls the reducer directly. `applyAddChannelEdit` can throw through `assertRailMotionEditChannel` (`railMotionModel.ts:690`), and the hook action (`useRotoTimelineActions.ts:2846-2851`) does not catch either, so a throw would escape the menu click handler. Today the channel id comes from the typed menu inventory, so the path is not reachable, which is why this is Info rather than a warning — but the guard belongs with the other four for the same contract.

**Fix:**

```ts
try {
  const next = applyRailMotionEditToCollection(records, {
    kind: 'add-channel',
    railId,
    channel: channelId,
  });
  if (next === records) return failure('This Motion channel is already present.');
  return success(next);
} catch {
  return failure('The Motion channel could not be added.');
}
```

### IN-02: Motion key set/remove bypass the command layer's rail-frame clamp

**Severity:** INFO
**Provenance:** carried forward from the earlier full-phase review; still present, outside the gap-closure diff.
**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:2154-2157,2796,2818`

**Issue:** `readActiveRailMotionState` computes `localCursorFrame = Math.max(0, floor(cursorFrame - view.startFrame))` with no upper bound. `setMotionKeyAtCursor` and `removeMotionKeyAtCursor` pass that value directly, while the command layer's single conversion, `railMotionCursorFrame` (`railMotionCommands.ts:74-83`), clamps into the rail's keyed span and is used by `animateRail` and the gizmo. The UI disables the diamond outside the lane span, so this is currently latent, but any automation or future caller can write a motion key beyond the rail's visible span.

**Fix:** Clamp with the shared helper before calling the command:

```ts
const keyFrame = state.view === null ? 0 : railMotionCursorFrame(state.view, state.cursorFrame);
```

or clamp `localCursorFrame` at its definition site.

### IN-03: Production-dead exports remain

**Severity:** INFO
**Provenance:** carried forward from the earlier full-phase review; still present, outside the gap-closure diff.
**File:** `app/src/components/physic-paint/roto/railMotionIdentity.ts:197` and `app/src/components/physic-paint/roto/railMotionCommands.ts:633`

**Issue:** `describeRailMotionOrphan` (`railMotionIdentity.ts:197`) and `resolveRecordChannels` (`railMotionCommands.ts:633`) have no non-test consumers; `resolveMotionCommandChannelIds` is now used by `addMotionChannel`, so only these two remain dead. They are reachable code with no production instantiation — a maintainability cost, not a necessity finding.

**Fix:** Remove them, or wire them to the surface they were intended for (`resolveRecordChannels` is a natural availability/inventory source for the channel menu; `describeRailMotionOrphan` is the session-warning copy described in its doc block). Do not leave exports whose documentation claims a live role.

---

_Reviewed: 2026-11-06T21:39:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
