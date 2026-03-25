---
phase: 19-add-paint-layer-rotopaint
plan: 06
subsystem: ui
tags: [canvas, flood-fill, onion-skin, rotoscoping, paint]

requires:
  - phase: 19-01
    provides: paint types, paintStore, paintRenderer
  - phase: 19-02
    provides: PaintOverlay pointer event capture
  - phase: 19-05
    provides: paint sidecar persistence
provides:
  - flood fill tool with configurable tolerance
  - onion skinning overlay for rotoscoping workflow
  - visual verification of complete paint system
affects: []

tech-stack:
  added: []
  patterns: [offscreen-canvas-compositing, paint-version-reactivity]

key-files:
  created:
    - Application/src/lib/paintFloodFill.ts
    - Application/src/components/canvas/OnionSkinOverlay.tsx
  modified:
    - Application/src/components/canvas/PaintOverlay.tsx
    - Application/src/lib/paintRenderer.ts
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/stores/paintStore.ts
    - Application/src/stores/projectStore.ts
    - Application/src/components/Preview.tsx
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/overlay/PaintToolbar.tsx
    - Application/src/components/sidebar/PaintProperties.tsx
    - Application/src-tauri/src/models/project.rs
    - Application/src-tauri/capabilities/default.json

key-decisions:
  - "Offscreen canvas compositing for both eraser and onion skin rendering"
  - "paintVersion signal as reactive bridge between plain Map storage and Preact effects"
  - "Paint mode gated to paint layer selection with auto-deactivation"

patterns-established:
  - "Offscreen canvas pattern: render paint to temp canvas first, composite with drawImage for correct alpha/composite behavior"
  - "Version counter signal pattern: bump a counter signal to make non-reactive data structures trigger reactive re-renders"

requirements-completed: []

duration: 45min
completed: 2026-03-24
---

# Plan 19-06: Flood fill, onion skinning, and visual verification

**Flood fill tool, onion skin overlay with offscreen compositing, and 8 bug fixes uncovered during visual verification**

## Performance

- **Duration:** ~45 min (including human verification and iterative bug fixing)
- **Tasks:** 3/3
- **Files modified:** 14

## Accomplishments
- Flood fill tool with configurable tolerance wired into PaintOverlay
- Onion skin overlay rendering ghost frames from adjacent paint frames with opacity falloff
- 8 critical bugs found and fixed during visual verification

## Task Commits

1. **Task 1: Flood fill + wire into PaintOverlay** - `315d59b`
2. **Task 2: OnionSkinOverlay component** - `6c9e370`
3. **Task 3: Visual verification** (human checkpoint — 8 bug fixes):
   - `4778e7b` — install perfect-freehand dependency
   - `29af663` — paint strokes persist via paintVersion signal
   - `96d2e6d` — onion skin re-renders on paint changes
   - `5beb681` — onion skin opacity via offscreen canvas
   - `264fd61` — paint source serialization + app color picker
   - `5876ed4` — project dirty flag, eraser transparency, remove sidebar tools
   - `fa8a40f` — fs:allow-write-text-file permission for sidecar writes

## Decisions Made
- Used offscreen canvas pattern for both eraser and onion skin to isolate composite operations
- Added paintVersion counter signal instead of making _frames reactive (less churn, explicit control)
- Gated paint mode to require paint layer selection rather than allowing activation without one
- Removed tool grid from sidebar (floating toolbar is sufficient)
- Onion skin defaults: previous=1, next=0 (per user preference)

## Deviations from Plan

8 bugs discovered during visual verification (expected for a checkpoint plan):
1. perfect-freehand not installed (pnpm install missing)
2. Strokes disappeared on mouse release (non-reactive Map, needed paintVersion signal)
3. Paint mode accessible without paint layer
4. Onion skin didn't re-render on paint changes
5. Onion skin opacity ignored (per-element alpha overrode outer alpha)
6. Paint source not serialized/deserialized (missing layer_id roundtrip)
7. Color picker opened OS native instead of app modal
8. Paint sidecar files never written (missing Tauri fs permission)

## Issues Encountered
- Merge conflicts between wave 3 worktrees on paintStore.ts/paint.ts (resolved by taking 19-05's version)
- Duplicate paintStore import in CanvasArea.tsx from merge (fixed)

## Next Phase Readiness
- Complete paint layer system verified end-to-end
- All persistence, rendering, and UI issues resolved

---
*Phase: 19-add-paint-layer-rotopaint*
*Completed: 2026-03-24*
