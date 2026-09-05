---
phase: quick-260905-d1w
plan: 260905-d1w
subsystem: ui
tags: [preact, signals, physics-paint, workflow-strip, action-row, rail-create, solo, guarded-actions]

# Dependency graph
requires: []
provides:
  - Reordered + gated Physics Paint workflow-strip action row (+ Key, + Rail, Push, Insert, Duplicate, Copy, Cut, Scissor, Paste, All, Trash)
  - + Rail gated by the SAME availability law as + Key (canAddRotoKey + ready + busy-state guard)
  - Solo relocated into the playback pill as an icon-only nav-button with the pill .active armed treatment
affects: [Phase 53 Integrated v1.0.0 Acceptance, native UAT of the workflow strip]

# Actuals (#2632) — pairs with the plan's `estimate` (30000 tokens) to calibrate future estimates.
actuals:
  tokens: 8817    # chars/4 over the realized diff (35269 chars)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded-action availability law reuse: + Rail mirrors + Key verbatim (canAddRotoKey/addRotoKeyDisabledReason ports), never re-derives the reason"
    - "Pill .active armed treatment for a relocated nav-button (one armed visual, no new color literals)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx

key-decisions:
  - "The playback pill lives in the memoized PhysicsPaintWorkflowStaticChromeImpl component, so the relocated Solo state (soloArmed, soloArmedClass, soloToolDisabled, soloToolDisabledReason) flows in as props and the static chrome owns the solo tooltip hook"
  - "soloArmedClass becomes the pill .active convention (' active') — the physics-paint-push-tool-armed compound selector requires the push-tool-button base class, which a nav-button does not carry"
  - "The relocated Solo onClick calls disarmPushTool() first, unconditionally, preserving the D-20 toolbar disarm the action-row capture guard previously provided"

patterns-established:
  - "A relocated guarded action keeps its availability law and disarm semantics even when it moves across component boundaries (state flows as props, tooltip hook moves with the surface)"

requirements-completed: [ACC-01]

coverage:
  - id: D1
    description: "Action row reordered as + Key, + Rail (gated), Push, Insert, Duplicate, Copy, Cut, Scissor, Paste, All, Trash; the Solo group is gone from the row"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#orders the action row as Key, Create rail, Push, Insert, Duplicate, Copy, Cut, Scissor, Paste, All, Trash (260905-d1w)"
        status: pass
    human_judgment: false
  - id: D2
    description: "+ Rail gated by the SAME availability law as + Key (aria-disabled, aria-describedby roto-key-action-reason-rail-create, guarded onClick before the menu toggle, Enter/Space block, guarded tooltip, menu never opens while disabled)"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#gates + Rail with the same availability law as + Key (260905-d1w)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx#does not open the rail-kind menu while + Rail is aria-disabled (260905-d1w)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Solo relocated into the playback pill as an icon-only nav-button immediately after the Loop toggle, with aria-pressed, the guarded styled tooltip, soloToolDisabled/Reason gating, the pill .active armed treatment, and an explicit disarmPushTool() in the onClick"
    requirement: ACC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#relocates Solo into the playback pill as an icon-only nav-button (260905-d1w)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#the relocated Solo button block carries the pill nav-button classes and the .active armed class, and soloArmedClass uses the pill .active convention"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase quick-260905-d1w: Workflow Strip Action-Row Layout + Rail Gating Summary

**Reordered the Physics Paint workflow-strip action row so + Rail sits immediately after + Key gated by the SAME availability law (canAddRotoKey + ready + busy-state guard), Push sits immediately after + Rail, and Solo relocates into the playback pill as an icon-only nav-button with the pill .active armed treatment and the D-20 Push disarm preserved.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T09:27:00Z
- **Completed:** 2026-09-05T09:33:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- + Rail now mirrors + Key's availability law exactly: aria-disabled, aria-describedby `roto-key-action-reason-rail-create`, guarded onClick (the Motion/Static/Reveal menu never opens while disabled), Enter/Space preventDefault, sr-only reason span, and the guarded tooltip idiom `buildGuardedActionTooltipCopy('Create rail', addRotoKeyDisabledReason)`.
- Action row reordered to + Key, + Rail, Push, Insert, Duplicate, Copy, Cut, Scissor, Paste, All, Trash; the Solo group is gone from the row.
- Solo relocated into the playback pill immediately after the Loop toggle as an icon-only nav-button (`physics-paint-nav-button physics-paint-roto-solo-toggle`), with aria-pressed, the guarded styled tooltip (same armed/disarmed copy), soloToolDisabled/Reason gating, and the pill .active armed treatment (no new color literals).
- The relocated Solo onClick calls `disarmPushTool()` first, unconditionally — the D-20 toolbar disarm the action-row capture guard previously provided is preserved explicitly.
- Full app suite green (3433 passed) and `tsc --noEmit` clean (ACC-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder the action row — + Rail (gated) after + Key, Push after + Rail** - `b607dcbd` (feat)
2. **Task 2: Relocate Solo into the playback pill as an icon-only nav-button + CSS** - `00bdf2c9` (feat)
3. **Task 3: Add new tests — action-row order, + Rail gating, menu-not-open-when-disabled, Solo-in-pill** - `2141bc40` (test)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Reordered + gated action row (+ Rail after + Key, Push after + Rail), relocated Solo into the playback pill, solo state flows as props to the static chrome, `soloArmedClass` uses the pill .active convention.
- `app/src/components/physic-paint/physicsPaintStudio.css` - `.physics-paint-roto-solo-toggle.active` joins the loop-toggle active rule; `.physics-paint-roto-solo-toggle[aria-disabled="true"]` dims like the nav-button :disabled treatment.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Updated Solo armed-tint source contract test + new action-row order, + Rail gating, and Solo-in-pill source-contract tests.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx` - Live-render harness now passes a complete `rotoPhysicalActions` bundle (canAddEmptyKey signal(true)); new menu-not-open-when-disabled test.

## Decisions Made
- The playback pill lives in the memoized `PhysicsPaintWorkflowStaticChromeImpl` component, not the main strip component where the solo state was defined. The relocated Solo button therefore receives `soloArmed`, `soloArmedClass`, `soloToolDisabled`, `soloToolDisabledReason` as props, and the static chrome owns the `soloTooltip` hook (the main component's now-unused `soloTooltip` was removed).
- `soloArmedClass` uses the pill .active convention (`' active'`) because the `physics-paint-push-tool-armed` compound selector requires the `physics-paint-push-tool-button` base class, which a nav-button does not carry — one armed visual, no new color literals.
- The relocated Solo onClick calls `disarmPushTool()` first, unconditionally, preserving the D-20 toolbar disarm the action-row capture guard previously provided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Solo state must flow as props into the memoized static-chrome component**
- **Found during:** Task 2 (Relocate Solo into the playback pill)
- **Issue:** The plan's literal instruction inserted the Solo button into the playback pill (L1045-1071), but that pill lives in the memoized `PhysicsPaintWorkflowStaticChromeImpl` component — a separate component from the main `PhysicsPaintWorkflowStrip` where `soloArmed`/`soloToolDisabled`/`soloTooltip`/`soloArmedClass` are defined. Inserting the button there referencing those locals does not compile (TS2304).
- **Fix:** Added `soloArmed`, `soloArmedClass`, `soloToolDisabled`, `soloToolDisabledReason` props to `PhysicsPaintWorkflowStaticChromeProps`; created the `soloTooltip` hook in the static chrome; removed the now-unused `soloTooltip` from the main component; passed the solo props from the main component to the static chrome. The plan's intent (Solo in the playback pill, D-20 disarm preserved) is fully implemented.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- **Verification:** `tsc --noEmit` clean; full suite green.
- **Committed in:** 00bdf2c9 (Task 2 commit)

**2. [Rule 3 - Blocking] Test assertions adjusted for the prop-based Solo button**
- **Found during:** Task 2 / Task 3 (Solo armed-tint test + Solo-in-pill test)
- **Issue:** The plan's test assertions expected `${soloArmedClass}` and `aria-disabled={soloToolDisabled` inside the Solo button block, but the relocated button lives in the static chrome and reads the state from props (`${props.soloArmedClass}`, `aria-disabled={props.soloToolDisabled`).
- **Fix:** Updated the assertions to the prop-based forms; the source still contains `const soloArmedClass = soloArmed ? ' active' : '';` in the main component.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
- **Verification:** Strip test file green.
- **Committed in:** 00bdf2c9 (Task 2) and 2141bc40 (Task 3)

**3. [Rule 3 - Blocking] + Rail gating test targets the button's aria-label, not the group's**
- **Found during:** Task 3 (+ Rail gating source-contract test)
- **Issue:** The `getButtonBlock(row, 'Create rail')` helper resolves `aria-label="Create rail"` to the FIRST occurrence — the group div's `role="group" aria-label="Create rail"` — so `lastIndexOf('<button', ...)` sliced the + Key button instead of the + Rail button.
- **Fix:** The test now uses `row.lastIndexOf('aria-label="Create rail"')` (the button's aria-label is the last occurrence) and slices the button block directly; the guarded tooltip copy is asserted on the row because it lives in the wrapper span, a sibling of the button.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
- **Verification:** Strip test file green.
- **Committed in:** 2141bc40 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes were structural/test-assertion corrections required to implement the plan's intent across the memoized static-chrome component boundary. No scope creep; no behavior change beyond the plan's stated output.

## Issues Encountered
- The playback pill is a memoized child component, so the Solo relocation required prop plumbing rather than a same-component move (documented as deviation 1 above).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The workflow strip action row is reordered and + Rail is gated; Solo is in the playback pill. Ready for native UAT (user drives): + Rail sits immediately right of + Key and Push immediately right of + Rail; on a frame where + Key is greyed, + Rail is greyed too with an explanatory tooltip and the menu does not open; Solo appears icon-only beside Loop and arms/disarms exactly as before; Push drags and disarms exactly as before and clicking Solo still leaves push mode; Undo/redo, arrows, Space, and Delete shortcuts still work.

---
*Phase: quick-260905-d1w*
*Completed: 2026-09-05*

## Self-Check: PASSED
- SUMMARY.md exists at `.planning/quick/260905-d1w-workflow-strip-action-row-layout-rail-be/260905-d1w-SUMMARY.md`
- Commits verified: b607dcbd (Task 1), 00bdf2c9 (Task 2), 2141bc40 (Task 3)
