---
phase: 261107-rrp-cycle-with-motion-in-studio-adding-a-cyc
plan: 01
subsystem: ui
tags: [rail-motion, loop-clip, reconciler, span-resolver, preact, vitest]

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: rail-motion identity, the document commit-point reconciler, the loop-resolution span resolver and the v7 motion lane surface
provides:
  - Key Rail -> cycle conversion re-keys the motion record to the new loopId in the same commit
  - finite Loop Clip motion span derived from the resolved rail extent
  - preserved-but-inactive out-of-band Motion keys
  - one band derivation (railMotionViewFrameCount) read by every consumer
affects: [rail-motion, timeline-motion-lane, loop-clip-cycle, undo-redo]

actuals:
  tokens: 11612
  tasks: 3
  commits: 3
  plan_head_before: bebeb79b934f4c5f7d02710e9ab2774d9bad4d46
  plan_head_after: ff6d6714df76920ecf8efda881c4369eab1a0dfc

tech-stack:
  added: []
  patterns:
    - "Commit-point classification ordered before delete rows: a proven conversion can never be read as a deletion"
    - "Injected span resolver as the rail/compositor authority; key-count product is only the no-answer fallback"
    - "One exported derived helper per surface number, guarded by source contract pins"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/railMotionIdentity.ts
    - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
    - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
    - app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/roto/railMotionEvaluator.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
    - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/lib/railMotionGateBEdits.test.ts

key-decisions:
  - "The conversion row is classified only when the next side has no successor Key Rail segment, the clip id is new, placementStart equals the prior rail's first key frame, and the clip owns every prior key through the shared group-ownership projection; every other case keeps the existing classification (fail closed)."
  - "onConvertRailToLoopClip returns the input unchanged when the destination loopId already carries a record, so a collision can never fork identity; the parser remains the final duplicate invariant."
  - "A finite Loop Clip view ends at the resolver's effectiveEnd verbatim; the key-count product applies only when the resolver has no finite answer. The infinity Math.max rule is untouched."
  - "Out-of-band Motion keys are preserved-but-inactive: writes and shrink never clamp or delete them, and they reappear at their original rail-local frames when the rail re-extends."
  - "railMotionViewFrameCount is the single band-width derivation for lane width, header stack, cursor writes and drag validation, pinned by a source contract test."

patterns-established:
  - "Conversion before deletion: identity-changing rows are evaluated ahead of destructive rows, and a destination-collision guard keeps the transform additive."
  - "One shared derived number per band: consumers import the helper rather than re-subtracting view fields."

requirements-completed: [QUICK-261107-RRP]

coverage:
  - id: D1
    description: "Converting an animated Key Rail into a Rail/Key Rail cycle keeps every motion channel, key, value, easing, wiggle and rail-local frame, re-keyed to the new loopId, and one undo restores the Key Rail record."
    requirement: QUICK-261107-RRP
    verification:
      - kind: integration
        ref: "src/lib/railMotionGateBEdits.test.ts#261107-rrp: a Key Rail cycle conversion keeps every motion key, and one undo restores it"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts#261107-rrp rail motion document reconciler — Key Rail to cycle conversion"
        status: pass
    human_judgment: true
    rationale: "The live surface (dots and curve on the converted rail, undo/redo parity) needs the user's visible UAT pass."
  - id: D2
    description: "A finite cycle's motion span follows the resolved rail extent, so added motion reaches the rail end and shrink/re-extend loses no key."
    requirement: QUICK-261107-RRP
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionIdentity.test.ts#261107-rrp rail motion identity — finite clip views"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionCommands.test.ts#261107-rrp motion span auto-fit policy"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionEvaluator.test.ts#261107-rrp: keeps every shared frame point identical when the rail shrinks"
        status: pass
    human_judgment: true
    rationale: "Cycle order changes and dot restoration are visible rail behavior the user verifies live."
  - id: D3
    description: "Lane width, header stack, cursor writes and drag validation all read the one railMotionViewFrameCount helper, with source contract pins."
    requirement: QUICK-261107-RRP
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/TimelineMotionChannels.test.ts#reads the same resolved band the shared helper derives for a long span"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/timelineMotionSurface.contract.test.ts#the Motion band has one authority (261107-rrp)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts (192 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-11-07
status: complete
---

# Quick 261107-rrp: Cycle with motion in Studio Summary

**An animated Key Rail now survives conversion into a Rail/Key Rail cycle by re-keying its record to the new loopId in the same commit, and every finite cycle band now derives from the resolved rail extent instead of a key-count product.**

## Performance

- **Duration:** 15 min (plan at 20:09, final task commit at 20:23)
- **Started:** 2026-11-07T20:09:32Z
- **Completed:** 2026-11-07T20:23:15Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Key Rail -> cycle conversion no longer deletes motion. The commit-point reconciler classifies the conversion ahead of the delete rows and invokes `onConvertRailToLoopClip`, which re-keys `railId` to the new `loopId`, re-stamps `anchorKeyId` on the clip's first source key, and keeps `channels` byte-identical — one document write, one undo.
- Finite Loop Clip motion spans now end at the injected resolver's `effectiveEnd`, so raising or lowering a cycle extends/shortens the lane to exactly what the rail and compositor draw; the key-count product survives only as the no-answer fallback and the infinity `Math.max` rule is unchanged.
- Out-of-band Motion keys are preserved-but-inactive: writing inside the band leaves a key at rail-local frame 20 untouched, and a shrink/re-extend restores it at its original frame with its value; every shared frame evaluates identically across the shrink.
- One band derivation, `railMotionViewFrameCount`, is now read by lane width, the header stack, cursor writes and both Motion-key drag validation sites, with source contract pins that fail if any consumer stops importing/calling it or if a second helper export appears.
- The real bridge transport is pinned: a loop-only play-script payload converts the record to `loop-new`, reports no merge notice, and one undo restores `rail-1` and the pre-edit revision.

## Task Commits

Each task was committed atomically:

1. **Task 1: Key Rail -> cycle conversion keeps motion** - `44c76c16d` (feat)
2. **Task 2: Finite span = resolved rail extent + one band helper** - `b6e8dfc00` (feat)
3. **Task 3: Every band consumer reads the one helper** - `ff6d6714d` (refactor)

Measured from the plan ledger: 3 commits between `bebeb79b9` and `ff6d6714d`.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionIdentity.ts` — added `onConvertRailToLoopClip` and `railMotionViewFrameCount`; finite Loop Clip views adopt the resolved end.
- `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — conversion transition rows, finite-span rows (resolved, no-answer fallback, shrink/re-extend), helper pins.
- `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` — `placementStart` clip fact, `findConversionLoopClip`, `convert-rail-to-loop` classification before the delete rows.
- `app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts` — 10 conversion rows: re-key, anchor re-stamp, override ownership, idempotence, destination collision, partial ownership, placement failures, existing loop id.
- `app/src/lib/railMotionGateBEdits.test.ts` — real-transport conversion + undo pin with a loop-only play-script payload.
- `app/src/components/physic-paint/roto/railMotionCommands.ts` — `railMotionCursorFrame` uses the helper.
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` — cursor clamp, preserved out-of-band key, helper-derived drag clamp.
- `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` — curve invariance across a shrink (regression pin, no evaluator change).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — `TimelineMotionBlock` band uses the helper.
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — header group band uses the helper.
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — long resolved span (10 -> 46 = 36 frames) header/body agreement; null view still fails closed.
- `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — one-authority source pins for the four consumers.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — prepare and commit drag validation use the helper.

## Decisions Made

- Conversion is proven only by: no successor Key Rail segment, a NEW clip id, `placementStart` equal to the prior rail's first key frame, and full ownership of the prior segment keys through `collectRailMotionGroupOwnedKeyIds`. Any missing fact fails closed to the previous classification.
- The conversion transition is additive and idempotent: same `railId`/`loopId`, absent source, or an occupied destination returns the input reference unchanged.
- The finite span takes the resolver answer verbatim; the key-count product is only a fallback. This is what makes lowering a cycle shrink the lane by exactly the rail's own amount.
- Writes and shrink never clamp or delete keys; the band is a view-time filter only.
- The out-of-band write pin uses the `rotation` channel rather than `position-x`, because Position is paired (D-12) and a one-axis fixture violates the model's pairing invariant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Gate-B payload kind could not be `create-loop`**
- **Found during:** Task 1 (real-transport conversion pin)
- **Issue:** The plan instructed `operationKind: 'create-loop'`, but that value is not a member of `PhysicPaintRotoPhysicalEditOperationKind` and the payload validator rejects it; the run stops before any reconciliation.
- **Fix:** Used the faithful real shape for a conversion: `operationKind: 'play-script'` with a loopOnly semantic delta (`affectedEndAppFrame === affectedStartAppFrame - 1`, capacity 600, `expectedLayerEndExclusive` 600, matching `proposedRecords`, `freshKeyIds: []`), a valid `rotoBackground` and the new `loopClips`, and no `railMotions` field so the reconciler runs. The test sets `projectStore.filePath` and `projectStore.scriptLibraryAuthority` because the play-script path requires a saved project.
- **Files modified:** app/src/lib/railMotionGateBEdits.test.ts
- **Commit:** 44c76c16d

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None — no new network, auth, file-access or schema surface; the persisted `railMotions` field, evaluator, store, document model, serializer and CSS are untouched.

## Verification

- Targeted suites: identity/commands/evaluator 181 passed; consumer suites 208 passed; actions 192 passed.
- Full suite: 399 test files passed | 2 skipped; 8036 tests passed | 1 skipped | 96 todo.
- `pnpm --filter efx-motion-editor run typecheck`: clean.
- Scope tripwire `git diff --name-only bebeb79b9 -- app/src`: exactly this plan's 13 files; no `app/src/stores`, `app/src/efx-paint/document`, `src-tauri`, `railMotionEvaluator.ts` source, `railMotionModel.ts` or CSS path.

## UAT Rows Handed to the User

1. Convert an animated Key Rail into a Rail cycle: motion dots and curve stay on the new cycle rail at the same rail-local frames with the same values, and no motion or warning is lost.
2. Undo the conversion and redo it: the Key Rail and its motion return, and redo restores the cycle with motion still attached.
3. Raise the cycle order: the motion lane extends to the new rail end and repeat occurrences carry the animation instead of empty dotted placeholders.
4. Animate an already-cycled rail and add motion keys in a later occurrence: dots accept frames up to the rail end, and drag/click stay clamped inside the rail.
5. Lower the cycle order, then raise it again: the lane shrinks with the rail, and re-extending restores the dots at their original rail-local frames with their values intact.

Automated-green is not done: these five rows are the live visible UAT pass.

## Self-Check: PASSED

- Existing files verified: railMotionIdentity.ts, railMotionDocumentReconciler.ts, railMotionCommands.ts, PhysicsPaintTrackRow.tsx, TimelineMotionChannels.tsx, useRotoTimelineActions.ts, and the six touched test files.
- Commits verified as ancestors of HEAD: `44c76c16d`, `b6e8dfc00`, `ff6d6714d`.
