---
phase: 33-enhance-current-engine
plan: 05
subsystem: ui
tags: [preact, color-picker, hsv, cmyk, tauri-store, paint]

requires:
  - phase: 33-enhance-current-engine
    provides: Brush preference persistence via LazyStore (33-02), simplified ColorPickerModal (33-03)
provides:
  - 4-mode inline color picker (Box/TSL/RVB/CMYK) with swatches
  - Shared colorUtils.ts with 8 color conversion functions
  - Recent and favorite color persistence
affects: [33-enhance-current-engine]

tech-stack:
  added: []
  patterns: [shared-color-utils, inline-picker-auto-apply, swatch-persistence]

key-files:
  created:
    - app/src/lib/colorUtils.ts
    - app/src/components/sidebar/InlineColorPicker.tsx
  modified:
    - app/src/components/shared/ColorPickerModal.tsx
    - app/src/components/sidebar/PaintProperties.tsx
    - app/src/lib/paintPreferences.ts

key-decisions:
  - "Re-export color utils from ColorPickerModal for backward compatibility with existing importers"
  - "Inline picker uses createPortal to document.body with fixed positioning on canvas left side"
  - "Auto-apply on every HSV/slider interaction, recent color collected only on pointer up"

patterns-established:
  - "Shared color utils: all color conversions in lib/colorUtils.ts, imported where needed"
  - "Inline picker pattern: no Apply/Cancel, onChange fires on every interaction"

requirements-completed: [ECUR-10]

duration: 5min
completed: 2026-04-05
---

# Phase 33 Plan 05: Inline Color Picker Summary

**4-mode inline color picker (Box HSV/TSL/RVB/CMYK) with HEX input, recent + favorite swatches persisted via LazyStore**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T09:57:20Z
- **Completed:** 2026-04-05T10:02:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted 6 color conversion functions from ColorPickerModal into shared colorUtils.ts, added rgbToCmyk and cmykToRgb (8 total exports)
- Built InlineColorPicker component with 4 modes: Box (HSV square canvas), TSL (H/S/L sliders), RVB (R/G/B sliders), CMYK (C/M/Y/K sliders)
- HEX input validates 3/4/6/8 digit hex, recent colors auto-collected (max 16), favorites user-managed
- Swatches persist across sessions via LazyStore in paintPreferences.ts
- Brush color button in PaintProperties now toggles inline picker instead of modal

## Task Commits

Each task was committed atomically:

1. **Task 1: Create colorUtils.ts with all color conversion functions** - `4dd1579` (feat)
2. **Task 2: Build InlineColorPicker component with 4 modes and swatches** - `a9cd15d` (feat)

## Files Created/Modified
- `app/src/lib/colorUtils.ts` - 8 color conversion functions (hexToRgba, rgbaToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb)
- `app/src/components/sidebar/InlineColorPicker.tsx` - 4-mode inline color picker with HSV canvas, sliders, HEX input, swatches
- `app/src/components/shared/ColorPickerModal.tsx` - Replaced inline functions with imports from colorUtils, re-exports for backward compat
- `app/src/components/sidebar/PaintProperties.tsx` - Brush color button toggles InlineColorPicker, removed old modal usage for brush color
- `app/src/lib/paintPreferences.ts` - Added loadRecentColors, saveRecentColors, loadFavoriteColors, saveFavoriteColors

## Decisions Made
- Re-exported color utils from ColorPickerModal to avoid breaking existing importers (KeyPhotoStrip, ShaderBrowser, etc.)
- Used createPortal for the inline picker to render above canvas with proper z-index
- Recent color collection happens on pointer up (not during drag) to avoid storing intermediate values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused showColorPicker state**
- **Found during:** Task 2
- **Issue:** After replacing modal with inline picker for brush color, `showColorPicker` state was unused
- **Fix:** Removed the unused state declaration to avoid lint warnings
- **Files modified:** app/src/components/sidebar/PaintProperties.tsx
- **Committed in:** a9cd15d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cleanup of dead code after refactoring. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Inline color picker ready for use in paint mode
- colorUtils.ts available for any future components needing color conversion
- Swatch persistence infrastructure ready for cross-component reuse

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
