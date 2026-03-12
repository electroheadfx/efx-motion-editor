---
phase: 08-ui-theme-system
plan: 02
subsystem: ui
tags: [css-variables, theming, tailwind, color-conversion]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Three CSS theme palettes with semantic variable naming"
provides:
  - "9 major component files fully converted to CSS variable references"
  - "All menus, panels, toolbar, overlays adapt to theme changes"
affects: [08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Semantic CSS variable references in Tailwind arbitrary values: bg-[var(--color-bg-menu)]"
    - "Identity colors stay hardcoded (FX dots, layer type indicators, Export CTA)"

key-files:
  created: []
  modified:
    - Application/src/components/timeline/AddFxMenu.tsx
    - Application/src/components/layout/LeftPanel.tsx
    - Application/src/components/layout/PropertiesPanel.tsx
    - Application/src/components/layer/AddLayerMenu.tsx
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/layer/LayerList.tsx
    - Application/src/components/layout/Toolbar.tsx
    - Application/src/components/overlay/ShortcutsOverlay.tsx
    - Application/src/components/sequence/KeyPhotoStrip.tsx

key-decisions:
  - "Semi-transparent black overlays (#000000CC, #00000080) on photo thumbnails kept hardcoded -- functional contrast overlays against photo content, not theme-dependent"
  - "Layer type indicator colors (#3B82F6, #14B8A6, #8B5CF6) kept hardcoded as identity colors alongside FX dots (#EC4899, #F97316)"

patterns-established:
  - "Tailwind arbitrary value pattern: bg-[var(--color-bg-*)] for theme-aware backgrounds"
  - "Identity colors are exempt from theme conversion -- they define entity types"

requirements-completed: [THEME-03]

# Metrics
duration: 9min
completed: 2026-03-12
---

# Phase 8 Plan 02: Component Color Conversion Summary

**Converted ~86 hardcoded hex colors across 9 component files to semantic CSS variable references for full theme adaptability**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-12T12:21:17Z
- **Completed:** 2026-03-12T12:30:37Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Converted all hardcoded hex colors in menus (AddFxMenu, AddLayerMenu), panels (LeftPanel, PropertiesPanel), and sequence list to CSS variables
- Converted remaining components (Toolbar, LayerList, ShortcutsOverlay, KeyPhotoStrip) to CSS variables
- Preserved identity colors for FX type dots, layer type indicators, and Export CTA button
- TypeScript compilation and Vite build both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert hardcoded colors in menu and panel components** - `bc3575d` (feat)
2. **Task 2: Convert hardcoded colors in Toolbar, LayerList, ShortcutsOverlay, KeyPhotoStrip** - `97f2221` (feat)

## Files Created/Modified
- `Application/src/components/timeline/AddFxMenu.tsx` - Menu bg, borders, text, hover states converted (FX dots stay hardcoded)
- `Application/src/components/layout/LeftPanel.tsx` - Section headers, subsections, dividers, error states, settings controls
- `Application/src/components/layout/PropertiesPanel.tsx` - Root bg, text colors, divider lines
- `Application/src/components/layer/AddLayerMenu.tsx` - Menu bg, borders, text, hover overlays (layer type dots stay hardcoded)
- `Application/src/components/sequence/SequenceList.tsx` - Selected state, drag handles, edit inputs, context menu, delete text
- `Application/src/components/layer/LayerList.tsx` - Selected bg, row backgrounds, drag handles, visibility toggle, delete hover
- `Application/src/components/layout/Toolbar.tsx` - Toolbar bg, dividers, button text (Export #F97316 stays hardcoded)
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Dialog bg, borders, headings, kbd badges, close button
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Thumbnail bg, add button, popover menu, image picker grid

## Decisions Made
- Semi-transparent black overlays on photo thumbnails (#000000CC, #00000080, #000000AA) kept hardcoded -- these are functional contrast overlays for readability on arbitrary photo content, not theme-dependent
- Layer type indicator dots (#3B82F6 blue, #14B8A6 teal, #8B5CF6 purple) and FX identity dots (#EC4899 pink, #F97316 orange) kept hardcoded -- these define entity identity and must be visually consistent across themes
- #888888 fallback type color in LayerList converted to var(--color-text-secondary) since it's not an identity color

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AddFxMenu.tsx located at timeline/ not layer/**
- **Found during:** Task 1
- **Issue:** Plan referenced `Application/src/components/layer/AddFxMenu.tsx` but file is at `Application/src/components/timeline/AddFxMenu.tsx`
- **Fix:** Used correct path for the file
- **Files modified:** Application/src/components/timeline/AddFxMenu.tsx
- **Verification:** File read and edited successfully
- **Committed in:** bc3575d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking -- wrong file path)
**Impact on plan:** Trivial path correction. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 9 highest-impact component files now fully respond to theme changes
- Plan 08-03 can address any remaining components with hardcoded colors
- A prior session commit (dd62f31) already converted several additional components (WelcomeScreen, TimelinePanel, TitleBar, ImportGrid, NewProjectDialog, DropZone, CanvasArea, EditorShell, TimelineRenderer)

## Self-Check: PASSED

All 9 modified files verified present. Both task commits (bc3575d, 97f2221) verified in git log.

---
*Phase: 08-ui-theme-system*
*Completed: 2026-03-12*
