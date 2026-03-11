---
phase: 06-layer-system-properties-panel
plan: 01
subsystem: ui
tags: [layers, compositing, undo, preact-signals, serde, backward-compat]

# Dependency graph
requires:
  - phase: 05-editing-infrastructure
    provides: "undo/redo history engine (pushAction, snapshot/restore pattern)"
provides:
  - "Layer type with LayerSourceData discriminated union and isBase flag"
  - "createBaseLayer() and defaultTransform() factory functions"
  - "Sequence type with layers: Layer[] field"
  - "MceLayer/MceLayerTransform/MceLayerSource types for .mce persistence"
  - "Rust MceLayer structs with serde(default) backward compatibility"
  - "layerStore with computed layers derived from active sequence"
  - "sequenceStore layer mutations: addLayer, removeLayer, updateLayer, reorderLayers"
  - "buildMceProject/hydrateFromMce with layer serialization (v2 format)"
affects: [06-02, 06-03, 06-04, preview-renderer, export-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-sequence layer storage via computed signals", "discriminated union for layer source data", "serde(default) for backward-compatible deserialization"]

key-files:
  created: []
  modified:
    - Application/src/types/layer.ts
    - Application/src/types/sequence.ts
    - Application/src/types/project.ts
    - Application/src/stores/layerStore.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/projectStore.ts
    - Application/src-tauri/src/models/project.rs
    - Application/src/components/layout/LeftPanel.tsx

key-decisions:
  - "layerStore.layers is computed from sequenceStore active sequence (not independent signal)"
  - "All layer mutations route through sequenceStore for unified snapshot/restore undo"
  - "Base layer ID is always 'base' with isBase=true flag for deletion protection"
  - "Project version bumped to 2; v1 files auto-generate base layer on load"

patterns-established:
  - "Per-sequence computed derivation: layerStore.layers = computed(() => activeSeq.layers)"
  - "Layer mutation delegation: layerStore.add() -> sequenceStore.addLayer() -> snapshot/pushAction"

requirements-completed: [LAYER-04, LAYER-05, LAYER-06, LAYER-08, LAYER-09, LAYER-10, LAYER-11, LAYER-12, LAYER-14]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 6 Plan 1: Layer Data Model & Store Summary

**Per-sequence layer data model with discriminated source types, undo-integrated mutations via sequenceStore, and backward-compatible .mce v2 persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T18:06:26Z
- **Completed:** 2026-03-03T18:10:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Extended Layer type with LayerSourceData discriminated union (static-image, image-sequence, video) and isBase flag
- Refactored layerStore from flat signal to computed derivation from active sequence's layers array
- Added four undo-integrated layer mutation methods to sequenceStore (addLayer, removeLayer, updateLayer, reorderLayers)
- Updated .mce project format to v2 with full layer serialization/deserialization and v1 backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend layer and sequence types, add Rust models for .mce persistence** - `a1bdfa2` (feat)
2. **Task 2: Refactor layerStore to per-sequence with undo integration, update projectStore serialization** - `299cd0a` (feat)

## Files Created/Modified

- `Application/src/types/layer.ts` - Added LayerSourceData union, source/isBase to Layer, defaultTransform() and createBaseLayer() factories
- `Application/src/types/sequence.ts` - Added layers: Layer[] field to Sequence interface
- `Application/src/types/project.ts` - Added MceLayer, MceLayerTransform, MceLayerSource types; optional layers on MceSequence
- `Application/src-tauri/src/models/project.rs` - Added Rust MceLayer/MceLayerTransform/MceLayerSource structs with serde; layers field on MceSequence with serde(default)
- `Application/src/stores/layerStore.ts` - Rewrote: layers is now computed from active sequence, all mutations delegate to sequenceStore
- `Application/src/stores/sequenceStore.ts` - Added addLayer/removeLayer/updateLayer/reorderLayers with snapshot/pushAction undo; createSequence auto-populates base layer
- `Application/src/stores/projectStore.ts` - buildMceProject serializes layers (v2), hydrateFromMce deserializes with v1 auto-migration
- `Application/src/components/layout/LeftPanel.tsx` - Removed obsolete mock layer seeding, updated isBase detection

## Decisions Made

- **Computed derivation over independent signal:** layerStore.layers is computed(() => activeSeq.layers), ensuring automatic sync when switching sequences. No separate layer state to synchronize.
- **Delegation to sequenceStore for mutations:** All layer mutations go through sequenceStore which already has the snapshot/restore + pushAction pattern. This avoids duplicating undo logic and ensures layers are captured in sequence snapshots.
- **Fixed base layer ID ('base'):** Base layer always has id='base' and isBase=true. This simplifies deletion protection and identification.
- **Project version bump to 2:** v2 .mce files include layers. v1 files (no layers field) auto-generate a base layer on load via createBaseLayer().

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed LeftPanel mock layer data missing source field**
- **Found during:** Task 1 (type extension)
- **Issue:** LeftPanel's useSeedLayerMockData() created Layer objects without the new required `source` field, causing 3 TypeScript errors
- **Fix:** Removed the mock layer seeding entirely (it was placeholder data marked TODO for Phase 5/6). Updated isBase detection from blendMode check to isBase flag.
- **Files modified:** Application/src/components/layout/LeftPanel.tsx
- **Verification:** TypeScript compiles with zero errors after fix
- **Committed in:** a1bdfa2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Mock data removal was necessary and appropriate -- the mock seeding was obsolete now that layers derive from sequences.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Layer data model complete with all type definitions for static-image, image-sequence, and video sources
- layerStore provides computed layer access that auto-updates on sequence switch
- All four CRUD operations (add/remove/update/reorder) are undo-integrated
- .mce persistence handles v1 backward compatibility
- Ready for Phase 6 Plans 02-04: LayerPanel UI, properties panel, and layer import operations

## Self-Check: PASSED

- All 9 files verified present
- Both task commits (a1bdfa2, 299cd0a) verified in git log
- All 12 key content checks passed (types, computed signals, mutations, version bump)
- TypeScript compiles with zero errors
- Rust compiles with zero errors, 8 tests pass

---
*Phase: 06-layer-system-properties-panel*
*Completed: 2026-03-03*
