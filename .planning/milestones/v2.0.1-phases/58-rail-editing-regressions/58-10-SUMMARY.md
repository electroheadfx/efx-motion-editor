---
phase: 58-rail-editing-regressions
plan: 10
subsystem: physic-paint-roto
tags: [roto, loop-clips, source-order, move-key-group, physical-resolver, preact, tdd, gap-closure]

requires:
  - phase: 58-rail-editing-regressions
    plan: 07
    provides: "CR-02 final-mapping source-order proof for the move-key branch and its locked D-16 copy"
  - phase: 58-rail-editing-regressions
    plan: 09
    provides: "Source-derived extent and Group-owned delete guards on the same resolver"

provides:
  - "loopSourceOrderIsProvable(clip, mapping) module-local helper shared by move-key (CR-02) and move-key-group (CR-03)"
  - "Final-mapping source-order guard in the move-key-group branch, after buildMoveGroupCandidate and before finalizeProposal"
  - "Rejection of order-breaking partial-cycle group drags with loop-source-key-move-rejected and the unchanged D-16 copy"
  - "Edge pins for the skip, no-change exemption, dangling-source, one-element, and multi-clip boundaries"
  - "UI dispatch pins proving a rejected group drag never calls executePhysicalEdit"

affects: [58-verify-work, 58-UAT row 7, CR-03 disposition]

actuals:
  tokens: 45238
  tasks: 2
  commits: 3
  plan_head_before: 5800ba1b189003b7cd97da5431b47578f8e7cb05
  plan_head_after: 646efaa28213ae04befeaf402a2b3841d9cf74f8

tech-stack:
  added: []
  patterns:
    - "One order-proof helper per invariant, called from every sibling branch so copies cannot drift"
    - "Order proofs read the FINAL candidate mapping, never the requested destination"
    - "Intersection-scoped guard: only clips whose sourceKeyIds contain a moved key are re-projected"
    - "Unprovable order (missing mapped source key) fails closed; no-change moves stay exempt"

key-files:
  created:
    - .planning/phases/58-rail-editing-regressions/58-10-TASK1-RED-EVIDENCE.json
    - .planning/phases/58-rail-editing-regressions/58-10-TASK2-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "One shared loopSourceOrderIsProvable helper replaces the inline move-key projection, so CR-02 stays byte-identical and CR-03 cannot drift"
  - "The group guard runs only when candidate.changed is true and only for clips whose sourceKeyIds intersect seenMovedKeyIds, matching the rigid-translation (no-ripple) nature of move-key-group"
  - "The proof reads the FINAL candidate mapping so a moved key landing past a non-moved source key is caught; a missing mapped key fails closed"
  - "Rejection reuses loop-source-key-move-rejected and LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT verbatim — no new failure code or copy"
  - "Task 2 adds tests only; its two order-breaking pins were executed against the pre-guard resolver from task 32a51245c to prove they discriminate, then the source was restored. The three acceptance pins are PINS_GREEN_AT_BIRTH"

patterns-established:
  - "Sibling intent branches share the same final-mapping order proof through one local helper"
  - "UI preparation pins assert the locked copy on reason and detail and zero executePhysicalEdit dispatches"

requirements-completed: [RAIL-06, RAIL-07]

coverage:
  - id: D1
    description: "A partial-cycle group drag is accepted exactly when every touched clip's final source frames stay strictly increasing (A,B -> cells 8,9 accepted and resolvable) and rejected otherwise (A,B -> cell 20) with the locked D-16 copy"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#an order-preserving partial-cycle group move stays accepted and the loop still resolves"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects a partial-cycle group move that breaks the referencing cycle order — CR-03"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#resolvePhysicPaintRotoPhysicalEdit — move-key CR-02 suite (unedited)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On the UI path an order-breaking group drag prepares as ok:false with the locked copy and never dispatches, while an order-preserving drag prepares and commits exactly one executePhysicalEdit"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#rejects an order-breaking partial-cycle drag with the locked copy and never dispatches"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#prepares and commits an order-preserving partial-cycle drag exactly once"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard's boundaries are regression-locked: one-element cycle, untouched dangling clip, no-change exemption, touched dangling clip fail-closed, and a two-clip move where one clip stays ordered and the other breaks"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a one-element source cycle — a single source key is vacuously ordered"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a move on keys no clip references, even beside a dangling clip — CR-03"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#fails closed when the move touches a dangling clip — CR-03"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a no-change partial drag in the dangling scenario — changed === false is exempt"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects the whole move when one touched clip stays ordered and another breaks — CR-03"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#D-04 whole-cycle tests (unedited)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 10: Partial-cycle group-move source-order guard Summary

**Partial-cycle group drags are accepted only when every touched clip's final source frames stay strictly increasing, and order-breaking destinations are rejected with the unchanged locked D-16 copy on both the resolver and UI preparation paths.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-03T16:24:05Z
- **Completed:** 2026-11-03T16:27:04Z
- **Tasks:** 2
- **Files modified:** 5 (1 production source, 2 test specs, 2 RED evidence records)

## Accomplishments

- Extracted `loopSourceOrderIsProvable(clip, mapping)` and wired both the move-key CR-02 guard and the new move-key-group CR-03 guard through it, so the order proof exists once and CR-02 behavior is byte-identical (its tests stayed unedited and green).
- The move-key-group branch now projects every clip whose `sourceKeyIds` intersect the moved set through the final candidate mapping and rejects any missing or non-increasing position with `loop-source-key-move-rejected` / `operationKind: move-key-group` and the verbatim D-16 copy.
- Rewrote the destructive D-04 partial-cycle test into an order-preserving acceptance at cells 8/9 with a derived `unresolved === null` assertion, and moved the order-breaking destination to its own rejection pin.
- Added six edge pins (one-element cycle, untouched dangling clip, touched dangling fail-closed, no-change exemption, two-clip partial break, whole-cycle follow untouched) and two UI dispatch pins proving a rejected drag never reaches `executePhysicalEdit` while an accepted drag commits exactly once.
- Full verification: 409 tests across the three specs pass, `tsc --noEmit` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end order-preserving partial-cycle group drag — CR-03**
   - `32a51245c` (test) — failing CR-03 group-move order pins + TASK1 RED evidence
   - `af7cfa547` (feat) — shared order helper and move-key-group guard
2. **Task 2: Edge pins: untouched clips, dangling sources, no-change, multi-clip moves**
   - `646efaa28` (test) — CR-03 edge pins + TASK2 RED evidence

_Note: TDD tasks produce test → feat → refactor commits._

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — added `loopSourceOrderIsProvable` beside `buildMoveGroupCandidate`, replaced the inline move-key projection with it, and added the intersection-scoped final-mapping guard in the move-key-group branch.
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` — rewrote the D-04 partial-cycle test at cells 8/9, added the cell-20 rejection pin, and added five edge pins.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — added the rejected-prepare and accepted prepare/commit pins for the partial-cycle group drag.
- `.planning/phases/58-rail-editing-regressions/58-10-TASK1-RED-EVIDENCE.json` — RED record for Task 1 (`RED_EVIDENCE_OK`).
- `.planning/phases/58-rail-editing-regressions/58-10-TASK2-RED-EVIDENCE.json` — RED record for Task 2 (`RED_EVIDENCE_OK`, generated against the pre-guard resolver then restored).

## Decisions Made

- One `loopSourceOrderIsProvable` helper, called from both branches; the move-key guard keeps the same failure call and comment.
- The group guard is gated on `candidate.changed` and intersection-scoped to clips containing a moved key. The rigid translation cannot move an untouched clip's source positions; the skip is documented in code and flagged for revisit if `move-key-group` ever gains a ripple.
- The proof judges the FINAL candidate mapping (so a moved key landing past a non-moved source key is caught) and fails closed on an unmapped source key; re-sorting is never an option because it would silently change playback order.
- No schema, parser, intent-kind, failure-code, or copy change: `loop-source-key-move-rejected` and `LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT` are reused verbatim.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Task 2 is tests-only and the guard landed in Task 1, so its pins are green on the post-guard tree. To record RED evidence that actually discriminates, the two order-breaking pins were executed against the pre-guard production source checked out from `32a51245c` (the Task 1 RED commit) and the source was restored from HEAD immediately after. The three acceptance pins are recorded as **PINS_GREEN_AT_BIRTH** — they must stay green before and after the guard, and production source was never weakened to manufacture RED.

## Threat Model Disposition

- **T-58-17 (mitigate):** The move-key-group branch now rejects any touched clip with missing or non-increasing final source positions using the locked code and copy; pinned by the cell-20 rejection and the two-clip partial-break pin.
- **T-58-18 (mitigate):** One shared `loopSourceOrderIsProvable` helper serves both move-key and move-key-group; every CR-02 test stayed unedited and green.
- **T-58-19 (accept):** The intersection-scoped skip relies on `move-key-group` remaining a pure rigid translation; recorded in the guard comment and the plan's flagged assumption.
- **T-58-SC (accept):** No package install or dependency/lockfile change.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CR-03 is closed on the resolver and UI preparation paths; UAT row 7's "Source missing / export blocked" failure mode is now rejected before any proposal is published.
- The phase's remaining gate is live UAT of the order-breaking group drag (rail rejection copy, no persisted clip) as part of 58-verify-work.

## Self-Check: PASSED

---
*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
