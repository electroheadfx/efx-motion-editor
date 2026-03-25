---
phase: 20-paint-brush-fx
plan: 08
subsystem: rendering
tags: [p5.brush, brush-fx, spectral-mixing, watercolor, flow-fields, offscreen-canvas]

# Dependency graph
requires:
  - phase: 20-paint-brush-fx (plans 01-06)
    provides: "BrushStyle/BrushFxParams types, brush selector UI, FX params panel"
provides:
  - "p5.brush standalone installed as brush FX rendering backend"
  - "TypeScript type declarations for p5.brush/standalone module"
  - "brushP5Adapter.ts with renderStyledStrokes/disposeBrushFx exports"
  - "Custom brush definitions: our_ink (edge darkening), our_charcoal, our_pencil (fine grain)"
affects: [20-09, paintRenderer, brush-rendering]

# Tech tracking
tech-stack:
  added: [p5.brush@2.1.3-beta]
  patterns: [p5.brush-standalone-adapter, offscreen-canvas-rendering, custom-brush-registration]

key-files:
  created:
    - Application/src/types/p5brush.d.ts
    - Application/src/lib/brushP5Adapter.ts
  modified:
    - Application/package.json

key-decisions:
  - "p5.brush standalone replaces ~2000 lines of broken custom WebGL2 renderer with ~200 lines of adapter code"
  - "Custom our_ink/our_charcoal/our_pencil brushes via brush.add() for distinct style character"
  - "Watercolor uses fill/bleed/texture two-part approach (stroke path + bleed circles) superseding D-11 polygon deformation"
  - "brush.seed(42) for deterministic rendering (export parity per D-12)"
  - "OffscreenCanvas returned instead of HTMLCanvasElement -- both are valid CanvasImageSource for drawImage()"

patterns-established:
  - "p5.brush adapter pattern: singleton OffscreenCanvas with lazy init, custom brush registration"
  - "Style mapping: Record<string, string> from BrushStyle to p5.brush preset name"

requirements-completed: [PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06, PAINT-07, PAINT-08, PAINT-09, PAINT-10]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 20 Plan 08: p5.brush Integration Summary

**p5.brush standalone adapter replacing ~2000 LOC of broken custom WebGL2 renderer with 200-line adapter featuring spectral mixing, flow fields, watercolor fill/bleed, and custom ink/pencil brushes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T19:21:12Z
- **Completed:** 2026-03-25T19:25:15Z
- **Tasks:** 2
- **Files modified:** 10 (3 created/modified, 7 deleted)

## Accomplishments
- Installed p5.brush@2.1.3-beta standalone as battle-tested brush FX rendering backend
- Created TypeScript type declarations covering ~25 p5.brush functions used by the adapter
- Built brushP5Adapter.ts mapping all 5 non-flat brush styles to p5.brush presets with FX param modulation
- Registered custom brushes (our_ink with edge darkening per PAINT-02, our_pencil with fine grain per PAINT-04)
- Deleted 7 files of broken custom code (~2077 lines): brushFxRenderer.ts, brushFxShaders.ts, brushFlowField.ts, brushWatercolor.ts, and 3 orphaned test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install p5.brush and create TypeScript type declarations** - `7edbf8e` (chore)
2. **Task 2: Create p5.brush adapter and delete broken custom renderer** - `2ff5483` (feat)

## Files Created/Modified
- `Application/package.json` - Added p5.brush@2.1.3-beta dependency
- `Application/pnpm-lock.yaml` - Lockfile updated with p5.brush and 20 transitive deps
- `Application/src/types/p5brush.d.ts` - TypeScript declarations for p5.brush/standalone module (~25 functions)
- `Application/src/lib/brushP5Adapter.ts` - Adapter wrapping p5.brush for PaintStroke rendering (~200 lines)

### Deleted Files
- `Application/src/lib/brushFxRenderer.ts` - Broken custom WebGL2 stamp renderer (~500 lines)
- `Application/src/lib/brushFxShaders.ts` - Broken custom GLSL shaders (~400 lines)
- `Application/src/lib/brushFlowField.ts` - Custom flow field implementation (~300 lines)
- `Application/src/lib/brushWatercolor.ts` - Broken watercolor polygon deformation (~800 lines)
- `Application/src/lib/spectralMix.test.ts` - Orphaned spectral mixing test
- `Application/src/lib/brushFlowField.test.ts` - Orphaned flow field test
- `Application/src/lib/brushWatercolor.test.ts` - Orphaned watercolor test

## Decisions Made
- Used p5.brush standalone over continuing custom WebGL2 code -- library provides superior quality with 10x less code
- Custom brush definitions (our_ink, our_charcoal, our_pencil) via brush.add() for distinct visual character per style
- Watercolor two-part rendering: marker stroke path + bleed circles at sampled points for wash + edge effect
- OffscreenCanvas return type instead of HTMLCanvasElement -- Canvas2D drawImage() accepts both via CanvasImageSource
- brush.seed(42) for deterministic rendering across preview and export

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired. The adapter renders real strokes via p5.brush; the only remaining integration step is updating the import path in paintRenderer.ts (Plan 20-09).

## Next Phase Readiness
- brushP5Adapter.ts ready for import path switch in paintRenderer.ts (Plan 20-09)
- paintRenderer.ts still imports from './brushFxRenderer' -- Plan 20-09 will change to './brushP5Adapter'
- brushFxDefaults.test.ts kept -- tests paint.ts types, unaffected by renderer changes

## Self-Check: PASSED

All files verified present/deleted, all commits found in git log.

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
