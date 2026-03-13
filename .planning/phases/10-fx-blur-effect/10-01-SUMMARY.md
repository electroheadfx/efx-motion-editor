---
phase: 10-fx-blur-effect
plan: 01
subsystem: rendering
tags: [blur, stackblur, canvas-2d, fx, preact-signals]

# Dependency graph
requires:
  - phase: 07-color-grade
    provides: "Adjustment layer pattern (fxColorGrade, drawAdjustmentLayer, offscreen canvas caching)"
provides:
  - "adjustment-blur LayerType and LayerSourceData"
  - "Per-layer blur property on Layer interface (normalized 0-1)"
  - "blurStore with hqPreview/bypassBlur signals"
  - "applyFastBlur (downscale-upscale) and applyHQBlur (StackBlur) algorithms"
  - "PreviewRenderer blur at 3 levels: content layer, generator layer, standalone adjustment"
affects: [10-02-PLAN, export-renderer]

# Tech tracking
tech-stack:
  added: [stackblur-canvas]
  patterns: [ping-pong-downscale-blur, offscreen-blur-composite, blur-store-signal-pattern]

key-files:
  created:
    - Application/src/lib/fxBlur.ts
    - Application/src/stores/blurStore.ts
  modified:
    - Application/src/types/layer.ts
    - Application/src/lib/previewRenderer.ts
    - Application/package.json

key-decisions:
  - "stackblur-canvas ts-expect-error import due to package.json exports missing types entry"
  - "Quadratic normalizedToPixelRadius mapping (n*n*maxDim*0.05) for perceptually linear blur"
  - "Content layer blur uses offscreen at logical dimensions, standalone adjustment-blur works in physical pixel coords"
  - "Generator blur preserves alpha (RGB-only StackBlur) to avoid alpha halos on compositing"

patterns-established:
  - "Blur offscreen pattern: render to offscreen canvas, blur, composite with blend mode + opacity"
  - "blurStore peek pattern: isHQ()/isBypassed() use .peek() for render-loop access without subscription"

requirements-completed: [BLUR-01, BLUR-02, BLUR-03, BLUR-04, BLUR-06]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 10 Plan 01: Blur Rendering Foundation Summary

**Fast + HQ blur algorithms with PreviewRenderer integration at content, generator, and standalone adjustment levels**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T11:34:50Z
- **Completed:** 2026-03-13T11:38:47Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended type system with adjustment-blur LayerType, LayerSourceData, and per-layer blur property
- Built two blur algorithms: fast downscale-upscale for real-time preview, StackBlur for HQ mode
- Integrated blur at all 3 levels in PreviewRenderer: content layer blur, generator layer blur (RGB-only), standalone adjustment-blur
- Created blurStore with hqPreview/bypassBlur signals following established store pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend type system, install stackblur-canvas, create blurStore** - `e29a5ab` (feat)
2. **Task 2: Create blur algorithm module (fxBlur.ts)** - `2f3b566` (feat)
3. **Task 3: Integrate blur into PreviewRenderer at all 3 levels** - `52c0503` (feat)

## Files Created/Modified
- `Application/src/types/layer.ts` - Added adjustment-blur to LayerType/LayerSourceData, blur property to Layer
- `Application/src/stores/blurStore.ts` - Global blur state signals (hqPreview, bypassBlur) with toggle methods
- `Application/src/lib/fxBlur.ts` - applyFastBlur (downscale-upscale) and applyHQBlur (StackBlur) with cached offscreen canvases
- `Application/src/lib/previewRenderer.ts` - Blur integration at all 3 levels with offscreen rendering helpers
- `Application/package.json` - Added stackblur-canvas dependency
- `Application/pnpm-lock.yaml` - Lock file update

## Decisions Made
- Used `@ts-expect-error` for stackblur-canvas import because package.json `exports` field lacks `types` entry (types exist at index.d.ts but bundler moduleResolution cannot resolve them)
- Quadratic mapping for normalizedToPixelRadius gives perceptually linear blur response across 0-1 range
- Content layer blur renders to offscreen at logical dimensions (blur in logical space, then composite to DPI-scaled main canvas)
- Standalone adjustment-blur works in physical pixel coords (modifies already-rendered composite, consistent with color-grade pattern)
- Generator blur uses RGB-only StackBlur (preserveAlpha=true) to prevent alpha halo artifacts during compositing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed stackblur-canvas TypeScript import resolution**
- **Found during:** Task 2 (fxBlur.ts creation)
- **Issue:** stackblur-canvas package.json `exports` field doesn't include `types` entry, causing TS7016 with bundler moduleResolution
- **Fix:** Added `@ts-expect-error` comment on import with explanation
- **Files modified:** Application/src/lib/fxBlur.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `2f3b566` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for upstream package configuration. No scope creep.

## Issues Encountered
None beyond the stackblur-canvas type resolution documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Blur rendering foundation complete, ready for Plan 02 (UI controls)
- All blur code paths are gated behind blur > 0 and blurStore checks, so existing FX rendering is unaffected
- Plan 02 will add UI to create blur layers and adjust blur parameters

## Self-Check: PASSED

All 4 created/modified source files verified on disk. All 3 task commits verified in git history.

---
*Phase: 10-fx-blur-effect*
*Completed: 2026-03-13*
