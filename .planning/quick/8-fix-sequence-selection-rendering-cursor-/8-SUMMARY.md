---
phase: quick-8
plan: 1
subsystem: ui
tags: [preact, signals, frameMap, preview, rendering]

requires:
  - phase: 07-cinematic-fx
    provides: "frameMap, PreviewRenderer, FX compositing"
provides:
  - "Cursor-position-based preview rendering independent of sidebar sequence selection"
  - "Sequence selection no longer moves playhead"
affects: [preview, timeline, sequence-sidebar]

tech-stack:
  added: []
  patterns:
    - "frameMap-based rendering in both reactive effect and rAF loop (unified approach)"

key-files:
  created: []
  modified:
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/Preview.tsx

key-decisions:
  - "disposeRender effect mirrors renderFromFrameMap pattern (.value vs .peek) for consistent frameMap-based rendering"
  - "Preload all frameMap images instead of just active sequence, since cursor can be in any sequence"
  - "hasContent check uses sequences directly instead of layerStore.layers (layerStore removed from Preview)"

patterns-established:
  - "Preview rendering always derives from frameMap at cursor position, never from activeSequenceId"

requirements-completed: [QUICK-8]

duration: 2min
completed: 2026-03-10
---

# Quick Task 8: Fix Sequence Selection Rendering/Cursor Summary

**Preview renders based on cursor position via frameMap; sidebar sequence selection no longer moves playhead or changes rendered content**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T21:37:30Z
- **Completed:** 2026-03-10T21:39:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Selecting a different sequence in the sidebar no longer seeks the playhead to that sequence's start frame
- Preview always renders the content at the global cursor position using frameMap lookup, regardless of which sequence is "active"
- Removed layerStore, activeSequenceFrames, and activeSequenceStartFrame dependencies from Preview.tsx
- Unified rendering approach: both disposeRender (reactive) and renderFromFrameMap (rAF) now use identical frameMap-based logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove playhead seek from sidebar sequence selection** - `628c95a` (fix)
2. **Task 2: Make Preview render based on cursor position via frameMap** - `5b24e6e` (fix)

## Files Created/Modified
- `Application/src/components/sequence/SequenceList.tsx` - Removed playhead seek from handleSelect, removed unused timelineStore and trackLayouts imports
- `Application/src/components/Preview.tsx` - Refactored disposeRender effect to use frameMap for cursor-position-based rendering, updated preload to cover all sequences, replaced hasLayers with hasContent

## Decisions Made
- disposeRender effect mirrors renderFromFrameMap pattern (using .value for reactivity instead of .peek) to ensure consistent frameMap-based rendering in both reactive and rAF contexts
- Preload effect now loads all frameMap images (not just active sequence) since the cursor can be in any sequence
- hasContent check uses sequenceStore.sequences directly since layerStore is no longer imported

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Preview rendering is now fully decoupled from activeSequenceId for content display
- Sidebar selection only affects which sequence's layers/properties are shown in sidebar panels
- Timeline click-to-seek and playback rendering remain unchanged

---
*Quick Task: 8-fix-sequence-selection-rendering-cursor*
*Completed: 2026-03-10*
