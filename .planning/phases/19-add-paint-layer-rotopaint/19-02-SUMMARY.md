---
phase: 19-add-paint-layer-rotopaint
plan: 02
subsystem: canvas
tags: [paint, pointer-events, overlay, preact, signals]

# Dependency graph
requires:
  - phase: 19-01
    provides: "PaintStroke/PaintShape types, paintStore, paintRenderer, strokeToPath"
provides:
  - "PaintOverlay component for capturing pointer events during paint mode"
  - "Paint mode toggle button in canvas toolbar with Paintbrush icon"
  - "Conditional PaintOverlay/TransformOverlay rendering"
  - "P keyboard shortcut for toggling paint mode"
  - "TransformOverlay safety gate when paint mode active on paint layer"
affects: [19-03, 19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Conditional overlay swap pattern (PaintOverlay replaces TransformOverlay)"]

key-files:
  created:
    - "Application/src/components/canvas/PaintOverlay.tsx"
  modified:
    - "Application/src/components/layout/CanvasArea.tsx"
    - "Application/src/components/canvas/TransformOverlay.tsx"

key-decisions:
  - "PaintOverlay renders a temp canvas for live stroke preview rather than DOM elements"
  - "Conditional swap: PaintOverlay replaces TransformOverlay entirely rather than overlapping"
  - "TransformOverlay has redundant safety gate via early return for edge case protection"

patterns-established:
  - "Paint mode conditional overlay: isPaintModeActive ? PaintOverlay : TransformOverlay"
  - "Cursor style mapping from active tool via cursorForTool helper"

requirements-completed: [PAINT-04, PAINT-05]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 19 Plan 02: Paint Overlay & Canvas Integration Summary

**PaintOverlay component capturing pointer events with coordinate conversion, paint mode toggle button with P shortcut, and conditional TransformOverlay gating**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T20:19:25Z
- **Completed:** 2026-03-24T20:23:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PaintOverlay captures pointer events, converts client coordinates to project-space via clientToCanvas, and commits brush/eraser strokes and shapes to paintStore
- Paint mode toggle button with Paintbrush icon added to canvas toolbar, with accent color when active
- P keyboard shortcut toggles paint mode, with standard input field guards
- TransformOverlay replaced by PaintOverlay when paint mode is active on a paint layer, with safety early-return in TransformOverlay itself
- Live stroke preview via rAF-gated temporary canvas overlay during drawing
- Space+drag pan delegation preserved in paint mode (D-11)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PaintOverlay component for pointer event capture** - `7b5f176` (feat)
2. **Task 2: Add paint mode toggle to CanvasArea and gate TransformOverlay** - `6aff3ec` (feat)

## Files Created/Modified
- `Application/src/components/canvas/PaintOverlay.tsx` - New component: pointer event capture, coordinate conversion, stroke accumulation, live preview, shape tools, eyedropper
- `Application/src/components/layout/CanvasArea.tsx` - Added paint mode toggle button, P shortcut, conditional PaintOverlay/TransformOverlay rendering, visual border indicator
- `Application/src/components/canvas/TransformOverlay.tsx` - Added paintStore import and early return when paint mode active on paint layer

## Decisions Made
- Used a temporary canvas element for live stroke preview rather than modifying the main preview canvas, keeping rendering concerns separated
- Conditional overlay swap replaces TransformOverlay entirely rather than rendering both and hiding one, reducing unnecessary DOM and event listener overhead
- Added redundant safety gate in TransformOverlay (early return null) as defense-in-depth against edge cases where both overlays might render

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports from PaintOverlay**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `renderPaintFrame` and `PaintElement` were imported but unused, causing TS6133/TS6196 errors
- **Fix:** Removed unused imports; used `strokeToPath` directly for live preview
- **Files modified:** Application/src/components/canvas/PaintOverlay.tsx
- **Verification:** TypeScript compiles without errors from this file
- **Committed in:** 7b5f176 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup, no scope change.

## Issues Encountered
- node_modules not present in worktree; resolved by running pnpm install before TypeScript verification

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality wired to real data sources.

## Next Phase Readiness
- PaintOverlay ready for Plan 03 (PreviewRenderer integration) to render committed strokes
- Paint mode toggle and conditional overlay rendering established for Plan 04 (sidebar paint tools panel)
- Eyedropper tool functional; fill tool is intentional no-op placeholder for Plan 06

---
*Phase: 19-add-paint-layer-rotopaint*
*Completed: 2026-03-24*
