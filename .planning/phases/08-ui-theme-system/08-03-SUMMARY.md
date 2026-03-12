---
phase: 08-ui-theme-system
plan: 03
subsystem: ui
tags: [css-variables, theming, canvas-2d, cached-color-lookup, tailwind]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Three CSS theme palettes with semantic variable naming and timeline CSS variables"
provides:
  - "All remaining component files converted to CSS variable references"
  - "TimelineRenderer canvas drawing reads colors from CSS variables via cached lookup"
  - "Theme change triggers cache invalidation and canvas redraw"
  - "Complete visual theme coverage across every UI element"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas 2D cached color lookup: getComputedStyle reads --color-timeline-* variables, caches until theme change"
    - "Cache invalidation via theme signal subscription: invalidateColorCache() + requestDraw()"

key-files:
  created: []
  modified:
    - Application/src/components/project/WelcomeScreen.tsx
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/components/layout/TitleBar.tsx
    - Application/src/components/import/ImportGrid.tsx
    - Application/src/components/project/NewProjectDialog.tsx
    - Application/src/components/import/DropZone.tsx
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineCanvas.tsx
    - Application/src/components/layout/Toolbar.tsx
    - Application/src/components/overlay/ShortcutsOverlay.tsx

key-decisions:
  - "Canvas colors cached in module-level object, invalidated on theme signal change -- avoids per-frame getComputedStyle calls"
  - "PLAYHEAD_COLOR and DROP_INDICATOR_COLOR stay hardcoded as functional high-visibility constants"
  - "PLACEHOLDER_BG_A and PLACEHOLDER_BG_B stay hardcoded -- subtle tinted empty-slot backgrounds that work across all themes"
  - "CanvasArea uses fixed --color-bg-right (#0A0A0A in all themes) to keep the canvas/preview area dark"

patterns-established:
  - "Canvas 2D theme pattern: getComputedStyle + cache + invalidate on signal change"
  - "Functional colors (playhead, drop indicator, traffic lights) exempt from theme conversion"

requirements-completed: [THEME-03]

# Metrics
duration: 18min
completed: 2026-03-12
---

# Phase 8 Plan 03: Remaining Components + TimelineRenderer Summary

**Converted 8 remaining component files and made TimelineRenderer canvas drawing theme-aware with cached CSS variable lookup, completing full theme coverage**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-12T13:42:00Z
- **Completed:** 2026-03-12T14:00:12Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Converted all remaining hardcoded hex colors in WelcomeScreen, TimelinePanel, TitleBar, ImportGrid, NewProjectDialog, DropZone, CanvasArea, and EditorShell to CSS variable references
- Made TimelineRenderer canvas 2D drawing theme-aware via cached color lookup from CSS variables (--color-timeline-*)
- Wired cache invalidation to theme signal subscription in TimelineCanvas, triggering automatic redraws on theme change
- User-verified all three themes (dark, medium, light) display correctly across every panel, menu, overlay, and timeline canvas
- Added missing theme cycle shortcut (Cmd+Shift+T) to ShortcutsOverlay during verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert remaining component files and make TimelineRenderer theme-aware** - `dd62f31` (feat)
2. **Verification fix: Add theme cycle shortcut to help overlay** - `63ccdef` (fix)

**Task 2 (visual verification):** Human-approved checkpoint -- no code commit.

## Files Created/Modified
- `Application/src/components/project/WelcomeScreen.tsx` - Text colors for highlighted/non-highlighted states converted to hierarchy variables
- `Application/src/components/layout/TimelinePanel.tsx` - Section header bg, root bg, dividers converted
- `Application/src/components/layout/TitleBar.tsx` - Title bar bg converted (traffic light dots stay hardcoded)
- `Application/src/components/import/ImportGrid.tsx` - Thumbnail background, hover overlay converted
- `Application/src/components/project/NewProjectDialog.tsx` - Error bg and error text converted
- `Application/src/components/import/DropZone.tsx` - Overlay bg, inner border bg converted
- `Application/src/components/layout/CanvasArea.tsx` - Canvas container bg via --color-bg-right
- `Application/src/components/layout/EditorShell.tsx` - Shell bg converted
- `Application/src/components/timeline/TimelineRenderer.ts` - Hardcoded color constants replaced with cached CSS variable lookup, invalidateColorCache() exported
- `Application/src/components/timeline/TimelineCanvas.tsx` - Theme signal subscription wired to invalidateColorCache() + redraw
- `Application/src/components/layout/Toolbar.tsx` - Additional toolbar colors converted
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Theme cycle shortcut added to overlay

## Decisions Made
- Canvas 2D colors cached at module level and invalidated on theme signal change -- avoids expensive per-frame getComputedStyle() calls while remaining responsive to theme switches
- PLAYHEAD_COLOR (#E55A2B) and DROP_INDICATOR_COLOR (#4488FF) kept hardcoded as functional high-visibility colors that must remain consistent regardless of theme
- PLACEHOLDER_BG_A (#1A1A2A) and PLACEHOLDER_BG_B (#1A2A1A) kept hardcoded as they are subtle tinted backgrounds for empty frame slots that work across all themes
- CanvasArea uses --color-bg-right which is set to #0A0A0A in all three themes, ensuring the preview area stays dark

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing theme cycle shortcut in ShortcutsOverlay**
- **Found during:** Task 2 (Visual verification checkpoint)
- **Issue:** Cmd+Shift+T theme cycling shortcut was functional but not listed in the keyboard shortcuts help overlay
- **Fix:** Added the shortcut entry to ShortcutsOverlay.tsx
- **Files modified:** Application/src/components/overlay/ShortcutsOverlay.tsx
- **Verification:** Shortcut now appears in overlay (Shift+? to view)
- **Committed in:** 63ccdef

---

**Total deviations:** 1 auto-fixed (1 bug -- missing overlay entry)
**Impact on plan:** Minor UI completeness fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete theme system is shipped -- all UI elements adapt to dark/medium/light themes
- Phase 08 is fully complete (3/3 plans done)
- Ready to move to Phase 09

---
*Phase: 08-ui-theme-system*
*Completed: 2026-03-12*
