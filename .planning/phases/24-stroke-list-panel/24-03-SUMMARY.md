---
phase: 24-stroke-list-panel
plan: "03"
subsystem: paint
tags: [paint, shortcuts, undo-redo, sidebar, collapsible]

# Dependency graph
requires:
  - phase: 24-stroke-list-panel/02
    provides: "StrokeList component, PaintProperties integration, visibility toggle, delete with undo"
provides:
  - "S key bound to paintStore.setTool('select') in paint mode"
  - "Alt+S bound to soloStore.toggleSolo() for overlay visibility toggle"
  - "CollapsibleSection header left-padding removed (pl-0 pr-3)"
  - "STROKES section ordered after SELECTION and before Copy to Next Frame"
  - "removeElement undo closure calls _notifyVisualChange + FX cache refresh"
affects: [24-stroke-list-panel/04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shortcut conflict resolved: S key for select tool, Alt+S for solo toggle"
    - "Gap-closure: padding alignment, section ordering, undo refresh"

key-files:
  created: []
  modified:
    - "Application/src/lib/shortcuts.ts"
    - "Application/src/components/sidebar/CollapsibleSection.tsx"
    - "Application/src/components/sidebar/PaintProperties.tsx"
    - "Application/src/stores/paintStore.ts"

key-decisions:
  - "S key now activates select tool in paint mode (previously bound to solo toggle)"
  - "Alt+S handles solo toggle to preserve muscle memory for users"
  - "CollapsibleSection header uses pl-0 pr-3 to align with SectionLabel 0px left-padding"
  - "STROKES section placed as sibling after SELECTION content, before Copy to Next Frame"
  - "removeElement undo closure matches pattern of reorderElements/setElementVisibility undo closures"

patterns-established: []

requirements-completed: [STRK-01, STRK-03, STRK-04]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 24 Plan 03 Summary

**Fixed 4 UAT gaps: S key shortcut now activates select tool (Alt+S for solo), STROKES section padding and ordering corrected, undo delete properly refreshes StrokeList and canvas.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T16:45:53Z
- **Completed:** 2026-03-27T16:53:06Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- S key activates select tool in paint mode (was overridden by solo toggle)
- Alt+S bound to soloStore.toggleSolo() for overlay visibility
- CollapsibleSection header left-padding aligned with other sections (pl-0 pr-3)
- STROKES section moved after SELECTION and before Copy to Next Frame
- Undo delete bumps paintVersion and refreshes FX cache, triggering StrokeList re-render

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix S key shortcut and assign Alt+S for solo toggle** - `faa2916` (fix)
2. **Task 2: Fix STROKES section left-padding alignment** - `c514301` (fix)
3. **Task 3: Move STROKES section after SELECTION and before Copy to Next Frame** - `48fbc99` (fix)
4. **Task 4: Fix removeElement undo closure to refresh StrokeList** - `98b0939` (fix)

## Files Created/Modified

- `Application/src/lib/shortcuts.ts` - S key bound to paintStore.setTool('select'), Alt+S bound to soloStore.toggleSolo() (line 444-456)
- `Application/src/components/sidebar/CollapsibleSection.tsx` - px-3 changed to pl-0 pr-3 on header div (line 27)
- `Application/src/components/sidebar/PaintProperties.tsx` - StrokeList moved from before SELECTION to after SELECTION section (lines 145-303 restructure)
- `Application/src/stores/paintStore.ts` - removeElement undo closure added _notifyVisualChange, invalidateFrameFxCache, refreshFrameFx (lines 145-151)

## Decisions Made

- S key shortcut conflict resolved by moving solo toggle to Alt+S, preserving the standard "S = select tool" convention in paint mode
- CollapsibleSection header padding changed from px-3 to pl-0 pr-3 to match SectionLabel alignment used by other sections
- STROKES section positioned as sibling after SELECTION content div, before Copy to Next Frame block
- removeElement undo closure follows same pattern as reorderElements and setElementVisibility undo closures (_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All 4 UAT gaps closed: shortcuts, padding, ordering, undo refresh
- Phase 24 StrokeList panel is complete (plan 03 is the final gap-closure plan)
- No remaining blockers for phase 24

---
*Phase: 24-stroke-list-panel/03*
*Completed: 2026-03-27*
