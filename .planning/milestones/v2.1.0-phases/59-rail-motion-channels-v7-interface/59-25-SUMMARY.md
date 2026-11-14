---
phase: 59-rail-motion-channels-v7-interface
plan: 25
subsystem: ui
tags:
  - rail-motion
  - grouped-position
  - motion-lane
  - wiggle-seed
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-02
    provides: the set-key reducer and its D-12 paired-axis seeding rule
  - phase: 59-23
    provides: the always-visible authority-gated add-channel row and the lane-count-only height on the same view file
provides:
  - "`applyAxisMotionKeyEdits` — one module-private fan-out helper behind both easing and Wiggle, primary-axis-first with a per-axis re-resolve"
  - "Grouped Position easing/Wiggle reach for BOTH `position-x` and `position-y` from the single display lane, each axis keeping its own value and its own other property"
  - "A seeded paired key: a keyless sibling is created at the edit frame by the reducer's D-12 rule from that axis's own stepped value, then carries the requested property"
  - "Every rendered motion-lane curve is built with the lane's own `{ railId }` wiggle seed"
affects:
  - Phase 59 verification of WR-03 and WR-04
  - Any future motion command that fans a display lane over multiple model channels

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized app/ diff)
actuals:
  tokens: 2644
  tasks: 2
  commits: 4
plan_head_before: 092173df189316380ec7e028134f62a7c29b9306
plan_head_after: 043b07b38326e4127e8c0b5774610175360f3967

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Display-lane fan-out: the command layer owns the grouping rule; the submitted axis gates the command, is edited first, and each remaining axis is re-resolved from the previous edit"
    - "Property-only edits never pass `pairedValue`, so a paired axis can never overwrite its sibling's stored value"
    - "One curve seed identity: the lane's `railId` prop feeds both `data-motion-rail-id` and the evaluator probe"

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-25-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-25-task2.json
  modified:
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts

key-decisions:
  - "The shared fan-out helper takes the resolved channel-id list from each setter instead of calling `resolveMotionCommandChannelIds` itself: both setters keep the single grouping rule visible at their own call site (and the plan's grep contract), while the helper owns the primary-first ordering."
  - "The RED assertions compare joined strings and numeric fields rather than deep object diffs: `tap-flat` breaks on multi-line YAML failure payloads (same constraint 59-24 recorded), so every RED failure message stays single-line."
  - "The Task-2 divergence row first proves the fixture's rail-seeded and preview-seeded paths differ, then asserts the rendered path against both — a seed-independent fixture can no longer pass the row vacuously."

patterns-established:
  - "Fan-out command: gate on the addressed axis, edit it first, re-resolve every follower from the records the previous edit produced."
  - "Seed-divergence guard: a wiggle pin asserts the two seeds actually differ before asserting which one the render used."

requirements-completed: [MOTN-03]

coverage:
  - id: D1
    description: "Grouped Position easing and Wiggle edit BOTH `position-x` and `position-y` in one command, each axis keeping its own value; a keyless paired axis is seeded at the frame from its own stepped value and then receives the property"
    requirement: "MOTN-03"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-12 rail motion commands — Motion keys (fan-out, position-y-addressed, Wiggle fan-out, seeded paired key, missing-key refusal, single-channel rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every rendered motion-lane curve is seeded with the lane's own `railId`, so a wiggle-bearing lane draws exactly the transform the compositor applies"
    requirement: "MOTN-03"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelLane > seeds a wiggle-bearing curve with the lane railId, never the preview seed (WR-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-11-07
status: complete
---

# Phase 59 Plan 25: Grouped Position fan-out and rail-seeded lane curves Summary

**Grouped Position easing/Wiggle now edit both axes from the single display lane, and every motion-lane curve samples the exact wiggle seed the compositor applies to its rail.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-07T10:18:00Z
- **Completed:** 2026-11-07T10:30:00Z
- **Tasks:** 2
- **Files modified:** 4 app files + 2 RED evidence records

## Accomplishments
- WR-04 closed: `setMotionKeyEasing` and `setMotionKeyWiggle` fan out over `resolveMotionCommandChannelIds`, so `position-y` easing and Wiggle are reachable from the grouped lane. The addressed axis gates the command and is edited first; each axis is edited with its own resolved value and never with a `pairedValue`.
- A keyless paired axis is created at the edit frame by the reducer's D-12 rule from that axis's own held step value (never an interpolation, never its sibling's value), and the follow-up edit then applies the requested property to that seeded key.
- WR-03 closed: the lane passes its own `railId` into `buildRailMotionCurvePath`, so the drawn curve and the applied transform share one deterministic wiggle seed.
- A divergence guard proves the two seeds actually differ before the row asserts which one the render used.
- Full suite green: 395 files / 7,894 tests passed (+7 rows), 1 skipped, 96 todo. `tsc --noEmit` clean.

## Task Commits

Each TDD task was committed as RED then GREEN:

1. **Task 1: Easing and Wiggle fan out across the grouped Position pair**
   - `53309ca47` (test) — pin the fan-out, the D-12 seeded paired key and the missing-key refusal (RED)
   - `023721a35` (feat) — per-axis fan-out helper behind both setters (GREEN)
2. **Task 2: The lane curve is seeded with the rail's own id**
   - `2bf205af6` (test) — rail-seeded parity row plus the wiggle divergence row (RED)
   - `043b07b38` (feat) — `buildRailMotionCurvePath(channel, frameCount, laneHeight, { railId })` (GREEN)

**Plan metadata:** see the final `docs(59-25)` commit.

_Note: TDD tasks have two commits each (test → feat). RED evidence records are committed as `red-evidence-59-25-task{1,2}.json` next to the phase artifacts._

## Files Created/Modified
- `app/src/components/physic-paint/roto/railMotionCommands.ts` — `applyAxisMotionKeyEdits` plus the two rewritten setters.
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` — six new rows: both-axis easing from each axis, both-axis Wiggle, the seeded keyless pair, the missing-key refusal and the single-channel pin.
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — the curve call now passes `{ railId }`.
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — parity row builds with `{ railId: 'rail-a' }`; new wiggle divergence row.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-25-task{1,2}.json` — machine-validated RED records (TAP).

## Decisions Made
- The fan-out helper receives the resolved channel-id list from each setter instead of calling `resolveMotionCommandChannelIds` itself; the grouping rule stays visible at both setter call sites and the plan's grep contract (definition + both setters) holds.
- RED assertions use joined-string and scalar comparisons, not deep object diffs, because `tap-flat` cannot parse multi-line YAML failure payloads (same constraint recorded by 59-24).
- The Task-2 row asserts seed divergence before asserting which seed the render used, so a wiggle-free fixture cannot pass vacuously.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The first RED run used `pnpm --filter … exec`, whose recursive error banner leaks non-TAP lines into stdout and made the evidence classifier report `INVALID_RED (invalid_record)`. Rerunning the same test from `app/` with `pnpm exec` produced a clean TAP report; the record names the real command and validates `RED_EVIDENCE_OK`. No report was edited.

## Known Stubs
None.

## Threat Flags
None — no new network, auth, file-access or schema surface; the fan-out and curve seed stay inside existing model and component boundaries (T-59-66 and T-59-67 mitigations are pinned by the added tests).

## Next Phase Readiness
- WR-03 and WR-04 are closed at their true owners (command layer and lane curve call); phase 59 has no remaining file overlap with this plan.
- No blockers.

## Self-Check: PASSED

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-07*
