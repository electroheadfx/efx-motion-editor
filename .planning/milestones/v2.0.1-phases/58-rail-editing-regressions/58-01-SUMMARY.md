---
phase: 58-rail-editing-regressions
plan: 01
subsystem: physics-paint roto resolver
tags: [preact, physics-paint, roto, loop-clips, resolver, vitest, rail-editing]

# Dependency graph
requires:
  - phase: 43
    provides: linked Loop Clips, D-11 rigid linked-key guard, countLoopsReferencingSourceKey
provides:
  - Law A single-key move acceptance when exactly one loop clip references the key
  - D-11 rejection preserved for two or more referencing loops with the verbatim D-16 copy
  - Standing no-leak pins over Force Spacing, delete, insert, duplicate, and move-key-rail guards
affects: [58-verify-work, Studio drag behavior, v7 timeline-rails quick]

actuals:
  tokens: 1538
  tasks: 2
  commits: 3
  plan_head_before: 908a264f7e6836cb847ba3384623acb58c25464f
  plan_head_after: 2892b081000b8960559d22b66dbe7b2d653a69a0
  commits_measured: 3

tech-stack:
  added: []
  patterns:
    - "Law A boundary pair: exactly one referencing loop accepts, two reject with the locked copy"
    - "Preservation pins pin the guards a relaxation did not touch, never a weakened production source"

key-files:
  created:
    - .planning/phases/58-rail-editing-regressions/58-01-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts

key-decisions:
  - "Law A is the single comparator change `> 0` to `> 1` at the move-key guard; the adjacent comment now cites Phase 58 D-12 and keeps the Phase 43 rule for two or more loops."
  - "D-13 required zero behavior work: buildMoveCandidate never emits nextLoopClips, so an accepted single-key move leaves placementStart untouched — pinned by asserting proposal.nextLoopClips is null and loopClips is not mutated."
  - "The two Key Rail guards not already covered in this spec (delete-key-rail, move-key-rail) got direct pins; Insert and Duplicate remain pinned by the resolver spec that this plan's verify executes."
  - "The RED TAP report was captured with the app-local vitest binary to avoid pnpm banner contamination; the planned pnpm verify command still ran the same spec and passed."

requirements-completed: [RAIL-06, RAIL-07]

coverage:
  - id: D1
    description: "A single-key drag on a key referenced by exactly one loop clip is accepted and lands on the requested frame (Law A, D-12)"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a single-key move when exactly one loop references the key — Law A (D-12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A key referenced by two or more loop clips still rejects with code loop-source-key-move-rejected, operationKind move-key, and the verbatim D-16 copy"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects a single-key move when two loops reference the key with the locked copy"
        status: pass
    human_judgment: false
  - id: D3
    description: "An accepted single-reference move emits no nextLoopClips (placementStart stays put, D-13) and never mutates the caller's loop collection"
    requirement: RAIL-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#accepts a single-key move when exactly one loop references the key — Law A (D-12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Force Spacing and the Delete / Insert / Duplicate / delete-key-rail / move-key-rail guards keep their current codes and copy (D-14, D-15)"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#Phase 58 Law A no-leak guards"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects full-timeline Force Spacing when any linked source key exists"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts#rejects scoped Force Spacing whose selection contains a linked source key"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#rejects insert-slot when the selected key is Group-referenced"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#rejects duplicate-key when the right ripple would move a Group-referenced key"
        status: pass
    human_judgment: false
  - id: D5
    description: "The live pointer drag in the Studio timeline actually moves a single-referenced cycle key"
    requirement: RAIL-06
    verification: []
    human_judgment: true
    rationale: "This plan is resolver-only; WorkflowStrip dispatch and the hooks are untouched, so end-to-end gesture confirmation belongs to phase UAT."

duration: 2 min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 01: Law A single-key move summary

**Move-key guard relaxed to `> 1` referencing loops: a key owned by one loop clip now drags alone, while two or more keep the verbatim rigid-group rejection.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-03T11:49:42Z
- **Completed:** 2026-11-03T11:51:47Z
- **Tasks:** 2
- **Files modified:** 3 (resolver, guards spec, RED evidence artifact)
- **Commits:** 3 (measured from `908a264f7..2892b0810`)

## Accomplishments
- Single-key move on a key referenced by exactly one loop clip is accepted end-to-end through `resolvePhysicPaintRotoPhysicalEdit` and lands on the requested physical cell (`C -> 22`).
- Two or more referencing loops still fail with `loop-source-key-move-rejected`, `operationKind: move-key`, and the locked D-16 sentence verbatim.
- D-13 confirmed free: `buildMoveCandidate` never emits `nextLoopClips`, so `placementStart` stays put; the accepted-move test pins both `nextLoopClips === null` and the untouched input collection.
- No-leak pins cover Force Spacing (full timeline and scoped), delete-key, delete-key-group, delete-key-rail, and move-key-rail; Insert and Duplicate Group-ownership stay backed by the resolver spec executed in the same verify.

## TDD

- **RED:** `test(58-01): add failing Law A boundary pair for single-key loop-source move` (`da3553860`). The target test `accepts a single-key move when exactly one loop references the key — Law A (D-12)` failed on its planned assertion (`expectOk` received the current `> 0` rejection). Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`, TAP: 40 tests, 39 pass, 1 fail). Evidence at `.planning/phases/58-rail-editing-regressions/58-01-RED-EVIDENCE.json`.
- **GREEN:** `feat(58-01): accept single-key moves on single-referenced loop keys (Law A)` (`efa28b16b`). Guards spec 40/40 passed.
- **Task 2 preservation pins:** born green (`PINS_GREEN_AT_BIRTH`); the behavior already held, so no RED was manufactured and no production source was weakened.
- Gate order verified: the `test(58-01)` commit precedes its `feat(58-01)` commit; no REFACTOR commit was needed.

## Task Commits

1. **Task 1 RED: Law A boundary pair** - `da3553860` (test)
2. **Task 1 GREEN: move-key guard `> 1`** - `efa28b16b` (feat)
3. **Task 2: no-mutation + untouched-guard pins** - `2892b0810` (test)

_Note: TDD tasks produce a RED commit before the implementation commit._

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` - move-key guard comparator `> 0` -> `> 1` and the adjacent comment rewritten to D-12; nothing else changed.
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` - Law A boundary pair, ordinary-key move with and without loops, no-mutation assertions, and the `Phase 58 Law A no-leak guards` describe.
- `.planning/phases/58-rail-editing-regressions/58-01-RED-EVIDENCE.json` - RED TAP evidence record consumed by the TDD gate.

## Decisions Made
- Law A remains a resolver-only change: `prepareRotoKeyDrag` / `commitRotoKeyDrag`, the WorkflowStrip dispatch, and the history hook were not touched (D-12, key_links).
- `countLoopsReferencingSourceKey` stays `sourceKeyIds`-only; a key that is only a `frameOverrides` owner is not counted, per CONTEXT's discretion recommendation.
- `LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT` and the `fail(...)` call are byte-identical to Phase 43 (D-16).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The TDD evidence contract needs a report in a supported format. Vitest's default summary is not TAP, so the RED run used the app-local `vitest --reporter=tap-flat` binary to capture a clean report (the `pnpm --filter` wrapper appends its own error banner to stdout). The planned pnpm verify command was still used for both GREEN acceptance runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RAIL-06 and RAIL-07 are automated-ready; live drag confirmation in the Studio timeline remains for phase UAT.
- Ready for the remaining wave-1 plans (58-02, 58-03).

## Self-Check: PASSED

All created/modified files exist on disk, and all three task commits (`da3553860`, `efa28b16b`, `2892b0810`) are ancestors of HEAD.

---
*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
