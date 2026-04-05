---
phase: 33-enhance-current-engine
plan: 04
subsystem: ui
tags: [paint-mode, preact-signals, conversion-dialog, blend-mode, transparent-background]

requires:
  - phase: 33-01
    provides: "BrushStyle per stroke, _notifyVisualChange, undo/redo fixes"
provides:
  - "PaintMode type system (flat, fx-paint, physic-paint placeholder)"
  - "PaintModeSelector component with conversion dialogs"
  - "Per-frame mode inference via getFrameMode"
  - "Mode stamping on strokes at creation and addElement"
  - "Transparent default background for flat mode"
  - "Layer blend mode and opacity controls in paint edit mode"
affects: [33-05, 33-06, 33-07]

tech-stack:
  added: []
  patterns: ["per-frame mode exclusivity", "mode-aware UI conditional rendering"]

key-files:
  created:
    - "app/src/components/sidebar/PaintModeSelector.tsx"
  modified:
    - "app/src/types/paint.ts"
    - "app/src/stores/paintStore.ts"
    - "app/src/components/sidebar/PaintProperties.tsx"
    - "app/src/components/canvas/PaintOverlay.tsx"
    - "app/src/lib/paintRenderer.ts"

key-decisions:
  - "PaintMode as union type with MODE_BRUSH_STYLES mapping for clear mode-to-style enforcement"
  - "getFrameMode infers mode from first stroke for backward compatibility with legacy strokes"
  - "DEFAULT_PAINT_BG_COLOR changed to transparent for flat mode compositing"

patterns-established:
  - "Mode-conditional UI: wrap FX-specific controls with activePaintMode.value === 'fx-paint'"
  - "Conversion dialog pattern: check frame emptiness before showing dialog"

requirements-completed: [ECUR-08, ECUR-09]

duration: 6min
completed: 2026-04-05
---

# Phase 33 Plan 04: Paint Mode System Summary

**3-mode paint system with flat/FX exclusivity, conversion dialogs, transparent flat background, and layer blend/opacity controls in paint edit mode**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T09:56:00Z
- **Completed:** 2026-04-05T10:02:18Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- PaintMode type system (flat, fx-paint, physic-paint) with per-stroke mode field and MODE_BRUSH_STYLES mapping
- PaintModeSelector component with 3-mode toggle, grayed-out physical paint, and conversion dialogs for flat/FX switching
- Per-frame mode inference via getFrameMode and mode enforcement in addElement
- Transparent default background for flat mode rendering (clearRect), FX keeps transparent WebGL compositing
- Layer blend mode dropdown and opacity slider accessible in paint edit mode
- FX brush styles and params hidden in flat mode, showFlatPreview only in FX mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PaintMode type and frame mode inference** - `a283eff` (feat)
2. **Task 2: Create PaintModeSelector UI with conversion dialogs** - `a612d96` (feat)
3. **Task 3: Wire mode enforcement in PaintOverlay and rendering pipeline** - `8359eae` (feat)

## Files Created/Modified
- `app/src/types/paint.ts` - PaintMode type, MODE_BRUSH_STYLES, mode field on PaintStroke, transparent default bg
- `app/src/stores/paintStore.ts` - activePaintMode signal, getFrameMode, setActivePaintMode, mode stamping in addElement
- `app/src/components/sidebar/PaintModeSelector.tsx` - 3-mode toggle with conversion dialog
- `app/src/components/sidebar/PaintProperties.tsx` - Mode selector integration, layer controls, mode-conditional brush styles
- `app/src/components/canvas/PaintOverlay.tsx` - Mode stamping at stroke creation
- `app/src/lib/paintRenderer.ts` - Transparent background handling with clearRect

## Decisions Made
- PaintMode as a simple union type matching BrushStyle approach for consistency
- getFrameMode checks first stroke's mode field, treating missing mode as legacy flat
- Changed DEFAULT_PAINT_BG_COLOR from '#FFFFFF' to 'transparent' for correct flat compositing over photos
- FX rendering already uses transparent WebGL clear (clearColor 0,0,0,0), no changes needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Mode system ready for use by subsequent plans
- Physical paint mode button present but disabled (placeholder for future engine integration)
- Conversion dialogs ready for flat/FX transitions

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
