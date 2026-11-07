---
phase: 59-rail-motion-channels-v7-interface
plan: 23
subsystem: ui
tags:
  - preact
  - preact-signals
  - motion-channels
  - gap-closure
  - add-channel
  - availability-authority
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-02
    provides: applyRailMotionEditToCollection add-channel reducer
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-10
    provides: resolveVisibleMotionDisplayLanes display projection
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-11
    provides: TimelineMotionBlock host and the measured resolveTrackRowLayout
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-12
    provides: resolveMotionCommandAvailability — the one availability authority (T-59-35)
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-17
    provides: TimelineMotionAddChannelRow, the keyless menu and the addChannelRow layout term
provides:
  - "TimelineMotionAddChannelRow disabled/reason props with verbatim title/aria-description, not-allowed cursor and forced-false aria-expanded"
  - "TimelineMotionBlock resolving add-motion-channel availability once and rendering the + row on every expanded block"
  - "Overlay gated on the authority's enabled, so a stale session identity cannot open a disabled menu"
  - "activeMotionAddChannelRow = activeMotionLaneCount > 0 — the strip's second keyless derivation is deleted"
  - "Outline parity: addChannelRow is true exactly when the block renders the row (fully-keyed four-lane outline = 123px)"
affects:
  - 59 phase verification and live UAT
  - 59-25 (edits TimelineMotionChannels.tsx and its test again)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized app/src diff)
actuals:
  tokens: 6294
  tasks: 2
  commits: 4
plan_head_before: 1cc813f059b5d0734a29e95eaaf3d27eb2786c96
plan_head_after: 3994b6d04e1fd91d30e622d81a8cce0b9545fb4d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - One availability authority — the view renders disabled/reason verbatim and never derives a local gate
    - A rendering affordance that never disappears: disabled-with-reason replaces silently absent (MUI-06)
    - Layout height derived from the SAME predicate that renders the row (lane count alone)
    - Outline flag tracks the rendered row, not a second inventory projection

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/timelineRailDesign.ts

key-decisions:
  - "The block resolves add-motion-channel availability exactly once per render and passes disabled/reason straight to the row; the view contains no copy of an authority reason string (grep-pinned)."
  - "A disabled row has NO click handler (onClick undefined), not a guarded no-op, and aria-expanded is forced false so an open session identity cannot leak into the accessibility tree."
  - "The overlay gate is the authority's enabled AND the session flag, so a stale railMotionChannelMenuRailId value cannot render an empty menu over a fully-keyed rail."
  - "The strip's add-row flag reduces to the lane count alone; the keyless projection survives only inside the block as the authority input, which is the single derivation the plan wanted."
  - "The block outline passes addChannelRow unconditionally: the block's early return already guarantees lanes exist, so the outline wraps the row it renders in every expanded state."

patterns-established:
  - "Disabled-with-reason affordance: an add row that stays visible on every expanded motion rail and reports the authority's sentence verbatim."
  - "Render/measure/outline parity: one lane-count predicate feeds the rendered row, the measured strip height and the outline."

requirements-completed:
  - MOTN-04
  - MUI-06

coverage:
  - id: D1
    description: "The + row renders on every expanded motion rail and keeps the 59-17 behaviour on a keyless rail: click toggles the session identity, aria-expanded mirrors the open state, and the menu lists exactly the keyless display lanes in fixed order."
    requirement: MOTN-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionAddChannelRow"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#59-17 add-channel row and keyless menu (G1/CR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fully-keyed rail shows the row DISABLED with resolveMotionCommandAvailability's reason verbatim, no click handler, not-allowed cursor and aria-expanded false; a stale session identity opens no overlay."
    requirement: MUI-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#59-17 add-channel row and keyless menu (G1/CR-03)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionAddChannelRow"
        status: pass
    human_judgment: false
  - id: D3
    description: "The measured strip layout adds the 18px row from the lane count alone (heightOf(4, true) = 123), and the block outline wraps exactly what the block renders, so a fully-keyed four-lane block measures 123px in both."
    requirement: MOTN-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#59-17: resolveTrackRowLayout — the 18px add-channel row joins the one measured layout"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#59-11 rail motion hosting — chevron, session expansion and the expanded block"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-07
status: complete
---

# Phase 59 Plan 23: Always-Visible, Authority-Gated Add-Channel Row Summary

**The Motion `+` row never disappears: it renders on every expanded rail, is disabled with the availability authority's reason verbatim when every display lane is keyed, cannot open a menu, and the strip measures its 18px from the lane count alone while the outline wraps it.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-07T10:10:16Z
- **Completed:** 2026-11-07T10:15:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- WR-01 closed: the `add-motion-channel` availability branch and `hasKeylessChannel` input are live production code, consumed once per block render.
- `TimelineMotionAddChannelRow` gained `disabled`/`reason`; a disabled row carries the reason on `title` and `aria-description`, uses `not-allowed`/opacity 0.4, has no click handler and forces `aria-expanded` false.
- The block's `+` row renders unconditionally; the overlay is gated on the authority's `enabled` plus the session identity, so a stale open-menu value renders nothing.
- The block outline passes `addChannelRow` for the row it always renders; the fully-keyed four-lane outline is 123px and is pinned equal to the measured row height.
- The strip's `activeMotionAddChannelRow` is `activeMotionLaneCount > 0`; `activeMotionHasKeylessChannel` and the `resolveKeylessMotionDisplayLanes` import are gone.
- Layout pins now cover lane counts 1-4: every additive case is exactly one lane height taller and `heightOf(4, true)` is 123.

## Task Commits

Each task was committed atomically (RED then GREEN per task):

1. **Task 1: The `+` row renders always and is gated by the one availability authority**
   - `36b7f609c` (test) — RED: fully-keyed disabled row, stale session identity, row unit props, 123px four-lane pin
   - `050dbcced` (feat) — GREEN: row props + authority-gated block + outline parity
2. **Task 2: The strip measures the add row from the lane count alone**
   - `427ee1c7c` (test) — RED: lane-count-only source contract + lane counts 1-4 layout pins
   - `3994b6d04` (feat) — GREEN: flag reduced, keyless derivation and import deleted

_Note: TDD tasks have two commits each (test → feat). RED evidence records for both tasks are committed next to the XML reports they embed._

## Files Created/Modified

- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — `TimelineMotionAddChannelRowProps.disabled`/`reason`; disabled rendering contract.
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — enabled/disabled row rows.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — one `resolveMotionCommandAvailability` call, unconditional row, gated overlay, outline parity.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — fully-keyed disabled row, stale session row, keyless enabled row, source contract, 123px pin.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — lane-count-only add-row flag; keyless import removed; stale docs retired.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — lane counts 1-4 pins, four-lane +18 row, source contract.
- `app/src/components/physic-paint/view/timelineRailDesign.ts` — `addChannelRow` doc states the render rule.

## Decisions Made

- The row's disabled state is the authority's answer only — `disabled: !addChannelAvailability.enabled`, `reason: addChannelAvailability.reason`; no local condition and no copied reason string.
- `onClick` is omitted entirely when disabled, and `aria-expanded` is `open && !disabled`, so both the pointer path and the accessibility path fail closed.
- The overlay condition reuses the same computed `addChannelRowOpen` for the row's `open` prop and the overlay render, keeping the row and the menu on one predicate.
- The strip keeps `resolveTrackRowLayout` unchanged; only the flag that feeds it changed, so the layout function's own pins stay byte-identical.

## Deviations from Plan

None - the plan's files, sequencing and contracts were executed as written. Two doc comments outside the plan's explicit lines were retired because they still claimed the keyless condition (`TimelineMotionBlock`'s header and `TrackRowLayoutInput.addChannelRow`); both are comment-only and keep the view from re-asserting the deleted rule.

## Issues Encountered

- The plan's Task 2 RED note predicted `heightOf(4, true)` was 105 before the fix. In practice `resolveTrackRowLayout` already honors its `addChannelRow` input, and the shipped test helper calls it directly, so the layout pins were green before implementation. The genuine RED for Task 2 was therefore the strip source contract (the second keyless derivation), which is exactly the WR-01 defect at the strip level; `RED_EVIDENCE_OK` was recorded against that test. The layout pins remain valuable as the new derivation's height oracle.

## TDD Gate Compliance

Both tasks carry `tdd="true"` and are behavior-adding. RED was committed before each implementation and validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, JUnit format, zero report errors):

- Task 1 — `red-evidence-59-23-task1.json`: 77 tests collected, 7 fail, all intended pre-implementation pins; the named target failed on `expect(rows).toHaveLength(1)` (zero add rows on a fully-keyed rail).
- Task 2 — `red-evidence-59-23-task2.json`: 184 tests collected, 1 fail, the strip source contract (the source still imported `resolveKeylessMotionDisplayLanes`).

No GREEN commit precedes its RED commit.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — 3 files, 261 tests passed.
- `pnpm --filter efx-motion-editor run typecheck` — clean.
- `grep` contracts: authority call present once; `addChannelRow={hasKeylessChannel}` 0; "while a keyless display lane remains" 0; strip `resolveKeylessMotionDisplayLanes` 0; `activeMotionHasKeylessChannel` 0; the lane-count-only assignment appears once; the authority reason is absent from both view files.

## Known Stubs

None.

## Threat Surface Scan

No new surface beyond the plan's `<threat_model>`. T-59-61 (authority bypass) and T-59-62 (layout/render drift) are mitigated exactly as planned and pinned by the tests above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 59-25 can rely on the current `TimelineMotionAddChannelRow` contract (`disabled`/`reason`) and on the row rendering on every expanded block.
- The disabled affordance and the four-lane 123px parity are render-pinned; live visual UAT of the disabled row remains part of phase 59 verification.

## Self-Check: PASSED

- All 7 plan files present on disk.
- Commits `36b7f609c`, `050dbcced`, `427ee1c7c`, `3994b6d04` are ancestors of HEAD.
- Both RED evidence records and their JUnit reports present; both validated `RED_EVIDENCE_OK`.
