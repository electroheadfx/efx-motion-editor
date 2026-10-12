---
phase: quick-261010-mwy
plan: 261010-mwy
subsystem: timeline
tags: [timeline-span, zoom, physic-paint, preact-signals, isolation, add-fx-menu]

# Dependency graph
requires:
  - phase: quick-261010-g2n
    provides: prior art for the same viewport math (AudioProperties Fit to view)
provides:
  - timelineVisibleSpan.ts as the only home of the LOCKED view-span law
  - resolvePhysicPaintCreateSpan isolation-vs-view creation decision
  - Physic Paint layer creation that fills exactly the visible timeline frames
affects: [timeline, physic-paint, add-layer-menu, sequence-store]

# Actuals (#2632)
actuals:
  tokens: 3162
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure view-span helper module (no store imports, no Preact) with the LOCKED formula as its only home"
    - "Click-time .peek() reads of viewport signals so a menu is not subscribed to scroll/zoom churn"

key-files:
  created:
    - app/src/lib/timelineVisibleSpan.ts
    - app/src/lib/timelineVisibleSpan.test.ts
    - app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts
  modified:
    - app/src/components/timeline/AddFxMenu.tsx

key-decisions:
  - "timelineVisibleSpan.ts is the only home of the LOCKED view-span law; callers pass {zoom, scrollX, viewportWidth} and never re-derive the formula"
  - "resolvePhysicPaintCreateSpan keeps the isolation-vs-view decision pure so it is testable without mounting AddFxMenu"
  - "Physic Paint is the only call site that passes a view-derived span; Paint / FX / content keep the one-click createFxSequence fallback"
  - "viewport signals are read with .peek() at click time (narrow reads) — the menu is not subscribed to scroll/zoom"
  - "previewRenderer is mocked in the helper suite so the pure module stays free of store side effects (same pattern as TimelineRenderer.test.ts)"

patterns-established:
  - "View-span law lives in timelineVisibleSpan.ts; AudioProperties-style geometry consumers should import from here rather than re-deriving frameWidth/trackArea"
  - "Creation-time span decisions that depend on viewport state use .peek() at the click, never a render-body .value read"

requirements-completed: [QUICK-261010-MWY]

coverage:
  - id: M1
    description: "Adding a Physic Paint layer fills exactly the timeline frames visible at the current zoom and scroll (left edge = first visible frame, right edge = last visible frame)"
    requirement: QUICK-261010-MWY
    verification:
      - kind: unit
        ref: "src/lib/timelineVisibleSpan.test.ts — zoom 1 / no scroll / 680px -> 0-10; zoom 2 -> 0-5; scrollX 120 -> 2-12"
        status: pass
      - kind: unit
        ref: "src/components/timeline/AddFxMenu.physicPaintSpan.test.ts — handler routes through resolvePhysicPaintCreateSpan with both span opts"
        status: pass
    human_judgment: true
    rationale: "Live visible range at a given zoom/scroll is a native UAT row (user-driven); unit tests prove the formula and the call-site contract, not the on-screen pixels"
  - id: M2
    description: "Zoom out before create makes a longer span; zoom in makes a shorter span; scrolling sideways moves the span window with the view"
    requirement: QUICK-261010-MWY
    verification:
      - kind: unit
        ref: "src/lib/timelineVisibleSpan.test.ts — zoom in shrinks the span; scroll moves the window"
        status: pass
    human_judgment: true
    rationale: "Zoom/scroll live behavior is a native UAT row; unit tests cover the formula inputs"
  - id: M3
    description: "On an empty project the new Physic Paint layer still matches the visible view instead of a silent fixed-length box"
    requirement: QUICK-261010-MWY
    verification:
      - kind: unit
        ref: "src/lib/timelineVisibleSpan.test.ts — 1-frame floor when trackArea is empty; resolvePhysicPaintCreateSpan has no 100-frame fallback input"
        status: pass
      - kind: unit
        ref: "src/components/timeline/AddFxMenu.physicPaintSpan.test.ts — createFxSequence fallback expression in sequenceStore.ts is intact and never an input to the helper"
        status: pass
    human_judgment: true
    rationale: "Empty-project creation length is a native UAT row"
  - id: M4
    description: "With isolation active the new Physic Paint layer keeps the isolated sequence range; the view does not override it"
    requirement: QUICK-261010-MWY
    verification:
      - kind: unit
        ref: "src/lib/timelineVisibleSpan.test.ts — non-null isolated range returns unchanged whatever the view inputs are"
        status: pass
      - kind: unit
        ref: "src/components/timeline/AddFxMenu.physicPaintSpan.test.ts — handler keeps targetSequenceId / isolatedInFrame / isolatedOutFrame short-circuit"
        status: pass
    human_judgment: true
    rationale: "Isolation-active creation is a native UAT row"
  - id: M5
    description: "Paint / FX / content layer creation keeps today's one-click span law"
    requirement: QUICK-261010-MWY
    verification:
      - kind: unit
        ref: "src/components/timeline/AddFxMenu.physicPaintSpan.test.ts — Paint / FX / content handlers keep their existing call shape; createFxSequence fallback intact"
        status: pass
    human_judgment: true
    rationale: "Other-layer creation unchanged is a native UAT row"

duration: 5min
completed: 2026-10-10
status: complete
plan_head_before: c4fe9cab54e86184eddc57c5d3144122e4b25868
plan_head_after: c97dd17e2af20e11f369f32a0a0172ed98f5290c
commits: 2
---

# Quick 261010-mwy: Physics Paint Layer Spans the Visible Timeline View Summary

**Physic Paint layer creation fills exactly the timeline frames visible at the current zoom and scroll (zoom = length control), with isolation still winning when a target sequence is isolated.**

## Accomplishments

- **LOCKED view-span law (M1/M2/M3):** Created `app/src/lib/timelineVisibleSpan.ts` as the only home of the formula — `frameWidth = BASE_FRAME_WIDTH * zoom`, `trackArea = viewportWidth - TRACK_HEADER_WIDTH`, `visibleFrameCount = max(1, round(trackArea / frameWidth))`, `inFrame = floor(scrollX / frameWidth)`, `outFrame = inFrame + visibleFrameCount`. Constants imported from `TimelineRenderer` (same pattern as AudioProperties). Degenerate zoom holds the 1-frame floor.
- **Isolation-vs-view decision (M4):** `resolvePhysicPaintCreateSpan({isolated, view})` returns the isolated range unchanged when non-null, otherwise the view span. The `createFxSequence` 100-frame fallback is never an input to this function.
- **Physic-paint-only wiring (M1-M4):** `handleAddPhysicPaintLayer` builds its `createFxSequence` span via `resolvePhysicPaintCreateSpan`, reading `timelineStore.zoom` / `scrollX` / `viewportWidth` with `.peek()` at click time (narrow reads — the menu is not subscribed to viewport signals). Always supplies both `inFrame` and `outFrame` alongside `position: 'top'`.
- **Other layer entries unchanged (M5):** `handleAddPaintLayer`, `handleAddFxLayer`, and `handleAddContentLayer` keep their existing `createFxSequence` / `setAddLayerIntent` call shapes. `sequenceStore.createFxSequence` still owns `opts?.outFrame ?? (totalFrames > 0 ? totalFrames : 100)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: View-span law helper (pure, TDD)** - `51b1e399` (test)
2. **Task 2: Wire physic-paint creation to the view span** - `c97dd17e` (feat)

## Files Created/Modified

- `app/src/lib/timelineVisibleSpan.ts` - Pure view-span law (`computeVisibleTimelineFrameSpan`) + isolation decision (`resolvePhysicPaintCreateSpan`)
- `app/src/lib/timelineVisibleSpan.test.ts` - 6 unit tests for the LOCKED formulas and isolation short-circuit
- `app/src/components/timeline/AddFxMenu.tsx` - `handleAddPhysicPaintLayer` routes through the helper with `.peek()` reads (only call site changed)
- `app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts` - 7 source-scan tests pinning the call-site contract and the untouched fallback

## Decisions Made

- Kept `timelineVisibleSpan.ts` pure (no store imports, no Preact) and imported the layout constants from `TimelineRenderer` as the plan specified. The helper suite mocks `previewRenderer` so the transitive store side effect (`paintStore` → `projectStore` markDirty wiring) does not load — same mock pattern `TimelineRenderer.test.ts` already uses.
- Single `createFxSequence` call in the physic-paint handler always carries both span opts (replacing the old isolation/no-isolation dual call). Isolation is decided inside `resolvePhysicPaintCreateSpan`, so the view never overrides an isolated range.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Fresh worktree had no `node_modules`. Ran `pnpm install` (locked workspace deps only) and `pnpm --filter @efxlab/efx-physic-paint build` so vitest could resolve the workspace package's `dist/` entry. No new packages were added to any manifest; `T-mwy-SC` (package-legitimacy gate) is N/A.
- Importing `TimelineRenderer` from the pure helper transitively pulls `previewRenderer` → `paintStore` → `projectStore` side effects, which broke the unit suite until `previewRenderer` was mocked in `timelineVisibleSpan.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated suite green (13/13). Live UAT rows (main app, user-driven) still need the user before close:
  - Timeline at a given zoom -> add Physic Paint -> in/out match the visible frame range exactly.
  - Zoom out -> new layer longer and still view-matched; zoom in -> shorter; scroll sideways -> layer starts where the view starts.
  - Empty project -> add Physic Paint -> layer matches the view (no silent fixed-length box).
  - Isolation active -> layer still spans the isolated sequence range.
  - Paint / FX / content creation unchanged.

## Constraints Honored

- `sequenceStore.createFxSequence` fallback untouched
- Physic-paint-only call-site change; Paint / FX / content handlers byte-stable in behavior
- Isolation range (`isolatedInFrame`/`isolatedOutFrame`) wins when `targetSequenceId` is set
- Span law LOCKED formula implemented only in `timelineVisibleSpan.ts`
- `.peek()` at click time — no render-body `.value` reads of viewport signals
- Preact + @preact/signals discipline (no useState added; no React patterns)
- vitest run only (never watch); no dev server; no push

---
*Phase: quick-261010-mwy*
*Completed: 2026-10-10*

## Self-Check: PASSED

- FOUND: app/src/lib/timelineVisibleSpan.ts
- FOUND: app/src/lib/timelineVisibleSpan.test.ts
- FOUND: app/src/components/timeline/AddFxMenu.tsx
- FOUND: app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts
- FOUND: .planning/quick/261010-mwy-physics-paint-layer-spans-the-visible-ti/261010-mwy-SUMMARY.md
- FOUND: 51b1e399
- FOUND: c97dd17e
