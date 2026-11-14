---
phase: 59-rail-motion-channels-v7-interface
plan: 16
subsystem: ui
tags:
  - preact
  - preact-signals
  - motion-channels
  - numeric-inspector
  - projection
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-02
    provides: railMotionValueToUi / railMotionValueFromUi display-unit conversion pair
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-05
    provides: evaluateRailMotionChannel and the stored-key/evaluator fallback
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-06
    provides: selectedMotionKey selection state on physicalActions
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-07
    provides: commitRailMotionRecords single-undo store setter
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-12
    provides: setMotionKeyAtCursor atomic grouped-Position writer
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-13
    provides: writeMotionTransformAtCursor gizmo path
provides:
  - projectRailMotionInspector — frozen, store-free Motion value projection for the selected Motion key
  - writeRailMotionChannelValueAtCursor — numeric field write delegating to the 59-12 grouped writer
  - commitRailMotionChannelValue — hook action returning the rejection reason (or null)
  - Five-field Motion value inspector in PhysicsPaintScriptsPanel wired in the Studio right-panel memo
affects:
  - 59 phase verification and UAT
  - Any later inspector surface reading a Motion key selection

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 94146
  tasks: 2
  commits: 4
plan_head_before: f5efb9e6235ea198e1e03134443dc4ea56e0ef81
plan_head_after: 3c5283e3080228c136bd0ff1c0ce2e4da3e74127

# Tech tracking
tech-stack:
  added: []
  patterns:
  - Props-driven inspector surface — projection in, callback out, zero store imports
  - Ref-held signal for transient rejection state under a hooks-mocked component harness
  - Rejection-sequence remount key to revert an optimistic native numeric input
  - One conversion authority reused for every displayed Motion value

key-files:
  created: []
  modified:
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "Selecting a Motion key does not move the playhead, so both the projection read and the numeric write use the selection's rail-local frame."
  - "The panel stays props-driven (selectedRailMotion in, onCommitRailMotionValue out) and imports no store; the rejection sentence is the only transient state."
  - "Numeric fields run with freeEntry and precision 3 so out-of-domain entries reach the command layer and produce a visible rejection instead of a silent clamp."
  - "A rejection bumps a sequence used in the field key, remounting only the rejected stepper so its optimistic text reverts to the projected document value."
  - "writeRailMotionChannelValueAtCursor delegates to setMotionKeyAtCursor, making the field path and the gizmo path one writer; the untouched Position axis is seeded from the stored key or the evaluator (D-12)."
  - "Rotation is passed through verbatim at every layer — no wrap, no shortest-arc rewrite, no degrees/radians conversion."
  - "The new Studio import was added as a second import line so the pinned deriveKeyRailSegments/projectSelectedKeyRailInspector import in PhysicsPaintStudio.test.ts stayed untouched."

patterns-established:
  - "Inspector projection: a frozen function returns null unless the full selection exists, so the panel never renders partially filled fields."
  - "Transient rejection state in a component harness without useSignal/useMemo: signal() kept in useRef."

requirements-completed:
  - MOTN-03
  - MOTN-09

coverage:
  - id: D1
    description: "Selected Motion key projects to a frozen inspector value set, threaded through the Studio right-panel memo into the panel"
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#projectRailMotionInspector (59-16: Motion value inspector)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#Physics Paint Scripts panel Motion value inspector (59-16)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionCommands.test.ts#59-16 rail motion commands — numeric inspector write"
        status: pass
    human_judgment: false
  - id: D2
    description: "All five channels editable numerically in the fixed D-13 order with independent grouped-Position axes, unbounded rotation, opacity percent, visible rejection and field/gizmo parity"
    requirement: MOTN-09
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#renders all five fields in the fixed D-13 order with their units and display values"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionCommands.test.ts#grouped position write parity with writeMotionTransformAtCursor"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#passes rotation through verbatim — 720 and -90 are never wrapped"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 16: Motion Value Inspector Summary

**A frozen `projectRailMotionInspector` plus a props-driven five-field numeric inspector: grouped Position edits one axis at a time, rotation passes through unwrapped, and field writes share the gizmo's single writer.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-11-06T19:00:00+01:00
- **Completed:** 2026-11-06T19:17:21+01:00
- **Tasks:** 2
- **Files modified:** 8 (6 source/test files from the plan list, plus the command layer and hook)

## Accomplishments

- Added the side-effect-free `projectRailMotionInspector` projection: null without a record, a Motion key selection, and a key at the selected frame; otherwise it emits Position X/Y (px), Scale (%), Rotation (°) and Opacity (%) in the fixed D-13 order using the 59-02 conversion pair, deeply frozen.
- Extended `PhysicsPaintStudio` with a memoized projection keyed on the selected Motion key and the rail-motion revision, threaded through `rightPanelPropsMemo` into the panel's `selectedRailMotion`, with `onCommitRailMotionValue` bound to the physical actions.
- Added `writeRailMotionChannelValueAtCursor`, which validates the finite/domain guard, converts display to stored units once, seeds the untouched Position axis from the stored key or the 59-05 evaluator, then delegates to the 59-12 atomic grouped writer so the numeric field and the gizmo are provably the same writer.
- Rendered the full five-field inspector in all three panel surfaces (normal Scripts, Key Rail, Loop Clip) with unit labels, one channel per commit, an alert-role rejection sentence, and a rejection-sequence remount that reverts the rejected field to the projected value.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: numeric Motion inspector projection and Scale write path pins** - `73c4a52e7` (test)
2. **Task 1 GREEN: numeric Motion inspector projection and Scale write path** - `a00986238` (feat)
3. **Task 2 RED: failing five-field inspector and rejection pins** - `ccc971916` (test)
4. **Task 2 GREEN: render the five-channel Motion value inspector** - `3c5283e30` (feat)

**Plan metadata:** committed after this SUMMARY (docs: complete motion value inspector plan)

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` - additive `projectRailMotionInspector` and its frozen presentation types
- `app/src/components/physic-paint/roto/railMotionCommands.ts` - `writeRailMotionChannelValueAtCursor` with the finite/domain rejection reasons
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `commitRailMotionChannelValue` action, refusal messages and one-undo commit
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` - props-driven Motion section with rejection state
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - projection memo, deps entry and `scripts` wiring
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` - five-field projection, freezing and rotation passthrough
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` - write rows, rejections, grouped independence, create-new seeding, parity
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` - field order/units, callback wiring, rejection, grouped independence, source pins

## Decisions Made

- Numeric edits write at the selected Motion key's rail-local frame because selecting a key does not move the playhead.
- The panel holds no store and no document state: every value arrives through `selectedRailMotion`; the only transient state is the rejection sentence.
- `freeEntry` with precision 3 is used so out-of-domain entries are rejected visibly rather than snapped into range by the stepper grid.
- Rejected fields remount through a sequence in the key, because Preact will not patch an unchanged `value` prop after the native input already moved.
- The command layer, not the hook, owns value-domain validation so the field and gizmo paths share identical reasons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the command-layer writer and hook action required to finish the end-to-end write path**
- **Found during:** Task 1 (One inspector field end-to-end)
- **Issue:** The plan's `files_modified` list names only the projection, the panel, the Studio and the tests, but an end-to-end Scale write also needs a pure command and a store-facing action.
- **Fix:** Appended `writeRailMotionChannelValueAtCursor` to `railMotionCommands.ts` and `commitRailMotionChannelValue` to `useRotoTimelineActions.ts`; both delegate to the 59-12 writer and return the rejection reason.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionCommands.ts`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
- **Verification:** `railMotionCommands.test.ts` (67 tests) and typecheck exit 0.
- **Committed in:** `a00986238`

**2. [Rule 1 - Bug] Revised the Task 1 RED source pin that forbade `@preact/signals` in the panel**
- **Found during:** Task 2 (Grouped Position, rotation, opacity and parity)
- **Issue:** The Task 1 pin asserted the panel had no signal import, but Task 2's behavior requires a signal to carry the rejection sentence under the project's signals-only rule.
- **Fix:** The Task 2 RED commit replaced that pin with an assertion that the signals import exists and `useState` does not.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`
- **Verification:** The revised pin and the full 154-test Task 2 run pass.
- **Committed in:** `ccc971916`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were necessary; the command/hook files are the missing halves of the plan's own write path, and the pin revision reflects Task 2's explicit signals contract. No scope creep.

## Issues Encountered

- The existing pinned import line in `PhysicsPaintStudio.test.ts` could not absorb `projectRailMotionInspector`; adding a separate import line kept that test untouched, as the plan requires no test file outside its list to change.
- Two implementation comments initially tripped the panel source pins (a second `lock` word and a `useState` mention); the comments were reworded, not the pins.

## Known Stubs

None.

## Threat Flags

None — no new network, auth or file-access surface. The plan's T-59-39 (single conversion authority and parity test), T-59-43 (one projection, zero panel store imports, memo deps naming the record and key) and T-59-49 (independent grouped-Position values and evaluator seeding) mitigations are implemented and pinned by tests.

## Next Phase Readiness

- MOTN-03 and MOTN-09 are implemented and covered by passing unit tests; the remaining gate is the phase-level UAT/verification pass.
- No blockers introduced. The public surface is additive (`projectRailMotionInspector`, `writeRailMotionChannelValueAtCursor`, `commitRailMotionChannelValue`, panel props).

## TDD Gate Compliance

- **Task 1 RED:** `73c4a52e7` — failing projection/panel pins; evidence `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-16-task1.json`, validated.
- **Task 1 GREEN:** `a00986238` — projection, command and hook implemented; verify suite passes.
- **Task 2 RED:** `ccc971916` — 154 tests, 149 pass, 5 fail, target "renders all five fields in the fixed D-13 order with their units and display values"; evidence `red-evidence-59-16-task2.json`, validated `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** `3c5283e30` — all 154 tests pass across the three plan test files.

## Self-Check: PASSED

All eight modified files exist and all four task commits are ancestors of HEAD.
