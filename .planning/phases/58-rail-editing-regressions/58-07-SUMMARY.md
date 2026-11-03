---
phase: 58-rail-editing-regressions
plan: 07
subsystem: physic-paint-roto
tags: [roto, loop-clip, resolver, law-a, cr-02, key-move, vitest]

# Dependency graph
requires:
  - phase: 58-rail-editing-regressions
    provides: Law A single-key move allowance when exactly one loop references the key (58-01, D-12)
  - phase: phase-43-loop-clips
    provides: D-11 rigid linked-key guard, the locked D-16 rejection copy, and the loop derivation strict-increase law
provides:
  - Single-reference key moves are rejected when the final candidate mapping breaks the referencing clip's sourceKeyIds order
  - Law A acceptance re-pinned at an order-preserving destination (A 10 -> 9) with a resolved derivation assertion
  - Edge pins for single-source cycles, dangling sources, unreferenced moves, and the no-change drag exemption
affects: [58-08, phase-58-verification]

actuals:
  tokens: 2111
  tasks: 2
  commits: 3
  plan_head_before: 536acbf44ca5d2f26f5548665953b60a6320b2f1
  plan_head_after: 61ba7ac8e54e855d6b8f96acc950a5fc1a6d71e8

tech-stack:
  added: []
  patterns:
    - "Validate the FINAL candidate mapping after buildMoveCandidate, never the requested destination cell"
    - "Fail closed on an unprovable source order; never re-sort sourceKeyIds to satisfy the derivation law"
    - "Gate the order check on candidate.changed so a no-change drag is exempt"

key-files:
  created:
    - .planning/phases/58-rail-editing-regressions/58-07-TASK1-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts

key-decisions:
  - "The single-reference order guard reads moveResult.candidate.mapping because cutSource/openAndInsert ripple survivors; judging the requested cell can hide an inversion."
  - "An order-breaking or unprovable destination is rejected with the existing loop-source-key-move-rejected code and verbatim D-16 copy; sourceKeyIds is never re-sorted or mutated."
  - "The guard runs only when candidate.changed is true, so a no-change drag back to the key's own cell is accepted even in an already-unresolved cycle."
  - "Two or more referencing loops keep the unchanged D-11 / D-16 rejection before any candidate is built."

patterns-established:
  - "Linked-cycle invariants are proven on the final mapping after survivor ripples, not on the user's requested destination."
  - "Boundary pins for a guard are added as deliberate assertions; do not weaken production source to manufacture RED."

requirements-completed: [RAIL-06, RAIL-07]

coverage:
  - id: D1
    description: "A single-reference move whose final mapping breaks the referencing clip's strictly increasing sourceKeyIds order is rejected with loop-source-key-move-rejected, operationKind move-key, and the verbatim D-16 copy"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects a single-key move that breaks the referencing cycle order — CR-02"
        status: pass
    human_judgment: false
  - id: D2
    description: "Law A still accepts a single-reference move at an order-preserving destination (A 10 -> 9), leaves nextLoopClips null, and the derived L1 range resolves with unresolved null"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a single-key move when exactly one loop references the key — Law A (D-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two or more referencing loops, Force Spacing, and every other linked-key guard keep their unchanged code and locked copy"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects a single-key move when two loops reference the key with the locked copy"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects full-timeline Force Spacing when any linked source key exists"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects scoped Force Spacing whose selection contains a linked source key"
        status: pass
    human_judgment: false
  - id: D4
    description: "Boundary pins: a one-element source cycle always moves, a dangling source fails closed, a key outside every loop moves normally, and a no-change drag in the dangling scenario is exempt"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a one-element source cycle move — a single source key is vacuously ordered"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#fails closed when the single referencing cycle names a source key absent from the mapping — CR-02"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a move on a key no loop references, even when another cycle is already unresolved"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a no-change drag in the dangling-source scenario — changed === false is exempt"
        status: pass
    human_judgment: false
  - id: D5
    description: "The move pipeline and every sibling spec remain green: 329 tests across the three roto specs and a clean typecheck"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 07: Single-Reference Key-Move Order Guard Summary

**A key moved alone under exactly one referencing loop now survives only if its final frames keep that cycle's sourceKeyIds strictly increasing; the destructive C 12 -> 22 move is rejected with the locked D-16 copy instead of persisting an unresolved clip.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-03T13:50:25Z
- **Completed:** 2026-11-03T13:52:42Z
- **Tasks:** 2
- **Files modified:** 2 production/test files (+ 1 RED evidence record)

## Accomplishments

- CR-02 closed at the resolver: the move-key branch computes `referencingClips` from `sourceKeyIds`, keeps the two-or-more D-11 rejection byte-identical, and after `buildMoveCandidate` projects the single referencing clip's source keys through the **final** mapping. Any missing key or non-increasing position rejects with `loop-source-key-move-rejected`, `operationKind: 'move-key'`, and the verbatim `LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT`.
- The Law A acceptance test was rewritten from the destructive C 12 -> 22 destination to an order-preserving A 10 -> 9 move, and now asserts `mapping.get('A') === 9`, `nextLoopClips === null`, a derivation with `unresolved: null`, and an untouched input loop collection.
- The old acceptance destination became a rejection test (C 12 -> 22) pinning code, operationKind, and copy.
- Four boundary pins landed in the D-11 describe without touching any Force Spacing or other describe: one-element source cycle accepted, dangling-source move fails closed, unreferenced-key move accepted, and a no-change drag in the dangling scenario accepted via the `changed === false` exemption.
- Final combined run: 3 spec files, 329 tests passed, exit 0; `tsc --noEmit` exit 0.

## Task Commits

Each task was committed atomically (TDD where RED was manufactured; Task 2 pins were born green):

1. **Task 1: End-to-end order-preserving single-reference move — CR-02**
   - `c1451b967` (test) — rewritten Law A acceptance at A 10 -> 9, new C 12 -> 22 rejection spec, RED evidence
   - `0fdc0d708` (feat) — referencingClips guard plus final-mapping strict-increase guard
2. **Task 2: Edge pins: single-source cycle, dangling source, unreferenced move**
   - `61ba7ac8e` (test) — four boundary pins in the D-11 describe

**Plan metadata:** (docs commit created after this file)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — move-key branch now derives `referencingClips`, rejects `> 1` with the unchanged failure call, and rejects a single-reference move when the final mapping does not resolve every source key to a strictly increasing frame.
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` — Law A acceptance rewritten at A 10 -> 9; added the C 12 -> 22 rejection and four edge pins; Force Spacing and all other describes untouched.
- `.planning/phases/58-rail-editing-regressions/58-07-TASK1-RED-EVIDENCE.json` — RED evidence, verdict `RED_EVIDENCE_OK` (`target_test_failed`, 324 pass / 1 fail of 325).

## TDD Cycle

### Task 1 — RED

- Tests: the rewritten `accepts a single-key move when exactly one loop references the key — Law A (D-12)` (A 10 -> 9) and the new `rejects a single-key move that breaks the referencing cycle order — CR-02` (C 12 -> 22).
- RED result: the rejection test failed because the old guard only counted referencing loops; the C move resolved while leaving the clip unresolved.
- Evidence: `58-07-TASK1-RED-EVIDENCE.json` -> `RED_EVIDENCE_OK` (`target_test_failed`, 324 pass / 1 fail).
- Semantic assessment: the named test executed and failed on the planned assertion; no setup, collection, import, or syntax failures.

### Task 1 — GREEN

- Implementation: `referencingClips.length > 1` preserves the D-11 rejection; a single reference is projected through `moveResult.candidate.mapping` and rejected when undefined or not strictly increasing.
- GREEN result: 325 passed.

### Task 2 — PINS_GREEN_AT_BIRTH

- Four pins added after the guard landed: one-element cycle acceptance, dangling-source fail-closed rejection, unreferenced-key acceptance, and the no-change dangling exemption.
- All four passed on first run. No production source or test configuration was weakened to manufacture RED; the pins were written to hold the boundary deliberately.
- Final combined result: 329 passed (324 baseline + 1 CR-02 rejection + 4 edge pins).

### REFACTOR

None — the guard is a compact, localized addition; no cleanup was needed.

## Decisions Made

- **Judge the final mapping, not the requested cell.** `cutSource`/`openAndInsert` ripple survivors, so only `moveResult.candidate.mapping` can prove the cycle order.
- **Reject on an unprovable order.** A source key absent from the mapping yields the same rejection rather than an optimistic allow.
- **Never re-sort.** Re-sequencing `sourceKeyIds` would silently change the cycle's playback order.
- **`candidate.changed` gates the check.** A no-change drag always matches the input mapping and stays accepted.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The plan's stated HEAD baseline of 322 passing tests was stale: after 58-06 the real baseline is 324. The acceptance criterion "above 322" is satisfied by the final 329; the RED evidence records 325 total (324 pass + 1 fail), which confirms the 324 baseline.

## Known Stubs

None.

## Threat Flags

None — no new network, auth, file-access, schema, parser, Rust, or type surface; the change is resolver-internal.

## Self-Check

- Created files exist: PASSED (`58-07-SUMMARY.md`, `58-07-TASK1-RED-EVIDENCE.json`, resolver, loop-guards spec)
- Commits are ancestors of HEAD: PASSED (`c1451b967`, `0fdc0d708`, `61ba7ac8e`)
- Three roto specs: 329 passed, exit 0
- Typecheck (`tsc --noEmit`): exit 0

## Next Phase Readiness

- RAIL-06 / RAIL-07 are pinned at the resolver level; phase-58 verification can mark the CR-02 gap closed.
- Two or more referencing loops, Force Spacing, delete-key, group move, and every sibling linked-key guard are unchanged and green.
- Plan 58-08 remains in the phase per STATE.md; no blocker was introduced here.

---

*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
