---
phase: 07-cinematic-fx-effects
plan: 09
subsystem: ui
tags: [canvas, timeline, fx, visibility, drag-reorder, compositing]

requires:
  - phase: 07-cinematic-fx-effects
    provides: FX sequence model, timeline FX range bars, preview FX compositing
provides:
  - FX sequence visibility toggle via header dot click
  - Dimmed rendering for hidden FX sequences on timeline
  - Hidden FX sequences skipped in preview compositing
  - FX sequence reorder via track header drag
affects: [07-10, uat-verification]

tech-stack:
  added: []
  patterns: [click-vs-drag disambiguation on pointer up, undefined-as-true visibility pattern]

key-files:
  created: []
  modified:
    - Application/src/types/sequence.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/types/timeline.ts
    - Application/src/lib/frameMap.ts
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/Preview.tsx

key-decisions:
  - "visible?: boolean uses undefined=true, false=hidden to avoid adding visible:true to all existing sequences"
  - "FX header click vs drag resolved on pointerUp: same-track release = toggle visibility, different-track = reorder"

patterns-established:
  - "Click-vs-drag disambiguation: initiate drag on pointerDown, resolve intent on pointerUp based on drop position"
  - "Undefined-as-true pattern for optional boolean fields on existing data structures"

requirements-completed: [FX-09, FX-10]

duration: 3min
completed: 2026-03-10
---

# Phase 7 Plan 9: FX Visibility Toggle and Reorder Summary

**FX sequence visibility toggle via header dot click with dimmed rendering, and FX reorder drag on timeline track headers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T13:25:50Z
- **Completed:** 2026-03-10T13:28:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- FX sequence visibility toggle: clicking the color dot in an FX track header toggles the FX on/off
- Hidden FX sequences render dimmed on the timeline (reduced opacity dot, bar, border, and text)
- Hidden FX sequences are skipped during preview compositing in both render loops
- FX sequences can be reordered by dragging track headers to different FX track positions
- Both operations are undoable via Cmd+Z

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FX sequence visibility toggle end-to-end** - `66be40d` (feat)
2. **Task 2: Add FX reorder drag via track header** - `f3a0236` (feat)

## Files Created/Modified
- `Application/src/types/sequence.ts` - Added optional `visible?: boolean` field to Sequence interface
- `Application/src/stores/sequenceStore.ts` - Added `toggleFxSequenceVisibility` and `reorderFxSequences` methods
- `Application/src/types/timeline.ts` - Added `visible: boolean` to FxTrackLayout interface
- `Application/src/lib/frameMap.ts` - Propagated visible field to fxTrackLayouts computed
- `Application/src/components/timeline/TimelineInteraction.ts` - FX header click/drag detection with click-vs-drag disambiguation
- `Application/src/components/timeline/TimelineRenderer.ts` - Dimmed rendering for hidden FX sequences
- `Application/src/components/Preview.tsx` - Skip invisible FX sequences in both compositing loops

## Decisions Made
- Used `undefined` for visible (true) and `false` for hidden to avoid adding `visible: true` to every existing and new sequence
- FX header interaction is dual-purpose: click (no movement) = toggle visibility, drag (movement) = reorder -- same pattern used by creative apps like After Effects and Premiere

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FX visibility toggle and reorder complete, ready for final UAT verification (07-10)
- All FX timeline interaction gaps from UAT round 2 are now closed

## Self-Check: PASSED

All 7 modified files verified present. Both task commits (66be40d, f3a0236) verified in git log.

---
*Phase: 07-cinematic-fx-effects*
*Completed: 2026-03-10*
