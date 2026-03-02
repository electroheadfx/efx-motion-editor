---
phase: 01-foundation-scaffolding
plan: 02
subsystem: ui
tags: [motion-canvas, preact-signals, signal-stores, player-embedding, reactive-state]

# Dependency graph
requires:
  - phase: 01-foundation-scaffolding/01
    provides: Tauri scaffold, Vite config with Motion Canvas plugin, TypeScript types, IPC wrappers
provides:
  - Motion Canvas player embedded in Preact app rendering test scene
  - 6 signal stores with per-field reactive signals and method objects
  - Cross-store computed values (timelineStore.currentTime from projectStore.fps)
  - Programmatic player mount pattern for Motion Canvas custom element in Preact
  - Foundation scaffold verified end-to-end on macOS
affects: [02-01, 03-01, 04-01, 05-01, all-subsequent-phases]

# Tech tracking
tech-stack:
  added: ["@efxlab/motion-canvas-player@4.0.0 (runtime)", "@preact/signals@2.8.1 (store pattern)"]
  patterns: [per-field-signals, store-object-with-methods, programmatic-player-mount, jsxImportSource-pragma-for-scenes, cross-store-computed]

key-files:
  created:
    - Application/src/project.ts
    - Application/src/scenes/testScene.tsx
    - Application/src/components/Preview.tsx
    - Application/src/stores/projectStore.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/layerStore.ts
    - Application/src/stores/timelineStore.ts
    - Application/src/stores/uiStore.ts
    - Application/src/stores/historyStore.ts
  modified:
    - Application/src/app.tsx
    - Application/vite.config.ts
    - Application/package.json
    - Application/pnpm-lock.yaml
    - Application/index.html
    - Application/src-tauri/tauri.conf.json
    - Application/src/vite-env.d.ts

key-decisions:
  - "Programmatic player mount via DOM manipulation (not JSX ref) to avoid Preact/custom-element lifecycle conflicts"
  - "Test scene uses Rect+Txt nodes instead of Img to avoid asset loading complexity during foundation validation"
  - "Batched signal updates in IPC handler to prevent computed signal cycles"
  - "Motion Canvas editor plugin filtered out of vite config to prevent hijacking root route"
  - "pnpm overrides added for @preact/signals to resolve version conflicts with Motion Canvas deps"

patterns-established:
  - "Scene files use /** @jsxImportSource @efxlab/motion-canvas-2d/lib */ pragma -- all other .tsx files use Preact JSX"
  - "Signal stores export a single store object with per-field signals and methods (e.g., projectStore.name, projectStore.setName())"
  - "Cross-store reads: computed signals in one store can read .value from another store's signals"
  - "Player mount: use useEffect + DOM createElement/appendChild for Motion Canvas player custom element"

requirements-completed: [FOUN-04, FOUN-05]

# Metrics
duration: 45min
completed: 2026-03-02
---

# Phase 1 Plan 02: Motion Canvas Player + Signal Stores Summary

**Motion Canvas player embedded via programmatic mount rendering Rect+Txt test scene, 6 reactive signal stores with per-field signals, and end-to-end verification on macOS confirmed**

## Performance

- **Duration:** ~45 min (including iterative fixes for Motion Canvas integration)
- **Started:** 2026-03-02T17:10:00Z
- **Completed:** 2026-03-02T19:12:31Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 16

## Accomplishments
- Motion Canvas player renders a test scene (blue rectangle with "EFX Motion Editor" text) inside the Preact app via programmatic DOM mounting
- All 6 signal stores created with per-field reactive signals: projectStore, sequenceStore, layerStore, timelineStore, uiStore, historyStore
- Signal reactivity verified: "Change Name" and "Toggle FPS" buttons instantly update the displayed values without manual re-rendering
- Cross-store computed signal works: timelineStore.currentTime derives from currentFrame / projectStore.fps
- IPC round-trip confirmed: project_get_default returns typed ProjectData from Rust
- Foundation scaffold verified end-to-end on macOS by human tester (Tauri window, dark theme, player, IPC, signals all working)

## Task Commits

Each task was committed atomically:

1. **Task 1: Embed Motion Canvas player with test scene and create all signal stores** - `8ceae14` (feat)
   - Note: This commit includes fixes from 8 iterative commits (1872bd5 through 8ceae14) resolving Motion Canvas integration issues
2. **Task 2: Verify foundation scaffold works end-to-end on macOS** - Human-verify checkpoint, approved by user

**Plan metadata:** (pending -- docs commit below)

## Files Created/Modified
- `Application/src/project.ts` - Motion Canvas project definition importing test scene with ?scene suffix
- `Application/src/scenes/testScene.tsx` - Test scene with @jsxImportSource pragma, Rect+Txt nodes
- `Application/src/components/Preview.tsx` - Preact wrapper with programmatic player mount and status monitoring
- `Application/src/stores/projectStore.ts` - Project state: name, fps, width, height signals + methods
- `Application/src/stores/sequenceStore.ts` - Sequence list + activeSequenceId signals
- `Application/src/stores/layerStore.ts` - Layer list + selectedLayerId with reorder support
- `Application/src/stores/timelineStore.ts` - Playhead, zoom, playing state + cross-store currentTime computed
- `Application/src/stores/uiStore.ts` - Panel selection, sidebar/properties widths
- `Application/src/stores/historyStore.ts` - Skeleton store (stack + pointer, logic deferred to Phase 8)
- `Application/src/app.tsx` - Root component with Preview, reactive signal display, and test buttons
- `Application/vite.config.ts` - Updated with Motion Canvas editor plugin filter and optimizeDeps config
- `Application/package.json` - Added pnpm overrides for @preact/signals compatibility
- `Application/pnpm-lock.yaml` - Updated lockfile
- `Application/index.html` - Dark background on body element
- `Application/src-tauri/tauri.conf.json` - Window config updates
- `Application/src/vite-env.d.ts` - Added ?scene and ?project module declarations

## Decisions Made
- Used programmatic DOM manipulation (createElement + appendChild) for Motion Canvas player instead of JSX ref, because Preact's virtual DOM lifecycle conflicts with the custom element's internal initialization
- Replaced Img node test scene with Rect+Txt nodes to avoid asset loading complexity during foundation validation (image compositing will be validated in Phase 2 with real imported images)
- Batched signal updates using `batch()` from @preact/signals in IPC handler to prevent computed signal dependency cycles
- Filtered out Motion Canvas editor plugin from vite config (`motionCanvas()` returns an array of plugins; the editor plugin hijacks the root route, breaking the Preact app)
- Added pnpm overrides for @preact/signals to resolve version conflicts between Motion Canvas dependencies and Preact signals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved Motion Canvas vite plugin CJS/ESM interop**
- **Found during:** Task 1
- **Issue:** Motion Canvas vite plugin uses CJS default export, causing interop failure
- **Fix:** Added ESM interop handling in vite.config.ts
- **Files modified:** Application/vite.config.ts
- **Committed in:** 39c2cb9 (folded into 8ceae14)

**2. [Rule 3 - Blocking] Resolved preact optimizeDeps conflict with Motion Canvas plugin**
- **Found during:** Task 1
- **Issue:** Vite's optimizeDeps for preact conflicted with Motion Canvas plugin's module handling
- **Fix:** Configured optimizeDeps exclude for Motion Canvas packages
- **Files modified:** Application/vite.config.ts
- **Committed in:** e964516 (folded into 8ceae14)

**3. [Rule 3 - Blocking] Filtered out Motion Canvas editor plugin that hijacks root route**
- **Found during:** Task 1
- **Issue:** motionCanvas() returns multiple plugins; the editor plugin serves its own HTML at /, overriding the Preact app
- **Fix:** Filter plugin array to exclude the editor plugin
- **Files modified:** Application/vite.config.ts
- **Committed in:** a60cd6b (folded into 8ceae14)

**4. [Rule 1 - Bug] Replaced Img node with Rect+Txt to avoid asset loading issues**
- **Found during:** Task 1
- **Issue:** Img node required a valid image URL at scene construction time; placeholder approach failed
- **Fix:** Replaced with Rect+Txt nodes for visual validation without asset dependencies
- **Files modified:** Application/src/scenes/testScene.tsx
- **Committed in:** 92991f6 (folded into 8ceae14)

**5. [Rule 1 - Bug] Fixed signal cycle in IPC handler with batch()**
- **Found during:** Task 1
- **Issue:** Multiple signal writes in the IPC response handler triggered computed recalculations mid-update, causing a cycle error
- **Fix:** Wrapped signal updates in batch() from @preact/signals
- **Files modified:** Application/src/app.tsx
- **Committed in:** af13f39 (folded into 8ceae14)

**6. [Rule 1 - Bug] Used DOM manipulation for player mount instead of Preact ref**
- **Found during:** Task 1
- **Issue:** Preact ref-based player mount caused lifecycle timing issues with the custom element
- **Fix:** Used useEffect with direct DOM createElement/appendChild
- **Files modified:** Application/src/components/Preview.tsx
- **Committed in:** 3965d42 (folded into 8ceae14)

---

**Total deviations:** 6 auto-fixed (3 blocking, 3 bugs)
**Impact on plan:** All fixes were necessary to get Motion Canvas player working inside Preact. The iterative debugging was expected given the risk flagged in ROADMAP.md about Motion Canvas embedding being a go/no-go gate. No scope creep.

## Issues Encountered
- Motion Canvas embedding required significant iterative debugging (8 commits) due to: CJS/ESM interop, optimizeDeps conflicts, editor plugin hijacking routes, Preact/custom-element lifecycle conflicts, and signal dependency cycles. This was anticipated as the highest-risk integration in the project.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 is complete: all success criteria from ROADMAP.md are satisfied
- Phase 1 blocker resolved: Motion Canvas embedding and Preact/compat confirmed working
- Phase 2 can proceed: UI Shell conversion and Image Pipeline
- Signal store pattern established and ready for feature-level state management
- IPC pattern proven: Rust commands return typed data through invoke wrappers

## Self-Check: PASSED

All 10 key files verified on disk. Task 1 commit (8ceae14) verified in git log. SUMMARY.md created successfully.

---
*Phase: 01-foundation-scaffolding*
*Completed: 2026-03-02*
