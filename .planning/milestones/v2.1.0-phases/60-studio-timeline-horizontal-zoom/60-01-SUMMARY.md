---
phase: 60-studio-timeline-horizontal-zoom
plan: 01
subsystem: ui
tags: [preact-signals, timeline, zoom, anchoring, requestAnimationFrame]

# Dependency graph
requires: []
provides:
  - "physicsPaintTimelineZoom.ts — the ONE session-only timeline pitch authority (presets, clamp, metrics, adaptive ruler step, anchored-scroll law, fit, percent, store, scroll port, reset)"
  - "PhysicsPaintTimelineZoomBar.tsx — the prop-less header zoom pill (minus / display-only percent / plus / one-shot Fit)"
  - "The modifier-wheel input path with a one-frame rAF coalescer and the registered scroll port"
  - "The first converted consumers: lane extent, cells grid, ruler step/tick basis, both rail framePitch props and the playhead"
affects: [60-02, 60-03, 60-04, 60-05]

actuals:
  tokens: 21210
  tasks: 3
  commits: 4
  plan_head_before: 7276353f7435bef000e86a2c3ab7f8a39108a303
  plan_head_after: bdd7b4392240dfc4045c03cb4b58702fcd1be210

tech-stack:
  added: []
  patterns:
    - "Module-level signal store as the single session-only authority — no Preact context, no prop threading"
    - "Scroll-port registration seam (register/unregister on mount) so a display store can drive DOM scrollLeft without a component reference"
    - "One-frame rAF coalescer for high-frequency wheel input (accumulate from the queued target, never from the live value twice; cancel on cleanup)"
    - "CSS custom property bridge (--timeline-cell-width) for width-only scaling while vertical geometry stays fixed"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts
    - app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts
    - app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts

key-decisions:
  - "One render-body metrics read in the strip; every horizontal consumer derives from it (D-12)"
  - "The wheel anchors on the frame under the cursor; minus/plus and Fit anchor on the playhead centre with a viewport-centre fallback (D-05)"
  - "Wheel zoom is continuous exponential (~1.1x per 100px) and never snaps to a preset; minus/plus step the ladder from the raw current value (D-05/D-06)"
  - "Ruler step is the smallest multiple of 3 whose tick leaves >=40px and only ever coarsens; the tick basis is computed inline (D-09/D-10)"
  - "Fit is a one-shot action — no aria-pressed, no resize re-fit (D-04)"
  - "The percent is a non-interactive span; minus/plus disable at 0.25x/4x (D-02/D-03)"
  - "Compare-then-write inside TIMELINE_ZOOM_EPSILON: a sub-epsilon wheel tick writes nothing (D-08)"

patterns-established:
  - "Anchored zoom: hold (scrollLeft + localX) / pitch invariant through a scale change"
  - "Session-only view metrics never enter the document: resetForStudioOpen() on mount, no .mce/schema/revision/cache/export surface"

requirements-completed: [ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04]

coverage:
  - id: D1
    description: "Session-only pitch authority with its unit proof: presets, clamp, metrics table (cellWidth + cellGap == pitch), adaptive ruler step, anchored-scroll law, fit, percent and epsilon no-op writes"
    requirement: ZOOM-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cmd/Ctrl+wheel (and trackpad pinch) zooms the real Studio timeline around the cursor through one rAF flush, with the plain-wheel/Shift/diagonal guards untouched"
    requirement: ZOOM-01
    verification:
      - kind: automated_ui
        ref: "src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts#modifier wheel"
        status: pass
    human_judgment: true
    rationale: "The browser wheel path, cursor anchoring and coalescing feel can only be judged in the running Studio; vitest pins the source seam, not the live gesture."
  - id: D3
    description: "The strip renders the live pitch in its lane extent, cells grid, adaptive ruler, both rails and playhead; vertical geometry (row/lane/cell heights, ruler band, gutter, header column) is unchanged"
    requirement: ZOOM-03
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts#live geometry + CSS split"
        status: pass
      - kind: automated_ui
        ref: "src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts + .rulerSeek.test.ts"
        status: pass
    human_judgment: true
    rationale: "Visual parity at 0.25x-4x (ruler density, cell gaps, playhead centring) is a human judgement on the real timeline."
  - id: D4
    description: "The header zoom pill sits between playback and the live status: minus / integer percent / plus / Fit, ends disabled, percent display-only and Fit one-shot"
    requirement: ZOOM-02
    verification:
      - kind: automated_ui
        ref: "src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts#header pill"
        status: pass
    human_judgment: true
    rationale: "Pill fit, spacing and readability inside the 46px header band need a live visual check."

# Metrics
duration: 11min
completed: 2026-11-09
status: complete
---

# Phase 60 Plan 01: Studio Timeline Horizontal Zoom — Pitch Authority and First Consumers

**One session-only timeline pitch authority now feeds the live ruler, cells grid, lane extent, rails and playhead, driven by Cmd/Ctrl+wheel with a one-frame coalescer and a header pill.**

## Performance

- **Duration:** ~11 min from the first artifact write to the final task commit (the required reading phase preceded it)
- **Started:** 2026-11-09T13:10:00+01:00
- **Completed:** 2026-11-09T13:21:00+01:00
- **Tasks:** 3/3
- **Files modified:** 9 (4 created, 5 modified)
- **Diff:** 1188 insertions, 43 deletions

## Accomplishments

- Landed `physicsPaintTimelineZoom.ts`: the single pitch authority (ladder 0.25–4, metrics with exactly four horizontal numbers, adaptive ruler step, the one anchored-scroll law, one-shot Fit, integer percent, compare-then-write epsilon guard) with 26 unit tests covering every documented table row and edge case.
- Wired the real strip: modifier wheel → coalescer → `setScaleAtCursor` → the registered scroll port; the lane extent, cells grid (plus `--timeline-cell-width`), ruler step/tick basis, both rails and the playhead now read the live pitch; at scale 1 the timeline is byte-identical to HEAD (playhead left 6 + f×18 + 8 = 194 at frame 10).
- Added the always-visible header pill between playback and the live status, reusing the shipped nav/canvas-zoom classes; minus/plus disable at the ends, the percent is a non-interactive span, Fit carries no aria-pressed.
- Full suite green at 8283 passed / 405 files; `tsc --noEmit` clean.

## Task Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | tracer / TDD | `2e4c39314` | `test(60-01)`: failing test + RED evidence for the pitch authority |
| 1 | tracer / TDD | `66164ceed` | `feat(60-01)`: implement the timeline pitch authority |
| 2 | auto | `0188336b0` | `feat(60-01)`: wire the timeline strip to the live zoom pitch |
| 3 | auto | `bdd7b4392` | `feat(60-01)`: add the header timeline zoom pill |

Tracer gate: automated-only `<verify>` re-run end-to-end after the GREEN commit (26/26) — no human checkpoint required (auto mode inactive; `human_verify_mode=end-of-phase`).

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts` — the authority (constants, `TimelineMetrics`, `TimelineZoomScrollPort`, pure helpers, signals, `timelineZoom` store, `registerTimelineZoomScrollPort`).
- `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` — 26 unit tests (metrics table, ruler-step table + monotonic loop, anchoring invariance tables, wheel factor, ladder stepping, fit/percent/boundaries, store behaviour with an `effect()`).
- `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` — 18 source-contract tests (mount seam, wheel branch ordering, coalescer, live geometry, CSS split, header pill).
- `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx` — the prop-less pill leaf reading exactly percent / isAtMin / isAtMax.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — import, zoom mount effect (reset + port), live metrics read, adaptive ruler, live grid/lane/rails/playhead, wheel branch + coalescer, viewport getter.
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-roto-cell` width from `--timeline-cell-width`, fixed 54px tick basis removed, `.physics-paint-pill--timeline-zoom` modifier.
- `PhysicsPaintWorkflowStrip.test.ts` / `PhysicsPaintWorkflowStrip.rulerSeek.test.ts` — repointed pins (lane extent, grid + custom property, adaptive tick basis, wheel cleanup, playhead expression).

## Decisions Made

- D-01: the pill lives in always-visible static chrome (playback → zoom → live status), not behind the Tools popover.
- D-02/D-03: percent is display-only; minus/plus step the ladder from the raw current value; 1× reads 100%.
- D-04: Fit is a one-shot action and never re-fits on resize.
- D-05..D-08: continuous exponential wheel with epsilon no-op writes; cursor anchoring for the wheel, playhead-centre anchoring (viewport-centre fallback) for the pill and Fit.
- D-09..D-12: adaptive ruler step (smallest multiple of 3 leaving ≥40px, coarsens only); one render-body metrics read drives every converted consumer; only horizontal geometry scales.
- D-14: no density threshold — every frame cell renders at every scale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The registered viewport getter now divides by the live pitch**
- **Found during:** Task 2
- **Issue:** `registerTimelineViewportGetter` divided `scrollLeft`/`clientWidth` by the 1× constant, so the visible frame window would be wrong by the scale factor the moment zoom exists (feeds the audio modal's Fit-to-view and the controller's auto-scroll).
- **Fix:** read `timelineZoom.metrics.peek().pitch` at call time. This is exactly the end state 60-03's plan specifies ("reading `timelineZoom.metrics.peek().pitch` at call time"), so that task only finds its doc-comment update outstanding.
- **Files modified:** `PhysicsPaintWorkflowStrip.tsx`
- **Commit:** `0188336b0`

**2. [Rule 1 - Bug] The wheel effect cleanup had to become a block**
- **Found during:** Task 2
- **Issue:** the pre-existing pin expected `return () => el.removeEventListener('wheel', handleTimelineWheel);`; the coalescer must also cancel its pending frame on cleanup.
- **Fix:** cleanup removes the listener, then cancels `wheelZoomRafRef.current` and clears the pending refs; the pin now asserts both halves.
- **Files modified:** `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintWorkflowStrip.test.ts`
- **Commit:** `0188336b0`

**3. [Rule 3 - Blocking] Scroll port reads the strip's own frame signal; `RULER_STEP` kept readable**
- **Found during:** Task 2 (typecheck)
- **Issue:** `PhysicsPaintWorkflowStripProps.currentFrame` is a `number` (not a signal), and `noUnusedLocals` rejects `RULER_STEP` once `buildRulerTicks` takes the step as a parameter — yet the D-10 minimum constant and its pin must survive.
- **Fix:** the zoom mount effect sits beside `currentFrameSignal` and reads `currentFrameSignal.peek()`; `buildRulerTicks` uses `RULER_STEP` as the no-subdivide floor/fallback for a bad step.
- **Files modified:** `PhysicsPaintWorkflowStrip.tsx`, `physicsPaintTimelineZoomWiring.test.ts`
- **Commit:** `0188336b0`

**4. [Rule 1 - Bug] Self-caught arithmetic errors in the RED draft**
- **Found during:** Task 1
- **Issue:** the cursor-zoom anchored target was drafted as 297 vs 294 (correct: ((100+294)/18)×27 − 294 = 297) and the no-port sequence's final scale as 1 vs 1.5.
- **Fix:** corrected before the RED run so the evidence records real assertion failures, not bad expectations.
- **Files modified:** `physicsPaintTimelineZoom.test.ts`
- **Commit:** `2e4c39314`

### TDD Process Notes (not product deviations)

- The RED commit needed a scaffold module returning placeholder values; without it the first run was a module-load failure (`INVALID_RED`), not a genuine assertion failure. The scaffold was committed with the RED test and fully replaced by the GREEN implementation.
- `pnpm --filter … exec vitest --reporter=tap` writes pnpm banners to stdout after the TAP block, which the evidence classifier reads as `INVALID_RED (invalid_record)`. Evidence was captured by invoking the local binary directly (`app/node_modules/.bin/vitest run --reporter=tap`) so stdout starts at the TAP block. Classifier returned `RED_EVIDENCE_OK` (`target_test_failed`, 26 tests, 24 failing).

## Deferred Issues

- **Ruler tick mark and label offset stay at the 1× half-cell.** `.physics-paint-ruler-tick::after` and `.physics-paint-ruler-label` are positioned with a literal `left: 8px` (half of the 16px cell at 1×). The plan explicitly says to keep that rule and its positioning in 60-01, so the mark drifts off the cell centre above 1×. Revisit in 60-05 (or a later quick) if the drift is visible in UAT.
- **Drag/ghost geometry still uses the 1× constant**, by plan: 60-02 converts projections and ghosts, 60-03 converts sound leaves and retires the legacy strip constant.

## Authentication Gates

None.

## Known Stubs

None — the module, the strip seam and the pill are fully wired to live signals.

## Threat Flags

None — no new network, auth, file-access or schema surface. The zoom state is session-only and never serialized.

## Self-Check: PASSED

- Created files verified on disk: the authority module, both test files and the pill component.
- Commits verified as ancestors of HEAD: `2e4c39314`, `66164ceed`, `0188336b0`, `bdd7b4392`.
