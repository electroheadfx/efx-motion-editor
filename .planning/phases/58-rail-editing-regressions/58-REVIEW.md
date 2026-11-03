---
phase: 58-rail-editing-regressions
reviewed: 2026-11-03T14:17:45Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
findings:
  critical: 1
  warning: 0
  info: 1
  total: 2
  necessity: 0
status: issues_found
---

# Phase 58: Code Review Report (gap closure: 58-06 / 58-07 / 58-08)

**Reviewed:** 2026-11-03T14:17:45Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Deep re-review of the three gap-closure fixes against diff base `90b20bc19dacefc62e4b8e000adc19ebb036f2c7`, with cross-file tracing into the drag routing, loop derivation, presentation, and export paths they depend on.

The 58-06 fix is correct: `confirmKeyRailCycle` now fences both awaits with the generation it captured (`physicsPaintRotoPlayScriptController.ts:1834,1841,1873`), routes `AbortError` to `'cancelled'` without a `fail()` (`:1882-1891`), and keeps the frozen target so a retry commits exactly once. The paired `cancel()` early return (`:3639-3643`) fixes WR-01: while `'committing'`, `canCancel` is false and `isBusyPhase` is true, so the target is no longer cleared under a dialog that cannot close; the failed-commit retry remains functional. Both new controller tests exercise the real interleavings (deferred authority / deferred commit) and assert commit counts, not just phases.

The 58-07 fix is correct for the intent it guards. The final-mapping check (`physicsPaintRotoPhysicalResolver.ts:4469-4493`) reads the post-ripple mapping, so cut/insert survivors cannot hide an inversion; a source key absent from the mapping fails closed; `changed === false` stays exempt; a one-element cycle is vacuously ordered; the `> 1` rejection and the locked D-16 copy are preserved verbatim. Its sibling intent, however, is not guarded: `move-key-group` can still persist a partial source-cycle move that inverts the cycle's order (CR-03 below), with the same user-visible consequences CR-02 had before the fix. This is pre-existing relative to the 58-07 commit but sits in the reviewed file and directly undermines the invariant 58-07 established.

The 58-08 fix is correct. `reducedForm` is exactly `keyRailCreate || standardEditTarget` (`PhysicsPaintPlayScriptDialog.tsx:69-72`), and both render only `ReducedCycleCard` (`:377-380`), so exempting the frames channel cannot admit an invalid confirm: `confirmKeyRailCycle` reads the frozen target and repeat, and `updateLoop` reads repeat plus the loop snapshot, never `countText`. `stackCollision` is null outside stacking (`:138`), so `confirmBlocked` matches the old button gate exactly on non-reduced surfaces. The Enter collision branch still precedes the gate (`:294-305`), and the footer button now reads the same value (`:579`).

Verification: `vitest run` over the four touched suites (loop guards, physical resolver, controller, dialog) passes 633 tests. No necessity findings. Prior info items IN-01..IN-03 from the phase review remain open per `58-REVIEW-DISPOSITION.md` and are not re-reported here.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-03: Partial-cycle group move bypasses the source-order invariant established for `move-key`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:4945-4977` (with `:1836-1958`, `:1950-1955`, `:5548-5560`, `:5650-5655`)
**Severity:** BLOCKER

**Issue:** The 58-07 order proof is attached only to the `move-key` branch. The sibling `move-key-group` branch builds a candidate and hands it to `finalizeProposal` without ever consulting the loop clips:

```ts
const moveResult = buildMoveGroupCandidate(identities, intent.movedKeyIds, intent.grabbedKeyId, intent.target, input.capacity, loopClips);
if (!moveResult.ok) return moveResult.resolution;
const finalized = finalizeProposal(moveResult.candidate, identities, input.capacity, input.interpolationEnabled, incomingInterpolationBreakKeyIds);
```

`buildMoveGroupCandidate` rejects only duplicate destinations and capacity (`:1895-1921`), `finalizeProposal` proves identity coverage/unique frames/interpolation breaks but never validates `sourceKeyIds` order (`:3590-3664`), and the loop follow only runs when the moved set contains the cycle's ENTIRE `sourceKeyIds` (`:1950-1955`). A partial-cycle selection therefore produces `nextLoopClips === null` and leaves the clip referring to its original source list.

The phase's own D-04 test pins the destructive case: source keys A..E at 10..14, cycle `[A,B,C,D,E]`, partial group move `{A,B}` to physical-cell 20 produces the mapping `A:20, B:21, C:12, D:13, E:14` and asserts `nextLoopClips` is null (`physicsPaintRotoLoopGuards.test.ts:761-771`). Its title claims "loops resolve by id" but it never calls `derive()`. In fact `derivePhysicPaintRotoLoopRanges` requires strictly increasing source positions (`:5548-5552`) and marks the clip `unresolved.invalidSourceTiming` (`:5650-5655`) because 12 < 21 at the third position.

Consequences are identical to the pre-fix CR-02 state: the rail reports "Source missing" (`view/physicsPaintLoopClipPresentation.ts:321,341`) and export is blocked with "invalid source timing" (`lib/exportEngine.ts:116-117`). The only recovery is Undo: `unlinkLoop` has no production consumer (only the dialog test mock at `PhysicsPaintPlayScriptDialog.test.ts:251`), and `repairLoop`/`openSourceEdit` refuse merged Standard clips (`physicsPaintRotoPlayScriptController.ts:1947,2061`).

Reachability is direct and user-facing: `PhysicsPaintWorkflowStrip.tsx:4448` arms a group drag whenever at least two keys are selected and the grabbed key is in the set; source keys are ordinary real keys in the selection source (`PhysicsPaintStudio.tsx:6645-6657` maps `rotoKeyRecordsRef`), and `prepareRotoKeyGroupDrag` forwards that selection as `move-key-group` (`useRotoTimelineActions.ts:2495-2535`). Every adjacent mutation path guards this invariant: `move-key-rail` rejects group-owned members (`:4559-4566`), Force Spacing requires a validated linked-source-spacing authorization that checks strict order at input (`:4497-4523`, `:3874-3878`), and `move-key` now checks the final order. `move-key-group` is the only remaining entry that can reorder sources.

**Fix:** Apply the same final-mapping proof to every clip the group move touches, after the candidate is built and before finalization. A group move that keeps the order (for example `{A,B}` to 8) stays legal, preserving the D-04 partial-move intent:
```ts
const moveResult = buildMoveGroupCandidate(identities, intent.movedKeyIds, intent.grabbedKeyId, intent.target, input.capacity, loopClips);
if (!moveResult.ok) return moveResult.resolution;
if (moveResult.candidate.changed) {
  for (const clip of loopClips) {
    // A clip is affected when the move repositions any of its source keys.
    if (!clip.sourceKeyIds.some((keyId) => seenMovedKeyIds.has(keyId))) continue;
    const positions = clip.sourceKeyIds.map((keyId) => moveResult.candidate.mapping.get(keyId));
    const orderIsProvable = positions.every(
      (position, index) => position !== undefined
        && (index === 0 || positions[index - 1]! < position),
    );
    if (!orderIsProvable) {
      return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
    }
  }
}
```
(`seenMovedKeyIds` is already built and validated at `:4949-4958`.) Alternatively gate partial-cycle group selections at drag-arm time, but that is a product decision. Update `physicsPaintRotoLoopGuards.test.ts:761-771` so it stops pinning an unresolved clip: move `{A,B}` to an order-preserving destination (e.g. 8) and assert `derive(...)?.unresolved` is null, then add a rejection case for the current physical-cell 20 destination.

## Warnings

None. The three gap fixes introduce no warning-level defects.

## Info

### IN-04: Post-commit generation comment misstates how a cancel can reach `'committing'`

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1870-1873` (with `:3630-3643`, `:4296`)
**Severity:** INFO

**Issue:** The comment on the post-commit `assertCurrent` says "A cancel that lands while the commit is in flight must not be upgraded into an accepted conversion." After the WR-01 fix this cannot happen through `cancel()`: `canCancel` is false during `'committing'` (`:830`), and `cancel()` now returns before touching the target or closing whenever `isBusyPhase(phase.peek())` is true (`:3639-3643`), so Escape, the footer Cancel, and the header Close are all true no-ops for the whole await. The only remaining way to invalidate the generation during the commit is `dispose()` (`:3674`), which is a legitimate reason to keep the check. The comment is inaccurate in a way that invites a future maintainer to "align" the code with it by removing the WR-01 guard, which would reintroduce the stranded-target dialog.

**Fix:** Reword the comment to name disposal as the only path that can invalidate the generation once the phase is `'committing'` (for example: "A dispose during the commit must not write phase/dialog/target state."). Optionally add a controller test that disposes during the commit and asserts no completion-side mutation occurs.

---

_Reviewed: 2026-11-03T14:17:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
