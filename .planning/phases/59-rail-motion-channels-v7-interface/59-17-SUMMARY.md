---
phase: 59-rail-motion-channels-v7-interface
plan: 17
subsystem: ui
tags:
  - preact
  - preact-signals
  - motion-channels
  - gap-closure
  - add-channel
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-02
    provides: applyRailMotionEditToCollection add-channel reducer with grouped Position seeding
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-07
    provides: replaceRotoPhysicalRailMotions single-undo store setter
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-10
    provides: resolveVisibleMotionDisplayLanes / resolveKeylessMotionDisplayLanes display projection
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-11
    provides: resolveTrackRowLayout measured lane layout and TimelineMotionBlock host
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-12
    provides: readActiveRailMotionState / commitMotionCommandResult motion command path
provides:
  - addMotionChannel — pure add-channel command with three exact refusal sentences
  - "'add-motion-channel' RailMotionCommandId row plus hasKeylessChannel availability input"
  - addMotionChannel bundle action committed through the one motion store setter
  - TimelineMotionAddChannelRow 18px add-channel row component
  - railMotionChannelMenuRailId session signal with exactly two named writers
  - "channelMenuZIndex overlay token and the addChannelRow term in the measured row layout"
affects:
  - 59 phase verification and live UAT
  - Any later surface that must make a keyless Motion channel reachable

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 17823
  tasks: 2
  commits: 3
plan_head_before: b4a7246638d27bbd4cb8632c446869736e4cd7a1
plan_head_after: 33ee036d7d5c693ea00850ed41571635de8c20f4

# Tech tracking
tech-stack:
  added: []
  patterns:
  - One command layer for every motion write — the add row and menu dispatch the same pure command the reducer owns
  - Absolute overlay menu keyed by one session signal so its open height never enters the measured layout
  - Additive layout term that swallows itself on a collapsed block, keeping the pre-59-17 heights byte-identical
  - Exactly-two-writer session signal, source-asserted from the row test

key-files:
  created: []
  modified:
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "The reducer stays the only seed authority: the command validates and delegates, so grouped Position always seeds both axes in one edit."
  - "Scale and Opacity seed at 1, not 100 — the document stores a factor and a fraction (1 = 100%); the plan's 100 was a display-unit reading of the same identity."
  - "The menu is session state in ONE module-scope signal with exactly two named writers (toggle, dismiss); the expansion toggle calls dismiss instead of assigning, so a third write site never appears."
  - "The menu paints in an absolute overlay inside the block's existing position:relative lane container with channelMenuZIndex 20 — above the rail chrome (7-9), below the playhead (30) — so its open height never reaches resolveTrackRowLayout."
  - "The 18px add row joins the one measured layout as an optional addChannelRow term that only applies inside an open block; the last add swaps the row for the new lane, net 0."
  - "The strip hosts addMotionChannel for the active lane and every non-active row, but only reads the menu signal — the row keeps its two writers."

patterns-established:
  - "Keyless-channel affordance: hasKeylessChannel gates the row, the menu and the outline term from one projection call, so the three can never disagree."
  - "Overlay height arithmetic is expressed in tokens (laneHeight, postBlockGap), never literals, and pinned by the rendered wrapper."

requirements-completed:
  - MOTN-03
  - MOTN-04
  - MUI-06

coverage:
  - id: D1
    description: "addMotionChannel seeds a missing channel (grouped Position pair included) through the 59-02 reducer and refuses duplicates, missing records and invalid rail ids with exact sentences"
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionCommands.test.ts#59-17 rail motion commands — add a Motion channel (G1)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#59-17 addMotionChannel — the host action behind the keyless menu"
        status: pass
    human_judgment: false
  - id: D2
    description: "The expanded block renders the 18px add-channel row and a fixed-order keyless menu as an absolute overlay; the measured layout grows by exactly one lane per add and stays byte-identical without the row"
    requirement: MOTN-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionAddChannelRow"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#59-17 add-channel row and keyless menu (G1/CR-03)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#59-17: resolveTrackRowLayout — the 18px add-channel row joins the one measured layout"
        status: pass
    human_judgment: false
  - id: D3
    description: "Availability row for add-motion-channel is wired through CONTEXTUAL_COMMANDS_BY_SCOPE-free command availability with the keyless guard and exact reasons"
    requirement: MUI-06
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionCommands.test.ts#59-17 rail motion commands — add-channel availability (MUI-06)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 17: Keyless Add-Channel Row Summary

**An 18px add-channel row, a session-owned absolute menu and a pure `addMotionChannel` command: Scale, Rotation and Opacity are now reachable through the same single motion commit door, and the measured layout grows by exactly one lane per add.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-11-06T20:18:00Z (approx.)
- **Completed:** 2026-11-06T20:47:35Z
- **Tasks:** 2
- **Files modified:** 11 (all plan-listed) plus the two RED evidence artifacts

## Accomplishments

- Added the pure `addMotionChannel` command beside `animateRail`: it validates a bounded `railId`, refuses a rail with no motion record, refuses any id already present on the record (including the grouped `position-x`/`position-y` pair), then dispatches the 59-02 `add-channel` reducer. A reducer no-op is mapped to the same "already present" reason so MUI-06 never produces a silent no-op.
- Extended the availability table with the `add-motion-channel` row and the `hasKeylessChannel` input, with the three exact refusal sentences pinned, and confirmed the command stays OUT of `CONTEXTUAL_COMMANDS_BY_SCOPE`.
- Added `addMotionChannel` to the action bundle as a declared `async` action returning `Promise<boolean>`, implemented through `readActiveRailMotionState` and the existing `commitMotionCommandResult` — no second commit path, no direct store read.
- Added the `TimelineMotionAddChannelRow` component (18px, `aria-expanded` mirroring `open`, one click intent) and threaded the outline's new `addChannelRow` term so the rounded outline wraps the extra row exactly when it renders.
- Introduced `railMotionChannelMenuRailId` as an exactly-two-writer session signal (`toggleRailMotionChannelMenu`, `dismissRailMotionChannelMenu`); `toggleRailMotionExpansion` now CALLS the dismiss writer on collapse and rail switch.
- Rendered the menu in an absolute overlay (`top = laneCount × laneHeight + postBlockGap + laneHeight`, `zIndex: channelMenuZIndex` = 20) inside the block's existing `position: relative` container, so no menu row displaces the following rows.
- Added the optional `addChannelRow` layout input/entry term; the strip derives it from the same keyless projection the block renders and feeds it only to the active row, leaving every pre-59-17 height untouched.

## Task Commits

Each task was committed atomically (TDD for Task 1: test → feat):

1. **Task 1 RED: failing add-motion-channel command pins** - `f9b852d3c` (test)
2. **Task 1 GREEN: implement the add-motion-channel command** - `3a3996a61` (feat)
3. **Task 2: keyless add-channel row and menu overlay** - `33ee036d7` (feat)

**Plan metadata:** committed after this SUMMARY (docs: complete keyless add-channel plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionCommands.ts` - `addMotionChannel` command, `'add-motion-channel'` id, `hasKeylessChannel` availability input
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` - command seeds/refusals and the availability row
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `addMotionChannel` bundle action on the one commit door
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - seeded-track commit, duplicate refusal, grouped Position, missing record, no rail
- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` - `TimelineMotionAddChannelRow` and the outline's `addChannelRow` prop
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` - add-row geometry/ARIA/intent, menu ordering, outline extra lane
- `app/src/components/physic-paint/view/timelineRailDesign.ts` - `channelMenuZIndex` token and the `addChannelRow` outline term
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` - session menu signal with two writers, block add row and absolute overlay
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` - rendered add row/overlay, two-writer source assertion, collapse/switch dismissal
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - `addChannelRow` layout term and the hosted `addMotionChannel` action
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - additive layout rows at every lane count and the strip read-only pin

## Decisions Made

- The reducer remains the only seed authority; the command validates first and delegates, so grouped Position cannot be half-seeded.
- Scale and Opacity seed at `value: 1` because the document stores a factor and a fraction (1 = 100%); the plan's `<behavior>` wrote 100, which is the same identity in display units.
- The menu identity is one session signal with exactly two named writers; the expansion toggle calls the dismiss writer so no third assignment exists.
- The overlay is a plain inline-styled `div` (no CSS class rule) inside the block's relative container, using only `TIMELINE_MOTION` tokens for its `top` arithmetic.
- `addChannelRow` is swallowed on a zero-lane block so a collapsed row can never reserve dead height.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scale and Opacity seed at 1, not 100**
- **Found during:** Task 1 RED (writing the command pins)
- **Issue:** The plan's `<behavior>` says the Scale seed key carries `value: 100` and Opacity `100`, but `railMotionIdentityValue` in `railMotionModel.ts` stores Scale as a FACTOR and Opacity as a FRACTION (1 = 100%). The plan also mandates that the reducer is the only seed authority.
- **Fix:** Asserted `value: 1` for both channels and documented the unit contract in the test comments; the reducer is untouched.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionCommands.test.ts`
- **Verification:** The Task 1 suite passes; the same value flows through the hook test's stored-record assertion.
- **Committed in:** `f9b852d3c`

**2. [Rule 3 - Blocking] The hook test seeds the track through `replaceRotoPhysicalRecords`, not `upsertRealRotoKeyFrame`**
- **Found during:** Task 2 (`useRotoTimelineActions` pins)
- **Issue:** The plan says `upsertRealRotoKeyFrame` satisfies the `_rotoRealKeyRecords` gate, but in this codebase that call writes the RUNTIME frame map; the gate is the records collection, which only `replaceRotoPhysicalRecords` creates.
- **Fix:** Seeded one real-key record through `replaceRotoPhysicalRecords` (which also yields the Key Rail segment `firstKeyId`) and kept the `upsertRealRotoKeyFrame` call afterwards with a valid rendered frame, mirroring the live records-then-runtime order.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
- **Verification:** All five new hook tests pass; typecheck exit 0.
- **Committed in:** `33ee036d7`

### Plan-level corrections (no behavior change)

- The plan's Task 2 verify command names `PhysicsPaintTrackRow.test.tsx.test.ts`; that file exists as a two-line launcher because vitest collects only `src/**/*.test.ts`, so the `.test.tsx` suite actually executes through it.
- The header column needed no change: `physicsPaintTrackHeaderColumn` renders its spacer at the layout entry height, so the extra add row leaves matching blank header space automatically.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) plus 2 documentation-level plan corrections
**Impact on plan:** Both auto-fixes were necessary for the pins to reflect the repository's real model units and store API; no scope change and no behavior beyond the plan's intent.

## Issues Encountered

- The first pass of the strip source pin asserted `not.toContain('railMotionChannelMenuRailId.value =')`, which also matches the equality read `.value ===`; the pin now uses `/…\.value\s*=(?!=)/`.
- The first hook-test pass assumed `upsertRealRotoKeyFrame` creates the real-key record map; the store returns no records, so the seed was split as described above.

## Known Stubs

None — the add row, the menu and the command are fully wired to the production action and the real store setter.

## Threat Flags

None — no new network, auth or file-access surface. The plan's T-59-52 (one command path, reducer-owned seeds), T-59-53 (two named writers for the session menu identity, expansion toggle dismissal, bounded overlay z-index that never enters the measured layout) and T-59-SC (no new dependency) mitigations are implemented and pinned by tests.

## Next Phase Readiness

- MOTN-03, MOTN-04 and MUI-06 are implemented and covered by 500 passing tests across the five plan test files; typecheck exits 0.
- The live UAT row for the add-channel affordance (click `+`, pick Scale, watch the lane render, check the overlay paints over the following rows) is still pending — it needs the user's Studio session, which this executor never runs.

## TDD Gate Compliance

- **Task 1 RED:** `f9b852d3c` — 76 tests, 68 pass, 8 fail; evidence `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-17-task1.json`, verdict `RED_EVIDENCE_OK`.
- **Task 1 GREEN:** `3a3996a61` — command, id and availability implemented; the full command suite passes.
- **Task 2:** `33ee036d7` — the plan declares Task 2 as `type="auto"` without `tdd="true"`, so its pins shipped in the same commit as the implementation.

## Self-Check: PASSED

All 11 modified files exist and all three task commits are ancestors of HEAD.
