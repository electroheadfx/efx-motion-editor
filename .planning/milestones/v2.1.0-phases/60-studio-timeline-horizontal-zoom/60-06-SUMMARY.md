---
phase: 60-studio-timeline-horizontal-zoom
plan: 06
subsystem: testing
tags: [timeline, zoom, acceptance-matrix, vitest, five-level, literal-table, edge-probe, store]

# Dependency graph
requires:
  - phase: 60-studio-timeline-horizontal-zoom/60-05
    provides: green single-authority audit, so every matrix value reads the authority or a parameterised helper
  - phase: 60-studio-timeline-horizontal-zoom/60-01
    provides: the zoom authority module, the metrics helpers and the module-level store
  - phase: 60-studio-timeline-horizontal-zoom/60-03
    provides: the strip's live pitch read and the scroll-to-frame positioning effects
provides:
  - Executable phase acceptance matrix at 0.25x / 0.5x / 1x / 2x / 4x over geometry, interaction, store gestures and edge-probe ownership
  - Literal five-level tables for pitch, cell width/gap, ruler step/extent, playhead, loop extents, audio range, drag, scrub and scroll-to-frame
  - A 13-row edge-probe ownership table that fails if any row loses its owner
affects: [60 verify-work, phase 61, phase 62 curve editing]

# Actuals (#2632) — chars/4 over the realized diff, the same scale as the plan estimate
actuals:
  tokens: 6232
  tasks: 3
  commits: 3
  plan_head_before: a55ebb9c622525e27bf82db3730f0d16e419be3b
  plan_head_after: 8a32537b23a03db6836644bc8568b75111a04a1d

tech-stack:
  added: []
  patterns:
    - "Acceptance matrix as a frozen literal level table: expected values are transcribed from the documented predicates, never computed by the implementation under test"
    - "One table drives geometry, interaction and store rows, so a single drift fails at the level that drifted"
    - "Header records non-pixel predicates (selection/paste) instead of inventing an assertion with no projection behind it"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts
  modified: []

key-decisions:
  - "Expected values live only in the frozen ZOOM_LEVELS table; helpers produce actual values only, and frameToPx output is itself pinned to a literal before the pxToFrame round-trip, so the implementation is never its own oracle"
  - "toBe is used for every exactly-pinned value (metrics, ruler extents, playhead, loop widths, Fit 0.49166666666666664); toBeCloseTo(..., 10) appears only on the documented non-exact audio range, and wheel factors compare against Math.exp(...) which does not call the implementation"
  - "Scroll-to-frame has no exported helper, so the matrix restates the documented centring law and the scrollWidth < (frame + 1) x pitch guard as a literal-expectation local predicate, cross-linked to 60-03 task 2's source pin"
  - "The store block resets the scale in beforeEach and unregisters the port in both beforeEach and afterEach, so no test can pass on state another test left behind"
  - "Selection and paste compare frame indices, not pixels; the header records their only pixel surface as the rail/ghost geometry asserted in task 1 and pinned to the live pitch by 60-02 task 3, rather than fabricating a pixel row"
  - "The 13-row edge-probe table is literal data with exact-length, exact-id and non-empty-owner assertions, including both unclassified rows"

patterns-established:
  - "Five-level acceptance matrix: one frozen literal table, it.each across every predicate, no helper-computed expectations"
  - "Module-state discipline: beforeEach reset plus dual port unregistration protects the shared zoom store"

requirements-completed: [ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04, ZOOM-05]

coverage:
  - id: D1
    description: "Hit-test, playhead centring and scrub projection resolve consistently at every level; a fixed content x lands on the same frame from 0.25x to 4x"
    requirement: ZOOM-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > round-trips the hit-test at a fixed content x (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#render geometry at every level > centres the frame-10 playhead at the documented px (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > projects the ruler scrub onto frame 7 (all five levels)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every promised extent holds across the ladder: ruler step/extent, visible and clipped loop widths, audio range, adjacency gap, drag stepping and scroll-to-frame centring"
    requirement: ZOOM-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#render geometry at every level > coarsens the ruler to the documented step over the documented extent (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#render geometry at every level > ends a visible three-frame loop clip on the scaled gap (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#render geometry at every level > keeps the full extent for a viewport-clipped loop clip (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > reports the audio visible range in frames (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > leaves exactly one scaled gap between adjacent rails (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > resolves a 72px drag to the documented frame count and a 4-frame drag to the documented px (all five levels)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > centres frame 100 at the documented target with its guard at (frame + 1) x pitch (all five levels)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No vertical dimension varies with zoom: row height 30, drawing cell 22, motion lane and motion cell 18, and the metrics object carries only scale, cellWidth, cellGap and pitch"
    requirement: ZOOM-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#render geometry at every level > holds every vertical token fixed — the metrics carry no vertical term"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reset returns the session to 1x / 100% with both end flags false, and the ordering/empty probes stay exact"
    requirement: ZOOM-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > resets the session to 1x on Studio open (ZOOM-04)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > keeps the empty document exact: no scaled cell, the ruler floor and the fit default"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#interaction geometry at every level > orders the ladder: pitch strictly increases and the ruler extent never decreases"
        status: pass
    human_judgment: false
  - id: D5
    description: "The store steps presets from the current value (1.37 -> 1.5 / 1), clamps both ends, never writes scroll on an unchanged scale, fits once through a registered port, safe no-ops without one, and clamps the wheel factor"
    requirement: ZOOM-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > steps the preset ladder from the current value, never from a rounded preset (D-06)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > holds the clamped ends: minus at 0.25 and plus at 4 are no-ops (ZOOM-02)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > does not write scroll when the scale is unchanged (D-08)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > fits the whole range once and clamps the anchored write at 0 (D-04)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > is a safe no-op when Fit runs with no registered port"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#store gestures > keeps the wheel factor continuous and clamps it at both ends (D-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The phase's 13-row spec-less edge probe is fully owned: exactly 13 rows, all five categories present, a named owner on every row, and both unclassified rows owned explicitly"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#edge-probe row ownership > carries exactly the thirteen rows the phase edge probe raised"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts#edge-probe row ownership > assigns a named owner to every row and owns both unclassified rows explicitly"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-09
status: complete
---

# Phase 60 Plan 06: Five-Level Zoom Acceptance Matrix Summary

**The phase's acceptance surface is now executable: one 667-line node-environment matrix drives every promised zoom number — pitch, ruler, playhead, loop extents, audio range, adjacency, drag, scrub, scroll-to-frame, store gestures — from a frozen literal five-level table at 0.25x / 0.5x / 1x / 2x / 4x, and fails at the level that drifts.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-09T13:11:31Z
- **Completed:** 2026-11-09T13:14:43Z
- **Tasks:** 3
- **Files modified:** 1 (the acceptance matrix, created)

## Accomplishments

- `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` defines a frozen five-level table (pitch 4.5 / 9 / 18 / 36 / 72; cell width 4 / 8 / 16 / 32 / 64; gap 0.5 / 1 / 2 / 4 / 8; ruler step 9 / 6 / 3 / 3 / 3 over extents 40.5 / 54 / 54 / 108 / 216; frame-10 playhead 52.25 / 99.5 / 194 / 383 / 761) and drives 73 tests from it with `it.each`.
- Geometry rows prove metrics exactness plus the four-key contract, ruler coarsening, playhead centring, sound-stain placement, visible loop widths 13 / 26 / 52 / 104 / 208, viewport-clipped widths 18 / 36 / 72 / 144 / 288, and the scale-invariant vertical tokens (30 / 22 / 18 / 18).
- Interaction rows prove the hit-test round-trip (client x 137.5 / 169 / 232 / 358 / 610 all resolving frame 7, boundary at +1 pitch), audio range 100/P–300/P, the adjacency gap 0.5 / 1 / 2 / 4 / 8, ordering, the exact empty-document case, drag stepping 16 / 8 / 4 / 2 / 1 at 72px, scrub projection, and scroll-to-frame targets 302.25 / 754.5 / 1659 / 3468 / 7086 with guards 454.5 / 909 / 1818 / 3636 / 7272.
- The 13-row edge-probe ownership table is encoded as literal data with exact-length, exact-id and non-empty-owner assertions, including both `unclassified` rows.
- Store rows prove preset stepping from the current value (1.37 → 1.5 / 1), clamped ends, D-08 compare-then-write with an uncalled scroll setter, Fit's exact literal `0.49166666666666664` → 49% with one clamped write, the no-port no-op, reset to 1 / 100 / false / false, and the exponential wheel factor with end clamps.

## Task Commits

1. **Task 1: Geometry matrix — metrics, ruler, playhead, sound stain and loop clip at five levels** - `820cea69d` (test)
2. **Task 2: Interaction matrix — hit-test, audio range, adjacency, ordering, empty, gestures and edge ownership** - `6514cd2f8` (test)
3. **Task 3: Store matrix — preset stepping, no-write idempotence, Fit through the port and reset** - `8a32537b2` (test)

**Plan metadata:** see the final `docs(60-06)` commit.

_Note: plan-level gates — matrix 73 tests and the zoom module suite 26 tests all green (99 together); full suite 8397 passed / 1 skipped / 96 todo (8494); typecheck clean._

## Files Created/Modified

- `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` — the five-level acceptance matrix: frozen table, loop fixture, geometry block, interaction block (hit-test, audio, adjacency, ordering, empty, drag, scrub, scroll-to-frame), 13-row edge-probe ownership, store gesture block with per-test port lifecycle

## Decisions Made

- Expected values live only in the frozen `ZOOM_LEVELS` table; helpers produce actual values only, and `frameToPx` output is pinned to a literal before the `pxToFrame` round-trip, so the implementation is never its own oracle.
- `toBe` for exactly-pinned values; `toBeCloseTo(..., 10)` only on the documented non-exact audio range; wheel factors compare against `Math.exp(...)`, which is independent of the implementation.
- Scroll-to-frame has no exported helper, so the matrix restates the documented centring law and `scrollWidth < (frame + 1) × pitch` guard as a literal-expectation local predicate, cross-linked to 60-03 task 2's source pin.
- Selection and paste compare frame indices, not pixels; their only pixel surface is the rail/ghost geometry asserted in task 1 and pinned to the live pitch by 60-02 task 3 — recorded in the header instead of fabricating a pixel row.
- The store block resets the scale in `beforeEach` and unregisters the port in both `beforeEach` and `afterEach`, so no test can pass on state another test left behind.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Plan 60-06 is `type: execute` with no `tdd="true"` tasks, and it is test-only: the deliverable IS the acceptance matrix and no production code changed, so there is no RED→GREEN pair to record. The plan's own verification contract for each task is its `vitest run` command, and all three ran green (32 / 66 / 99 tests).
- Fabricating RED evidence would have required planting a wrong assertion in the final matrix; the honest record is three `test(60-06)` commits, comparable to 60-05's audit tasks 2–3.

## Issues Encountered

- The plan's literal expectations were re-derived arithmetically before writing (for example, scroll-to-frame at 0.25x: `100 × 4.5 + 2.25 − 150 = 302.25`; Fit: `(360 − 6) / (40 × 18) = 0.49166666666666664`), and every level cross-checks at 1x against the shipped 18 / 16 / 2 / playhead-194 numbers so a transcription error would fail at the base level.
- No stray mutations: the matrix runs in the node environment and the only module state it touches (the zoom store and scroll port) is reset before and after each store test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The phase's acceptance surface is executable and green; `/gsd-verify-work` can route the D1–D6 coverage entries to their passing tests.
- Manual UAT remains per the plan: wheel zoom feel and cursor anchoring, pinch delivery as ctrlKey wheel, scroll-snap interaction after an anchored zoom, and the pill's Fit/step behavior at both ends.
- No stubs, no skipped tests, no unrun verify commands in this plan.

## Self-Check: PASSED

---
*Phase: 60-studio-timeline-horizontal-zoom*
*Completed: 2026-11-09*
