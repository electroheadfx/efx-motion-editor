---
phase: 59-rail-motion-channels-v7-interface
plan: 20
subsystem: ui
tags:
  - preact
  - motion-channels
  - merge-notice
  - reveal-rails
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-15
    provides: the store-direct removal reconciler (Gate B) and its settlement bookkeeping
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-12
    provides: the rail-motion merge-drop notice signal, copy builder and strip row
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-19
    provides: the wave-3 predecessor; the store and railMotionIdentity wiring stays intact
provides:
  - RotoTrackMergedDrop and the optional mergedDrop on every removal-door ok result
  - reveal delete/resize/bake motion reconciliation in the same acknowledged transaction
  - railMotionMergeNoticeUndoable companion signal and the non-undoable copy variant
  - the strip move wrapper publishing a non-undoable drop notice
affects:
  - 59-VERIFICATION gap G4 (CR-02, WR-04)
  - MOTN-10 and MOTN-12 gap-closure assertions
  - the coordinator's undoable settlement path (unchanged, still the default publication)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 11820
  tasks: 3
  commits: 6
plan_head_before: 675cfa9a15b866d2fc0edba800829c9df06ec91f
plan_head_after: bf23c444787e4bf5cd09324812897d55f5aed6a3

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "A report built from the same reconciliation whose collection is written, returned only after every port accepted, cannot announce a merge that failed."
  - "A session companion signal carries undoability because the settlement notice type is bridge-validated with a closed key set."
  - "Every reveal door derives its post-edit loop ownership BEFORE the first write so the motion collection describes the rails that exist after the edit."

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-20-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-20-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-20-task3.json
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/efxPaintStore.reveal.test.ts
    - app/src/components/physic-paint/roto/railMotionMergeNotice.ts
    - app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "The removal doors spread mergedDrop into the ok result only when non-null, so a clean removal stays deep-equal to `{ ok: true }` and no existing equality assertion changes shape."
  - "The store reports the drop; the strip publishes it. The store never imports the notice module, so the settlement type stays display-only and out of persistence."
  - "Undoability is a session companion signal, not a fourth notice member, because PhysicPaintRailMotionMergeNotice is bridge-validated with a closed key set."
  - "A resize that prunes every clip-owned key OMITS the emptied clip: an emptied reveal rail is not a rail, and leaving it in place would make the reconciler classify the loop as surviving and retain its motion forever."
  - "The bake substitutes the post-replay clip ownership (old span keys -> baked keys at the same frames) into the next snapshot, so fresh baked keys are never orphaned and can never merge a neighbouring Key Rail and steal its motion."

patterns-established:
  - "Report-and-write from one reconciliation: the returned report is derived from the exact collection the port accepted."
  - "Pre-write snapshot, post-edit snapshot, one reconciled write at the end of the same transaction."

requirements-completed:
  - MOTN-10
  - MOTN-12

coverage:
  - id: D1
    description: "A removal that merges two animated rails returns { railId, startFrame, endFrameExclusive } from clearTrackFrames and cutTrackSelection; a one-sided or non-merge removal reports no mergedDrop key and keeps the exact { ok: true } shape; a rejected motion write fails closed with apply-failed and reports nothing"
    requirement: MOTN-10
    verification:
      - kind: unit
        ref: "src/stores/physicPaintStore.rotoRailMotions.test.ts#reports the dropped rail and its prior app-frame span from clearTrackFrames"
        status: pass
      - kind: unit
        ref: "src/stores/physicPaintStore.rotoRailMotions.test.ts#reports the same merge drop from cutTrackSelection"
        status: pass
      - kind: unit
        ref: "src/stores/physicPaintStore.rotoRailMotions.test.ts#reports no drop for the same edit when the tail anchor carries no record (control)"
        status: pass
      - kind: unit
        ref: "src/stores/physicPaintStore.rotoRailMotions.test.ts#fails closed with apply-failed and reports no drop when the motion write is rejected"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "deleteRevealRail removes the loop-bound motion record in the same transaction; a resize that keeps at least one clip-owned key retains the record by reference; a replay bake preserves the loop record and an adjacent Key Rail record byte-identically with one motion-port call"
    requirement: MOTN-12
    verification:
      - kind: unit
        ref: "src/stores/efxPaintStore.reveal.test.ts#delete removes the loop-bound motion record in the same transaction"
        status: pass
      - kind: unit
        ref: "src/stores/efxPaintStore.reveal.test.ts#resize that keeps a clip-owned key retains the record by reference with one motion write"
        status: pass
      - kind: unit
        ref: "src/stores/efxPaintStore.reveal.test.ts#a replay bake preserves the loop record and an adjacent Key Rail record byte-identically"
        status: pass
    human_judgment: false
  - id: D3
    description: "A resize that prunes every clip-owned key drops the emptied clip from the document and the runtime and removes its loop-bound record, with exactly one motion-port call"
    requirement: MOTN-12
    verification:
      - kind: unit
        ref: "src/stores/efxPaintStore.reveal.test.ts#resize that prunes every clip-owned key drops the emptied clip and its record"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts src/stores/physicPaintStore.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The companion signal follows publish ({ undoable: false } -> false, absent -> true), an invalid publish changes neither signal, dismiss restores the default, and the non-undoable copy names the span without ever promising a restore"
    requirement: MOTN-10
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionMergeNotice.test.ts#publishing with { undoable: false } marks the notice non-undoable"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionMergeNotice.test.ts#the non-undoable copy names the span and never promises a restore"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionMergeNotice.test.ts#dismiss clears the notice and restores the undoable default"
        status: pass
    human_judgment: false
  - id: D5
    description: "The strip move wrapper publishes result.mergedDrop with { undoable: false } before the destination selection and dismisses a stale notice otherwise; the coordinator's undoable settlement path is untouched"
    requirement: MOTN-10
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#publishes the store drop as non-undoable and dismisses a stale notice otherwise"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#renders the built copy verbatim inside a polite status row with a wired Dismiss"
        status: pass
      - kind: other
        ref: "git diff --stat -- app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts (no change)"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 20: Merge-Drop Reporting and Reveal-Door Motion Reconciliation Summary

**A removed rail's motion is now announced honestly — the store returns the dropped rail's prior span, the move path says it cannot be undone, and every reveal door (delete, resize, bake) writes the reconciled motion collection inside its own acknowledged transaction.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-11-06T22:08:45+01:00
- **Completed:** 2026-11-06T22:21:45+01:00
- **Tasks:** 3
- **Files modified:** 8 code/test files plus 3 RED evidence artifacts

## Accomplishments

- `_applyRotoTrackSelectionRemoval` now keeps the whole reconciliation instead of only `.railMotions`, and returns a frozen `RotoTrackMergedDrop` (`railId`, `startFrame`, `endFrameExclusive`) built from `droppedRailId` + `droppedRailFrames`. `cutTrackSelection`, `clearTrackFrames` and the final `moveTrackItems` return spread the report only when non-null, so a clean removal stays exactly `{ ok: true }`. A rejected motion write still fails closed with `apply-failed` and reports nothing.
- `deleteRevealRail` snapshots loops, breaks, records and the motion collection before the first write, runs the reconciler, then adds `replaceRotoPhysicalRailMotions` after the records write. `resizeRevealRail` takes the same pre-write snapshot, keeps the same-span no-op, and OMITS a clip whose every clip-owned key was pruned — the emptied rail and its loop-bound record disappear in the same transaction. `commitRevealBake` computes `leadingBakedKeyId`, the final break set and the post-replay loop ownership (old span key → baked key at the same frame) before any write, then writes the reconciled collection between the records write and the leading-break write.
- `railMotionMergeNoticeUndoable` (a session companion signal) follows every successful publish, an invalid publish changes neither signal, and dismiss clears the notice and restores the default. `buildRailMotionMergeNoticeCopy(notice, { undoable })` keeps today's exact sentence by default and, for a non-undoable drop, names the same span and states the change cannot be undone — never a restore promise.
- The strip's `moveTrackItems` wrapper publishes `result.mergedDrop` with `{ undoable: false }` before selecting the destination and dismisses a stale row otherwise; `RailMotionMergeNoticeRow` reads the companion signal into a local and passes `{ undoable }` to the copy builder. The coordinator's settlement path is untouched.

## Task Commits

Each task was committed atomically (all three tasks recorded RED evidence first; RED is a `test` commit, GREEN a `feat` commit):

1. **Task 1 RED: pin the merge-drop report on the removal transaction** - `dcb36c598` (test)
2. **Task 1 GREEN: report the two-sided merge drop from every removal door** - `38b7ae7b7` (feat)
3. **Task 2 RED: pin reveal-door motion reconciliation** - `e5c2978b8` (test)
4. **Task 2 GREEN: reconcile reveal-door motion in the same transaction** - `7fa5324b0` (feat)
5. **Task 3 RED: pin the non-undoable move-drop notice** - `169ee8b6b` (test)
6. **Task 3 GREEN: publish the move drop as a non-undoable notice** - `bf23c4447` (feat)

**Plan metadata:** committed after this SUMMARY (docs: complete merge-drop reporting plan)

## Files Created/Modified

- `app/src/stores/physicPaintStore.ts` — `RotoTrackMergedDrop`; optional `mergedDrop` on the three removal-result unions; `_applyRotoTrackSelectionRemoval` returns the report; reveal bake computes and writes the reconciled motion collection.
- `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` — A/B merge rows for `clearTrackFrames` and `cutTrackSelection`, the A/C control row (no drop, same record references), and the rejected-motion-write row.
- `app/src/stores/efxPaintStore.ts` — imports the pure reconciler; `deleteRevealRail` / `resizeRevealRail` snapshot pre-write, reconcile and write motion last (the emptied-clip case drops the clip entirely).
- `app/src/stores/efxPaintStore.reveal.test.ts` — four WR-04 rows: delete, non-destructive resize, replay with an adjacent Key Rail, and resize-to-empty; each pins exactly one motion-port call.
- `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` — companion signal, `RailMotionMergeNoticeOptions`, options-aware publish/dismiss and copy builder.
- `app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts` — companion-signal rows and the two copy rows.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — import additions, row undoability read, move-wrapper publish/dismiss.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — updated 59-12 copy-call row and the move-wrapper publication row.
- `red-evidence-59-20-task1.json`, `red-evidence-59-20-task2.json`, `red-evidence-59-20-task3.json` — TAP RED evidence, classifier verdict `RED_EVIDENCE_OK` for all three.

## Decisions Made

- The three result unions expose `mergedDrop` only on the ok branch, and the doors use a conditional spread: a no-drop result keeps exactly the previous property set so every existing deep-equality assertion still passes.
- The report and the written collection come from the SAME reconciliation value, and the store returns the report only after every port accepted — a failed write can never announce a merge that did not happen (T-59-56).
- Undoability is a session companion signal rather than a notice member: `PhysicPaintRailMotionMergeNotice` is bridge-validated with a closed key set, so a fourth member would break the bridge contract.
- An emptied reveal rail is not a rail: the resize omits the clip instead of publishing a zero-key cycle, which is what lets the reconciler classify the loop as gone and drop its motion record.
- The bake's next snapshot substitutes the baked key ids into the existing clips exactly as `replayRevealRail` will rewrite them afterwards; without that, the fresh baked keys are unowned when reconciled, merge a neighbouring Key Rail segment and re-anchor or drop that rail's motion.
- The copy path keeps its behavior: `physicsPaintRotoRailSetCopy.ts` still uses the no-resolver default and was not touched.

## Deviations from Plan

None - plan executed as written, with one test-assertion correction described below.

**1. [Rule 1 - Bug] Signal existence guard used the wrong runtime shape**
- **Found during:** Task 3 GREEN
- **Issue:** the companion-signal rows guarded the missing export with `typeof signal === 'function'`, but this project runs `@preact/signals` 2.11.3, where a signal is an object. The RED failure was correct (`undefined`), but the same guard failed after the export existed (`expected 'object' to be 'function'`).
- **Fix:** the guard is now `expect(noticeModule.railMotionMergeNoticeUndoable).toBeDefined()`; the RED semantics are unchanged (a missing export still fails the guard).
- **Files modified:** `app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts` (in the Task 3 GREEN commit).
- **Commit:** `bf23c4447`

## Issues Encountered

- **Task 2 RED ordering:** the implementation was already in the working tree when the tests were written. Genuine RED evidence was captured by saving the diff, restoring both store files to HEAD, running the TAP report, then restoring the saved files and verifying the patch matched byte-for-byte before the GREEN commit. All four rows failed on their own assertions (three on the motion port never being called; the resize-to-empty row on `loop-clip-failed`, because the pre-fix code wrote the emptied clip back).
- **Environment note:** `gsd_run` is not on PATH in this shell; the project-local `./.claude/gsd-core/bin/gsd_run` was used throughout.

## Known Stubs

None — every new path is wired to the real store reconciliation context and covered by its own tests.

## Threat Flags

None — no new network, auth or file-access surface. T-59-56 is mitigated by building the report from the same reconciliation whose collection is written and returning it only on the ok branch after every port accepted. T-59-57 is mitigated by pre-write snapshots, a fail-closed motion port inside the same transaction, and the bake's substituted post-replay ownership. T-59-SC: no install in this plan.

## TDD Gate Compliance

- **Task 1 RED:** `dcb36c598` — target test `reports the dropped rail and its prior app-frame span from clearTrackFrames` failed on `expected undefined to be 'rail-tail'`; 20 tests ran, 18 pass, 2 fail; classifier verdict `RED_EVIDENCE_OK` (reason `target_test_failed`). The A/C control row and the rejected-write row passed both before and after, proving the A/B fixture is what makes the merge reachable.
- **Task 1 GREEN:** `38b7ae7b7` — the same command exits 0 with all 20 tests passing.
- **Task 2 RED:** `e5c2978b8` — all four rows failed against the pre-fix code: three on `expected "replaceRotoPhysicalRailMotions" to be called 1 times, but got 0 times`, and the resize-to-empty row on `loop-clip-failed`; 43 tests ran, 39 pass; classifier verdict `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** `7fa5324b0` — `efxPaintStore.reveal.test.ts` + `physicPaintStore.test.ts` exit 0 (175 tests), typecheck exits 0.
- **Task 3 RED:** `169ee8b6b` — target test `publishing with { undoable: false } marks the notice non-undoable` failed on the missing companion signal; six new rows failed in the notice file (five on the missing signal, one because the non-undoable copy still promised a restore), and the strip's updated and new source rows failed against the unmodified source; classifier verdict `RED_EVIDENCE_OK`.
- **Task 3 GREEN:** `bf23c4447` — the two-file command exits 0 (201 tests). The only test edit between RED and GREEN is the documented signal-shape guard correction.

## Self-Check: PASSED

- Files exist: both store files, both store test files, the notice module and its test, the workflow strip and its test, and all three RED evidence JSONs.
- Commits `dcb36c598`, `38b7ae7b7`, `e5c2978b8`, `7fa5324b0`, `169ee8b6b`, `bf23c4447` are ancestors of HEAD.
- Plan verification: five-file vitest run exits 0 (396 tests), typecheck exits 0, `mergedDrop` present in the store (10 occurrences), `railMotionMergeNoticeUndoable` present in the strip (2), `reconcileRailMotionsForDocumentEdit` present in `efxPaintStore.ts` (3), `useRotoPhysicalEditCoordinator.ts` unchanged.
