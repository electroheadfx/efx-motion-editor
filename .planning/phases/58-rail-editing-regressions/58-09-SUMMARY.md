---
phase: 58-rail-editing-regressions
plan: 09
subsystem: physic-paint-roto
tags: [roto, loop-clips, lifecycle, physical-document, preact, signals, tdd, gap-closure]

requires: []
provides:
  - "resolvePhysicPaintRotoLoopSourceExtent and reconcilePhysicPaintRotoGroupFrames in the physical model"
  - "Coordinator reconcile on every non-replay accepted write: canonical extent plus orphan paint-sheet pruning"
  - "Source-derived bounds shared by derivation, classification, phase authority, paint/delete-frame, and regenerate"
  - "updateLoop stale-override pruning inside the rebuilt staged clip with the narrowed [newEnd, survivingEnd) refusal band"
  - "group-owned-key-delete-rejected plus GROUP_OWNED_KEY_DELETE_REJECTED_TEXT on delete-key, delete-key-group, and delete-key-rail"
  - "Frame-aware Delete routing: a selected Group-frame key routes to group-frame; Group-containing multi/rail selections route to no-target"
affects: [58-verify-work, G-01 UAT, 58-10]

actuals:
  tokens: 47725
  tasks: 3
  commits: 6
  plan_head_before: 578d61d516be5a87a80cb8ede6342cb95ac9d0a3
  plan_head_after: a0e318a241437342f4f7aeed876576cdae0bf365

tech-stack:
  added: []
  patterns:
    - "Source-derived extent is the render/ownership truth; the stored originalEndExclusive remains reported intent (requestedEnd)"
    - "One shared bounded-end computation per layer (model helper, groupLifecycle local, resolver predicate, controller survivingEnd)"
    - "Staged-write reconcile skips replay so Undo/Redo round-trips byte-identically"
    - "Frame-based Group ownership on delete paths, with the D-07 source guard always first"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "The source-derived extent wins for render, classification, and ownership; requestedEnd keeps the stored end so stale intent stays visible and a dangling source keeps today's { missingSourceKeyIds } result"
  - "The six-field lifecycle gate lives in resolvePhysicPaintRotoLoopSourceExtent, so lifecycle-less in-memory clips and infinity clips keep the stored end instead of inventing a bound"
  - "The coordinator reconcile is applied after staged collections resolve and before revision/payload construction, and is skipped only for isReplay with replayTarget"
  - "updateLoop refuses only overrides inside [originalEndExclusive, survivingEnd) and filters the rebuilt clip's frameOverrides to appFrame < survivingEnd, so the bridge staged-document parse accepts the contraction"
  - "Delete ownership is frame-based via one resolver predicate; delete-key-rail keeps groupOwnedKeyIds for segment/break derivation but refuses on owned frames with the new code and locked copy"
  - "The classifier routes a single selected key by its own frame; ordinary keys keep the cursor-frame classification, and Group-containing multi-key/key-rail/rail-set selections fail closed to no-target"

patterns-established:
  - "Bound every consumer of a lifecycle extent with the same source-derived helper and stored-end fallback (derivation, proposers, delete ownership, contraction)"
  - "Prune persisted paint references inside the accepted write that retires their frame, never at load time"

requirements-completed: [RAIL-03, RAIL-07]

coverage:
  - id: D1
    description: "One accepted delete on an already-stale document persists the bounded extent (end 6, visible [0,6)), drops the override-7 reference and record, resolves frame 7 empty, and one Undo restores the deleted key and override; canonical and infinity documents pass through byte-identically"
    requirement: RAIL-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#repairs a stale finite cycle when the key outside its source extent is deleted"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#undoes the stale-cycle repair in one command"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#passes an already-canonical lifecycle clip through the staged reconcile byte-identically"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#leaves an infinity lifecycle clip and its paint sheet untouched"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#leaves a clip whose visible ranges would trim empty unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A finite lifecycle clip derives, classifies, paints, deletes, and regenerates only inside its surviving source extent; frames past that bound resolve empty and are rejected as Group content"
    requirement: RAIL-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#bounds a stale finite lifecycle clip to the surviving source extent and resolves removed frames empty"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts#derives and classifies only the surviving source extent"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts#rejects Group paint and delete-frame past the surviving extent and stops affected frames there"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts#regenerates finite ranges to the bounded end and leaves an infinity clip stored"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repeat contraction drops stale out-of-extent overrides from the rebuilt staged clip, keeps in-extent overrides, publishes a clip the bridge parse accepts, and still refuses to discard locally painted frames inside the surviving cycle with the unchanged copy"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#drops stale out-of-extent overrides on Repeat contraction and keeps overrides inside the new end"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#rejects Repeat contraction before commit when it would discard a locally painted override"
        status: pass
    human_judgment: false
  - id: D4
    description: "No delete path can remove a real key whose frame a lifecycle Group owns: delete-key, delete-key-group, and delete-key-rail return group-owned-key-delete-rejected with the locked copy after D-07, while keys past the extent and ordinary groups/rails still delete; the classifier routes a selected Group-frame key to group-frame and Group-containing multi/rail selections to no-target"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects delete-key on a real key whose frame a lifecycle Group owns"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects delete-key-group as a whole when any member frame is Group-owned"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects delete-key-rail when any member frame is Group-owned"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#classifies a selected key at a Group frame as group-frame even when the cursor moved"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#returns no-target for a multi-key selection containing a Group-owned frame"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#returns no-target for a Key Rail whose member frame is Group-owned"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#returns no-target for a rail set whose member frame is Group-owned"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 09: Surviving-Cycle Extent and Group-Owned Delete Guards Summary

**A finite lifecycle Rail now renders, classifies, and deletes only inside its surviving source cycle: one accepted write persists the canonical extent and prunes orphaned paint sheets, and no delete path can remove a key backing a Group frame**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-11-03T15:43:11Z
- **Completed:** 2026-11-03T16:03:46Z
- **Tasks:** 3 (tracer + 2 auto, all TDD)
- **Files modified:** 11 code/test files (plus three RED evidence records)

## Accomplishments

- Added `resolvePhysicPaintRotoLoopSourceExtent` (six-field lifecycle gate, strictly increasing existing sources, capacity-clamped `phaseOrigin + cycleLength * repeat`) and `reconcilePhysicPaintRotoGroupFrames` (bounded end, trimmed ranges, dropped out-of-extent overrides, pruned unreferenced paint sheets, identity-preserving when nothing changes) to the physical model.
- Applied the reconcile in the coordinator after staged collections resolve and before revision/payload construction, skipping only replay; one accepted delete on an already-stale document now persists end 6 / visible [0,6) and drops both the override-7 reference and its `groupOverrideRecords` entry in one Undoable command.
- Bounded every Group consumer with the source-derived end: derivation (`effectiveEnd`, `truncated`), classification containing groups, phase authority affected frames, paint and delete-frame extent checks, and Regenerate's rebuilt ranges. `requestedEnd` still reports the stored intent, and dangling sources keep today's unresolved result.
- Made Repeat contraction prune stale out-of-extent overrides from the rebuilt staged clip while still refusing to discard locally painted frames inside the surviving cycle with the unchanged locked copy.
- Added the G-01 ownership-parity guard: `group-owned-key-delete-rejected` with `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` on delete-key, delete-key-group, and delete-key-rail (D-07 always first), plus frame-aware Delete routing in the classifier.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: stale-cycle write repair spec** - `2277cd845` (test)
2. **Task 1 GREEN: model exports + coordinator reconcile** - `887c7a92d` (feat)
3. **Task 2 RED: source-derived extent specs** - `99ee3e2fd` (test)
4. **Task 2 GREEN: bounded resolution and proposers** - `d830b23ee` (feat)
5. **Task 3 RED: contraction and Group-owned delete specs** - `a4a53487d` (test)
6. **Task 3 GREEN: stale-override pruning + delete ownership** - `a0e318a24` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` - `resolvePhysicPaintRotoLoopSourceExtent`, `reconcilePhysicPaintRotoGroupFrames`
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` - non-replay staged reconcile feeding revision, staged document, payload, and accepted snapshot
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` - bounded derivation; `group-owned-key-delete-rejected`; `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT`; frame-based delete ownership on all three delete paths
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts` - one `resolveGroupBoundedEnd` shared by classification, phase authority, paint, delete-frame, and regenerate
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - `survivingEnd`, narrowed refusal band, filtered `frameOverrides` in the rebuilt staged clip
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - frame-aware Group ownership helpers and selection routing
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` - extent derivation and Group-owned delete specs
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts` - bounded classifier/paint/delete/regenerate specs
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` - stale-override contraction spec
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` - stale-cycle write repair and byte-identical pins
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - frame-aware Delete routing specs
- `.planning/phases/58-rail-editing-regressions/58-09-TASK{1,2,3}-RED-EVIDENCE.json` - RED evidence records (`RED_EVIDENCE_OK`)

## Decisions Made

- The source extent is render/ownership truth while the stored end stays visible as `requestedEnd`; this keeps stale intent diagnosable without letting it render or block deletes.
- The lifecycle gate is the six-field all-or-none check inside the model helper, so lifecycle-less clips and infinity clips keep the stored end exactly as before.
- The coordinator reconcile runs after staging resolution and before revision/payload construction, and is skipped for replay so Undo/Redo stays byte-identical.
- `updateLoop` uses the source extent of the clip's CURRENT repeat as `survivingEnd`; overrides at/after it are stale render-wise and are filtered out, while overrides inside `[newEnd, survivingEnd)` still refuse with the unchanged copy.
- Delete ownership uses one frame-based resolver predicate; the rail branch keeps `groupOwnedKeyIds` for segment/break derivation but refuses owned frames with the new code and copy.
- The classifier routes a single selected key by its own frame first (Group content wins), keeps the cursor classification for ordinary keys, and fails closed on Group-containing multi/rail selections.

## TDD Gate Compliance

- Task 1: RED `2277cd845` (`test(58-09)`) precedes GREEN `887c7a92d` (`feat(58-09)`). `58-09-TASK1-RED-EVIDENCE.json` validated `RED_EVIDENCE_OK`, target test failed on the planned assertions (acceptance left end 9 and override-7 intact).
- Task 2: RED `99ee3e2fd` precedes GREEN `d830b23ee`. `58-09-TASK2-RED-EVIDENCE.json` validated `RED_EVIDENCE_OK` (target `bounds a stale finite lifecycle clip...`, `expected 20 to be 16`). PINS_GREEN_AT_BIRTH: dangling-source unresolved result, lifecycle-less stored behavior, and infinity-to-capacity.
- Task 3: RED `a4a53487d` precedes GREEN `a0e318a24`. `58-09-TASK3-RED-EVIDENCE.json` validated `RED_EVIDENCE_OK` (target contraction `expected false to be true`; unfiltered run `8 failed | 463 passed`). PINS_GREEN_AT_BIRTH: the override-22 refusal keeps the byte-identical copy, the D-07 source guard still wins, and keys past the extent plus ordinary groups/rails still delete.
- No production source was weakened to manufacture RED. GREEN test strengthening: the loopGuards spec now imports the exported `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` instead of a local literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Canonicalized two fixtures that encoded stale stored ends**
- **Found during:** Task 2 GREEN (five-spec verification)
- **Issue:** After the derivation bound, two pre-existing fixtures with stored ends beyond their source-derived extent changed behavior: the D-11 duplicated-placement fixtures used a 2-frame source cycle with the default repeat 2 and stored ends 28/10, and the CR-03 fragmented clip used repeat 1 over a 4-frame cycle with stored end 22.
- **Fix:** Set `repeat: 4` on the two D-11 loop fixtures and `stackClip(3, …)` on the CR-03 fixture, with 58-09 comments, so each fixture is canonical under its own source cycle. Test intent and assertions are unchanged.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
- **Verification:** five specs 607 passing; typecheck clean
- **Committed in:** `d830b23ee` (Task 2 GREEN)

**2. [Rule 1 - Bug] Corrected the Task 2 infinity pin before GREEN**
- **Found during:** Task 2 RED authoring
- **Issue:** The first draft expected a lifecycle infinity clip to stop at the stored end; HEAD extends infinity to capacity.
- **Fix:** Rewrote the pin to assert `requestedEnd 'infinity'`, `effectiveEnd === CAPACITY`, `truncated false`, and marked it PINS_GREEN_AT_BIRTH before committing RED.
- **Files modified:** app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
- **Verification:** RED evidence validated after the correction; the pin passes at HEAD and after GREEN
- **Committed in:** `99ee3e2fd` (Task 2 RED)

**3. [Rule 1 - Bug] Corrected the Task 3 rail RED intent**
- **Found during:** Task 3 RED authoring
- **Issue:** `['X','G']` did not match the derived segment (H@31 is contiguous in the no-break derivation), so the test failed as `malformed-target` instead of reaching the new ownership guard.
- **Fix:** Used `['X','G','H']` so today's resolver accepts the rail and the new guard is the only rejection cause.
- **Files modified:** app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
- **Verification:** RED failed for the planned reason (`expected true to be false` on `resolution.ok`); GREEN returns the new code and copy
- **Committed in:** `a4a53487d` (Task 3 RED)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 test corrections/canonicalizations, no production behavior weakened)
**Impact on plan:** No scope creep; the fixture and pin corrections keep every pre-existing assertion and only make their encoded extents canonical under the new bound.

## Issues Encountered

- Vitest's serialized object diffs (multi-line, column-0) break the TAP parser used by `gsd_run check tdd-red-evidence`. Task 2's first evidence record was rejected as `invalid_record`; the artifact was rebuilt from a `-t`-filtered run whose only failing assertion is a simple `toBe`. Task 3 reused that workflow (controller-only filtered TAP).
- Task 1 ran as the tracer; auto mode was inactive with `HUMAN_VERIFY_MODE=end-of-phase`, and its automated verify passed, so the tracer feedback gate continued without a checkpoint.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Five-spec verification: 617/617 passing (HEAD baseline 596 plus the new cases); `tsc --noEmit` clean.
- G-01 is closed at the automated level: write repair, source-derived bounds, contraction pruning, and delete ownership all have deterministic pins. Live UAT rows already persisted in `58-UAT.md` remain the human check for the visible "removed frames stop rendering cached paint" behavior.
- No `.mce`, parser-shape, persisted-schema, Rust, or revision-semantics change; D-08..D-11, D-15, D-16, and D-17 surfaces are preserved.
- No stubs, no skipped tests, no new security-relevant surface.

## Self-Check: PASSED

- `58-09-TASK1-RED-EVIDENCE.json`, `58-09-TASK2-RED-EVIDENCE.json`, `58-09-TASK3-RED-EVIDENCE.json` exist and each validated `RED_EVIDENCE_OK`.
- Commits `2277cd845`, `887c7a92d`, `99ee3e2fd`, `d830b23ee`, `a4a53487d`, `a0e318a24` are ancestors of HEAD.
- `58-09-SUMMARY.md` exists; measured plan commits: 6 from `578d61d51` to `a0e318a24`.
