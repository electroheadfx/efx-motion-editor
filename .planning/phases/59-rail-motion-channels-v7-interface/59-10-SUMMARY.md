---
phase: 59-rail-motion-channels-v7-interface
plan: 10
subsystem: ui
tags: [preact, props-only-component, motion-lanes, design-tokens, vnode-materialization, tdd, motn-04, mui-02, mui-03]

# Dependency graph
requires:
  - phase: 59-02
    provides: "PhysicPaintRotoRailMotionChannel/Key/ChannelId types and the fixed five-channel model order"
  - phase: 59-05
    provides: "buildRailMotionCurvePath — the single evaluator-authored lane path string"
  - phase: 59-06
    provides: "RailMotionRailView and durable rail identity; this plan consumes railId as an opaque prop"
provides:
  - "RailMotionDisplayLaneId + the frozen four-lane display order; Position folds position-x/position-y onto one shared key set"
  - "resolveMotionDisplayLanes / resolveVisibleMotionDisplayLanes / resolveKeylessMotionDisplayLanes — the one display-lane projection"
  - "TimelineMotionChannelLane — 18px lane, 16x18x3 cells, evaluator curves, 6x6 keys, header cluster with reasoned disabled states"
  - "TimelineMotionBlockOutline + resolveMotionBlockOutlineRect — the MUI-03 rounded block outline, null when collapsed"
  - "TimelineMotionChannelMenu — the keyless-only add-channel menu; Position offers position-x once"
  - "TIMELINE_MOTION token block — motion cell footprint, key metrics, lane/header metrics, post-block gap, per-type lighter key rim"
affects: [59-11, 59-12, 59-16]

actuals:
  tokens: 34401
  tasks: 2
  commits: 4

plan_head_before: 9266a83ea83e58cf28ce03b4009aa0b081538472
plan_head_after: 43b089487

tech-stack:
  added: []
  patterns:
    - "Display-lane projection: five persisted model channels fold into four fixed-order rows; Position reuses the first present axis's shared frames instead of inventing a second merge rule"
    - "Props-only surface: the lane, outline and menu read no store, signal, hook or DOM, so the whole surface is provable by materializing vnodes in a plain .test.ts"
    - "Token-derived geometry: every lane/cell/key length comes from TIMELINE_MOTION or TIMELINE_GEOMETRY; a source-contract test forbids the 18/16/6/1.5 literals"
    - "Reasoned inertness: a control that cannot act renders disabled with title + aria-description carrying the human reason, overridable per control by the host"

key-files:
  created:
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-10-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-10-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-10-task1.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-10-task2.xml
  modified:
    - app/src/components/physic-paint/view/timelineRailDesign.ts
    - app/src/components/physic-paint/view/timelineRailDesign.test.ts

key-decisions:
  - "Position is ONE display lane backed by two model channels: the projection exposes the first present axis's frames as the shared key set, so three shared frames render one 6px dot each and a 3-key header, never six"
  - "Key dots are centred on the frame column (left = frame x pitch + (cellWidth - keySize) / 2 = frame x 18 + 5), matching SPECS §2; the plan's 'at frame x cellPitch' is read as the frame-column anchor, not the literal left edge"
  - "TIMELINE_MOTION is a separate token block rather than a mutation of TIMELINE_GEOMETRY: the motion cell is 16x18x3 against the drawing key's 16x22x3, and the evaluator's TIMELINE_GEOMETRY.cellPitch/motionLaneHeight contract is untouched"
  - "resolveMotionBlockOutlineRect has the documented (rowTop, rowHeight, laneCount) signature, so width is '100%' and height carries the row + lanes x 18 + the 2px post-block gap; laneCount 0 returns null (MUI-03)"
  - "TimelineMotionBlockOutline accepts an optional lineColor beyond the plan's four props so the 59-11 host can pass the rail's bright line; absent, it falls back to the neutral accent"
  - "TIMELINE_MOTION.keyRim derives its four values from TIMELINE_RAIL_PALETTES[type].selected.keyRim instead of duplicating colour literals"
  - "The add-channel menu lists only keyless DISPLAY lanes from the same projection and emits position-x for the Position row; the 59-02 reducer seeds position-y atomically"
  - "Requirements MOTN-04/MUI-02/MUI-03 left pending per the 59-01/02/03/05/06/07 precedent: the props-only surface and its pins are complete, but the rows become user-facing only when 59-11 hosts the lanes and live UAT closes them"

patterns-established:
  - "Grouped-display projection: a display lane owns a channel list plus one key set, so the lane body draws N curves and exactly one dot per shared frame"
  - "Compiling RED stubs: both TDD tasks start from type-correct placeholders, so every RED failure is a named assertion failure, never an import or collection fault"
  - "Source-contract purity test: the test file reads the .tsx source and proves the absence of store/hook/DOM reads and of duplicated geometry literals"

requirements-completed: []

coverage:
  - id: D1
    description: "Five model channels project into four fixed-order display lanes; Position folds position-x/position-y onto one shared key set and never doubles the key count"
    requirement: MOTN-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#resolveMotionDisplayLanes"
        status: pass
    human_judgment: false
  - id: D2
    description: "A zero-key display lane renders no row; a fully populated rail shows four lanes and never five"
    requirement: MOTN-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#resolveMotionDisplayLanes > reports four keyless display lanes / never exceeds four display lanes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lane body: 18px motionLane surface, 16x18x3 cells at the 18px pitch, 6x6 keys centred on frame columns, one evaluator curve path per model channel, current-tier cursor key, out-of-band keys not rendered"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelLane"
        status: pass
    human_judgment: false
  - id: D4
    description: "Header cluster order (icon, label, N keys, previous, diamond, next) with clicks routed to select-key / adjacent-key / toggle handlers"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelLane > renders the header cluster / routes key and nav clicks"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every inert control is disabled with a visible reason in title AND aria-description, overridable by the host (MUI-06 anticipation)"
    requirement: MUI-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelLane > disables an inert nav control / lets the host override a disabled reason"
        status: pass
    human_judgment: false
  - id: D6
    description: "Block outline: null at laneCount 0, rounded 1.5px rect over the row plus lanes plus the 2px post-block gap at 1/3 lanes"
    requirement: MUI-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionBlockOutline; timelineRailDesign.test.ts#resolveMotionBlockOutlineRect"
        status: pass
    human_judgment: false
  - id: D7
    description: "Add-channel menu lists only keyless display lanes in fixed order, offers Position exactly once and emits position-x only; renders nothing when no lane is keyless"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannelMenu"
        status: pass
    human_judgment: false
  - id: D8
    description: "TIMELINE_MOTION token pins (16x18x3 footprint, 6/1/1.5/18 metrics, header cluster, label gap, post-block gap, per-type rim) and the TIMELINE_GEOMETRY values unchanged"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineRailDesign.test.ts#TIMELINE_MOTION pins + TIMELINE_GEOMETRY pins"
        status: pass
    human_judgment: false
  - id: D9
    description: "The lane surface is a pure function of props (no store/signal/hook/DOM read, no interpolation) and derives geometry only from tokens"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#TimelineMotionChannels source contract"
        status: pass
    human_judgment: false
  - id: D10
    description: "The rendered lane rhythm, colours and header cluster in the live Studio timeline (hosted by 59-11, exercised in live UAT)"
    verification: []
    human_judgment: true
    rationale: "Vnode materialization proves structure and values; it cannot prove the visible 18px rhythm, contrast or interaction feel in the WKWebView Studio, which 59-11 hosting plus live UAT must confirm."

# Metrics
duration: 7min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 10: Motion Lane Surface Summary

**A props-only v7 motion lane surface: five model channels fold into four rows (Position grouped on one shared key set), with evaluator curves, 16×18×3 cells, 6×6 keys, reasoned disabled controls, the 1.5px block outline and the keyless add-channel menu — all proven by vnode materialization with no DOM.**

## Performance

- **Duration:** 7min
- **Started:** 2026-11-06T15:24:20Z
- **Completed:** 2026-11-06T15:31:08Z
- **Tasks:** 2
- **Files modified:** 8 (2 source, 2 test, 4 RED-evidence artifacts)
- **Diff realized:** 137,604 chars → 34,401 estimate-scale tokens (code-only diff: 47,488 chars / 11,872 tokens)

## Accomplishments

- The display-lane projection: `resolveMotionDisplayLanes` always returns four fixed-order lanes, and the grouped Position lane reuses the first present axis's frames as ONE shared key set — three shared frames render three dots and a "3 keys" header, never six.
- The lane body draws exactly what the evaluator authored: one `buildRailMotionCurvePath` string per model channel (two paths for Position), 6×6 keys centred on their frame columns at the 18px pitch, and 16×18 radius-3 cells — every value from `TIMELINE_MOTION`/`TIMELINE_GEOMETRY`.
- MUI-06 anticipation: previous/diamond/next and key selection disable with a human reason in both `title` and `aria-description`; the host can override any reason.
- MUI-03: `resolveMotionBlockOutlineRect` + `TimelineMotionBlockOutline` wrap the rail row, the display lanes and the 2px post-block gap at 1.5px radius 4; a collapsed block renders nothing.
- The `+` menu is the keyless complement of the same projection: Position once, emitting `position-x` (the 59-02 reducer seeds both axes), and nothing when every display lane carries keys.
- `TIMELINE_GEOMETRY` is untouched (the diff is additions only); the evaluator suite (181 rail-motion tests) stays green.

## Task Commits

Each task was committed atomically with its TDD gate:

1. **Task 1 RED: failing motion lane surface pins** — `b149c2ba9` (test)
2. **Task 1 GREEN: grouped Position lane rendered from props** — `e25664bd7` (feat)
3. **Task 2 RED: failing block outline and channel menu pins** — `685b501ef` (test)
4. **Task 2 GREEN: block outline and keyless channel menu** — `43b089487` (feat)

**Plan metadata:** `[pending final docs commit]` (docs: complete plan)

## TDD Gate Compliance

| Gate | Commit | Evidence |
|------|--------|----------|
| RED 1 | `b149c2ba9` | `red-evidence-59-10-task1.json` → `RED_EVIDENCE_OK` (51 tests, 18 fail; target: display-lane folding) |
| GREEN 1 | `e25664bd7` | 51/51 tests pass |
| RED 2 | `685b501ef` | `red-evidence-59-10-task2.json` → `RED_EVIDENCE_OK` (59 tests, 6 fail; target: outline rect arithmetic) |
| GREEN 2 | `43b089487` | 59/59 tests pass |

The tracer feedback gate ran after Task 1 in interactive mode (`HUMAN_VERIFY_MODE=end-of-phase`, automated-only verify): the Task 1 verify was re-run end-to-end with exit 0 before expanding to Task 2.

## Files Created/Modified

- `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` — display-lane projection, lane component, block outline and keyless channel menu (props only)
- `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — 18 lane-surface tests + 3 outline + 3 menu + 2 source-contract tests, all by vnode materialization
- `app/src/components/physic-paint/view/timelineRailDesign.ts` — `TIMELINE_MOTION` token block and `resolveMotionBlockOutlineRect`; no existing value changed
- `app/src/components/physic-paint/view/timelineRailDesign.test.ts` — cell footprint/key metric/rim pins plus the outline rect at laneCount 0/1/3
- `.planning/.../red-evidence-59-10-task1.json`, `red-59-10-task2.json` and their JUnit reports — the two validated RED records

## Decisions Made

- **Position folds, it does not merge twice.** The projection takes the first present axis's frames as the shared set; D-12 guarantees frame equality and the 59-02 parser already refuses a lone or mismatched axis. A second merge rule would be a second authority.
- **Key centring clarification.** SPECS §2 places keys at `cellStart + 5` (centre = cellStart + 8); the implementation uses `frame × cellPitch + (cellWidth − keySize) / 2` and the test pins 5/59/113. The plan's "at frame × cellPitch" is read as the frame-column anchor.
- **Outline width is `'100%'`.** The documented helper signature has no frame-count input; the host (59-11) positions the overlay over the rail width, while `height` carries the row + lanes × 18 + 2px post-block gap.
- **Optional `lineColor` on the outline.** The plan's four props cannot resolve the rail-type bright line, so the host may pass it; absent, the neutral accent is used, and `selected` drives 1 vs 0.55 opacity.
- **`keyRim` is derived, not duplicated.** `TIMELINE_MOTION.keyRim` reads the selected palette tier, keeping one colour authority.
- **Requirements left pending** (`requirements-completed: []`): MOTN-04/MUI-02/MUI-03 become user-facing when 59-11 hosts the lanes and live UAT closes them — the phase's established no-false-done rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test harness] Preact hands single-expression children as an array**
- **Found during:** Task 1 GREEN
- **Issue:** `headerPart(tree, 'label').props.children` was `['Position']`, failing a `toBe('Position')` assertion even though the rendered text was correct.
- **Fix:** Replaced direct children reads with a recursive `textOf` helper that joins string/number descendants; assertions still pin the exact strings.
- **Files modified:** `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts`
- **Verification:** 51/51 tests pass.
- **Committed in:** `e25664bd7`

### Clarifications (no behavior change)

- `TIMELINE_MOTION` created in Task 1 carries the key/curve/header metrics the Task 1 lane already needs; Task 2 adds `postBlockGap`, `keyRim` and the outline helper. The plan's task split is a minimum, not a maximum.
- Key dot left uses the SPECS centring offset (`+5`), documented above.

**Total deviations:** 1 auto-fixed (test harness), plus documented clarifications. **Impact:** none on scope or behavior; the harness change was required for the assertions to read the actual rendered text.

## Issues Encountered

- The first typecheck pass rejected `Record<string, unknown>` style objects against Preact's `CSSProperties`; the style helpers are now typed `CSSProperties` (project precedent: `PhysicsPaintBrushModal`). Typecheck is clean.

## Threat Surface Scan

No new network, auth, file-access or schema surface. The plan's mitigations are implemented and pinned:

- **T-59-28 (DoS):** keys outside the rail band are not rendered (pinned), and each channel contributes a single path string — no per-sample elements.
- **T-59-29 (spoofing):** every inert control carries `title` + `aria-description` (pinned per control).
- **T-59-30 (token drift):** one token block, a source test forbidding the 18/16/6/1.5 literals, and unchanged `TIMELINE_GEOMETRY` (diff is additions only).
- **T-59-SC:** no installs.

## Known Stubs

None. The lane surface is complete for its scope; hosting it in the timeline is plan 59-11's work, not a stub in this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **59-11 (row host) can render the lane set directly:** it supplies `lane` from `resolveVisibleMotionDisplayLanes(channels)`, `railFrameCount`, `cursorFrame`, the handlers and an optional `lineColor`; lane heights and outline math already agree through `TIMELINE_MOTION`.
- **59-12 (commands/UAT)** owns the live interactions behind the handlers and the visible UAT rows; MOTN-04/MUI-02/MUI-03 stay pending until then.
- **Constraint preserved:** `TIMELINE_GEOMETRY.cellPitch` and `motionLaneHeight` are unchanged, so `railMotionEvaluator.ts` (59-05) keeps its defaults.

---
*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- All four task commits (`b149c2ba9`, `e25664bd7`, `685b501ef`, `43b089487`) are ancestors of HEAD.
- Both source files and both test files exist; the plan verify exits 0 (59/59) and typecheck exits 0.
