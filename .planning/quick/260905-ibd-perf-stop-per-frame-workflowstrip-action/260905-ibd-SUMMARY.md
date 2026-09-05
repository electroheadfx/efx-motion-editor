---
phase: quick-260905-ibd
plan: 260905-ibd
subsystem: ui
tags: [preact, signals, useComputed, memo, deferred-ref, performance, workflow-strip, roto]

# Dependency graph
requires:
  - phase: quick-260905-hfd
    provides: the workflow strip action-row layout (Key/Create rail/Push/Insert/Duplicate/Copy/Paste/Cut/Scissor/All/Trash) that this plan memoizes
provides:
  - useComputed-stabilized availability computeds in useRotoTimelineActions with a signal-backed classifier input surface
  - a memo-wrapped PhysicsPaintRotoActionRow fed by ReadonlySignal props with narrow per-button subscribers
  - identity-stable action-row handler props via the deferred-ref pattern
  - a Studio-owned currentFrameSignal written via guarded echo in the three startFrame callers
affects: [physics-paint, roto, workflow-strip, performance]

# Actuals (#2632) — pairs with the plan's `estimate` (45000 tokens) to calibrate future estimates.
actuals:
  tokens: 56000    # chars/4 over the realized diff (223757 chars / 4)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useComputed-stabilized availability computeds (identity-stable across renders, re-evaluate on tracked deps)"
    - "signal-backed classifier input surface (every classifier port reads a signal or a deferred ref)"
    - "memo-wrapped narrow-subscriber component fed by ReadonlySignal props (PhysicsPaintHistoryActionButton pattern)"
    - "deferred-ref handler stabilization (groupLifecycleDeleteExecuteRef precedent)"
    - "guarded-echo signal mirror writes (Rule 6 sanctioned: if (sig.peek() !== next) sig.value = next)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts

key-decisions:
  - "Stable mirror signals (field-wise guarded echo) for rotoSession.actionAvailability and rotoSession.copiedKey — the session signals are re-created every render, so the mirrors keep the action-row's signal props reference-stable between key boundaries"
  - "The action-row body reads sessionAvailability.value and re-derives availability; frame-dependent parts are narrow subscribers (PhysicsPaintRotoKeyIdentity, PhysicsPaintRailCreateButton) so the row body never subscribes to currentFrameSignal"
  - "getRotoKeyUtilityDisabledMessage uses currentFrameSignal.peek() for the generated-frame message — the frame number can be stale mid-scrub through a generated region, which is invisible (the message only shows while the row is already disabled)"
  - "onSelectAllRotoKeys routes through the deferred-ref too — its useCallback deps include render-scoped currentFrame/launchContext, so it re-creates every render"
  - "onCreatePlayScriptRail/onCreateRevealRail become stable useCallbacks writing the stable scriptPickerIntent signal"

patterns-established:
  - "Memo-wrapped action-row with narrow per-button signal subscribers: the row body reads availability signals, frame-dependent children subscribe to currentFrameSignal"
  - "Deferred-ref handler props: actionRowHandlersRef re-pointed each render, stable useCallbacks read the current implementation at call time"

requirements-completed: [G-52-9]

coverage:
  - id: D1
    description: "Availability computeds stabilized with useComputed and every classifier input port signal-backed or deferred-ref, so availability stays live after scrub release"
    requirement: G-52-9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#re-evaluation test + source-scan contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "Action-row extracted into a memo-wrapped PhysicsPaintRotoActionRow fed by ReadonlySignal props with narrow per-button subscribers; strip's internal currentFrame mirror removed"
    requirement: G-52-9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#action-row contract tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Frame-dependent action-row handler props identity-stable via deferred-ref; onCreatePlayScriptRail/onCreateRevealRail stable useCallbacks"
    requirement: G-52-9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#AM-3 source-scan contract"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: scrub through dense reveal rails — the action-row buttons no longer visibly refresh every frame; after release, +Key/Delete/Scissor/Paste land exactly on the released frame with the correct enabled/disabled state and tooltip"
    requirement: G-52-9
    verification: []
    human_judgment: true
    rationale: "Visual per-frame refresh and post-release availability correctness can only be judged on the live app by the user; automated tests prove identity stability and live signal reads but cannot observe the rendered scrub."

# Metrics
duration: 35min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-ibd Plan 260905-ibd: Stop per-frame WorkflowStrip action-row re-renders during scrub (G-52-9)

**useComputed-stabilized availability computeds, a signal-backed classifier input surface, a memo-wrapped PhysicsPaintRotoActionRow with narrow per-button subscribers, and deferred-ref-stabilized action-row handler props — the action-row no longer re-renders every scrub frame while availability stays live**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-05T13:40:00Z (approx, first task commit 13:48)
- **Completed:** 2026-09-05T14:17:56Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Converted the ~26 plain `computed()` availability computeds in useRotoTimelineActions to `useComputed` and signal-backed every classifier input port (six mirrors + three selection signals + currentFrameSignal + deferred-ref launchContext), so the computeds are identity-stable across renders yet re-evaluate on tracked deps — availability stays LIVE after scrub release.
- Extracted the `physics-paint-roto-action-row` div into a memo-wrapped `PhysicsPaintRotoActionRow` (same file) fed by ReadonlySignal props with narrow per-button subscribers; the strip's internal currentFrame mirror is replaced by the Studio-owned `currentFrameSignal` prop.
- Stabilized the frame-dependent action-row handler props via the deferred-ref pattern (`actionRowHandlersRef`), converted `onCreatePlayScriptRail`/`onCreateRevealRail` to stable useCallbacks, and routed `onSelectAllRotoKeys` through the deferred-ref (its deps include render-scoped values).
- Full suite green (3461 passed) and `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stabilize availability computeds (useComputed) + signal-back every classifier input port + memoize the hook input** - `59c3cbd1` (perf)
2. **Task 2: Extract the action-row into a memo-wrapped narrow-subscriber component fed by ReadonlySignal props** - `1f96e1b3` (perf)
3. **Task 3: Stabilize the frame-dependent action-row handler props via deferred-ref + final wiring + full-suite verification** - `b9a39a99` (perf)

**Plan metadata:** docs commit handled by the orchestrator (not committed by the executor).

## Files Created/Modified
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - useComputed availability computeds, effectiveInput override, signal-backed classifier ports, memoized input
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Studio-owned currentFrameSignal + stable mirror signals, memoized hook input, deferred-ref action-row handlers, stable rail-creation useCallbacks
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - memo-wrapped PhysicsPaintRotoActionRow + PhysicsPaintRotoKeyIdentity + PhysicsPaintRailCreateButton narrow subscribers, currentFrameSignal prop
- `app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts` - added `render.rotoActionRow` counter
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - updated harness + re-evaluation test + source-scan contract
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - updated source-scan assertions + action-row contract tests
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx` - idempotent walk via per-vnode render cache
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - AM-3 source-scan contract updated to the stable useCallback form
- `app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts` - registry updated with `render.rotoActionRow`

## Decisions Made
- **Stable mirror signals for session availability:** `rotoSession.actionAvailability` and `rotoSession.copiedKey` are re-created every render (useRotoKeyUtilities' session useMemo deps are unstable). Field-wise guarded-echo mirrors in the Studio keep the action-row's signal props reference-stable between key boundaries.
- **Narrow subscribers for frame-dependent parts:** the action-row body reads `sessionAvailability.value` and re-derives availability; the key identity div and + Rail button subscribe to `currentFrameSignal` in their own narrow components, so the row body never re-renders per scrub frame.
- **peek() for the generated-frame message:** `getRotoKeyUtilityDisabledMessage` reads `currentFrameSignal.peek()` to avoid subscribing the whole row; the frame number can be stale mid-scrub through a generated region, which is invisible (the message only shows while the row is already disabled).
- **onSelectAllRotoKeys routed through the deferred-ref:** its useCallback deps include render-scoped `currentFrame`/`launchContext`, so it re-creates every render — the plan's step 3 "route through the deferred-ref only if any still re-creates" applied.
- **RailCreate test harness walk made idempotent:** the cursor-persistent `useSignal` mock advanced slots on every `findOne`/`findAll` walk, so a child-owned menu signal was re-created at a fresh slot on the second walk. A per-vnode render cache makes the walk idempotent within a render (matching real Preact's once-per-pass behavior).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Stable mirror signals for session availability**
- **Found during:** Task 2 (action-row extraction)
- **Issue:** `rotoSession.actionAvailability` and `rotoSession.copiedKey` are NEW signals every render (useRotoKeyUtilities' session useMemo deps include unstable values), so passing the raw signals to the memo-wrapped action-row would re-render it every frame — defeating the extraction.
- **Fix:** Added field-wise guarded-echo mirror signals in the Studio (`sessionAvailabilitySignal`, `hasCopiedRotoKeySignal`) that only write when a field changes (at key boundaries), keeping the action-row's signal props reference-stable.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Verification:** Full suite green; action-row contract tests pass.
- **Committed in:** 1f96e1b3 (Task 2 commit)

**2. [Rule 1 - Bug] RailCreate test harness walk advanced hook slots**
- **Found during:** Task 2 (full-suite verification)
- **Issue:** The `PhysicsPaintWorkflowStripRailCreate.test.tsx` harness's cursor-persistent `useSignal` mock advanced the cursor on every `findOne`/`findAll` walk. With the menu-open signal now owned by the child `PhysicsPaintRailCreateButton` (invoked during the walk), the second walk re-created the signal at a fresh slot, so the menu never appeared open.
- **Fix:** Made the harness walk idempotent with a per-vnode render cache (`hooks.renderedCache` WeakMap) — a component renders once per pass, matching real Preact.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx
- **Verification:** All 7 RailCreate tests pass.
- **Committed in:** 1f96e1b3 (Task 2 commit)

**3. [Rule 1 - Bug] Performance trace registry test missing the new counter**
- **Found during:** Task 2 (full-suite verification)
- **Issue:** Adding `render.rotoActionRow` to the counter registry broke the hardcoded `EXPECTED_COUNTER_NAMES` in `physicsPaintPerformanceTrace.test.ts` (6 failures).
- **Fix:** Added `render.rotoActionRow` to the test's expected registry in the same alphabetical position as the source.
- **Files modified:** app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts
- **Verification:** Full suite green.
- **Committed in:** 1f96e1b3 (Task 2 commit)

**4. [Rule 1 - Bug] AM-3 source-scan contract pinned the inline arrow form**
- **Found during:** Task 3 (full-suite verification)
- **Issue:** Converting `onCreatePlayScriptRail`/`onCreateRevealRail` to stable useCallbacks broke the `PhysicsPaintStudio.test.ts` source-scan contract that asserted the old inline arrow text.
- **Fix:** Updated the contract to assert the stable useCallback form (same unconditional intent write).
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** All 134 Studio tests pass.
- **Committed in:** b9a39a99 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 missing critical, 3 bugs)
**Impact on plan:** All auto-fixes were necessary for the extraction to actually stop re-renders (mirror signals), to keep the test suite green (registry + source-scan contracts), and to keep the RailCreate harness faithful to real Preact behavior. No scope creep.

## Issues Encountered
- The session signals (`rotoSession.actionAvailability`, `rotoSession.copiedKey`) are not identity-stable across renders — this is the root reason the raw signals could not be passed directly to the memo-wrapped action-row and required stable mirrors.
- The RailCreate test harness's cursor-persistent mock is a simplified simulation of Preact hook stability; it only worked when the menu state lived in the root component. The per-vnode render cache restores fidelity for child-owned state.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The action-row is memo-wrapped with identity-stable props; the rails grid, RotoTimelineCellButton, drag mechanics, and playback pill are untouched.
- Native UAT (user drives): scrub through dense reveal rails — the action-row buttons should no longer visibly refresh every frame; after release, +Key/Delete/Scissor/Paste must land exactly on the released frame with the correct enabled/disabled state and tooltip.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/260905-ibd-perf-stop-per-frame-workflowstrip-action/260905-ibd-SUMMARY.md`
- Commits verified: `59c3cbd1` (Task 1), `1f96e1b3` (Task 2), `b9a39a99` (Task 3)

---
*Phase: quick-260905-ibd*
*Completed: 2026-09-05*
