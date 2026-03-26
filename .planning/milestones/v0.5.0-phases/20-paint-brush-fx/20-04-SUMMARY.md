---
phase: 20-paint-brush-fx
plan: 04
subsystem: paint-persistence
tags: [flatten, persistence, fxState, frame-cache, renderFrameFx, vitest]

# Dependency graph
requires:
  - "20-01: PaintStroke fxState/brushStyle types, paintStore frameFxCache API"
  - "20-02: renderPaintFrameWithBg with frame-level FX cache compositing"
  - "20-03: PaintOverlay select tool, FX application workflow"
provides:
  - "flattenFrame() and unflattenFrame() in paintStore for fastest playback (D-17)"
  - "Frame FX cache regeneration on load in paintPersistence (PAINT-13)"
  - "Flatten Frame button in PaintProperties sidebar (select tool mode)"
  - "7 filled paintPersistence.test.ts tests (zero it.todo remaining)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frame-level FX cache regeneration on project load via renderFrameFx"
    - "Flatten marks strokes as 'flattened' and re-renders frame cache for single drawImage playback"

key-files:
  created: []
  modified:
    - "Application/src/stores/paintStore.ts"
    - "Application/src/lib/paintPersistence.ts"
    - "Application/src/lib/paintPersistence.test.ts"
    - "Application/src/components/sidebar/PaintProperties.tsx"

key-decisions:
  - "flattenFrame ensures all styled strokes are marked fx-applied before calling renderFrameFx"
  - "unflattenFrame re-renders frame cache after restoring fx-applied state (not just invalidating)"
  - "Export parity confirmed by code inspection: exportRenderer delegates to PreviewRenderer which uses renderPaintFrameWithBg"

patterns-established:
  - "Flatten/unflatten as explicit user action (not automatic) per D-17"

requirements-completed: [PAINT-12, PAINT-13]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 20 Plan 04: Flatten, Export Parity & Persistence Summary

**flattenFrame/unflattenFrame methods with per-frame cache rendering via renderFrameFx, persistence fxState round-trip with cache regeneration on load, and Flatten Frame button in select mode**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T08:53:19Z
- **Completed:** 2026-03-26T08:58:40Z
- **Tasks:** 2 (auto) + 1 (checkpoint:human-verify awaiting approval)
- **Files modified:** 4

## Accomplishments
- flattenFrame() re-renders all FX strokes via renderFrameFx and marks as 'flattened' for fastest single-drawImage playback (D-17)
- unflattenFrame() restores fx-applied state with frame cache re-render
- Persistence regenerates per-frame FX cache on load for frames with fx-applied strokes (PAINT-13)
- All 7 paintPersistence tests filled and passing (zero it.todo remaining)
- Export parity confirmed: exportRenderer delegates to PreviewRenderer which uses renderPaintFrameWithBg (PAINT-12)
- Flatten Frame button visible in PaintProperties when select tool is active

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement flatten and add Flatten button to PaintProperties** - `34b9221` (feat)
2. **Task 2: Update persistence to save fxState and regenerate frame FX cache on load** - `2fc4b20` (feat)
3. **Task 3: Visual verification of complete FX workflow** - checkpoint:human-verify (awaiting)

## Files Created/Modified
- `Application/src/stores/paintStore.ts` - Added flattenFrame()/unflattenFrame() methods, renderFrameFx and projectStore imports
- `Application/src/lib/paintPersistence.ts` - Added frame FX cache regeneration on load via renderFrameFx
- `Application/src/lib/paintPersistence.test.ts` - 7 real tests replacing todo stubs (serialization, round-trip, backward compat, no fxCachedCanvas)
- `Application/src/components/sidebar/PaintProperties.tsx` - Added Flatten Frame button in select tool mode

## Decisions Made
- flattenFrame ensures all styled strokes are marked fx-applied before calling renderFrameFx, so strokes that were drawn flat but later styled get included in the frame render
- unflattenFrame re-renders the frame cache after restoring fx-applied state (rather than just invalidating), so the visual appearance is maintained immediately
- Export parity (PAINT-12) confirmed by code inspection without code changes: exportRenderer delegates to PreviewRenderer which calls renderPaintFrameWithBg -- same code path as preview

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all code is wired to live store signals and real rendering functions.

## Next Phase Readiness
- Task 3 (human-verify checkpoint) awaits visual verification of the complete 12-point FX workflow
- All automated work is complete -- flatten, persistence, export parity, and tests are implemented and committed

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-26*
