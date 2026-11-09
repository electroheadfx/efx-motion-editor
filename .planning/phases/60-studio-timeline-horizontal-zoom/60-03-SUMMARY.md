---
phase: 60-studio-timeline-horizontal-zoom
plan: 03
subsystem: ui
tags: [preact-signals, timeline, zoom, sound-stains, rail-width, viewport-positioning]

# Dependency graph
requires:
  - phase: 60-studio-timeline-horizontal-zoom
    provides: "60-01's session pitch authority + already-converted registered viewport getter; 60-02's interaction-surface conversions (ghosts, drag projections, cross-track port)"
provides:
  - "Sound stain, edge handles, duplicate ghost and live band preview all place/size from the live pitch (leaf-subscribed for renders, peeked for gestures)"
  - "Open-frame and reveal positioning centre on the peeked pitch with both dependency arrays byte-identical to HEAD (Pitfall 13)"
  - "Scaled cell gap threaded into the rail-width law: 52 / 208 / 13 for a three-frame rail at 1x / 4x / 0.25x"
  - "The strip declares no pitch constant; ROTO_CELL_WIDTH_PX is gone and RULER_STEP survives"
affects: [60-04, 60-05, 60-06]

actuals:
  tokens: 7188
  tasks: 3
  commits: 6
  plan_head_before: 2714501c2f7603250696aec2abdf7124b3477cd0
  plan_head_after: c34c76cf19908f641ced7f051dda14549795222d

tech-stack:
  added: []
  patterns:
    - "Narrow sound leaves subscribe to the metrics in their own bodies; the live placement preview peeks at event time (efx-preact-reactivity rules 5/6)"
    - "One-shot positioning effects peek the pitch inside the body and never add zoom to their dependency arrays (RESEARCH Pitfall 13)"
    - "Optional frameGap parameters defaulting to TIMELINE_GEOMETRY.cellGap at every new seam, so existing callers and rail tests stay green while the strip always passes the scaled value"

key-files:
  created:
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-03-red-evidence-task1.json
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-03-red-evidence-task2.json
    - .planning/phases/60-studio-timeline-horizontal-zoom/60-03-red-evidence-task3.json
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx

key-decisions:
  - "Sound leaves read timelineZoom.metrics.value.pitch in their own bodies; the band preview peeks, so a drag never re-subscribes the strip to zoom"
  - "Edge-handle pixel offsets (leftPx - 3, leftPx + max(0, width - 5)) stay fixed — only the stain frame geometry scales (D-13 spirit)"
  - "Open/reveal effects peek the live pitch and keep their dependency arrays byte-identical to HEAD; zooming never re-runs either positioning effect"
  - "frameGap is an optional fourth parameter with a TIMELINE_GEOMETRY.cellGap default on the loop geometry and both rail families; the strip always supplies timelineMetrics.cellGap"
  - "The Key Rail drag preview also subtracts the scaled gap; the group-drag hook keeps its own Math.max(1, …) preview law (outside this plan's files)"
  - "ROTO_CELL_WIDTH_PX retired; RULER_STEP remains the ruler's no-subdivide floor"

patterns-established:
  - "Gap-scaling acceptance table: frames × pitch − gap is asserted at 1x (52), 4x (208) and 0.25x (13), including the clipped branch that ignores the gap"
  - "Effect dep-array preservation pin: slice the effect to its closing dep line and assert exact equality plus absence of any zoom identifier"

requirements-completed: [ZOOM-01, ZOOM-05]

coverage:
  - id: D1
    description: "Sound stain, edge handles, duplicate ghost and the live placement preview place and size from the live pitch; edge footprints stay pixel-fixed"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Phase 60 (ZOOM-05) sound leaves read the live pitch"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the pitch expression, not the painted overlays. Plan defers visual UAT: a sound clip's stain must cover the same frames at 25% and 400%."
  - id: D2
    description: "Open-frame and reveal positioning centre on the pitch peeked in the effect body with both dependency arrays unchanged and zoom-free"
    requirement: "ZOOM-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Phase 60 (ZOOM-05) open-frame and reveal positioning peek the live pitch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts#reads the visible frame window in live-pitch frames"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rail-width law subtracts the scaled gap (52 / 208 / 13) and both rail types consume frameGap from the strip"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#Phase 60 (ZOOM-05) loop-clip rail width follows the scaled gap"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#Phase 60 (ZOOM-05) scaled rail gap contract"
        status: pass
    human_judgment: true
    rationale: "The pixel table is pinned, but the visual claim (a loop rail's right edge lands on the last cell's right edge at both zoom ends) is deferred to the phase UAT gate."
  - id: D4
    description: "The strip declares no pitch constant and the full suite plus typecheck stay green"
    requirement: "ZOOM-05"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#strip geometry pitch contract (repointed constant pin)"
        status: pass
      - kind: build
        ref: "pnpm --filter efx-motion-editor exec vitest run (405 files, 8303 passed) and pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-11-09
status: complete
---

# Phase 60 Plan 03: Sound Leaves, Positioning and the Scaled Rail Gap Summary

**The last strip-level pitch consumers now follow the session authority — sound stains and ghosts size from the live pitch, open/reveal positioning peeks it without subscribing, and the rail gap scales with the pitch while the legacy strip constant is retired.**

## Performance

- **Duration:** 4 min from the first recorded RED run to the final task commit (plan reading preceded it)
- **Started:** 2026-11-09T12:37:07Z
- **Completed:** 2026-11-09T12:41:04Z
- **Tasks:** 3/3
- **Files modified:** 6 source/test files + 3 persisted RED evidence records
- **Diff:** 250 insertions, 30 deletions (source and test files)

## Accomplishments

- The sound stain, its trim handles, the incoming-duplicate ghost and the live band preview all place and size from `timelineZoom.metrics`; waveform source-space windowing, gain/fade overlays and the peak tier rule are unchanged, and the handle pixel offsets stay fixed.
- The one-shot Studio-open positioning and the reveal request centre on `timelineZoom.metrics.peek().pitch` read inside each effect body, with both dependency arrays byte-identical to HEAD, so zooming can never snap the viewport back (Pitfall 13).
- `projectPhysicsPaintLoopClipGeometry` accepts the scaled `frameGap` and both rail families thread it into every `projectTimelineRailLineWidth` call they own, including the Key Rail drag preview — three frames now measure 52 / 208 / 13 at 1x / 4x / 0.25x.
- The strip passes `frameGap={timelineMetrics.cellGap}` beside the live pitch to both rails and no longer declares `ROTO_CELL_WIDTH_PX`; `RULER_STEP` is kept.
- Full suite green at 8303 passed / 405 files (1 skipped, 96 todo); `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | TDD | `6aafb122e` | `test(60-03)`: pin sound leaves and the viewport doc to the live pitch |
| 1 | TDD | `7164393b1` | `feat(60-03)`: size the sound leaves on the live timeline pitch |
| 2 | TDD | `cc3cd6db5` | `test(60-03)`: pin open-frame and reveal positioning to the live pitch |
| 2 | TDD | `edfa075ee` | `feat(60-03)`: position the open and reveal frames on the live pitch |
| 3 | TDD | `8a8a0d95d` | `test(60-03)`: pin the scaled rail gap at 52 / 208 / 13 and both rail props |
| 3 | TDD | `c34c76cf1` | `feat(60-03)`: scale the rail gap with the live pitch and retire the constant |

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan).

## Files Created/Modified

- `PhysicsPaintWorkflowStrip.tsx` — sound leaves/preview read the live pitch; open/reveal effects peek it; both rails receive the scaled gap; the pitch constant and its comment block are retired.
- `PhysicsPaintWorkflowStrip.test.ts` — five sound-leaf pins, three positioning pins (including dep-array byte equality), a scaled-rail-gap pin, and the repointed constant pin.
- `physicsPaintLoopClipPresentation.ts` — optional `frameGap` (default `TIMELINE_GEOMETRY.cellGap`) forwarded to the rail-width law.
- `physicsPaintLoopClipPresentation.test.ts` — scaled-gap describe with the 52 / 208 / 13 table, the clipped branch and the default-gap case.
- `PhysicsPaintKeyRail.tsx` — optional `frameGap` on both prop layers, threaded into the projection helper and the drag-preview width.
- `PhysicsPaintLoopClipRail.tsx` — optional `frameGap` forwarded into the loop geometry call.
- Three `60-03-red-evidence-taskN.json` records — JUnit RED evidence, all `RED_EVIDENCE_OK` (`target_test_failed`).

## Decisions Made

- Sound leaves subscribe in their own bodies (render leaf) while the band preview peeks at event time; the strip body gains no zoom read for them.
- The edge handles keep a fixed 5-8px footprint; only frame-derived geometry scales (D-13 spirit for fixed markers).
- Both positioning effects peek and keep their exact dep arrays; a zoom change must never re-run a one-shot positioning effect.
- New `frameGap` seams are optional with `TIMELINE_GEOMETRY.cellGap` defaults so all pre-zoom callers (Track Row, hook previews, rail tests) stay byte-compatible; the strip always passes the scaled value.
- The group-drag hook's `Math.max(1, …)` preview width is deliberately untouched (outside `files_modified`); the accepted-rail law owns the gap rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan read_first line numbers had drifted**
- **Found during:** Tasks 1-3
- **Issue:** The plan cites `PhysicsPaintWorkflowStrip.tsx:2455-2500` for the stain, `:4180-4200` for the preview and `:5630-5670` for the rail prop sites; after 60-01/60-02 those symbols sit at 2486 / 4266 / 5758+5790.
- **Fix:** Located every site by symbol search instead of line number; no behavior change beyond the planned conversions.
- **Files modified:** `PhysicsPaintWorkflowStrip.tsx`
- **Verification:** All plan target tests and the full suite pass.
- **Committed in:** `7164393b1`, `edfa075ee`, `c34c76cf1`

**2. [Rule 3 - Blocking] The registered viewport getter was already converted by 60-01**
- **Found during:** Task 2
- **Issue:** Task 2 asks to convert the getter to divide by the peeked pitch; 60-01's deviation #1 already did that (its wiring test pins `const pitch = timelineZoom.metrics.peek().pitch;` and both divisions).
- **Fix:** No further getter change; Task 2's remaining work was the two positioning effects plus the new dep-array assertion. The getter's doc comment was updated under Task 1's explicit doc instruction.
- **Files modified:** none beyond the planned Task 2 files
- **Verification:** `physicsPaintTimelineZoomWiring.test.ts` and the new positioning pins pass.
- **Committed in:** `edfa075ee`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both are execution-mechanics corrections; no scope creep and no unplanned behavior.

## Issues Encountered

- The 1x baseline (52) and default-gap loop-clip cases pass even at RED because the 3-argument call already defaults the gap to 2. The genuine RED evidence comes from the 4x/0.25x cases (214 / 11.5 versus 208 / 13) and the two strip pins; this is recorded in the Task 3 `semanticAssessment`.

## Deferred Issues

- Two doc comments in files outside this plan's `files_modified` still cite the retired constant: `usePhysicsPaintRulerScrub.ts:49` ("the strip passes ROTO_CELL_WIDTH_PX = 18") and `physicsPaintAudioController.ts:64` (the Fit-to-view formula). They describe the pre-zoom contract and are harmless, but a later quick should reword them to "live pitch".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 60-04 (track row, motion lanes, insertion line) and 60-05 (required `cellWidthPx`) can now rely on the gap rule as the single rail-width law.
- Manual UAT is deferred to the phase gate: at 25% and 400%, a sound stain must cover exactly its clip's frames and a loop rail's right edge must land on the last cell's right edge at both range ends.

---
*Phase: 60-studio-timeline-horizontal-zoom*
*Completed: 2026-11-09*

## Self-Check: PASSED

- All 6 source/test files and all 3 RED evidence records exist on disk.
- All 6 task commits are ancestors of HEAD.
