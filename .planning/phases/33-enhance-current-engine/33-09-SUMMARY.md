---
phase: 33-enhance-current-engine
plan: 09
subsystem: paint
tags: [fx-cache, paint-mode, persistence, p5-brush, preact-signals]

requires:
  - phase: 33-enhance-current-engine
    provides: paint store with FX cache, brush styles, p5.brush adapter
provides:
  - FX cache invalidation on clearFrame and color change
  - Color-aware FX cache keys in brushP5Adapter
  - activePaintMode signal with persistence
  - Mode-aware background rendering (white for FX, transparent for flat)
  - Paint preferences persistence (brush color, size, paint mode)
affects: [paint-overlay, paint-properties, export-renderer]

tech-stack:
  added: [@tauri-apps/plugin-store for paint preferences]
  patterns: [lazy dynamic import for circular dependency avoidance, mode-aware rendering]

key-files:
  created:
    - app/src/lib/paintPreferences.ts
  modified:
    - app/src/stores/paintStore.ts
    - app/src/lib/brushP5Adapter.ts
    - app/src/lib/paintRenderer.ts

key-decisions:
  - "activePaintMode as separate signal from brushStyle -- mode controls rendering pipeline, brushStyle controls individual stroke appearance"
  - "Lazy dynamic imports for layerStore/timelineStore in setBrushColor to avoid circular dependency"
  - "Separate paint-preferences.json Tauri store file to isolate paint prefs from app config"

patterns-established:
  - "Pattern: Use dynamic import() for cross-store dependencies in paintStore methods"
  - "Pattern: Mode-aware background rendering in paintRenderer (check activePaintMode before paintBgColor)"

requirements-completed: [ECUR-01, ECUR-03, ECUR-06, ECUR-09]

duration: 5min
completed: 2026-04-05
---

# Phase 33 Plan 09: FX Cache Invalidation and Paint Mode Persistence Summary

**FX cache invalidation on clearFrame/color change, color-aware cache keys, activePaintMode with persistence, and mode-aware white/transparent background**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T11:54:56Z
- **Completed:** 2026-04-05T11:59:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- clearFrame now immediately invalidates and refreshes FX cache (both immediate execution and redo closure)
- setBrushColor refreshes FX canvas when in fx-paint mode with lazy-loaded store dependencies
- FX cache key includes stroke color so color changes produce fresh renders
- New activePaintMode signal ('flat' | 'fx-paint') persists across app restart via Tauri store
- FX mode always renders with white background; flat mode supports transparent or user-configured color

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix FX cache invalidation in clearFrame, setBrushColor, and cache key** - `79c8b8e` (fix)
2. **Task 2: Add paint mode persistence and FX mode white background** - `c02024c` (feat)

## Files Created/Modified
- `app/src/lib/paintPreferences.ts` - New module for paint preference persistence via Tauri LazyStore
- `app/src/stores/paintStore.ts` - activePaintMode signal, clearFrame FX invalidation, setBrushColor FX refresh, setActivePaintMode, initFromPreferences
- `app/src/lib/brushP5Adapter.ts` - FX cache key includes s.color
- `app/src/lib/paintRenderer.ts` - Mode-aware background (white for FX, transparent-capable for flat)

## Decisions Made
- Created activePaintMode as a dedicated signal separate from brushStyle -- brushStyle controls per-stroke rendering while activePaintMode controls the rendering pipeline mode
- Used dynamic import() for layerStore/timelineStore in setBrushColor to avoid circular dependencies (matching existing require() pattern in auto-flatten effect)
- Created dedicated paint-preferences.json Tauri store file rather than adding to app-config.json

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added brushSize persistence in setBrushSize**
- **Found during:** Task 2 (paint mode persistence)
- **Issue:** Plan only mentioned saveBrushColor but setBrushSize also needed persistence for complete brush preference restore
- **Fix:** Added saveBrushSize call in setBrushSize method
- **Files modified:** app/src/stores/paintStore.ts
- **Verification:** setBrushSize now calls saveBrushSize via dynamic import
- **Committed in:** c02024c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix ensures complete brush preference persistence. No scope creep.

## Issues Encountered
- paintPreferences.ts did not exist yet (plan assumed it did) -- created as new file in Task 1 since setBrushColor needed it
- activePaintMode signal did not exist yet -- created in Task 1 since setBrushColor guard needed it, then extended in Task 2 with persistence

## Known Stubs
None -- all data paths are fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- activePaintMode signal available for UI components (PaintProperties mode selector)
- initFromPreferences() method ready to be called from app initialization
- FX cache correctly invalidates on all mutation paths

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
