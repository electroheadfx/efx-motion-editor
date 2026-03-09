---
phase: 03-project-sequence-management
plan: 07
subsystem: ui
tags: [preact, createPortal, sortablejs, forceFallback, context-menu, drag-reorder]

requires:
  - phase: 03-project-sequence-management
    provides: "SortableJS with DOM revert pattern for sequence reorder (03-06)"
provides:
  - "Portal-based context menu via createPortal to document.body"
  - "forceFallback SortableJS bypassing Tauri HTML5 DnD interception"
affects: []

tech-stack:
  added: []
  patterns:
    - "createPortal to document.body for menus inside overflow containers"
    - "forceFallback:true for SortableJS in Tauri to bypass native DnD interception"

key-files:
  created: []
  modified:
    - Application/src/components/sequence/SequenceList.tsx

key-decisions:
  - "Use createPortal from preact/compat to render context menu in document.body, escaping overflow-y-auto container"
  - "Use position:fixed with getBoundingClientRect for portal menu positioning"
  - "SortableJS forceFallback:true uses CSS transforms + pointer events instead of native HTML5 DnD"
  - "Remove relative class from SequenceItem wrapper since portal menu no longer needs positioning ancestor"

patterns-established:
  - "Portal context menu: createPortal + position:fixed + getBoundingClientRect for menus in overflow containers"
  - "SortableJS in Tauri: forceFallback:true to bypass Tauri's native DnD event interception"

requirements-completed: [SEQN-01, SEQN-03]

duration: 2min
completed: 2026-03-09
---

# Phase 03 Plan 07: Portal Context Menu and forceFallback SortableJS Summary

**Portal-rendered context menu via createPortal escapes overflow container scrollbar; forceFallback SortableJS bypasses Tauri HTML5 DnD interception for sequence drag reorder**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T13:42:56Z
- **Completed:** 2026-03-09T13:45:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Context menu renders as floating overlay via createPortal to document.body with position:fixed -- no scrollbar in sequence list overflow container
- SortableJS uses forceFallback:true to use CSS transforms + pointer events instead of native HTML5 DnD -- drag reorder works in Tauri without disabling file drop
- Menu position computed from action button getBoundingClientRect for accurate placement
- Click-outside handler continues working with portal since it checks menuRef.current.contains()

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal context menu and forceFallback SortableJS** - `6e326bc` (fix)

## Files Created/Modified
- `Application/src/components/sequence/SequenceList.tsx` - Import createPortal from preact/compat, render context menu via portal to document.body, add forceFallback:true and fallbackClass to SortableJS config, remove relative from wrapper div, add menuBtnRef and openMenu helper for position computation

## Decisions Made
- **createPortal over z-index fix:** The context menu was inside an overflow-y-auto container, so any absolutely-positioned child would either be clipped or cause a scrollbar. Portal to document.body completely escapes the overflow context.
- **position:fixed with getBoundingClientRect:** Menu position is computed from the action button's viewport coordinates. The fallback uses mouse event clientX/clientY for right-click context menus.
- **forceFallback over disabling Tauri DnD:** Tauri v2 intercepts native HTML5 drag events by default (dragDropEnabled). forceFallback makes SortableJS use CSS transforms + pointer events, bypassing this entirely. This preserves Tauri's file drop feature which is needed for image import.
- **Removed relative class:** No remaining child elements in SequenceItem use absolute positioning (active indicator, drag handle, thumbnail all use normal flex flow), so relative was only needed for the old inline context menu.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT test 2 (context menu scrollbar) and test 3 (drag reorder) gaps are closed
- Plan 08 remains for additional UAT gap closure
- Ready for UAT re-verification after plan 08 completes

## Self-Check: PASSED

All files exist. Commit verified (6e326bc).

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-09*
