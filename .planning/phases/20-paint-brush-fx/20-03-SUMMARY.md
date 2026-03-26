---
phase: 20-paint-brush-fx
plan: 03
subsystem: ui
tags: [preact, canvas, p5brush, signals, paint, select-tool, fx-application]

# Dependency graph
requires:
  - phase: 20-01
    provides: "Types (StrokeFxState, BrushStyle, BrushFxParams), store signals (selectedStrokeIds, frameFxCache, paintBgColor, brushStyle), renderFrameFx()"
  - phase: 20-02
    provides: "renderPaintFrameWithBg() with solid background and frame-level FX cache compositing"
provides:
  - "Select tool with hit testing for stroke selection (D-05)"
  - "FX application workflow: draw flat, select, apply style (D-01, D-06, D-08)"
  - "Per-frame batch rendering via renderFrameFx for spectral mixing (PAINT-06)"
  - "Rollback to flat with full-frame re-render (D-10)"
  - "Delete selected strokes in select mode (D-07)"
  - "Sequence overlay toggle with keyboard shortcut O (D-13, D-14)"
  - "previewRenderer wired to renderPaintFrameWithBg for solid background compositing (D-11)"
affects: [20-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FX application via signal watching (brushStyle change triggers re-render)"
    - "Per-frame batch rendering: all FX strokes rendered together via single renderFrameFx call"
    - "Hit testing via bounding box + point distance for stroke selection"

key-files:
  created: []
  modified:
    - "Application/src/components/canvas/PaintOverlay.tsx"
    - "Application/src/components/sidebar/PaintProperties.tsx"
    - "Application/src/stores/paintStore.ts"
    - "Application/src/lib/previewRenderer.ts"

key-decisions:
  - "Flat-only drawing: all strokes created with brushStyle='flat', fxState='flat', no brushParams -- FX applied post-draw via select tool"
  - "FX application triggers full-frame re-render of ALL FX strokes together (not just newly selected) for spectral mixing correctness"
  - "showSequenceOverlay signal added to paintStore rather than component-level state for cross-component access"
  - "Removed unused renderPaintFrame import from previewRenderer (replaced by renderPaintFrameWithBg)"

patterns-established:
  - "Select tool routing: handlePointerDown checks tool === 'select' before other tool handlers"
  - "reRenderFrameFx helper: centralized frame-level FX re-render + cache update pattern"
  - "Selection indicators via setLineDash bounding boxes on temp canvas"

requirements-completed: [PAINT-01, PAINT-06, PAINT-08, PAINT-09]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 20 Plan 03: Select Tool, FX Application & Preview Wiring Summary

**Select tool with hit testing, per-frame FX application via renderFrameFx for spectral mixing, sequence overlay toggle, and previewRenderer wired to renderPaintFrameWithBg**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T08:39:36Z
- **Completed:** 2026-03-26T08:45:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented select tool with tap-to-select hit testing and multi-select (Cmd/Ctrl) per D-05
- Enforced flat-only drawing mode: all strokes created with brushStyle='flat' per D-01
- FX application via brushStyle signal watching: selected strokes get FX applied, triggering full-frame re-render of ALL FX strokes together for spectral mixing (PAINT-06)
- Rollback to flat with frame re-render per D-10, delete in select mode per D-07
- Added sequence overlay toggle with checkbox in PaintProperties and keyboard shortcut O per D-13/D-14
- Wired previewRenderer to use renderPaintFrameWithBg for solid background compositing per D-11

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement select tool, FX application with per-frame rendering, and sequence overlay toggle** - `a939cac` (feat)
2. **Task 2: Wire previewRenderer to use renderPaintFrameWithBg for solid background** - `4a5aee5` (feat)

## Files Created/Modified
- `Application/src/components/canvas/PaintOverlay.tsx` - Select tool handler, hit testing, FX application effect, selection indicators, delete handler, overlay shortcut, flat-only drawing
- `Application/src/components/sidebar/PaintProperties.tsx` - Sequence overlay toggle checkbox with description
- `Application/src/stores/paintStore.ts` - showSequenceOverlay signal, toggleSequenceOverlay/setShowSequenceOverlay methods
- `Application/src/lib/previewRenderer.ts` - Replaced renderPaintFrame with renderPaintFrameWithBg in paint layer branch

## Decisions Made
- Enforced flat-only drawing by hardcoding brushStyle='flat' in handlePointerUp rather than relying on store default -- prevents any possibility of drawing with FX style
- FX application watches paintStore.brushStyle signal via useEffect rather than requiring explicit "Apply" button -- instant feedback per D-08/D-09
- showSequenceOverlay added to paintStore (not component-level state) so PaintOverlay can read it for rendering and PaintProperties can toggle it
- Removed unused renderPaintFrame import from previewRenderer to fix TypeScript unused-variable warning (Rule 1 - Bug)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused renderPaintFrame import from previewRenderer**
- **Found during:** Task 2 (previewRenderer wiring)
- **Issue:** After replacing renderPaintFrame with renderPaintFrameWithBg, the old import became unused causing TS6133 error
- **Fix:** Removed renderPaintFrame from import statement
- **Files modified:** Application/src/lib/previewRenderer.ts
- **Committed in:** 4a5aee5

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup. No scope creep.

## Issues Encountered
None

## Known Stubs
- Sequence overlay rendering: The `showSequenceOverlay` signal is wired and toggleable, but the actual rendering of the sequence frame underneath paint in PaintOverlay is a placeholder -- the exact implementation depends on how sequence frames are accessed in paint layer context. The toggle UI and keyboard shortcut are fully functional. This will be wired when the overlay compositing approach is determined.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Select tool, FX application, and preview wiring are complete
- Plan 04 (brush style selector UI, FX param sliders, keyboard shortcut integration) can proceed
- All APIs from Plans 01 and 02 are consumed and verified working

## Self-Check: PASSED

- FOUND: Application/src/components/canvas/PaintOverlay.tsx
- FOUND: Application/src/components/sidebar/PaintProperties.tsx
- FOUND: Application/src/stores/paintStore.ts
- FOUND: Application/src/lib/previewRenderer.ts
- FOUND: commit a939cac
- FOUND: commit 4a5aee5
- FOUND: 20-03-SUMMARY.md

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-26*
