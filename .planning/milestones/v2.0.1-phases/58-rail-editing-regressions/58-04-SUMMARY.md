---
phase: 58-rail-editing-regressions
plan: 04
subsystem: ui
tags: [preact, signals, dialog, play-script, rail-editing, key-rail, tdd]

requires:
  - phase: 58-02
    provides: "dialogMode 'key-rail-create', openKeyRailCycleEdit prefill, confirm() routing, and repeatText/infinity signals"
provides:
  - "ReducedCycleCard: the Cycle stepper + Infinity switch used by both reduced-form entry points"
  - "Reduced-form gating in PhysicsPaintPlayScriptDialog (key-rail-create and merged-Standard loop-edit)"
  - "Deliberately rewritten merged-Standard dialog tests and removal of the unreachable Standard branches"
affects: [58-verify, rail-editing UAT]

actuals:
  tokens: 7072
  tasks: 2
  commits: 4
  plan_head_before: 77301fb125923e35eb7d02ba60b56c6523580c01
  plan_head_after: d716e105850204b63e9c717dc10a04c07c242286

tech-stack:
  added: []
  patterns:
    - "Reduced mode of the existing dialog: reducedForm selects a single-card body and fixed surface height instead of a second dialog route"
    - "Source-contract test for behaviors the node harness cannot observe (focus) beside behavioral vnode assertions"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts

key-decisions:
  - "The reduced surface is the existing Edit Rail dialog in a reduced mode (reducedForm), not a second component or modal route"
  - "Both entry points share ReducedCycleCard: first conversion (key-rail-create, Create Cycle) and existing Standard clips (loop-edit, Update Rail)"
  - "RailTypeCard's standard prop and Standard span were deleted outright after confirming the dialog was the only caller"
  - "Focus-on-open is pinned via a source contract because the node test harness mocks useEffect as a no-op"

patterns-established:
  - "Exclusion gating: stacking, applySurface, revealTab, surfaceTall, and identicalCycle each exclude the reduced form rather than being rewritten for it"

requirements-completed: [RAIL-01, RAIL-02]

coverage:
  - id: D1
    description: "Reduced Edit Rail form renders exactly one Cycle stepper (1) and one unchecked Infinity switch, with the Edit Rail title and fixed surface height"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > PhysicsPaintPlayScriptDialog reduced Key Rail cycle form (58-04 D-05/D-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Primary action labels Create Cycle for a first conversion and Update Rail for an existing Standard clip; both route through playScript.confirm()"
    requirement: RAIL-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > labels the primary action Create Cycle and confirms through playScript.confirm()"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > labels the primary action Update Rail and confirms through it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reduced form carries no tabs, rail-type card, frames-per-cycle, Motion, source cycle, seed/color, or Regenerate Rail"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > renders no tabs, rail type, frames-per-cycle, motion, source cycle, seed, or Regenerate Rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > renders the reduced Cycle + Infinity form and no rail type"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > renders no Regenerate Rail action for a merged Standard rail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unreachable Standard branches removed from the dialog and RailTypeCard; non-Standard loop-edit keeps the full form and Regenerate Rail"
    requirement: RAIL-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > no longer carries the unreachable Standard rail-type or Regenerate Rail branches"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > 58-04: keeps the full form and Regenerate Rail for a non-Standard loop-edit"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cancel/Escape still write nothing and confirm() remains the only write path"
    requirement: RAIL-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts > routes the collision Cancel to the controller without confirming the run"
        status: pass
    human_judgment: true
    rationale: "Escape/keyboard behavior is owned by the controller and window event wiring outside this spec; live dialog UAT must confirm Cancel/Escape remain no-write on the reduced surface."

duration: 4min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 04: Reduced Rail Conversion Dialog Summary

**Edit Rail dialog reduced to a Cycle stepper and Infinity switch for first Key Rail conversions and existing Standard clips, with the unreachable Standard branches deleted**

## Performance

- **Duration:** ~4 min (first task commit through plan verification)
- **Started:** 2026-11-03T12:20:19Z
- **Completed:** 2026-11-03T12:24:10Z
- **Tasks:** 2
- **Files modified:** 3
- **Commits:** 4 (2 RED, 2 GREEN)

## Accomplishments

- Added `ReducedCycleCard` rendering exactly the Cycle stepper (id `physics-play-script-repeat`) and the Infinity switch (id `physics-play-script-infinity`), reusing existing card/field classes with no new CSS
- Added `reducedForm` gating to the existing dialog: `key-rail-create` and merged-Standard loop-edit targets render the reduced body, hide the range readout/tabs/full footer, drop the `-surface-tall` class, and focus the repeat input
- Primary action reads Create Cycle for a first conversion and Update Rail for an existing Standard clip, and only calls `playScript.confirm()`
- Removed the unreachable Standard branches: the `standard` prop and read-only Standard span in `RailTypeCard`, the dialog's `standard={standardEditTarget}` wiring, and the `STANDARD_RAIL_REGENERATE_REASON` disabled/title/aria block (the shared constant itself remains exported)
- Rewrote the two merged-Standard dialog tests from read-only rail type + disabled Regenerate to the reduced-form expectations, and pinned the non-Standard loop-edit keeps its full form

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: reduced Cycle/Infinity dialog spec** - `9583f07b4` (test)
2. **Task 1 GREEN: reduce the Edit Rail dialog to Cycle and Infinity** - `3434e7e60` (feat)
3. **Task 2 RED: Standard cleanup spec** - `5dd8da07b` (test)
4. **Task 2 GREEN: merge Standard rail edits into the reduced cycle form** - `d716e1058` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` - `keyRailCreate`/`reducedForm` locals, reduced body/footer/height/focus gating, header title, Standard branch removals
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` - new `ReducedCycleCard`; `RailTypeCard` standard prop and Standard span deleted
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` - new reduced Key Rail and Standard cleanup describes, rewritten merged-Standard tests, non-Standard loop-edit regression guard

## Decisions Made

- The reduced surface stays inside the existing `PhysicsPaintPlayScriptDialog` (mode-gated), honoring the plan's no-second-dialog prohibition
- `ReducedCycleCard` is shared by both entry points so the two reduced surfaces cannot drift
- `RailTypeCard`'s `standard` prop was deleted (not merely unwired) after grep confirmed the dialog was its only caller
- Focus-on-open is asserted with the spec's existing source-contract idiom because the harness mocks `useEffect`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled two merged-Standard test rewrites into Task 1 GREEN**
- **Found during:** Task 1 (reduced dialog form)
- **Issue:** Task 1's GREEN made `reducedForm` include `standardEditTarget`, so the old merged-Standard tests (expecting a read-only rail type and a disabled Regenerate button) failed against the intended behavior; Task 1's acceptance requires a green spec.
- **Fix:** Rewrote the two tests to the reduced-form expectations (the same rewrite Task 2 called for) and removed the now-unused `STANDARD_RAIL_REGENERATE_REASON` test import needed by `noUnusedLocals`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts`
- **Verification:** dialog spec 98/98 green at Task 1 GREEN; final 100/100 green.
- **Committed in:** `3434e7e60` (Task 1 GREEN)

**2. [Rule 1 - Bug] Made the Standard cleanup test fail readably in TAP**
- **Found during:** Task 2 RED evidence
- **Issue:** `expect(source).not.toContain(...)` printed the entire multi-line joined source as TAP `actual`, which the RED classifier rejected as `INVALID_RED` (Non-TAP data/Malformed TAP).
- **Fix:** Rewrote the four assertions as `expect(source.includes('...')).toBe(false)`, producing a short `actual: "true"`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts`
- **Verification:** `gsd_run check tdd-red-evidence` classified `RED_EVIDENCE_OK`; task 2 GREEN turns all four green.
- **Committed in:** `5dd8da07b` (Task 2 RED)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Neither changed planned scope; deviation 1 moved a Task 2 test rewrite earlier because Task 1's green gate demanded it.

## Issues Encountered

- The pre-existing dirty `.planning/config.json` (`ui_safety_gate` change) was left untouched and excluded from every commit.
- The node harness cannot observe focus (mocked `useEffect`), so the focus requirement is pinned by source contract plus `inputRef` wiring.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The reduced conversion surface is automatable-ready; live UAT should still confirm the exact visible surface (title, one stepper, one switch, primary label) and that Cancel/Escape write nothing.
- No stubs; no new security-relevant surface beyond the existing confirm-only dialog path.

## Self-Check: PASSED
