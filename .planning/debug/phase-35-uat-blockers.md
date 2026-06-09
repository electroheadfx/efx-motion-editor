---
status: investigating
trigger: "Investigate Phase 35 UAT blocker issues tests 5, 6, and 8 in /Users/lmarques/Dev/efx-motion-editor. User reports: [apply canvas] and [apply play canvas] end with \"Could not apply physics paint output. The main editor did not return an apply result.\" The app sidebar also shows \"Target layer is not a physic-paint rendered-output layer\". Sequence apply is slow and logs/says \"RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID\". Expected: standalone emits/sends physic-paint:apply, editor applies payload to selected physic-paint layer/current frame, returns matching physic-paint:apply-result, preview updates. Relevant files likely include app/src/lib/physicPaintBridge.ts, app/src/main.tsx, app/src/components/sidebar/PhysicPaintProperties.tsx, app/src/stores/physicPaintStore.ts, app/src/types/physicPaint.ts, packages/efx-physic-paint/demo/src/App.tsx. Read .planning/phases/35-interactive-physics-paint-controls/35-UAT.md and source files. Return root cause, exact files/functions involved, and minimal fix guidance. Do not edit files."
created: 2026-06-09T00:00:00Z
updated: 2026-06-09T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "Two independent contract breaks cause the UAT blockers: (1) PhysicsPaintStudio sends apply over Tauri events but only listens for DOM CustomEvent apply-result, so native apply results are never observed and the standalone times out; (2) physic-paint layer persistence omits/restores layer_id, so saved/reopened physic-paint layers lack source.layerId and applyPhysicPaintPayload rejects them as not rendered-output layers."
  confirming_evidence:
    - "PhysicsPaintStudio.tsx sends Tauri payload with eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload) but only registers window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT)."
    - "physicPaintBridge.ts Tauri listener replies through eventApi.emit and eventApi.emitTo('efx-physic-paint', PHYSIC_PAINT_APPLY_RESULT_EVENT, result), not DOM CustomEvent in the standalone webview."
    - "projectStore.ts buildMceProject serializes source.layer_id only for paint layers, while loadProject reconstructs layerId only for paint; physic-paint falls through to raw ml.source."
    - "The reported sidebar error string is exactly the failure branch requiring targetLayer.source.layerId === payload.layerId."
  falsification_test: "A native Tauri listener in PhysicsPaintStudio for PHYSIC_PAINT_APPLY_RESULT_EVENT or persisted/reopened physic-paint source.layerId matching layer.id would falsify the respective sub-hypothesis; neither exists in the inspected source."
  fix_rationale: "Listen for Tauri apply-result in the standalone and persist/hydrate physic-paint layer_id the same way paint layers do; this repairs the exact communication and data-shape contracts rather than suppressing the timeout or loosening validation."
  blind_spots: "Did not run the app per project instruction and did not inspect the user's actual .mce file, so the persistence sub-cause is inferred from source and exact error text; fresh unsaved layers may only hit the result-listener bug."
next_action: update Resolution with confirmed root cause and return diagnose-only findings without editing files

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: standalone emits/sends physic-paint:apply, editor applies payload to selected physic-paint layer/current frame, returns matching physic-paint:apply-result, preview updates
actual: [apply canvas] and [apply play canvas] end with "Could not apply physics paint output. The main editor did not return an apply result." Sidebar shows "Target layer is not a physic-paint rendered-output layer". Sequence apply is slow and logs/says "RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID".
errors: "Could not apply physics paint output. The main editor did not return an apply result."; "Target layer is not a physic-paint rendered-output layer"; "RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID"
reproduction: Phase 35 UAT tests 5, 6, and 8: apply canvas, apply play canvas, sequence apply
started: Phase 35 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-09T00:01:00Z
  checked: Phase 35 UAT tests 5, 6, and 8 plus physic-paint bridge/store/sidebar/demo files
  found: UAT failures are apply-result timeout in standalone plus editor sidebar error "Target layer is not a physic-paint rendered-output layer". Bridge validation returns that exact error when targetLayer.type/source/source.layerId do not match the payload layerId. Store can apply valid payloads once validation passes.
  implication: failure is before store write or result routing; likely selected layer data shape/protocol mismatch or standalone/editor transport mismatch.
- timestamp: 2026-06-09T00:02:00Z
  checked: PhysicsPaintStudio Tauri apply send/result receive path vs main bridge listener
  found: PhysicsPaintStudio sends Tauri apply via eventApi.emitTo('main', 'physic-paint:apply', payload), and main installPhysicPaintApplyListener replies via eventApi.emit('physic-paint:apply-result') plus emitTo('efx-physic-paint', ...). However PhysicsPaintStudio only installs window.addEventListener('physic-paint:apply-result') and never listens on @tauri-apps/api/event for that result.
  implication: in the native UAT path, the standalone can successfully send apply but will not observe the Tauri apply-result, so its 5s timeout message is expected even when the editor produced an error result.
- timestamp: 2026-06-09T00:03:00Z
  checked: physic-paint layer creation and project serialization/deserialization
  found: AddFxMenu creates physic-paint layers with source { type: 'physic-paint', layerId }. buildMceProject only serializes layer_id for source.type === 'paint', not source.type === 'physic-paint'. load path only reconstructs layerId for t === 'paint'; physic-paint falls through to raw ml.source, which lacks camelCase layerId after save/open.
  implication: newly created unsaved layers should validate, but saved/reopened physic-paint layers hydrate as source.type 'physic-paint' with no source.layerId, making applyPhysicPaintPayload reject them with the exact sidebar error.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Two Phase 35 protocol/data-shape regressions: PhysicsPaintStudio sends native Tauri apply events but does not subscribe to native Tauri apply-result events, causing standalone timeout; persisted physic-paint layers do not round-trip source.layerId because projectStore only serializes/deserializes layer_id for paint layers, causing applyPhysicPaintPayload to reject reopened physic-paint layers as not rendered-output layers."
fix: "Minimal guidance only: add Tauri apply-result listener in PhysicsPaintStudio and persist/hydrate physic-paint source.layerId in projectStore/MceLayerSource; optionally keep strict validation but make it tolerant only if source.type is physic-paint and missing layerId by falling back to layer.id after fixing persistence."
verification: diagnose-only; no files edited
files_changed: []
