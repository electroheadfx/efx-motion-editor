---
phase: quick-9
plan: 01
subsystem: ui
tags: [preact, pointer-events, deselection, properties-panel]

requires:
  - phase: quick-18
    provides: deselect layer on dead space click (EditorShell INTERACTIVE_SELECTOR)
provides:
  - data-interactive on NumericInput drag-scrub labels prevents deselection during drag
affects: []

tech-stack:
  added: []
  patterns: [data-interactive attribute for interactive non-standard elements]

key-files:
  created: []
  modified:
    - Application/src/components/layout/PropertiesPanel.tsx

key-decisions:
  - "Attribute-only fix: data-interactive on span label matches existing INTERACTIVE_SELECTOR guard in EditorShell"

patterns-established:
  - "data-interactive: Add this attribute to any non-standard interactive element (span, div) that handles pointer events to prevent EditorShell deselection"

requirements-completed: [QUICK-9]

duration: 1min
completed: 2026-03-14
---

# Quick 9: Fix Layer Deselection When Dragging Properties Panel Labels

**Added data-interactive to NumericInput drag-scrub label spans so EditorShell's deselection guard skips them**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-14T12:48:23Z
- **Completed:** 2026-03-14T12:49:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- NumericInput label drag-scrub no longer triggers layer deselection
- Fix leverages existing INTERACTIVE_SELECTOR infrastructure in EditorShell -- zero changes needed there
- Opacity range sliders already covered by `input` in INTERACTIVE_SELECTOR

## Task Commits

Each task was committed atomically:

1. **Task 1: Add data-interactive to NumericInput drag-scrub labels** - `ad89d5b` (fix)

## Files Created/Modified
- `Application/src/components/layout/PropertiesPanel.tsx` - Added `data-interactive` attribute to the draggable label `<span>` in NumericInput component

## Decisions Made
- Attribute-only fix: adding `data-interactive` to the label span is sufficient because EditorShell's INTERACTIVE_SELECTOR already includes `[data-interactive]` in its guard check (line 18). No changes needed in EditorShell.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fix is complete and self-contained
- Pattern established: any future non-standard interactive elements (spans, divs with pointer handlers) should use `data-interactive` to prevent accidental deselection

---
*Quick task: 9-fix-layer-deselection-when-dragging-slid*
*Completed: 2026-03-14*
