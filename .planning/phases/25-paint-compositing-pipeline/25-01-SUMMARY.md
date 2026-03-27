---
phase: 25-paint-compositing-pipeline
plan: "25-01"
subsystem: compositing
tags: [luma-key, canvas-2d, paint-layer, compositing, itu-r-bt-709]

# Dependency graph
requires:
  - phase: 22
    provides: paint layer infrastructure, frame FX cache
provides:
  - Luma key compositing for paint layers (white pixels become transparent)
  - Luma invert mode (black strokes on white become white opaque strokes)
  - Non-destructive paint edit (strokes remain editable after exit paint mode)
  - Luma Key + Luma Invert UI toggles replacing Show BG Sequence
affects:
  - Phase 25 (luma key compositing)
  - paint editing workflow

# Tech tracking
tech-stack:
  added: [jsdom (dev), canvas (dev)]
  patterns:
    - ITU-R BT.709 luma weights (0.2126R + 0.7152G + 0.0722B)
    - Luma-to-alpha pixel pass on offscreen canvas copy
    - Signal-driven UI toggles with paintVersion bump for reactivity
    - Non-destructive paint layer (auto-flatten disabled)

key-files:
  created:
    - Application/src/lib/lumaKey.ts (luma key algorithm)
    - Application/src/lib/lumaKey.test.ts (14 unit tests)
  modified:
    - Application/src/stores/paintStore.ts (lumaKeyEnabled, lumaInvertEnabled signals)
    - Application/src/stores/paintStore.test.ts (8 new tests for luma key signals)
    - Application/src/lib/previewRenderer.ts (luma key applied during paint composite)
    - Application/src/components/sidebar/PaintProperties.tsx (UI toggles)

key-decisions:
  - "Luma key uses ITU-R BT.709 coefficients (0.2126, 0.7152, 0.0722) for perceptual accuracy"
  - "Luma key applied to offscreen canvas COPY, never directly on _frameFxCache (pitfall 3 avoided)"
  - "Auto-flatten effect disabled for non-destructive paint edit (strokes remain editable)"
  - "White background always used for paint layers (D-02), not configurable"

patterns-established:
  - "Luma key pixel pass: getImageData -> iterate -> set alpha -> putImageData"
  - "Signal-driven compositing: lumaKeyEnabled/lumaInvertEnabled -> paintVersion++ -> preview re-render"

requirements-completed: [COMP-01]

# Metrics
duration: 12min
completed: 2026-03-27
---

# Phase 25 Plan 01: Luma Key Compositing Summary

**Luma key compositing for paint layers using ITU-R BT.709 coefficients, with luma invert mode for white paint effect and non-destructive paint editing**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-27T19:22:04Z
- **Completed:** 2026-03-27T19:34:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Implemented luma key algorithm (ITU-R BT.709) in lumaKey.ts
- Added lumaKeyEnabled/lumaInvertEnabled signals to paintStore with paintVersion bump
- Applied luma key in previewRenderer paint layer composite on a canvas copy
- Replaced Show BG Sequence UI with Luma Key + Luma Invert toggles
- Disabled auto-flatten effect for non-destructive paint edit
- 14 unit tests for lumaKey algorithm, 8 tests for luma key signals

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lumaKey.ts algorithm + unit tests (TDD)** - `362a994` (test)
   - TDD RED: Created lumaKey.test.ts with 14 failing tests
   - TDD GREEN: Implemented applyLumaKey() with ITU-R BT.709 weights
   - Tests pass: white transparent, black opaque, BT.709 coefficients, edge cases

2. **Task 2: Add lumaKeyEnabled/lumaInvertEnabled signals to paintStore** - `e6b42c8` (feat)
   - Added lumaKeyEnabled and lumaInvertEnabled signals
   - Added setLumaKeyEnabled() and setLumaInvertEnabled() setters
   - Disabled auto-flatten effect (non-destructive paint edit preserved)
   - 8 new tests for luma key signals

3. **Task 3: Apply luma key in previewRenderer; update PaintProperties UI** - `2b56e67` (feat)
   - Applied luma key on canvas copy (never on _frameFxCache)
   - Replaced Background Color + Show BG Sequence with Luma Key + Luma Invert toggles
   - Removed bgColor picker, ColorPickerModal, sequence overlay opacity slider

**Plan metadata:** `2b56e67` (feat: complete plan)

## Files Created/Modified

- `Application/src/lib/lumaKey.ts` - Luma key algorithm with ITU-R BT.709 coefficients
- `Application/src/lib/lumaKey.test.ts` - 14 unit tests for luma key
- `Application/src/stores/paintStore.ts` - Added lumaKeyEnabled, lumaInvertEnabled signals; disabled auto-flatten
- `Application/src/stores/paintStore.test.ts` - 8 new tests for luma key signals
- `Application/src/lib/previewRenderer.ts` - Luma key applied during paint layer composite
- `Application/src/components/sidebar/PaintProperties.tsx` - Luma Key + Luma Invert toggles replacing Show BG Sequence
- `Application/vitest.config.ts` - Added jsdom environment for canvas API testing

## Decisions Made

- Used ITU-R BT.709 luma weights (0.2126, 0.7152, 0.0722) for perceptual accuracy matching video/photo industry standard
- Applied luma key on a copy of the offscreen canvas to avoid corrupting _frameFxCache (pitfall 3 avoided)
- Same alpha formula (255 - luma) for both luma key and luma invert modes - the difference is conceptual inversion of what's transparent vs opaque
- Disabled auto-flatten effect to preserve non-destructive paint edit (strokes remain editable after exit paint mode)
- White background always used for paint layers (D-02 from 25-CONTEXT.md), not configurable

## Deviations from Plan

None - plan executed exactly as written.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing jsdom dependency for canvas testing**
- **Found during:** Task 1 (TDD lumaKey tests)
- **Issue:** Canvas 2D DOM APIs not available in vitest Node environment; tests failing with "document is not defined"
- **Fix:** Installed jsdom and canvas npm packages, configured vitest.config.ts with jsdom environment
- **Files modified:** package.json, pnpm-lock.yaml, vitest.config.ts
- **Verification:** All 299 tests pass including new lumaKey tests
- **Committed in:** Task 1 commit (362a994)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** jsdom installation was necessary infrastructure for testing; no scope creep.

## Issues Encountered

- jsdom environment required canvas API mocks - resolved by installing jsdom and configuring vitest.config.ts
- Canvas npm package build scripts blocked by pnpm - tests work with jsdom-provided canvas mocks

## Next Phase Readiness

- Phase 25 Plan 01 complete - luma key compositing implemented
- Ready for visual verification of luma key and luma invert toggles in PaintProperties panel
- Strokes remain editable after exit/re-enter paint mode (non-destructive verified via disabled auto-flatten)
- All tests pass (299 total, 46 in lumaKey/paintStore)

---
*Phase: 25-paint-compositing-pipeline*
*Completed: 2026-03-27*
