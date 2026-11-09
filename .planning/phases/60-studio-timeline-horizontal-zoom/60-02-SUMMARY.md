---
phase: 60-studio-timeline-horizontal-zoom
plan: 02
subsystem: ui
tags: [preact-signals, timeline, zoom, drag-and-drop, ghost-geometry, source-contract-tests]

# Dependency graph
requires:
  - phase: 60-studio-timeline-horizontal-zoom
    provides: "60-01's session-only pitch authority (physicsPaintTimelineZoom.ts) and the one render-body metrics read in the strip"
provides:
  - "Every event-time projection in the strip divides by the live pitch peeked at event time: push, rail-set drag, cross-track framePitch, background clip drag and resize, sound drag, push click and ruler scrub"
  - "Every frame-scoped ghost/preview sizes from the live pitch (render-body timelineMetrics or event-time pitch) with a one-cell live-pitch floor, never a pixel floor"
  - "The cross-track drag port receives the already-scaled pitch with zoom left undefined — the pitch is applied exactly once"
  - "A greppable interaction-surface contract test slicing the push projection, rail-set projection, cross-track hook input and ghost region"
affects: [60-03, 60-04, 60-05]

actuals:
  tokens: 6093
  tasks: 3
  commits: 5
  plan_head_before: 29b13f542968f15dc674fc7d36f225c105ae81f3
  plan_head_after: 6b8fad8c08691db36dcf53ff3ae48637fdc06f1d

tech-stack:
  added: []
  patterns:
    - "Event-time projection: pointer handlers read timelineZoom.metrics.peek().pitch — never .value, so a drag never subscribes to the zoom signal"
    - "Render-body ghost geometry reads timelineMetrics.pitch from the single render-body metrics read (D-12); one-cell floors use the live pitch, never a pixel floor"
    - "Cross-track port contract (RESEARCH Pitfall 6): pass the already-scaled framePitch and leave zoom undefined so the hook multiplies exactly once"

key-files:
  created:
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-02-red-evidence-task1.json
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-02-red-evidence-task2.json
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts

key-decisions:
  - "Handlers peek the metrics signal at event time; only the render body reads .value — a pointer drag never re-subscribes to zoom (efx-preact-reactivity rules 5/6)"
  - "The cross-track hook receives timelineZoom.metrics.peek().pitch as framePitch and passes no zoom, so computeInsertionFrame applies the pitch once (Pitfall 6)"
  - "Ghost one-cell minimums are Math.max(livePitch, …) — never an absolute pixel floor, so a one-frame clip stays visible at 0.25x and 4x alike"
  - "ZOOM-05 stays open: this plan converts the interaction surface, but sound stains, open/reveal scroll positioning, rail geometry and the motion-lane insertion line remain for 60-03/60-04/60-05"

patterns-established:
  - "Source-slice contract pins: slice a region with indexOf, assert the live-pitch expression and the absence of the legacy constant"
  - "TDD evidence via vitest's JUnit reporter (reportPath + run timestamps + exact JUnit method name) when TAP output is rejected by the classifier"

requirements-completed: [ZOOM-01]

coverage:
  - id: D1
    description: "Push and rail-set pointer projections divide the raw signed pointer travel by the live pitch peeked at event time"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Directional Push tool source contract > A3/A4; Phase 60 (ZOOM-05) interaction-surface conversion contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cross-track drag port receives the already-scaled pitch with no zoom multiplier (pitch applied exactly once)"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts#computeInsertionFrame under the live session pitch; PhysicsPaintWorkflowStrip.test.ts#interaction-surface conversion contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every drag ghost and preview (background drag/resize, current-frame outline, push hover/ghosts/blocked edge, rail-set ghost/blocked edge, anchor capsule) sizes from the live pitch with a one-cell live-pitch floor"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Phase 60 (ZOOM-05) ghost and preview geometry contract"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the pitch expression, not the rendered overlay. The plan defers visual UAT to the phase gate: a rail drag of N cells must move N cells at 25%, 100% and 400%, and every ghost must cover exactly its rail's frame span."
  - id: D4
    description: "Greppable interaction-surface conversion proof covering push, rail-set, cross-track input and the ghost region"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Phase 60 (ZOOM-05) interaction-surface conversion contract"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-09
status: complete
---

# Phase 60 Plan 02: Interaction Surface on the Live Pitch Summary

**Every strip pointer projection, drag ghost and preview now divides and sizes by the session pitch authority, with the cross-track hook receiving the pre-scaled pitch exactly once**

## Performance

- **Duration:** 6 min (first recorded RED run to final task commit; plan reading preceded the first run)
- **Started:** 2026-11-09T12:25:42Z
- **Completed:** 2026-11-09T12:31:13Z
- **Tasks:** 3
- **Files modified:** 3 source/test files + 2 persisted RED evidence records

## Accomplishments

- Push, rail-set batch-move, background clip drag/resize, sound drag, push click and ruler-scrub projections all divide pointer travel by `timelineZoom.metrics.peek().pitch`, so N frames of travel address N frames at 0.25x and 4x.
- The cross-track drag port now receives `framePitch: timelineZoom.metrics.peek().pitch` with `zoom` omitted, so `computeInsertionFrame` multiplies the pitch exactly once (no pitch²).
- All nine ghost/preview geometry sites (background drag ghost, both background resize branches, rail-set blocked-edge bar, current-frame outline, push armed-anchor hover, push drag ghost, push blocked edge, rail-set drag ghost, push anchor capsule) read the live pitch; every one-cell minimum is `Math.max(livePitch, …)` rather than a pixel floor.
- One greppable contract test slices the push projection, rail-set projection, cross-track hook input and the active-lane ghost region, asserting a live-pitch expression and the absence of `ROTO_CELL_WIDTH_PX` in each.

## Task Commits

Each task was committed atomically (TDD RED then GREEN where the task changes behavior):

1. **Task 1: Event-time projections** - `5163b9cdb` (test, RED) → `155cdb4d8` (feat, GREEN)
2. **Task 2: Ghosts and previews** - `8fdf1c10c` (test, RED) → `0f24748da` (feat, GREEN)
3. **Task 3: Interaction-surface contract test** - `6b8fad8c0` (test)

**Plan metadata:** `TBD` (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - event-time projections peek the live pitch; ghost geometry reads the render-body pitch with live-pitch floors
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - repointed A3/A4 push pins, four ghost geometry pins, one interaction-surface contract pin
- `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts` - doubled-pitch and no-double-multiplication insertion-frame pins
- `.planning/phases/60-studio-timeline-horizontal-zoom/60-02-red-evidence-task1.json` - RED evidence (JUnit), verdict `RED_EVIDENCE_OK`
- `.planning/phases/60-studio-timeline-horizontal-zoom/60-02-red-evidence-task2.json` - RED evidence (JUnit), verdict `RED_EVIDENCE_OK`

## Decisions Made

- Handlers use `.peek()` and never subscribe to the zoom signal; the render body keeps the single `timelineMetrics` read (D-12). This preserves the event-time read discipline from `efx-preact-reactivity`.
- The cross-track port keeps `zoom` undefined and only passes the scaled `framePitch` (RESEARCH Pitfall 6). The existing `computeInsertionFrame` already multiplies once, so the new pins encode "no doubling" rather than changing hook behavior.
- Ghost width floors are the live pitch, not 18px or any literal: a one-frame clip stays visible at every zoom level.
- ZOOM-05 is not marked complete here: 60-03 (sound stains/preview, open/reveal scroll), 60-04 (track row, motion lanes, insertion line) and 60-05 (required `cellWidthPx`) still own consumers it names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TDD evidence accepted only through the JUnit adapter**
- **Found during:** Task 1 RED
- **Issue:** The vitest TAP and tap-flat reporters were rejected by the classifier (`invalid_record`) because vitest's multi-line diagnostic YAML blocks do not parse as TAP.
- **Fix:** Reran the target with `--reporter=junit` and persisted records carrying `reportPath`, `runStartedAt`, `reportModifiedAt` and the exact JUnit method name; both records return `RED_EVIDENCE_OK` (`target_test_failed`).
- **Files modified:** `.planning/phases/60-studio-timeline-horizontal-zoom/60-02-red-evidence-task1.json`, `60-02-red-evidence-task2.json`
- **Verification:** `gsd_run check tdd-red-evidence` returns `RED_EVIDENCE_OK` for both records.
- **Committed in:** `6b8fad8c0` (metadata commit carries the evidence records)

**2. [Rule 3 - Blocking] Plan reference drift: no group-drag ghost pitch geometry exists**
- **Found during:** Task 2
- **Issue:** The plan's read_first cites a group drag ghost at `PhysicsPaintWorkflowStrip.tsx:5525-5545`; at HEAD that range is the timeline scrollbar pointer handler. The group-drag preview is a per-cell class (`rotoGroupDragGapPreviewAppFrames` → `roto-fill-empty`) with no pixel geometry.
- **Fix:** Converted every actual ghost/preview site in the file instead; no group ghost code change was needed because none carries pitch geometry. The remaining `ROTO_CELL_WIDTH_PX` uses are the sound stains/preview family and the open/reveal scroll positioning, both explicitly deferred to 60-03.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- **Verification:** `grep` shows the ghost region is clean; the ghost contract test passes.
- **Committed in:** `0f24748da`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were execution-mechanics corrections. No scope creep; no production behavior beyond the planned conversions.

## Issues Encountered

- The two new cross-track insertion pins passed immediately because `computeInsertionFrame` already applies `framePitch * zoom` once. The genuine RED evidence for Task 1 therefore comes from the repointed A3/A4 push projection pins, which failed while the strip still divided by `ROTO_CELL_WIDTH_PX`; the cross-track pins remain as the no-doubling regression guard. This is recorded in the Task 1 evidence `semanticAssessment`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 60-03 can now delete `ROTO_CELL_WIDTH_PX` once its sound-stain and scroll-positioning consumers convert; this plan left that constant in place intentionally.
- Manual UAT is deferred to the phase gate: drag N cells at 25%, 100% and 400% and confirm the ghost span and insertion line track the rail.

---
*Phase: 60-studio-timeline-horizontal-zoom*
*Completed: 2026-11-09*

## Self-Check: PASSED

- All 3 source/test files and both RED evidence records exist.
- All 5 task commits are ancestors of HEAD.
