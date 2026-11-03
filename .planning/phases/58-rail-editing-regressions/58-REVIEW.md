---
phase: 58-rail-editing-regressions
reviewed: 2026-11-03T20:27:40Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
  necessity: 1
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-11-03T20:27:40Z
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This artifact replaces the stale review from `2026-11-03T16:41:49Z` and covers the CURRENT tree on `dev` at `39dc6e418`, including the six UAT-driven fix commits that landed afterwards (`eb576f1cf`, `2d2105897`, `b9691ea03`, `bdc5928ac`, `e41c2f6a4`, `9507de221`). Scope is the 13 production files actually touched by phase 58 (`git diff --name-only 578d61d51~1..39dc6e418 -- 'app/src/**'` minus tests). Five files named in the phase brief were NOT modified by phase 58 and were read for context only: `physicsPaintRotoRunScriptStacking.ts`, `physicsPaintKeyRailPresentation.ts`, `PhysicsPaintKeyRail.tsx`, `PhysicsPaintPlayScriptDialog.tsx`, `PhysicsPaintScriptsPanel.tsx`.

Both findings from the stale round are closed in the current tree. `resolveLoopCopyExtent` now rounds the frozen cycle count UP (`Math.ceil`, `physicsPaintRotoRailSetCopy.ts:313`), so G-01 cannot trim a pasted Infinity rail's tail. `isGroupOwnedKeyFrame` now consults `visibleRanges` (`physicsPaintRotoPhysicalResolver.ts:1149-1151`), so a real key on a hidden gap frame is deletable instead of deadlocked between the key-delete and frame-delete paths.

The main live defect is a count-vs-span confusion left by `2d2105897` in the new rail insert plan: a spaced source cycle can never take the whole-shift branch, and the fallback rejects every insert at or left of the rail's phase origin. Because the plan is all-or-nothing for the whole document, a single spaced rail blocks a global Insert at frame 0. Four warnings cover the two rail-insert routes disagreeing about trailing content, the paint route never growing capacity, the G-04 retime being silently dropped past capacity, and the spaced-cycle delete falling back to hole semantics. The remaining items are quality and consistency gaps, including one necessity finding.

## Critical Issues

### CR-01: Rail insert plan compares a source-key COUNT with a cycle SPAN, rejecting every insert at or left of a spaced rail

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4632-4647` (failure at `:4787-4789`)
**Issue:** `moved` counts source key IDs whose current frame is `>= destinationAppFrame`, while `cycleLength` is the cycle SPAN `lastSourceFrame - phaseOrigin + 1`. The whole-shift branch is gated on `moved === cycleLength` (`:4633`), which is only true when the source cycle is contiguous. For a spaced cycle (e.g. source offsets 0, 2, 4: count 3, span 5), any destination at or left of `phaseOrigin` falls through to the interior branch, whose `insertOffset = destination - phaseOrigin <= 0` rejects (`:4646-4647`). The plan is all-or-nothing across every clip, so ONE spaced rail to the right makes a global Insert at frame 0 fail with `loop-source-key-insert-rejected` (`:4787-4789`), and Insert directly on the spaced rail's phase origin fails too. Spaced cycles are a supported state produced by G-05 single-key drags and authorized spacing; `2d2105897` changed only `cycleLength` here, so this is a regression introduced by that fix. The existing spaced-rail test covers only an interior insert.
**Fix:**
```ts
// :4633 — compare like units: `moved` is a key count, `cycleLength` is a span
- if (moved === cycleLength) {
+ if (moved === typed.sourceKeyIds.length) {
```
Keep `cycleLength` (the span) for `insertOffset` and `extendLoopClipCycle`. Add tests for a spaced cycle (offsets 0/2/4) with an insert at `phaseOrigin`, an insert before the rail, and a global insert at frame 0 with the spaced rail to the right.

## Warnings

### WR-01: Paint/+Key rail insert never grows capacity, so it fails when trailing content sits at the document tail

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1622,1637,1727,1786` and `:5154`
**Issue:** `buildRailKeyInsertPasteCandidate` shifts every trailing non-source key by `trailingDelta = target.repeat` (`:1622`, `:1637`) and every trailing clip by the same delta (`:1727`), but the paste-key branch finalizes with the unchanged `input.capacity` and never sets `nextCapacity` (`:5154`). Contrast the insert-slot branch, which computes `nextCapacity` from the highest final key frame, the destination, and the highest lifecycle end (`:4803-4823`) and passes it through `finalizeProposal` (`:3964`). When the document's last real key sits at `capacity - 1` and a trailing shift is required, the paint promotion is rejected with `over-capacity` even though the insert-slot route would have grown the document. The two rail-insert routes must agree.
**Fix:** Compute the same `nextCapacity` in the paste rail branch (or return it from `buildRailKeyInsertPasteCandidate`) and finalize with `{ ...candidate, nextCapacity }`, mirroring `:4813-4824`.

### WR-02: G-04 retime is silently discarded when the retimed band exceeds capacity

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5273-5284`
**Issue:** The retime is applied only when every retimed clip satisfies `originalEndExclusive === undefined || originalEndExclusive <= input.capacity` (`:5281`). When the moved source key stretches the cycle so `phaseOrigin + cycleLength * repeat` exceeds capacity, the whole retime is dropped while the base move candidate is kept: the source key moves, the rail band keeps its stale end, and the moved key lands outside its own band. `buildMoveCandidate` never touches loop clips, and the G-01 reconcile only trims when `storedEnd > extent`, so nothing repairs the stale band. With `repeat >= 2` the band grows by `repeat` per added source frame, so this is reachable on any rail near the document tail.
**Fix:** Do not drop the retime silently. Either grow capacity via `nextCapacity` (as in the insert-slot branch) or clamp the retimed end to capacity while keeping `phaseOrigin`/`visibleRanges` consistent with the moved source frames.

### WR-03: Insert-slot rail growth swallows trailing content into the grown band for repeat > 1

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1224-1241` and `:4423-4448`
**Issue:** The insert-slot path ripples every identity at or after the destination by exactly +1 (`buildInsertCandidate`, `:1231-1241`), while the target rail's band grows by `repeat` frames (`extendLoopClipCycle` multiplies the new cycle by `repeat`, `:4423-4448`). The paste route deliberately compensates by shifting trailing content by `repeat` (`:1622-1727`); the insert-slot route does not. For a rail with `repeat >= 2` and a following real key adjacent to the old end, that key now falls INSIDE the rail's `[phaseOrigin, originalEndExclusive)` band, is classified as a rail frame by `classifyPhysicPaintRotoGroupFrameTarget`, and stops behaving as an ordinary key. The two insert routes therefore disagree about the same geometry.
**Fix:** Extend the insert-slot rail plan to account for the band growth: shift trailing identities and trailing clips by `repeat` when the target rail grows, or clamp the rebuilt end so trailing keys cannot be swallowed. Add a repeat > 1 insert test with an adjacent following key.

### WR-04: Deleting the first phase of a spaced source cycle silently degrades from contraction to hole semantics

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:661` and `:887-905`
**Issue:** `resolveGenerateModeContraction` refuses whenever the removed phase is offset 0 and the next source is not adjacent (`:661`). `proposePhysicPaintRotoDeleteGroupFrame` then falls through to the legacy path (`:887-905`), which only removes frames from `visibleRanges` and drops overrides: the deleted phase's source key stays in `sourceKeyIds` and the cycle keeps its old length. The user asked to delete a phase and got a hidden hole with a surviving source key, which violates the G-02 contraction contract. The guard is documented, but the degradation is silent and the impact payload does not distinguish it from a real contraction.
**Fix:** Either teach contraction to re-anchor `phaseOrigin` when the first source is removed from a spaced cycle, or surface a distinct failure/impact flag so the caller can explain that the phase was hidden rather than removed. At minimum, do not leave the deleted key referenced as a source of the clip.

## Info

### IN-01: Dead `frameOwners` map in the rail insert target resolver

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4500-4505`
**Issue:** `frameOwners` is built and incremented but never read. The duplicate-frame detection it evidently was meant to provide is absent; the downstream collision check uses `mappedFrames.size !== frameByKeyId.size` instead (`:4564-4566`).
**Fix:** Remove the map, or use it to reject duplicate identity frames explicitly.

### IN-02: Unused export silently drops Group override records

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4580-4584`
**Issue:** `resolvePhysicPaintRotoRailInsertLoopClips` has zero callers in `app/src` and returns only `plan.loopClips`, discarding `plan.groupOverrideRecords`. Any caller who adopted it on a rail with painted overrides would shift override frames without shifting their records, producing a document the parser rejects (`Group override reference mismatch`).
**Fix:** Delete the wrapper or make it return the full plan so override records cannot be dropped.

### IN-03: Shared override keyIds are not guarded by either rail insert path

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:1628-1634` and `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:667-673`
**Issue:** Contraction refuses when another clip shares any shifted override keyId (`:667-673`); `buildRailKeyInsertPasteCandidate` guards only shared source keys (`:1628-1634`), and `resolvePhysicPaintRotoRailInsertPlan` has no sharing guard at all (identical source cycles shift together, which is safe). The parser permits two clips with disjoint sources to share an override keyId, so a shared override would have its record shifted while the other clip's `frameOverrides[].appFrame` stays stale, failing later at parse time. Production paths do not create shared override keyIds today (`duplicateLinkedLoop` has no caller, rail-set copy repoints identities), so this is latent.
**Fix:** Apply contraction's shared-override rejection to both insert paths.

### IN-04: Insert classifier and resolver disagree about override-record requirements

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4692-4696`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:149-155`
**Issue:** `isPhysicPaintRotoRailInsertDestination` runs the plan with `requireOverrideRecords = false` and no records, while the resolver always calls it with `true` and passes `input.groupOverrideRecords` (`:4781-4785`). The UI can advertise a rail frame as an insertable `generated` destination while the actual edit fails `loop-source-key-insert-rejected` because an override shift cannot be satisfied.
**Fix:** Thread the override records into the classifier, or make the classifier conservative when the plan needs records it does not have.

### IN-05: Ambiguous rail target silently falls back to a detached key insert

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4540`
**Issue:** `if (target !== null) return null;` aborts target resolution when a second rail clip also matches. Callers then take the ordinary paint/+Key path and create a detached key inside the painted band, with no user-visible rejection. The parser only forbids non-identical source sharing, so two qualifying bands can overlap in principle.
**Fix:** Choose a deterministic owner (for example the innermost band) or return a distinct failure so the UI can report that the rail cannot accept the key at this frame.

### IN-06: Impossible-state guard — nullable capacity in `resolveGroupBoundedEnd`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts:321-338`
**Category:** necessity
**Issue:** Subtype: impossible-state guard. `capacity` is typed `number | undefined` and the helper returns early on non-number, but every call site passes `input.document.capacity` / `document.capacity` (`:103`, `:367`, `:396`, `:822`, `:983`), and `PhysicPaintRotoPhysicalDocument.capacity` is a required `number` (`physicsPaintRotoPhysicalModel.ts:374`) validated as a positive integer by the parser. The guarded state cannot occur from typed code.
**Fix:** Narrow the parameter to `number` and drop the branch:
```ts
function resolveGroupBoundedEnd(
  group: PhysicPaintRotoLoopClip & Required<Pick<PhysicPaintRotoLoopClip, 'phaseOrigin' | 'originalEndExclusive'>>,
  realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[],
  capacity: number,
): number { ... }
```

### IN-07: `isCanonicalLifecycleRailClip` does not require `placementStart === phaseOrigin`, while retiming rewrites `phaseOrigin = placementStart`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:988-998` and `:1043-1060`
**Issue:** The canonicality predicate checks visible-range alignment but not that `placementStart` equals `phaseOrigin`. `computeSourceAttachedLoopPlacementFollow` then unconditionally rewrites `phaseOrigin: placementStart` and `originalEndExclusive: placementStart + cycleLength * repeat` (`:1043-1060`). A clip whose `placementStart` differs from `phaseOrigin` (the shape `duplicateLinkedLoop` produces by spreading lifecycle fields onto a new placement) would be re-anchored away from its source frames by a G-04/G-05 retime. `duplicateLinkedLoop` has no production caller, so this is latent.
**Fix:** Add `clip.placementStart === clip.phaseOrigin` to `isCanonicalLifecycleRailClip`, or make the retime preserve the existing `phaseOrigin` relationship explicitly.

---

_Reviewed: 2026-11-03T20:27:40Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
