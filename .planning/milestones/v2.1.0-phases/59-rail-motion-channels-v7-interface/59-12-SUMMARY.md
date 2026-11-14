---
phase: 59-rail-motion-channels-v7-interface
plan: 12
subsystem: ui
tags: [preact-signals, rail-motion, motion-channels, selection-scopes, tdd]

requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: 59-02 rail-motion reducer and evaluator, 59-05 rail-local frame law, 59-06 rail bindings, 59-07 store setter and revision signal, 59-11 track-row layout
provides:
  - Animate command that seeds one identity Position key at the rail-local playhead
  - Motion key add/remove/step commands with scope-gated Hold/Ease and Wiggle
  - One selection-scope authority with a per-scope contextual command table
  - Session-only merge-drop confirmation row with validated factory and two named writers
affects: [59-15 settlement consumer, 59-13 lane rendering, 59-14 UAT]

actuals:
  tokens: 33066
  tasks: 4
  commits: 7

tech-stack:
  added: []
  patterns:
    - Pure command layer over the 59-02 reducer; one store writer
    - Scope-gated action-bar commands from one table, absent rather than disabled
    - Module-scope Preact signal for session-only notice state with two named writers

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionMergeNotice.ts
    - app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts
  modified:
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/types/physicPaint.ts

key-decisions:
  - Motion-key selection lives in a module-scope Preact signal in the timeline-actions hook, beside the existing selection state; no store field was added.
  - The three scopes and their clearing rules live with the rail-set authority; the command layer re-exports them as the one import site.
  - Hold/Ease/Wiggle are gated by the per-scope command table, so other scopes render no controls rather than disabled ones.
  - The merge notice is validated in its factory and published through exactly two named writers; the strip reads it only in a leaf component.
  - Motion-key stepping moves the playhead through the existing synced-frame navigation seam via a deferred ref, not a second navigation path.

patterns-established:
  - "One scope authority: resolveSelectionScope + clearSelectionForScope decide cross-scope clearing; the strip never compares selections inline."
  - "One command table: CONTEXTUAL_COMMANDS_BY_SCOPE drives which controls exist; every command appears in exactly one scope list."
  - "Session-only notice: module-scope signal, frozen validated values, publish/dismiss only, no effect and no render-body write."

requirements-completed: [MOTN-01, MOTN-04, MOTN-05, MOTN-10, MOTN-11, MUI-06]

coverage:
  - id: D1
    description: "Animate the selected rail: idempotent, rail-local key seed, no other collection touched."
    requirement: MOTN-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-12 rail motion commands — animate"
        status: pass
    human_judgment: false
  - id: D2
    description: "Motion key add/remove/step with Hold/Ease and Wiggle available only in the motion-key scope."
    requirement: MOTN-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-12 rail motion commands — Motion keys"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#59-12 Task 2: Motion-key commands exist only in the motion-key scope (MOTN-05, D-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three independent selection scopes with exactly one active scope and one contextual command list."
    requirement: MOTN-11
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-12 Task 3: three independent selection scopes (MOTN-11)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Merge-drop confirmation row: validated session notice, plain-sentence copy naming the dropped frame range, Dismiss."
    requirement: MOTN-10
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#59-12 Task 4: merge-drop confirmation row (MOTN-10)"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-11-06
status: complete
plan_head_before: 2b068a85fa352c3c227d836e00306547f09f5559
plan_head_after: 7d1ca5bf52f81c2ad2e4dbe1584d12d4ab3ce2fc
---

# Phase 59 Plan 12: Motion Commands and Scopes Summary

**Rail motion is commandable: Animate seeds an idempotent rail-local key, Motion keys add/remove/step with scope-gated Hold/Ease and Wiggle, three selection scopes stay independent, and a merge that drops motion surfaces a dismissible session notice**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-11-06T16:15:00Z
- **Completed:** 2026-11-06T16:48:00Z
- **Tasks:** 4
- **Files modified:** 11

## Accomplishments

- The action bar exposes one Animate command for the selected rail; a second Animate returns the same collection reference (D-04) and binds a loop rail by loopId without minting an id.
- Motion-key commands composed over the 59-02 reducer: add uses the channel's evaluated value at the rail-local cursor, grouped Position writes both axes atomically (D-11/D-12), removal cascades channel then record (D-15), and stepping never wraps.
- Hold/Ease and Wiggle attach to Motion keys only, gated by the one per-scope command table; a rail or drawing-key selection renders no such controls.
- Selection scopes: one `resolveSelectionScope` authority, `clearSelectionForScope` keeps the rail set while making the two key scopes exclusive, and selecting a Motion key highlights it in its lane.
- The merge-drop row is a polite `role="status"` leaf reading a session-only signal; the factory rejects malformed or inverted spans without repairing them, publish replaces the single slot, and Dismiss clears it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Animate the selected rail** - `988971eec` (feat)
2. **Task 2: Motion key commands and key controls** - `34499e8c7` (test, RED) → `71638f4c5` (feat, GREEN)
3. **Task 3: Three independent selection scopes** - `2e3aa04ce` (test, RED) → `be8e17472` (feat, GREEN)
4. **Task 4: Merge-drop confirmation row** - `5a0e1382c` (test, RED) → `7d1ca5bf5` (feat, GREEN)

**Plan metadata:** measured from `2b068a85f..7d1ca5bf5` — 7 commits.

_Note: TDD tasks commit RED and GREEN separately; `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for Tasks 2, 3 and 4 before each implementation._

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionCommands.ts` - Animate, key commands, availability table, selection-scope re-exports, per-scope command table
- `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` - Validated factory, session signal, publish/dismiss writers, plain-sentence copy
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts` - `RailMotionSelectionScope`, `resolveSelectionScope`, `clearSelectionForScope`
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - Motion action bundle, availability signals, session key selection, one store commit path
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Animate button, motion lane wiring, key controls, selected-key highlight, merge-notice leaf
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` - Channel-aware lane callbacks, host disabled reasons, selected-key highlight prop
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `navigateToAppFrame` seam through a deferred ref so stepping moves the playhead
- `app/src/types/physicPaint.ts` - `PhysicPaintRailMotionMergeNotice` declared once, documented as session-only
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` - 35 command, availability and scope truth-table tests
- `app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts` - 11 factory, slot, copy and non-persistence tests
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Scope-visibility vnode rows, wiring pins, merge-notice source pins

## Decisions Made

- **Motion-key selection placement:** a module-scope Preact signal (`railMotionSelectedKey`) in `useRotoTimelineActions`, beside the existing selection state. No store field existed and none was added; the strip reads it through the action bundle.
- **Scope authority location:** declared in `physicsPaintRotoRailSetSelection.ts` per the plan, re-exported from `railMotionCommands.ts` so the strip and tests keep one import site.
- **Selection clearing semantics:** `clearSelectionForScope` is a clearing-time function, not a selection-time one — selecting a rail does not call it, which is exactly why a rail re-selection preserves the motion-key selection (pinned by test).
- **Motion-key highlight:** the block accepts the selection and forwards frame numbers to the lane that owns the channel; grouped Position matches either axis channel.
- **Step navigation:** routed through `handleNavigateToSyncedFrame` via a deferred ref assigned after its definition (existing ref-seam pattern), avoiding a second navigation path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TrackRow lane callbacks needed the addressed channel**
- **Found during:** Task 2 (Motion key commands)
- **Issue:** `TimelineMotionBlock` collapsed lane clicks into frame-only callbacks, so the host could not know which model channel a click addressed; Hold/Ease/Wiggle would have guessed.
- **Fix:** Added `channelId` to the lane callbacks, a host-owned `disabledReasons` map and later a `selectedMotionKey` prop; the block forwards `lane.channels[0].id`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`
- **Verification:** `PhysicsPaintTrackRow.test.tsx.test.ts` (35 tests) and the strip scope rows pass.
- **Committed in:** `71638f4c5` (Task 2), extended in `be8e17472` (Task 3)

**2. [Rule 3 - Blocking] Step commands had no live playhead consumer**
- **Found during:** Task 2 (Motion key commands)
- **Issue:** the hook gained `navigateToAppFrame`, but Studio constructed the input before the navigation handler existed, leaving stepping a silent visual no-op.
- **Fix:** wired the port through `navigateToAppFrameRef`, assigned after `handleNavigateToSyncedFrame`, matching the existing execute-ref seam.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** `PhysicsPaintStudio.test.ts` (339 tests) and `tsc --noEmit` pass.
- **Committed in:** `71638f4c5` (Task 2)

**3. [Rule 2 - Missing Critical] Animate bypassed the single commit path**
- **Found during:** Task 2 (adding the commit funnel)
- **Issue:** `animateSelectedRail` wrote the store directly while key commands used `commitRailMotionRecords`, leaving two store writers in one hook.
- **Fix:** routed Animate through `commitRailMotionRecords`; a source test now pins exactly one direct `replaceRotoPhysicalRailMotions` call.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
- **Verification:** the one-writer assertion in `PhysicsPaintWorkflowStrip.test.ts` passes.
- **Committed in:** `71638f4c5` (Task 2)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three were required for the lane commands and stepping to work end-to-end; no scope creep.

## Issues Encountered

- The RED evidence record must live inside the project directory (a `/tmp` path is rejected); the gate was rerun with the record under the phase directory.
- The `.test.tsx` TrackRow suite is only collected through its `.test.tsx.test.ts` launcher; the full related suite was run through that launcher.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 59-15 (declared dependency) is the only production caller expected for `publishRailMotionMergeNotice`/`dismissRailMotionMergeNotice`; the row is already rendered and tested, it simply has no drop event to display until that settlement wiring lands.
- `physicsPaintStudio.css` was intentionally not modified; the notice row uses inline token styling.
- The full related suite (280 tests across commands, notice, strip, lane and TrackRow) passes, and `tsc --noEmit` is clean.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- SUMMARY.md: FOUND
- 7/7 task commits are ancestors of HEAD
