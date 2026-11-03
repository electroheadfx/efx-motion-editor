---
phase: 58-rail-editing-regressions
reviewed: 2026-11-03T16:41:49Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
  necessity: 1
status: issues_found
---

# Phase 58: Code Review Report (gap closure: 58-09 G-01 / 58-10 CR-03)

**Reviewed:** 2026-11-03T16:41:49Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Deep re-review of the 58-09 (G-01) and 58-10 (CR-03) gap-closure work against diff base `44d36f5dd7`, cross-referenced with the copy/paste rail-set path, the parse/revision pipeline, the delete classifiers, and the residual `repeat` consumers. No structural-findings block was supplied for this round.

58-10 is correct. `loopSourceOrderIsProvable` (`physicsPaintRotoPhysicalResolver.ts:1867-1887`) is a faithful extraction of the 58-07 `move-key` proof, and the `move-key-group` guard (`:5036-5052`) reads the FINAL candidate mapping, is intersection-scoped to clips whose `sourceKeyIds` contain a moved key, and is safe because `buildMoveGroupCandidate` (`:1887-2007`) is a pure rigid translation. The prior round's CR-03 is closed.

58-09's read-side bound is coherent: `resolvePhysicPaintRotoLoopSourceExtent` (`physicsPaintRotoPhysicalModel.ts:1003-1031`) and its consumers agree on `min(storedEnd, phaseOrigin + cycleLength * repeat)`, the reveal-rail exemption is honoured, dangling sources fall back to the stored end, and `reconcilePhysicPaintRotoGroupFrames` (`:1062-1112`) preserves every parser invariant (non-empty strictly increasing ranges inside the new end, overrides inside a visible range, unreferenced override records pruned, replay excluded, input references returned when nothing changes). Undo/Redo round-trips byte-identically.

However, G-01 applies its "stored end is stale intent" rule to every finite lifecycle clip, while the rail-set paste path deliberately synthesizes lifecycle clips whose stored end is a duration-preserving span that is NOT a whole cycle multiple. The new clamp therefore truncates freshly pasted Infinity rails (CR-01). A second gap is the ownership disagreement between the new delete classifiers and the resolver for frames inside a lifecycle gap (WR-01). The full-suite pass and clean typecheck do not exercise either case: the pinned paste tests only use whole-cycle spans, and no test places a real key on a gap frame.

## Narrative Findings (AI reviewer)

### CR-01: G-01 truncates a pasted Infinity rail whose frozen span is not a whole cycle

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:307-311` (root cause), `:449-451` (synthesized lifecycle), `:898` (impact); `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5661-5666`, `:5717-5720` (render clamp); `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1067-1092` (persistent trim); `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:2346-2356`, `:2449-2450` (reconcile on paste + semantic delta)
**Severity:** BLOCKER

**Issue:** Copying an Infinity rail freezes its visible span and derives the cycle count with rounding:

```ts
const effectiveEndExclusive = Math.max(clip.placementStart, Math.min(document.capacity, boundary));
return { effectiveEndExclusive, repeat: Math.max(1, Math.round((effectiveEndExclusive - clip.placementStart) / cycleLength)) };
```

`buildDuplicatedLoopClip` then synthesizes `originalEndExclusive: destinationStart + (sourceEffectiveEndExclusive - clip.placementStart)` — the preserved duration — with that rounded `repeat`. When the span is not a whole multiple and rounds down, the clip stores `originalEndExclusive > phaseOrigin + cycleLength * repeat`. G-01's `resolvePhysicPaintRotoLoopSourceExtent` treats the formula as truth (`:1028`), so `derivePhysicPaintRotoLoopRanges` clamps:

```ts
const boundedNaturalEnd = sourceExtent === null ? naturalEnd : Math.min(naturalEnd, sourceExtent.endExclusive);
...
const effectiveEnd = Math.max(fragment.start, Math.min(boundedNaturalEnd, fragment.endExclusive, boundary.frame));
```

Two consequences, both introduced by this phase:

1. **Render loss.** The pasted rail renders `cycleLength * repeat` frames, not the source's visible duration. Pre-G-01 the resolver ignored `repeat` for rendering and used `min(originalEndExclusive, boundary)`, so the trailing partial cycle was visible. Repro: Infinity rail at `placementStart 10`, source keys at 10 and 14 (`cycleLength 5`), next unowned key at 27 → copied span 17, `repeat = round(17/5) = 3`, pasted at 100 → stored end 117, extent 115 → frames 115 and 116 stop rendering the moment the paste is accepted.
2. **Permanent trim.** `reconcilePhysicPaintRotoGroupFrames` runs on the same non-replay paste commit (the paste proposal feeds `stagedLoopClips` at `:2297`), rewrites `originalEndExclusive` to 115, trims `visibleRanges`, and prunes override records in the discarded tail. The trimmed shape is then persisted, so the loss survives later edits and Undo/Redo snapshots pair with the truncated document.

The same inconsistency also leaves the published edit's semantic delta describing a document that was never written: `proposed.impact` is built from the untrimmed proposal (`physicsPaintRotoRailSetCopy.ts:898`), stored at `useRotoPhysicalEditCoordinator.ts:2094`, and attached as the payload's `semanticDelta` (`:2449-2450`), while `stagedRevision` and the payload clips are built from the reconciled collection. `identities[].effectiveEndExclusive` and `nextRevision` therefore advertise the trimmed-away tail.

This contradicts the copy path's own contract: `resolveLoopCopyExtent`'s doc (`:255-264`) promises the pasted copy "reproduces the visible duration it actually had", and the synthesized-lifecycle comment in `buildDuplicatedLoopClip` (`:440-451`) promises it "renders to exactly the source's visible duration". The pinned tests only cover spans that happen to be whole multiples (`physicsPaintRotoRailSetCopy.test.ts:660-708`, 24/6) or round up (`:710-730`, 100/6 → 17), so the regression is untested.

**Fix:** Make the frozen cycle count cover the preserved span so the derived extent can never be shorter than the stored end:

```ts
// physicsPaintRotoRailSetCopy.ts:308-311
return {
  effectiveEndExclusive,
  // Ceil, not round: the synthesized lifecycle stores the full visible span as
  // originalEndExclusive, so phaseOrigin + cycleLength * repeat must be >= it or
  // G-01's source-extent clamp trims the pasted tail away.
  repeat: Math.max(1, Math.ceil((effectiveEndExclusive - clip.placementStart) / cycleLength)),
};
```

The existing pinned values are unchanged (24/6 → 4; 100/6 → 17). Add a regression test with a span such as 17 at cycle 5: assert the pasted `originalEndExclusive`, the derived `effectiveEnd` (must equal the pasted end), and that a coordinator commit leaves the pasted clip byte-identical. Also build the paste impact/`nextRevision` from the post-reconcile document (or run the reconcile before the impact is constructed) so the semantic delta matches what is published.

### WR-01: A real key inside a lifecycle gap is undeletable, and the locked copy points at a frame that refuses deletion

**File:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:734-745`, `:906-915`, `:964-967`; `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1054-1069`, `:4226-4231`, `:873-875`; `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:614-625`
**Severity:** WARNING

**Issue:** The new UI ownership test only accepts frames that render Group content:

```ts
return target.kind === 'source-occurrence' || target.kind === 'generated-occurrence' || target.kind === 'override'
  ? { groupId: target.groupId } : null;
```

`classifyPhysicPaintRotoGroupFrameTarget` returns `group-gap` for any in-extent frame outside `visibleRanges` (`physicsPaintRotoGroupLifecycle.ts:439-448`), so gap frames are not "owned" in the UI. The resolver's `isGroupOwnedKeyFrame` never consults `visibleRanges` — ownership is `phaseOrigin <= appFrame < min(originalEndExclusive, extent.endExclusive)` — so the same frame IS owned there. Result: when the cursor is elsewhere, the single-key branch falls through and returns `ordinary-key`; the delete reaches the resolver, which rejects with `group-owned-key-delete-rejected` and the locked copy "This key is owned by a Rail cycle. Delete the Rail frame instead." But `proposePhysicPaintRotoDeleteGroupFrame` rejects that same frame with `frame-not-visible` (`:621-625`). The prescribed remedy cannot be executed, and the key cannot be removed at all.

Reachability is short and follows the guard's own terms. G-01 explicitly claims ownership of "a local key inside the surviving extent" (resolver `:4227`). Such a key can sit on a rendered Group frame (rail-set paste checks occupancy against `realKeyRecords` only, so a rendered frame is "free"). Deleting that Rail frame — exactly what the locked copy instructs — removes the phase from `visibleRanges` and leaves the real key on a now-hidden gap frame. From then on, key Delete is refused as Group-owned while Rail-frame Delete is refused as not visible. The only escape is deleting the entire Group rail.

**Fix:** Make the resolver's ownership predicate visibility-based, so gap frames classify as ordinary keys (this is what the UI already concludes):

```ts
// physicsPaintRotoPhysicalResolver.ts:1062-1068
return appFrame >= clip.phaseOrigin
  && appFrame < endExclusive
  && clip.visibleRanges !== undefined
  && clip.visibleRanges.some((range) => appFrame >= range.start && appFrame < range.endExclusive);
```

Add parity tests for a source frame, an override frame, and a gap frame (visible vs hidden) across the resolver and `classifyRotoDeleteTarget`. If gap-frame keys must stay protected instead, then the UI must return a group-frame target for `group-gap` AND `proposePhysicPaintRotoDeleteGroupFrame` must accept gap frames; protecting them in the resolver while refusing the frame delete in the UI is not a coherent state.

### IN-01: Unreachable `capacity === undefined` fallback in `resolveGroupBoundedEnd`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:320-337`
**Severity:** INFO
**Category:** necessity

**Issue:** `resolveGroupBoundedEnd` accepts `capacity: number | undefined` and returns the stored end when `typeof capacity !== 'number'` (`:328`). Every call site passes `input.document.capacity` (`:102`, `:395`, `:621`, `:747`) or the `capacity` parameter of `resolveGroupPhaseAuthority` (`:366`), which is only ever called with `input.document.capacity` (`:107`, `:411`, `:626`). `PhysicPaintRotoPhysicalDocument.capacity` is a required `number` (`physicsPaintRotoPhysicalModel.ts:374`), and parsed documents validate it. The undefined branch cannot be reached from typed code, so the guard protects an impossible state and weakens the signature of a helper whose callers all hold the capacity.

**Fix:** Type the parameter as `number` and delete the fallback:

```ts
function resolveGroupBoundedEnd(
  group: PhysicPaintRotoLoopClip & Required<Pick<PhysicPaintRotoLoopClip, 'phaseOrigin' | 'originalEndExclusive'>>,
  realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[],
  capacity: number,
): number {
  const extent = resolvePhysicPaintRotoLoopSourceExtent(...);
  return extent === null ? group.originalEndExclusive : Math.min(group.originalEndExclusive, extent.endExclusive);
}
```

---

_Reviewed: 2026-11-03T16:41:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
