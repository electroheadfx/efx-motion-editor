---
phase: quick-11
plan: 01
subsystem: ui
tags: [preact, portal, popover, z-index, css-variables]

# Dependency graph
requires:
  - phase: 12-layer-keyframe-animation
    provides: KeyframePopover component and keyframe diamond click interaction
provides:
  - Correctly layered and opaque interpolation popover menu
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createPortal to document.body for popover z-index isolation"

key-files:
  created: []
  modified:
    - Application/src/components/timeline/KeyframePopover.tsx

key-decisions:
  - "Portal to document.body for stacking context escape (same pattern as SequenceList context menu)"
  - "Use --color-bg-menu CSS variable (defined in all 3 themes) to replace non-existent --color-bg-panel"

patterns-established:
  - "Popover portal pattern: wrap fixed-position overlays in createPortal(el, document.body) when they need to escape parent stacking contexts"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-03-15
---

# Quick Task 11: Fix Interpolation Menu Z-Index and Transparent Background

**Interpolation popover portaled to document.body with opaque theme-aware background via --color-bg-menu**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-15T15:18:02Z
- **Completed:** 2026-03-15T15:19:02Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Popover now renders above all UI panels (timeline controls bar, properties bottom bar) via createPortal to document.body
- Background is solid/opaque in all three themes using --color-bg-menu (dark: #1E1E1E, medium: #4A4A4A, light: #FFFFFF)
- Backdrop click-to-close behavior preserved
- Easing selection functionality unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix KeyframePopover z-index via portal and fix transparent background** - `830368d` (fix)

## Files Created/Modified
- `Application/src/components/timeline/KeyframePopover.tsx` - Added createPortal import from preact/compat, wrapped return JSX in createPortal(..., document.body), replaced --color-bg-panel with --color-bg-menu

## Decisions Made
- Used createPortal to document.body (same pattern already established in SequenceList.tsx) rather than increasing z-index values, which would not work across sibling stacking contexts
- Chose --color-bg-menu as the replacement variable since it is defined in all three themes and semantically matches (popover is a menu)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Interpolation popover fully functional and visible in all themes
- No blockers

## Self-Check: PASSED

- FOUND: Application/src/components/timeline/KeyframePopover.tsx
- FOUND: .planning/quick/11-fix-interpolation-menu-z-index-and-trans/11-SUMMARY.md
- FOUND: commit 830368d

---
*Quick Task: 11-fix-interpolation-menu-z-index-and-trans*
*Completed: 2026-03-15*
