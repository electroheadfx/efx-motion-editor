---
phase: 07-cinematic-fx-effects
plan: 05
subsystem: data-model
tags: [sequence, fx, discriminator, serialization, crud]

# Dependency graph
requires:
  - phase: 07-04
    provides: "MceLayerSource FX fields and generator/adjustment serialization"
provides:
  - "Sequence kind discriminator ('content' | 'fx')"
  - "Sequence-level inFrame/outFrame for FX temporal ranges"
  - "sequenceStore.createFxSequence and updateFxSequenceRange methods"
  - "sequenceStore.getContentSequences and getFxSequences accessors"
  - "FxTrackLayout type for timeline FX range bars"
  - ".mce v4 format with sequence-level kind/in_frame/out_frame"
affects: [07-06, 07-07, timeline, preview, addLayerMenu]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Discriminated union (kind field) for content vs FX sequences", "Temporal range at sequence level instead of layer level"]

key-files:
  created: []
  modified:
    - Application/src/types/sequence.ts
    - Application/src/types/layer.ts
    - Application/src/types/timeline.ts
    - Application/src/types/project.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/projectStore.ts
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/layout/PropertiesPanel.tsx
    - Application/src/components/layer/LayerList.tsx

key-decisions:
  - "FX temporal range (inFrame/outFrame) moved from Layer to Sequence level for timeline-first FX architecture"
  - "Layer-level InOutSection removed from PropertiesPanel; will be re-added at sequence level in future plan"
  - ".mce version bumped from 3 to 4; v3 layer-level in_frame/out_frame silently ignored on load"

patterns-established:
  - "Sequence kind discriminator: all sequences have kind field, defaulting to 'content' for backward compat"
  - "FX sequence CRUD follows same snapshot/restore undo pattern as content sequences"

requirements-completed: [FX-01, FX-09]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 7 Plan 05: FX Sequence Data Model Summary

**Sequence kind discriminator with FX temporal ranges, CRUD methods, and v4 serialization for timeline-level FX sequences**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T12:15:47Z
- **Completed:** 2026-03-10T12:18:55Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Extended Sequence type with `kind: 'content' | 'fx'` discriminator and optional `inFrame`/`outFrame` temporal range
- Added `createFxSequence`, `updateFxSequenceRange`, `getContentSequences`, `getFxSequences` to sequenceStore
- Moved in/out temporal range from Layer to Sequence level across types, serialization, and rendering
- Bumped .mce format to v4 with backward-compatible hydration (older files default to kind='content')

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Sequence type with kind discriminator and temporal range** - `d0c105f` (feat)
2. **Task 2: Add FX sequence CRUD to sequenceStore and update serialization** - `0ac119b` (feat)

## Files Created/Modified
- `Application/src/types/sequence.ts` - Added kind discriminator and inFrame/outFrame to Sequence
- `Application/src/types/layer.ts` - Removed inFrame/outFrame (moved to Sequence)
- `Application/src/types/timeline.ts` - Added FxTrackLayout interface for timeline FX range bars
- `Application/src/types/project.ts` - Added kind/in_frame/out_frame to MceSequence, removed from MceLayer
- `Application/src/stores/sequenceStore.ts` - Added createFxSequence, updateFxSequenceRange, getContentSequences, getFxSequences
- `Application/src/stores/projectStore.ts` - Serialize/deserialize kind and sequence-level in/out, version bump to 4
- `Application/src/lib/previewRenderer.ts` - Removed layer-level inFrame/outFrame filtering (now sequence-level)
- `Application/src/components/layout/PropertiesPanel.tsx` - Removed InOutSection (layer-level range controls)
- `Application/src/components/layer/LayerList.tsx` - Removed layer in/out range display

## Decisions Made
- FX temporal range (inFrame/outFrame) moved from Layer to Sequence level for timeline-first FX architecture
- Layer-level InOutSection removed from PropertiesPanel; will be re-added at sequence level in a future plan
- .mce version bumped from 3 to 4; v3 layer-level in_frame/out_frame fields silently ignored on load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed layer.inFrame/outFrame references from PropertiesPanel.tsx and LayerList.tsx**
- **Found during:** Task 1 (Type changes)
- **Issue:** PropertiesPanel had InOutSection and LayerList had range display referencing deleted layer.inFrame/outFrame fields, causing TypeScript errors
- **Fix:** Removed InOutSection component and LayerList range display; these will be re-added at sequence level in a future plan
- **Files modified:** Application/src/components/layout/PropertiesPanel.tsx, Application/src/components/layer/LayerList.tsx
- **Verification:** TypeScript compiles clean with zero errors
- **Committed in:** d0c105f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to remove references to deleted fields. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data model complete for FX sequences as timeline-level entities
- sequenceStore CRUD ready for AddLayerMenu (07-06) and Timeline (07-07) to build upon
- FxTrackLayout type ready for timeline rendering of FX range bars
- Serialization supports round-trip persistence of FX sequence data

---
*Phase: 07-cinematic-fx-effects*
*Completed: 2026-03-10*
