---
phase: 59-rail-motion-channels-v7-interface
plan: 11
subsystem: ui
tags: [preact, session-signal, measured-layout, header-alignment, block-aware-reorder, tdd, mui-01, mui-04, mui-05]

# Dependency graph
requires:
  - phase: 59-06
    provides: "assignRailMotionRailViews + durable rail identity; the row and the strip consume views/records through readTrackRailMotionFacts"
  - phase: 59-07
    provides: "getRotoPhysicalRailMotions / loop-clip reads backing the rail motion facts"
  - phase: 59-10
    provides: "resolveVisibleMotionDisplayLanes, TimelineMotionChannelLane, TimelineMotionBlockOutline, TimelineMotionChannelMenu, TIMELINE_MOTION"
provides:
  - "railMotionExpandedSelection — the ONE session expansion identity, written only by the chevron toggle"
  - "resolveSelectedRailMotionId / resolveMotionBlockExpanded / resolveMotionChevronKind / toggleRailMotionExpansion / resolveMotionRecordForRail / resolveRailMotionHasKeys / resolveTrackMotionLaneCount"
  - "TimelineMotionBlock — the shared expanded block (display lanes + post-block gap + menu + outline) any host can render"
  - "resolveTrackRowLayout — the ONE measured layout (31px rail row + 18px per visible display lane + one 2px post-block gap)"
  - "resolveReorderInsertionIndex — the measured, block-aware reorder index shared by preview and commit"
  - "Header lane spacer rows and the layout-derived insertion indicator"
affects: [59-12]

actuals:
  tokens: 32592
  tasks: 3
  commits: 5

plan_head_before: 5b5a4a690cb2470f27b66c359e294603d042724b
plan_head_after: 15e17b435

tech-stack:
  added: []
  patterns:
    - "Session-only identity: one module-scope signal holds the single open rail block; at most one block open, never persisted, never in the fingerprint"
    - "One measured layout: content height, header spacers and the reorder index all read the same array instance, so the panes cannot drift"
    - "Block-aware pointer math: a point inside an open block resolves to that block's own rail index, never to a neighbour or a fractional lane"
    - "Shared block component: the row host and the strip host render the same TimelineMotionBlock, so there is one implementation of the expanded surface"

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-11-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-11-task1.xml
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "The chevron lives in PhysicsPaintTrackRowHeader (the pinned header cell), not the row body, so the 14x14 toggle sits in the mockup's control order grip/eye/blend/motion/name/trash"
  - "The strip derives the active rail identity with the Studio's own precedence (key rail firstKeyId, then a lone selected loop clip); only the active track's header receives it, because only the active lane's rails are interactive"
  - "The active track is rendered by renderActiveLane(), not by a track row, so the strip hosts its expanded block inside a layout-height wrapper — the same TimelineMotionBlock component the row uses"
  - "The strip reads the active track's rotor revision narrowly so a motion edit that changes the lane count re-measures the layout; non-active tracks are pinned at laneCount 0 because their rails are not selectable"
  - "resolveTrackRowLayout([]) returns total 0: the strip supplies the empty-document placeholder row itself, so the old rowCount=1 fallback stays at the call site instead of hiding inside the pure helper"
  - "The header column accepts the layout structurally (its own entry interface) so it never imports the strip that imports it; one array instance still flows through both"
  - "The header keeps `reorderDragIndex * HEADER_ROW_HEIGHT_PX` only as the legacy fallback for a caller that supplies no layout; the strip always supplies one"
  - "Requirements MUI-01/MUI-04/MUI-05 stay pending per the phase's no-false-done rule: the surface is pinned by unit tests, but the visible Studio behaviour closes in 59-12's live UAT"

patterns-established:
  - "Layout-as-prop: a variable-height list gives every pane the same measured array and derives offsets from it, never from a constant"
  - "Two-host component extraction: when two hosts (row + strip) need the same block, extract it once rather than duplicating the markup"
  - "Session-state source contract: the test file greps the writer count, the read count and the persistence sources to prove the signal never leaves the session"

requirements-completed: []

coverage:
  - id: D1
    description: "Chevron kinds: no motion on any rail -> grey minus; a motion-bearing rail -> chevron-right collapsed, chevron-down expanded"
    requirement: MUI-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#chevron kinds + physicsPaintTrackHeaderColumn.test.ts#motion slot"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 14x14 chevron is a real toggle with aria-expanded; clicking flips the arm/collapse states and opens/closes the block"
    requirement: MUI-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#click expand/collapse"
        status: pass
    human_judgment: false
  - id: D3
    description: "Expansion is session-only, initialised null, written only by the chevron toggle; Animate leaves the block collapsed; one signal keeps at most one block open"
    requirement: MUI-04
    verification:
      - kind: unit
        ref: "PhysicsPaintTrackRow.test.tsx#writes the session expansion signal in exactly one place; #Animate leaves it collapsed; #keeps at most one block open"
        status: pass
    human_judgment: false
  - id: D4
    description: "Switching rail selection collapses the open block: the recorded identity no longer matches the selected rail"
    requirement: MUI-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#resolveMotionBlockExpanded"
        status: pass
    human_judgment: false
  - id: D5
    description: "The expanded block renders the rail row plus its DISPLAY-lane rows inside the 59-10 outline (height 105 at four lanes, radius 4, 1.5px); a collapsed rail renders no lane and no outline"
    requirement: MUI-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#expanded block"
        status: pass
    human_judgment: false
  - id: D6
    description: "Header and lane body consume the same layout instance: 18px lane spacers, group height 31 + lanes x 18 + 2, identical offset sequences at the same scroll"
    requirement: MUI-05
    verification:
      - kind: unit
        ref: "physicsPaintTrackHeaderColumn.test.ts#measured row layout; PhysicsPaintWorkflowStrip.test.ts#resolveTrackRowLayout"
        status: pass
    human_judgment: false
  - id: D7
    description: "Lane counts are DISPLAY-lane counts from 59-10: grouped Position counts once, a five-model-channel rail yields four lanes and 105px, never 123px"
    requirement: MUI-05
    verification:
      - kind: unit
        ref: "PhysicsPaintTrackRow.test.tsx#lane count 4; PhysicsPaintWorkflowStrip.test.ts#caps a fully populated block at four display lanes"
        status: pass
    human_judgment: false
  - id: D8
    description: "Content height is the sum of measured row heights, never rowCount x 31; a collapsed/motion-free document is byte-identical to HEAD"
    requirement: MUI-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#reserves exactly one row unit per collapsed rail"
        status: pass
    human_judgment: false
  - id: D9
    description: "The reorder index walks the measured offsets, clamps at both ends, resolves block interiors to the block's own rail, and is byte-identical to floor(y/31) with no lanes; preview and commit share one function"
    requirement: MUI-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#resolveReorderInsertionIndex"
        status: pass
    human_judgment: false
  - id: D10
    description: "The visible chevron rhythm, the expanded block inside the live Studio timeline, and the drag feel across an open block"
    verification: []
    human_judgment: true
    rationale: "Vnode materialization and source contracts pin structure, arithmetic and identity; they cannot prove the visible 14px toggle, the 18px lane rhythm or the drag feel in the WKWebView Studio. 59-12 hosts the live commands and closes this in UAT."

# Metrics
duration: 28min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 11: Motion Block Integration Summary

**The motion surface from 59-10 now lives in the timeline: a session-only chevron toggles one open rail block, the active strip lane hosts the same block component, and content height, header spacers and the reorder insertion index all derive from one measured layout.**

## Performance

- **Duration:** 28min
- **Started:** 2026-11-06T15:40:00Z (approx.)
- **Completed:** 2026-11-06T16:08:18Z
- **Tasks:** 3
- **Files modified:** 6 source/test files + 2 RED-evidence artifacts
- **Diff realized:** 130,369 chars → 32,592 estimate-scale tokens (app-only diff: 83,958 chars / 20,990 tokens) against an 80,000-token estimate

## Accomplishments

- The chevron is a real 14×14 toggle in the header cell's control order: grey `minus` with a reasoned disabled state when no rail carries motion, `chevron-right` collapsed, `chevron-down` expanded, `aria-expanded` only when it can act.
- One module-scope signal holds the open block; the toggle is its only writer, Animate never opens it, a rail switch collapses it, and the identity never reaches either store — the source contract proves all four.
- `TimelineMotionBlock` is now the single implementation of the expanded surface, rendered by the row host (tests / future row hosting) and by the strip's active lane.
- `resolveTrackRowLayout` is the one height authority: 31px rail row + 18px per visible display lane + one 2px post-block gap. A four-lane block is 105px; a motion-free or collapsed document keeps the exact `rowCount × 31` numbers.
- The header column consumes the same array instance: one `aria-hidden` 18px spacer per lane, a group height equal to the layout entry, and the reorder indicator at the layout's rail offset.
- `resolveReorderInsertionIndex` walks measured offsets: a point inside an open block lands on that block's own rail, and with no lanes it reproduces `floor(y / 31)` for every integer band, scroll and track count in the equivalence table.
- The strip subscribes narrowly to the active track's rotor revision and to the expansion signal, so a motion edit or a chevron click re-measures immediately without touching the document revision.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing rail motion chevron and block pins** — `9739914d8` (test)
2. **Task 1 GREEN: host the motion chevron and expanded block in the track row** — `de2650521` (feat)
3. **Task 2: one measured row layout shared by body, header and content height** — `a84803200` (feat)
4. **Task 3: block-aware reorder insertion index from the measured layout** — `31e06d118` (feat)
5. **Session-only pin: expansion signal never reaches persistence** — `15e17b435` (test)

**Plan metadata:** see the final docs commit.

## TDD Gate Compliance

| Gate | Commit | Evidence |
|------|--------|----------|
| RED 1 | `9739914d8` | `red-evidence-59-11-task1.json` → `RED_EVIDENCE_OK` (35 tests, 11 fail; target: chevron kinds) |
| GREEN 1 | `de2650521` | 35/35 tests pass; header column 21/21 |

Tasks 2 and 3 are `type="auto"` with no `tdd` attribute, so no RED gate applies; each was driven by its verify command before commit.

The tracer feedback gate ran after Task 1 in interactive mode (`HUMAN_VERIFY_MODE=end-of-phase`, automated-only verify): the Task 1 verify was re-run end-to-end with exit 0 before expanding.

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — session signal, the seven pure helpers, `TimelineMotionBlock`, the header chevron, and the row's block host
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — 12 hosting tests (identity kinds, chevron, toggle, Animate, one writer, lane count, block presence, outline/gap/row heights) plus the session-only persistence pin
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` — `rowLayout` + `selectedRail` props, lane spacer rows, layout-derived indicator offset
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` — 5 measured-layout tests (spacers, collapsed identity, offset sequences, indicator, active-only rail forwarding)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `resolveTrackRowLayout`, `resolveReorderInsertionIndex`, the measured content height, the active-lane block host
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — 8 layout/reorder tests including the no-lane equivalence table and the row-unit source contract
- `.planning/.../red-evidence-59-11-task1.json` and its JUnit report — the validated RED record

## Decisions Made

- **Chevron in the header cell.** MUI-01's toggle belongs in the pinned header row control order (grip, eye, blend, motion, name, trash), not in the frame-cell body.
- **Strip mirrors the Studio's rail precedence.** `props.selectedRotoKeyRail` first, then a lone `selectedRotoLoopClipIds[0]`. Only the active track's header receives the identity because only the active lane's rails are interactive; every other header gets null and an explanatory disabled reason.
- **Active-track hosting.** `renderActiveLane()` bypasses `PhysicsPaintTrackRow`, so the strip hosts the block itself via the extracted `TimelineMotionBlock` inside a wrapper whose height is the layout entry's height.
- **Narrow revision subscription.** The strip reads `getTrackRotorRevision(layerId, activeTrackId).value` and `railMotionExpandedSelection.value` once per render; no effect, no document revision term.
- **Empty layout semantics.** `resolveTrackRowLayout([])` = `{ rows: [], totalHeight: 0 }`; the strip pushes the placeholder row for an empty document, keeping the old `rowCount = 1` behaviour at the call site.
- **Header structural coupling.** The header column declares its own layout-entry interface instead of importing the strip, avoiding a cycle while still consuming the same array instance.
- **Requirements left pending.** MUI-01/MUI-04/MUI-05 close with 59-12's live UAT, consistent with the phase's no-false-done rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The active track had no block host**
- **Found during:** Task 2
- **Issue:** The plan assumed the rail rows render their own expanded block, but the active track is rendered by the strip's `renderActiveLane()`, never by `PhysicsPaintTrackRow`. Hosting the chevron without this would leave the active track (the only one whose rails are selectable) unable to open a block — the feature would be dead on arrival.
- **Fix:** Extracted `TimelineMotionBlock` from the row body and added `resolveTrackRowLayout`-sized hosting around the active lane in the strip, so the row host and the strip host render one implementation.
- **Files modified:** `PhysicsPaintTrackRow.tsx`, `PhysicsPaintWorkflowStrip.tsx`
- **Verification:** Lanerow tests 35/35; the strip test pins the layout entry and the shared component import.
- **Committed in:** `a84803200`

**2. [Rule 2 - Missing critical functionality] Layout would go stale after a motion edit**
- **Found during:** Task 2
- **Issue:** Reading only `railMotionExpandedSelection` would leave the measured layout stale when motion keys are added or removed (lane count unchanged but records replaced) — the block and the row height could disagree with the store.
- **Fix:** Added the narrow active-track rotor revision read (`getTrackRotorRevision(layerId, activeTrackId).value`) beside the expansion read; both are signal reads, no effect.
- **Files modified:** `PhysicsPaintWorkflowStrip.tsx`
- **Verification:** Typecheck clean; the strip's `resolveTrackRowLayout` tests pin the arithmetic.
- **Committed in:** `a84803200`

### Clarifications (no behavior change)

- `resolveTrackRowLayout` clamps lane counts to the four DISPLAY lanes and fails closed to 0 for non-finite inputs; the strip only ever passes the 59-10 projection's length.
- The header's `reorderDragIndex * HEADER_ROW_HEIGHT_PX` survives as the documented fallback for a caller that supplies no layout (the header-only tests and any legacy invocation); the strip always supplies the measured array.
- The strip's `rowLayout` memo depends on `props.tracks` identity; recomputation is O(tracks) and involves no DOM reads (T-59-32).

**Total deviations:** 2 auto-fixed (both required for the feature to work at all). **Impact:** the plan's three tasks are complete as specified; the strip gained the one hosting path the plan's file list implied but did not spell out.

## Issues Encountered

- The first header-offset test missed the track array child (`{tracks.map(...)}` renders one array child), so the helper had to flatten nested arrays before walking the band. Fixed in the test helper; assertions unchanged in intent.
- The Task 2 row-unit source assertion counted four `STRIP_ROW_HEIGHT_PX` lines until Task 3 removed the uniform reorder division; it now pins exactly three.

## Threat Surface Scan

No new network, auth, file-access or schema surface. The plan's mitigations are implemented and pinned:

- **T-59-31 (tampering, reorder index):** measured offsets, clamping, block-aware resolution, and a no-lane equivalence table over track counts and scrolls.
- **T-59-32 (DoS, layout recomputation):** one `useMemo` layout for the strip; per-row heights come from lane counts, never DOM measurement.
- **T-59-33 (repudiation, header/lane drift):** one array instance consumed by both panes, pinned by identical offset sequences.
- **T-59-SC:** no installs.

## Known Stubs

None. The expanded block's interactive commands (`onSelectMotionKey`, `onMotionCursorStep`, `onToggleMotionKeyAtCursor`, `onAddMotionChannel`) are intentionally unwired in the strip — 59-12 owns the live commands and the channel menu state. The controls render disabled with their human reason (MUI-06 anticipation), so nothing silently no-ops.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **59-12 (commands/UAT)** can wire the motion handlers into the strip's `TimelineMotionBlock` props, add the `+` menu toggle state, and run the live UAT rows for MUI-01/MUI-04/MUI-05.
- **Layout is stable for commands:** adding a channel changes the display-lane count, which already re-measures through the active-track revision read.
- **Constraint preserved:** `TIMELINE_GEOMETRY.motionLaneHeight` (18) remains the single lane unit for both panes; `physicsPaintStudio.css` was not modified.

---

*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- All five plan commits (`9739914d8`, `de2650521`, `a84803200`, `31e06d118`, `15e17b435`) are ancestors of HEAD.
- All six source/test files exist; `vitest run src/components/physic-paint/view` exits 0 (88 files, 1931 tests) and `typecheck` exits 0.
