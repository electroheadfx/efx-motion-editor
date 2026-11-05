---
phase: 58-rail-editing-regressions
reviewed: 2026-11-05T11:17:17Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
findings:
  critical: 3
  warning: 4
  info: 10
  total: 17
  necessity: 1
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-11-05T11:17:17Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This is an incremental deep re-review of the two commits that landed after the 2026-11-03 review: `02de1ecc5` (refuse single-key moves that would erase a source key) and `bcbdecb71` (extend a rail after +Key/paint instead of a detached segment). Scope is exactly the four files named in the workflow; every finding below was confirmed by reading the current tree and, where behavior was in doubt, by a temporary executable vitest probe suite (removed afterwards; no source files were modified; the working tree is clean).

The three explicit questions from the workflow:

1. **Is CR-01 still present after `bcbdecb71`? Yes.** The count-vs-span comparison is unchanged at `physicsPaintRotoPhysicalResolver.ts:4944`. A probe through the real `insert-slot` intent fails with `loop-source-key-insert-rejected` when a spaced rail sits to the right of the destination; the same insert with a contiguous rail succeeds, and an interior insert on the spaced rail succeeds. Nothing in either commit touched this code.
2. **Are the move guards sound?** `loopSourceOrderIsProvable` (`:2235-2247`) is sound for the clip it is given and is correctly used by both move branches. The new "would erase a source key" refusal (`:5630-5648`) is not: it only inspects the single clip that references the *moved* key, so a physical-cell move of an unowned key can ripple another clip's source keys out of their visible fragments and the resolver still returns `ok: true`. Two probes reproduce it, including one where an entire canonical rail's source cycle is pushed out of its band (CR-04). The guard is also absent from `move-key-group`, and the comment at `:5633-5634` claiming a whole-cycle group drag retimes every lifecycle rail is false.
3. **Do the new tests pin the new behavior?** The rejection test in `physicsPaintRotoLoopGuards.test.ts:312-333` genuinely exercises the guard, and the append tests do assert the rebuilt clip. They are not vacuous. They do have material gaps: the append fixtures are not parseable documents (overrides without override records), no test exercises a trailing key or clip, no test exercises a scripted or Reveal rail *with* overrides (the exact combination the append now changes), and CR-01 has no regression test.

The append change also has a law defect of its own: it accepts any overridden single-range repeat-1 rail, including Playscript (`scriptId`) and Reveal (`railKind: 'reveal'`) rails, which the dissolve law deliberately rejects. That is CR-05.

One prior warning is not re-reported: WR-04 ("deleting the first phase of a spaced source cycle silently degrades to hole semantics") was re-checked and is superseded by `1bfbf2672`, which removed `resolveGenerateModeContraction`; hole semantics is now the documented, intentional delete law (`physicsPaintRotoGroupLifecycle.ts:663-680`). The disposition record keeps the row.

## Critical Issues

### CR-01: Rail insert plan compares a source-key COUNT with a cycle SPAN, rejecting every insert at or left of a spaced rail

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4944` (rejection at `:4958`)
**Issue:** `moved` counts source key IDs whose current frame is `>= destinationAppFrame` (`:4917-4926`), while `cycleLength` is the cycle SPAN `lastSourceFrame - phaseOrigin + 1` (`:4943`). The whole-shift branch is gated on `moved === cycleLength` (`:4944`), which is only true for a contiguous source cycle. For a spaced cycle (offsets 0/2/4: count 3, span 5) a destination at or left of `phaseOrigin` falls through to `insertOffset = destination - phaseOrigin <= 0`, which rejects (`:4958`). The plan is all-or-nothing across every clip and is invoked by the `insert-slot` branch whenever any rippled key is Group-owned (`:5082-5101`), so ONE spaced rail to the right makes a global Insert at frame 0 fail with `loop-source-key-insert-rejected`.

Probe evidence (real resolver, current tree): a spaced rail at frames 10/12/14 (phaseOrigin 10, end 15):
- `insert-slot @ 0` -> failed, `loop-source-key-insert-rejected`
- `insert-slot @ 11` (interior) -> ok
- the same insert at 0 with a contiguous rail (10/11/12) -> ok

**Fix:** Compare like units:
```ts
// :4944
- if (moved === cycleLength) {
+ if (moved === typed.sourceKeyIds.length) {
```
Keep `cycleLength` (the span) for `insertOffset` and `extendLoopClipCycle`. Add regression tests for `insert-slot` at frame 0 with a spaced rail to the right and at the spaced rail's phase origin.

### CR-04: Ghost-source guard only inspects the moved key's referencing clip; cross-clip ripples still erase source keys

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5635-5648`, `:1019-1033`, `:6154-6161`
**Issue:** The v2.0.1 guard runs only when `referencingClips.length === 1` and scans only `referencingClips[0].sourceKeyIds`. A `move-key` physical-cell drag of a key that no clip references still goes through `cutSource`/`openAndInsert` (`:2099-2181`), which ripples every survivor at or after the insertion frame. If a rippled survivor is a source key of *another* clip, no clip follows the change (`nextLoopClips` stays null), and the key can land outside every visible fragment. The presentation layer then hides it as a ghost source key (`view/PhysicsPaintTrackRow.tsx:240-264`) and removes it from ordinary key rails (`PhysicsPaintStudio.tsx:1135-1142`), so the real painted key becomes invisible and unselectable while the edit reports success.

Probe evidence (real resolver, current tree):
- `{S1@10, S2@14, X@16}`, gapped rail `[10,12)` + `[13,15)`; move X to physical cell 13 -> `ok: true`, mapping `{S1:10, S2:15, X:13}`, `nextLoopClips: null`. S2@15 is outside `[13,15)` -> ghost.
- `{X@8, S1@10, S2@14}`, canonical rail `[10,15)`; move X to physical cell 20 -> `ok: true`, mapping `{X:20, S1:9, S2:13}`, `nextLoopClips: null`. The cut left-shifts the whole source cycle; both sources are outside `[10,15)` -> the entire rail's sources ghost.
- `{K1@1, K3@3, K5@5}`, canonical rail `[1,6)`; `move-key-group` of all three sources by +2 -> mapping `{K1:3, K3:5, K5:7}` but the clip comes back with `placementStart: 3`, `phaseOrigin: 1`, `originalEndExclusive: 6`, `visibleRanges: [{start:1,endExclusive:6}]`; K5@7 is outside the band -> ghost. `buildMoveGroupCandidate` calls `computeSourceAttachedLoopPlacementFollow` without `retimeFiniteLifecycle` (`:2363-2368`), so the claim at `:5633-5634` that "the whole-cycle group drag retimes every lifecycle rail" is false.

Reachability: `prepareRotoKeyDrag` passes `loopClips` straight to the resolver (`hooks/useRotoTimelineActions.ts:2588-2596`), `prepareRotoKeyGroupDrag` does the same (`:2683-2698`), and the strip routes single-key drags there (`view/PhysicsPaintWorkflowStrip.tsx:4676`). There is no caller-side guard. The existing test `physicsPaintRotoLoopGuards.test.ts:392-400` pins the skipped-guard branch but with no source ripple, so it cannot catch this.

**Fix:** Once the final mapping is known, iterate **every** clip in the final clip collection and **every** source key, and reject when the key was covered at its pre-move frame and is not covered at its mapped frame:
```ts
const finalLoopClips = moveCandidate.nextLoopClips ?? loopClips;
for (const clip of finalLoopClips) {
  for (const keyId of clip.sourceKeyIds) {
    const previousFrame = identities.framesByKeyId.get(keyId);
    const movedFrame = moveCandidate.mapping.get(keyId);
    if (previousFrame === undefined || movedFrame === undefined) continue;
    if (sourceKeyFrameIsCovered(loopClips, keyId, previousFrame)
      && !sourceKeyFrameIsCovered(finalLoopClips, keyId, movedFrame)) {
      return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
    }
  }
}
```
Apply it to both `move-key` (`:5635-5648`) and `move-key-group` (after `:6154-6161`). Add tests for the three probe scenarios above.

### CR-05: Append bypasses the Standard/reveal/script discriminator and mutates Playscript and Reveal rails

**Severity:** BLOCKER
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4678-4692` and `:4536-4548`; contrast `:4838-4847`
**Issue:** `resolveRailKeyInsertTargetInternal` qualifies the append for any rail with one full-span visible range, `repeat === 1`, and `frameOverrides.length > 0` (`:4678-4681`). It never checks `isStandardMergedLoopClip` (`roto/physicsPaintRotoRunScriptStacking.ts:536-540`) or `railKind`, while the dissolve authority it now preempts explicitly requires a complete Standard rail and rejects Reveal/scripted clips (`:4838-4847`). Since `addEmptyKey` consults the insert target before the dissolve (`hooks/useRotoTimelineActions.ts:2518-2541`), an overridden Playscript rail (`scriptId`) or Reveal rail (`railKind: 'reveal'`) now takes the append: `buildAppendedRailClip` rewrites `originalEndExclusive`/`visibleRanges` (`:4540-4546`) and the new painted key is spliced into `sourceKeyIds` (`:1725-1734`), while `scriptId`, `motion`, `overrideColor`, and `railKind` are preserved by the spread.

Probe evidence (real resolver, current tree): for both `{scriptId: 'action-1', ...overriddenRail}` and `{railKind: 'reveal', ...overriddenRail}`, `resolvePhysicPaintRotoRailKeyInsertTarget` returns `{loopId:'rail-1', cycleOffset:5, insertionAppFrame:6}` and the edit resolves `ok: true` with `sourceKeyIds: ['K1','K3','K5','NEW']`, `originalEndExclusive: 7`, `scriptId`/`railKind` intact.

This contradicts the law pinned by `useRotoTimelineActions.test.ts:1658-1688` ("a scripted rail beyond its end keeps the detached key" and the Reveal equivalent): those fixtures use `standardRail(1)` with `frameOverrides: []`, so they never enter the append branch. The overridden state is reachable: painting a generated frame stores a `frameOverride` on any lifecycle clip (`hooks/useRotoPhysicalEditCoordinator.ts:1991` -> `roto/physicsPaintRotoGroupLifecycle.ts:94-180`), and rail-set copy preserves `scriptId` plus overrides (`roto/physicsPaintRotoRailSetCopy.ts:466,494`). Regenerate/stacking rebuilds Playscript rails from the script and treats a rewritten lifecycle as a mismatch (`roto/physicsPaintRotoPlayScriptController.ts:4355-4398`), so the appended paint key can be dropped or the rail desynced; a Reveal rail's baked source cycle is altered the same way.

**Fix:** Gate the append with the same Standard discriminator as the dissolve:
```ts
const append = input.appFrame >= clip.originalEndExclusive
  && clip.repeat === 1
  && clip.frameOverrides !== undefined
  && clip.frameOverrides.length > 0
  && isStandardMergedLoopClip(clip);
```
Add regression tests for an overridden scripted rail and an overridden Reveal rail expecting the previous detached-key behavior.

## Warnings

### WR-01: Paint/+Key rail insert never grows capacity, so it fails when trailing content sits at the document tail

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5499` (finalize), `:1671-1672`, `:1754-1771`
**Issue:** `buildRailKeyInsertPasteCandidate` shifts every trailing non-source key by `trailingDelta` (`:1671-1672`) and every trailing clip by the same delta (`:1754-1771`), but the rail insert and dissolve branches finalize with the unchanged `input.capacity` (`:5499`) and never set `nextCapacity`. Only the insert-slot branch computes a grown capacity (`:5114-5139`). With the new append route, `trailingDelta = destination - phaseOrigin + 1 - cycleLength` can be large, so a trailing key near `capacity - 1` is pushed to `capacity` and the whole +Key/paint is rejected with `over-capacity`, even though the insert-slot route would have grown the document. The two rail routes still disagree.
**Fix:** Return a `nextCapacity` from `buildRailKeyInsertPasteCandidate` (highest final key frame + 1, destination + 1, highest lifecycle end) and finalize with it, mirroring `:5114-5139`.

### WR-02: G-04 retime is silently discarded when the retimed band exceeds capacity

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5617-5628`
**Issue:** The retime is applied only when every retimed clip satisfies `originalEndExclusive === undefined || originalEndExclusive <= input.capacity` (`:5625-5627`). Otherwise the retime is dropped while the base move candidate is kept: the source key moves, the rail band keeps its stale end, and the moved key can land outside its own band. The G-04 reconcile only trims when the stored end exceeds the derived extent, so nothing repairs the stale band. The new ghost guard now rejects some of these moves, but only when the moved key lands outside the stale fragments; the silent drop remains.
**Fix:** Do not drop the retime silently. Grow capacity via `nextCapacity`, or fail closed with an explicit failure code instead of keeping a half-applied move.

### WR-03: Insert-slot rail growth swallows trailing content into the grown band for repeat > 1

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1259-1284` and `:4550-4575`
**Issue:** The insert-slot path shifts every real key at or after the destination by exactly +1 (`buildInsertCandidate`, `:1265-1274`), while `extendLoopClipCycle` grows the rail band by one frame per repeat (`nextCycleLength = cycleLength + 1`, `:4556`, and the mapped end at `:4569`). For a rail with `repeat >= 2`, a following real key adjacent to the old end now falls INSIDE the grown band, is classified as a rail frame, and stops behaving as an ordinary key. The paste rail route deliberately compensates with `trailingDelta`; the insert-slot route does not.
**Fix:** Shift trailing identities and trailing clips by the band growth (`repeat`) when the target rail grows, or clamp the rebuilt end so trailing keys cannot be swallowed. Add a repeat-2 insert test with an adjacent following key.

### WR-05: Append ripples every trailing key and clip by the full band growth, including content beyond the destination

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1671-1672`, `:1754-1771`, target `trailingDelta` at `:4703`
**Issue:** The append sets `trailingDelta = destination - phaseOrigin + 1 - cycleLength`, i.e. the total growth of the rail band, and then shifts **every** non-source key at or after the old rail end by that amount, plus every trailing clip, override, and override record. Content that the grown band cannot reach is still moved. Probe evidence (real resolver): with an overridden rail `[1,6)`:
- append at 6 -> band ends at 7, but `P@10` moves to 11;
- append at 20 -> band ends at 21, but `P@10` moves to 25 (a 15-frame displacement of an unrelated key).

The dissolve path at the same destination leaves `P@10` untouched (`{K1:1, K3:3, K5:5, NEW:6, P:10}`), so the same gesture produces radically different trailing edits depending on whether the rail carries one painted override. The target resolver's own straddle guard treats only `[oldEnd, destination)` as the affected window (`:4683-4692`), which suggests the wider ripple was not intended. No test asserts any trailing content for the append route.
**Fix:** Shift only content the grown band actually overtakes (frames in `[railOldEnd, destination]`); leave frames `>= destination + 1` untouched. If the full-growth ripple is intentional, document it and pin it with a test that asserts the trailing key's new frame, otherwise it will keep changing by accident.

## Info

### IN-01: Dead `frameOwners` map in the rail insert target resolver

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4634-4639`
**Issue:** `frameOwners` is built and incremented but never read. The duplicate-frame detection it evidently was meant to provide is absent; the downstream collision check uses `mappedFrames.size !== frameByKeyId.size` (`:4719`).
**Fix:** Remove the map, or use it to reject duplicate identity frames explicitly.

### IN-02: Unused export silently drops Group override records

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4891-4895`
**Issue:** `resolvePhysicPaintRotoRailInsertLoopClips` has zero callers in `app/src` and returns only `plan.loopClips`, discarding `plan.groupOverrideRecords`. Any adopter on a rail with painted overrides would shift override frames without their records, producing a document the parser rejects.
**Fix:** Delete the wrapper or return the full plan so override records cannot be dropped.

### IN-03: Shared override keyIds are not guarded by the paste rail insert path

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1658-1663`, `:1719-1722`, `:1765-1771`
**Issue:** The insert candidate guards shared **source** keyIds only. The parser permits two clips with disjoint sources to share an override keyId; if such a rail is the insert target or trails it, one clip's override frame is shifted/rewritten while the other clip's `frameOverrides[].appFrame` stays stale, failing later at parse time. The former contraction-side guard for this case disappeared with `resolveGenerateModeContraction`, so the invariant is now unguarded everywhere. Production paths do not create shared override keyIds today, so this is latent.
**Fix:** Reject a rail insert when any shifted or rewritten override keyId is referenced by another clip.

### IN-04: Insert classifier and resolver disagree about override-record requirements

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5003-5007` and `:5092-5097`
**Issue:** `isPhysicPaintRotoRailInsertDestination` runs the plan with `requireOverrideRecords = false` and no records, while the resolver always passes `true` and `input.groupOverrideRecords`. The UI can advertise a rail frame as an insertable destination while the actual edit fails because an override shift cannot be satisfied.
**Fix:** Thread the override records into the classifier, or make it conservative when the plan needs records it does not have.

### IN-05: Ambiguous rail target silently falls back to a detached key insert

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4693`
**Issue:** `if (target !== null) return null;` aborts target resolution when a second rail clip also matches. Callers then take the ordinary paint/+Key path and create a detached key inside the painted band, with no user-visible rejection.
**Fix:** Choose a deterministic owner (for example the innermost band) or return a distinct failure so the UI can report that the rail cannot accept the key at this frame.

### IN-06: Impossible-state guard — nullable capacity in `resolveGroupBoundedEnd`

**Severity:** INFO
**Category:** necessity
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:320-337`
**Issue:** Subtype: impossible-state guard. `capacity` is typed `number | undefined` and the helper returns early on non-number (`:328`), but every call site passes `input.document.capacity` / `document.capacity`, and `PhysicPaintRotoPhysicalDocument.capacity` is a required `number` validated as a positive integer by the parser. The guarded state cannot occur from typed code.
**Fix:** Narrow the parameter to `number` and drop the branch.

### IN-07: `isCanonicalLifecycleRailClip` does not require `placementStart === phaseOrigin`, while retiming rewrites `phaseOrigin = placementStart`

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1000-1010` and `:1085-1095`
**Issue:** The canonicality predicate checks range alignment but not that `placementStart` equals `phaseOrigin`. `computeSourceAttachedLoopPlacementFollow` then unconditionally rewrites `phaseOrigin: placementStart` and `originalEndExclusive: placementStart + cycleLength * repeat`. A clip whose `placementStart` differs from `phaseOrigin` would be re-anchored away from its source frames by a G-04/G-05 retime. `duplicateLinkedLoop` has no production caller, so this is latent.
**Fix:** Add `clip.placementStart === clip.phaseOrigin` to `isCanonicalLifecycleRailClip`, or make the retime preserve the existing `phaseOrigin` relationship explicitly.

### IN-08: Append tests use a document shape the parser rejects, and the hook test does not assert the new key's frame

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts:5390-5428`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts:1562-1582`
**Issue:** Both fixtures attach `frameOverrides: [{ appFrame: 4, keyId: 'O1' }]` (or `'ov1'`) to the clip but pass no `groupOverrideRecords`. `validatePhysicPaintRotoGroupReferences` requires a matching record for every override (`roto/physicsPaintRotoPhysicalModel.ts:1694-1707`), so neither fixture represents a parseable document. The resolver append path happens to succeed because it performs no override shifts, so the tests pass while exercising an invalid state. The hook test also never asserts the appended key's frame in `mapping`, only the clip's source list and end.
**Fix:** Build the fixtures through the document parser (or add `groupOverrideRecords`) and assert the new key's mapped frame.

### IN-09: No regression test for CR-01's spaced-rail insert-slot path

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts:4413-4442`
**Issue:** The only spaced-rail insert test uses an interior destination (3) and therefore never reaches the whole-shift branch that CR-01 breaks. There is no test for a global Insert at frame 0 with a spaced rail to the right, which is the user-visible failure.
**Fix:** Add the insert-slot cases described in CR-01.

### IN-10: Ghost-guard tests miss the cross-clip ripple and the group-drag band staleness

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts:312-333`, `:392-400`
**Issue:** The new guard test covers a move of the rail's own last source key. The "accepts a move on a key no loop references" test pins the branch where the guard is skipped, but its move does not ripple any source key, so it never demonstrates that the skipped guard is safe. No test moves an ordinary key across or next to a rail, and no test covers `move-key-group` leaving a lifecycle band stale.
**Fix:** Add the CR-04 probe scenarios (unowned-key ripple, whole-cycle group drag) as regression tests.

---

_Reviewed: 2026-11-05T11:17:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
