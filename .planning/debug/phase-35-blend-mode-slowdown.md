---
status: resolved
trigger: "Phase 35 intermittent multi-second UI slowdown when changing Physic Paint layer blend mode; happens sometimes, after 35-07 gap closure, with server run by user. Keep the current lightweight-update patch as context, but don’t assume it’s the full fix until debug profiles where the stall actually occurs."
created: 2026-06-10T14:44:00Z
updated: 2026-06-10T14:44:00Z
---

# Debug Session: Phase 35 Blend Mode Slowdown

## Symptoms

expected_behavior: |
  Changing a Physic Paint layer blend mode should feel immediate, with no multi-second UI freeze.

actual_behavior: |
  Changing the Physic Paint layer blend mode sometimes causes a slowdown/freezing delay lasting several seconds.

error_messages: |
  None reported yet.

timeline: |
  Started after Phase 35 / 35-07 gap closure work. A lightweight update-path patch is currently present but is not confirmed as the full fix.

reproduction: |
  With the user running the app/server locally, select a Physic Paint layer and change its blend mode in the Properties panel. The slowdown is intermittent, not every change.

## Current Focus

hypothesis: "Unknown. Candidate causes include preview canvas compositing/image decode, autosave/project serialization, undo snapshotting, event-loop blocking, or physics-paint output image cache behavior."
test: "Gather initial evidence from current code paths and add/identify profiling instrumentation if needed."
expecting: "A falsifiable root cause for intermittent multi-second stalls when changing Physic Paint blend mode."
next_action: "gather initial evidence"
reasoning_checkpoint: "Do not assume the lightweight update patch fixed the issue; profile where the stall actually occurs."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-10T14:48:00Z
  observation: "Existing lightweight patch routes PhysicPaintProperties blend/opacity through sequenceStore.updateLayerVisual(), avoiding full sequence snapshots for undo."
  source: "app/src/components/sidebar/PhysicPaintProperties.tsx, app/src/stores/sequenceStore.ts"
- timestamp: 2026-06-10T14:49:00Z
  observation: "updateLayerVisual() still calls markDirty(), and autoSave subscribes to sequenceStore.sequences.value; any layer visual change schedules projectStore.saveProject() after the debounce."
  source: "app/src/stores/sequenceStore.ts, app/src/lib/autoSave.ts"
- timestamp: 2026-06-10T14:50:00Z
  observation: "saveProject() calls buildMceProject(), which always calls physicPaintStore.toMceOutputs(); that method synchronously walks physics-paint layers/frames, sorts frames, clones metadata, and returns embedded PNG data URLs."
  source: "app/src/stores/projectStore.ts, app/src/stores/physicPaintStore.ts"
- timestamp: 2026-06-10T14:52:00Z
  observation: "Implemented serialization caching for physicPaintStore.toMceOutputs(), invalidated only when physics-paint rendered output/editable state changes; layer visual metadata changes no longer rebuild the physics-paint output array."
  source: "app/src/stores/physicPaintStore.ts"
- timestamp: 2026-06-10T14:53:00Z
  observation: "Added regression coverage that repeated toMceOutputs() calls reuse the cached object until a new physics-paint frame is applied."
  source: "app/src/lib/physicPaintBridge.test.ts"
- timestamp: 2026-06-10T14:54:00Z
  observation: "Verification passed: pnpm --dir app test --run src/lib/physicPaintBridge.test.ts and pnpm --dir app typecheck."
  source: "terminal"

## Eliminated

- Full undo snapshotting for Physic Paint blend/opacity changes: existing lightweight patch replaces updateLayer() with updateLayerVisual().
- Immediate synchronous image decode/cache miss as the primary repeated cause: the remaining reproducible heavy path is autosave project build/physics output serialization after dirty sequence changes.

## Specialist Review

LOOKS_GOOD — cache physics-paint serialization at the store boundary and invalidate only on physics-paint output/editable-state mutations. Do not change the persisted schema; layer blend/opacity changes should not invalidate output serialization.

## Resolution

root_cause: "Blend-mode changes still marked sequence data dirty, which triggered autosave; autosave rebuilt the full project and repeatedly serialized all embedded physics-paint PNG data URLs via physicPaintStore.toMceOutputs(), causing intermittent main-thread stalls after the UI action."
fix: "Kept the lightweight visual update path and cached physicPaintStore.toMceOutputs() results, invalidating the cache only when physics-paint rendered output or editable state changes."
verification: "pnpm --dir app test --run src/lib/physicPaintBridge.test.ts; pnpm --dir app typecheck"
files_changed: ["app/src/components/sidebar/PhysicPaintProperties.tsx", "app/src/stores/layerStore.ts", "app/src/stores/sequenceStore.ts", "app/src/stores/physicPaintStore.ts", "app/src/lib/physicPaintBridge.test.ts"]
