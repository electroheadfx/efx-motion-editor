---
phase: 05-library-demo-polish
plan: 03
subsystem: engine
tags: [typescript, facade-pattern, canvas-2d, beer-lambert, compositor, tsup, library]

# Dependency graph
requires:
  - phase: 05-01
    provides: core modules (wet-layer, diffusion, drying, paper)
  - phase: 05-02
    provides: brush modules (paint, erase, stroke processing)
provides:
  - EfxPaintEngine facade class with full public API
  - Wet layer compositor with Beer-Lambert absorption
  - Dual-canvas setup and background management
  - Library entry point exporting EfxPaintEngine and all public types
  - tsup build producing dist/index.mjs (68KB) and dist/index.d.ts
affects: [05-04-preact-demo, efx-motion-editor-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [facade-pattern, dual-canvas-overlay, beer-lambert-compositing, pointer-coalescing]

key-files:
  created:
    - paint-rebelle-new/src/render/compositor.ts
    - paint-rebelle-new/src/render/canvas.ts
    - paint-rebelle-new/src/engine/EfxPaintEngine.ts
  modified:
    - paint-rebelle-new/src/index.ts

key-decisions:
  - "Compositor receives sampleHFn and sampleGrainFn callbacks to decouple from paper module"
  - "EfxPaintEngine class owns all typed array buffers, modules are pure functions"
  - "Physics interval at 16ms (60fps) matching v3 research prototype"
  - "Synchronous redrawAll for project load/replay (async animated replay deferred)"
  - "drawBg accepts paper textures as Map for clean key-based lookup"

patterns-established:
  - "Facade pattern: EfxPaintEngine single entry point hides 10+ functional modules"
  - "Dual-canvas overlay: dry canvas for paint, display canvas for wet compositing + cursor"
  - "Bound event handler pattern: store bound refs for clean removeEventListener in destroy()"
  - "Undo via full canvas + wet buffer snapshots (slice + set for typed arrays)"

requirements-completed: [LIB-01, LIB-02]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 05 Plan 03: Render Modules and EfxPaintEngine Facade Summary

**EfxPaintEngine facade class with 20+ public API methods, Beer-Lambert wet compositor, dual-canvas setup, and library entry point producing 68KB ESM bundle**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T16:22:35Z
- **Completed:** 2026-03-31T16:28:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Beer-Lambert wet layer compositor with paper grain and brush texture modulation
- Dual-canvas setup (dry + display overlay) with background management, brush cursor, and stroke preview
- EfxPaintEngine facade owning all state: typed array buffers, canvases, intervals, event listeners
- Full D-08 public API: setTool, setBrushSize, setColorHex, startPhysics, stopPhysics, save, load, undo, clear, destroy, and 15+ more
- Library entry point exporting EfxPaintEngine class and 9 public types
- tsup build producing dist/index.mjs (68KB) with complete type declarations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create render modules (compositor.ts, canvas.ts)** - `9476516` (feat)
2. **Task 2: Create EfxPaintEngine facade and finalize library entry point** - `14dedd2` (feat)

## Files Created/Modified
- `paint-rebelle-new/src/render/compositor.ts` - Beer-Lambert wet layer compositing with paper/grain modulation
- `paint-rebelle-new/src/render/canvas.ts` - Dual-canvas setup, background drawing, brush cursor, stroke preview
- `paint-rebelle-new/src/engine/EfxPaintEngine.ts` - Facade class owning all state, 870+ lines
- `paint-rebelle-new/src/index.ts` - Library entry point re-exporting EfxPaintEngine and public types

## Decisions Made
- Compositor receives height and grain sampling functions as callbacks rather than importing paper module directly (testability, decoupling)
- Physics interval set to 16ms (60fps) to match v3 research prototype smooth spreading
- Project load uses synchronous redrawAll rather than animated replayWithPhysics (simplifies initial library release)
- drawBg uses Map<string, {tiledCanvas, heightMap}> for paper texture lookup (clean type-safe access)
- Undo snapshots store full canvas ImageData + typed array copies (matching v3 pattern exactly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Record<string,number> to BrushOpts type cast**
- **Found during:** Task 2 (EfxPaintEngine facade)
- **Issue:** TypeScript strict mode rejected direct `as BrushOpts` cast from `Record<string, number>` in SerializedProject deserialization
- **Fix:** Used `as unknown as BrushOpts` intermediate cast for the JSON-deserialized params
- **Files modified:** paint-rebelle-new/src/engine/EfxPaintEngine.ts
- **Verification:** `pnpm run check` passes clean
- **Committed in:** 14dedd2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for TypeScript strict mode compliance. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all modules are fully wired with real data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EfxPaintEngine is fully functional and exports cleanly
- Ready for Plan 04: Preact component wrapper and demo application
- Library builds to dist/ with type declarations suitable for npm publish

---
*Phase: 05-library-demo-polish*
*Completed: 2026-03-31*
