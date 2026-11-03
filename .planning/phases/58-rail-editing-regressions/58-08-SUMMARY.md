---
phase: 58-rail-editing-regressions
plan: 08
subsystem: ui
tags: [preact, signals, dialog, play-script, rail-editing, key-rail, confirm-gating, tdd]

requires:
  - phase: 58-02
    provides: "dialogMode 'key-rail-create', openKeyRailCycleEdit, and the reduced modal prefill"
  - phase: 58-04
    provides: "ReducedCycleCard and the reducedForm gating this plan re-gates"
provides:
  - "framesValidationError + confirmBlocked shared confirm gate in PhysicsPaintPlayScriptDialog"
  - "Enter and the primary button take the identical decision on every dialog surface"
  - "No-leak pins for the apply, Reveal, and stack-collision confirm surfaces"
affects: [58-verify, rail-editing UAT]

actuals:
  tokens: 2376
  tasks: 2
  commits: 3
  plan_head_before: 0305dde5d20a8e22396b42edaa6b1622ca7f11a9
  plan_head_after: d3cc5510c25a4f0db1b8ab551f897fe46afec969

tech-stack:
  added: []
  patterns:
    - "Single derived confirm gate consumed by both write triggers (keyboard Enter + primary button)"
    - "Reduced-form exemption expressed by nulling the irrelevant validation channel, never by a second gate"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts

key-decisions:
  - "One render-local confirmBlocked value drives the Enter guard and the non-regenerate primary disabled state, so a click and Enter cannot disagree"
  - "framesValidationError is null when reducedForm is true (key-rail-create and merged Standard loop-edit), otherwise the reveal or paint validation channel"
  - "stackCollision stays part of the shared gate for the button; Enter still reaches the collision branch first, and the no-leak pin proves that ordering"
  - "The new specs live in a sibling 'Enter confirm gate (WR-02)' describe beside the keyboard containment describe, the placement Task 1 explicitly allows"

patterns-established:
  - "Confirm-gating parity: derive one boolean from every blocking channel and bind both triggers to it"

requirements-completed: [RAIL-02, RAIL-04]

coverage:
  - id: D1
    description: "In key-rail-create, Enter calls preventDefault and playScript.confirm() once despite the stale 'Maximum available count is 0.' frames validation, with the Create Cycle button enabled"
    requirement: RAIL-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#confirms on Enter in the reduced Key Rail form despite a stale frames validation error"
        status: pass
    human_judgment: false
  - id: D2
    description: "A repeatError still disables the primary and blocks Enter in the reduced Key Rail form, and the merged Standard loop-edit surface (loop-edit + merged target) also confirms on Enter despite a stale validationError"
    requirement: RAIL-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#blocks both Enter and the primary when the reduced Key Rail form has a repeat error"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#confirms on Enter for a merged Standard loop edit despite a stale frames validation error"
        status: pass
    human_judgment: false
  - id: D3
    description: "The full creation, Reveal, and stack-collision surfaces keep their exact prior gating: default apply confirms, apply validationError and Reveal revealValidationError block both triggers, a stack collision routes Enter to confirmStackCollision('truncate') and keeps the footer primary disabled"
    requirement: RAIL-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#confirms on Enter on the default apply surface when nothing blocks"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#blocks both Enter and the primary on the apply surface when the frames validation fails"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#blocks both Enter and the primary on the Reveal tab when only the reveal validation fails"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#routes Enter on a stack collision to Truncate and keeps the primary disabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Escape keeps its cancel precedence and Enter stays inert while a generation can be cancelled"
    requirement: RAIL-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#keeps Escape on cancel and leaves Enter inert while a generate can be cancelled"
        status: pass
    human_judgment: true
    rationale: "The spec proves the routing (cancel is called, confirm is not); the zero-write guarantee itself is owned by the controller's cancel path and stays a live UAT row, same as 58-04 D5."

duration: 3min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 08: Shared Confirm Gate for the Reduced Cycle Form Summary

**One derived `confirmBlocked` now drives both the Enter key and the Create Cycle / Update Rail button, so the reduced Cycle form confirms despite the stale frames validation while apply, Reveal, and stack-collision keep their exact prior gating**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-11-03T13:55:03Z
- **Completed:** 2026-11-03T13:58:00Z
- **Tasks:** 2
- **Files modified:** 2 (plus one RED evidence record)

## Accomplishments

- Added `framesValidationError` (null when `reducedForm`, else `revealValidationError` on the Reveal tab or `validationError`) and `confirmBlocked` (frames or repeat error or an open stack collision) as render locals in `PhysicsPaintPlayScriptDialog`
- Replaced the Enter guard's separate `tabValidationError` expression with a single `if (confirmBlocked) return;` and bound the non-regenerate primary's `disabled` to the same value, so click and Enter cannot disagree
- Closed WR-02: in `key-rail-create` the controller's stale "Maximum available count is 0." frames error no longer vetoes confirm; `repeatError` still blocks both triggers; the merged Standard loop-edit surface inherits the same exemption through `reducedForm`
- Added no-leak pins for every non-reduced surface (default apply, apply validationError, Reveal revealValidationError, stack collision truncate route, Escape/canCancel precedence)

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Enter-confirm gate specs** - `5af7f7052` (test)
2. **Task 1 GREEN: shared confirm gate** - `e78064fe1` (feat)
3. **Task 2: non-reduced confirm-surface pins** - `d3cc5510c` (test)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` - `framesValidationError` / `confirmBlocked` locals, single Enter guard, primary `disabled={confirmBlocked}`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` - new `Enter confirm gate (WR-02)` describe with four RED-driven specs and four green-at-birth no-leak pins
- `.planning/phases/58-rail-editing-regressions/58-08-TASK1-RED-EVIDENCE.json` - RED evidence record (verdict `RED_EVIDENCE_OK`)

## Decisions Made

- The shared gate is a render-local boolean reading signals only — no signal write, no new signal, no controller change (efx-preact-reactivity rules 2, 5, 6 respected)
- The reduced-form exemption is expressed by nulling the frames/reveal channel, which keeps every other mode semantically identical to the previous expression
- `stackCollision` remains in the gate for the button while the Enter collision branch still returns first; the no-leak pin locks that ordering
- Task 2's specs extend the sibling `Enter confirm gate (WR-02)` describe created in Task 1 ("in or beside the keyboard containment describe"), keeping the existing containment tests untouched

## TDD Gate Compliance

- RED commit `5af7f7052` (`test(58-08): ...`) precedes GREEN `e78064fe1` (`feat(58-08): ...`); no REFACTOR commit was needed.
- RED evidence (`.planning/phases/58-rail-editing-regressions/58-08-TASK1-RED-EVIDENCE.json`): `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`, reason `target_test_failed`. The named target — "confirms on Enter in the reduced Key Rail form despite a stale frames validation error" — failed on its planned assertion (`expected "spy" (preventDefault) to be called 1 times, but got 0 times`, dialog.tsx:290-291 still read `validationError`). No import, collection, or fixture fault; 104 tests reported, the target the only failure, the rest SKIPPED by the `-t` filter.
- **PINS_GREEN_AT_BIRTH:** Task 2's four pins passed as soon as they were written because the shared gate preserved the prior semantics for every non-reduced mode. No production source was weakened to manufacture RED; the pins are recorded as green-at-birth and committed as a test-only change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The stack-collision surface renders a second `physics-paint-play-script-actions` row and a primary-class Truncate button inside `CollisionCard`, so the generic primary lookup matched twice. The no-leak stack pin scopes its lookup to the dialog footer before reading `disabled`; production source is unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dialog spec: 108/108 passing (baseline was 100), typecheck clean.
- WR-02 is closed at the automated level; live UAT should still confirm that Enter in the Cycle field commits `Create Cycle` and that Escape/Cancel write nothing.
- No stubs, no skipped tests, no new security-relevant surface.

## Self-Check: PASSED
