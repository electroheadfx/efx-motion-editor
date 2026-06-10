---
phase: 35-interactive-physics-paint-controls
verified: 2026-06-10T17:02:23Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 35: Interactive Physics Paint Controls Verification Report

**Phase Goal:** Interactive Physics Paint Controls — additive physic-paint editor layer, standalone interactive physics paint controls/diagnostics, apply canvas/apply play canvas rendered-output apply-back, and visible feedback without replacing existing paint systems.
**Roadmap Goal:** Users can validate efx-physic-paint as a separate live physics paint tool with observable interactive behavior and diagnostics.
**Verified:** 2026-06-10T17:02:23Z
**Status:** passed
**Re-verification:** No — initial verification against current code and current UAT state. Stale gap artifacts were not treated as active bugs without current code evidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can paint on a live physics canvas using local `@efxlab/efx-physic-paint`. | VERIFIED | `app/src/components/physic-paint/PhysicsPaintStudio.tsx` and `packages/efx-physic-paint/demo/src/App.tsx` render `EfxPaintCanvas` from `@efxlab/efx-physic-paint/preact`, retain engine ownership via `onEngineReady`, and UAT tests 2-3 currently record pass. |
| 2 | User can use paint and erase tools through real engine APIs. | VERIFIED | `PhysicsPaintStudioToolbar.tsx` and demo `Toolbar.tsx` call `engine.setTool(nextTool)` / `engine.setTool(t)` and render Paint/Erase buttons; UAT test 3 records pass. |
| 3 | User can change color, brush size, opacity, and physics controls and see live canvas response. | VERIFIED | Toolbar handlers call real engine APIs: `setColorHex`, `setBrushSize`, `setBrushOpacity`, `setPhysicsMode`, `setLocalSpreadStrength`, `startPhysics`, and `stopPhysics`; settings are surfaced to diagnostics. UAT test 3 records pass. |
| 4 | User can see engine readiness, canvas/session state, active settings, bridge state, and errors while testing. | VERIFIED | `PhysicsPaintStudio.tsx` computes missing conditions (`Canvas is still mounting`, `No app layer context received`, `App bridge is not connected`), renders `Ready to apply` / `Not ready to apply`, diagnostics grid, active tool/color/brush/opacity/physics mode, bridge transport mode, and last error. UAT tests 2 and 8 currently record pass. |
| 5 | efx-physic-paint is an additional tool and does not replace basic perfect-freehand paint or p5.brush FX paint. | VERIFIED | `LayerType` adds sibling `'physic-paint'` while preserving `'paint'`; `AddFxMenu.tsx` keeps `Paint / Rotopaint` and adds separate `Physic Paint`; `LeftPanel.tsx` routes only `physic-paint` layers to `PhysicPaintProperties`; preview keeps existing `layer.type === 'paint'` branch. |
| 6 | User can create/select a distinct Physic Paint layer and open the standalone canvas from `[open fx paint canvas]`. | VERIFIED | `AddFxMenu.tsx` creates `type: 'physic-paint'`, `source: { type: 'physic-paint', layerId }`; `PhysicPaintProperties.tsx` renders exact `[open fx paint canvas]` button and calls `openPhysicPaintCanvas`; `LeftPanel.tsx` wires selected physic-paint layers to this panel. |
| 7 | `[apply canvas]` writes rendered current canvas output into the selected physics paint layer at the captured app frame and returns visible feedback. | VERIFIED | `PhysicsPaintStudio.tsx` captures `engine.exportCompositeCanvas().toDataURL('image/png')`, sends `kind: 'apply-canvas'`, `layerId`, `startFrame`, rendered frame, and editable state; `physicPaintBridge.ts` validates and calls `physicPaintStore.applyCanvas`; result feedback uses `PHYSIC_PAINT_APPLY_RESULT_EVENT`; bridge tests assert frame placement and operation-matched success. |
| 8 | `[apply play canvas]` writes generated rendered frame sequence starting at captured app frame and returns visible feedback. | VERIFIED | `PhysicsPaintStudio.tsx` uses `AnimationPlayer.play`, maps frame index to `appFrame: launchContext.startFrame + frameIndex`, sends `kind: 'apply-play-canvas'`; `physicPaintStore.applySequence` stores frames at `startFrame + index`; bridge tests assert frames 10, 11, 12 for a three-frame payload. |
| 9 | Apply/result transport works over Tauri runtime and browser/dev fallback without timeout-causing missing result routing. | VERIFIED | `installPhysicPaintApplyListener` listens for `physic-paint:apply`, emits `physic-paint:apply-result` via Tauri `emit`/`emitTo` and browser `CustomEvent`; `PhysicsPaintStudio.tsx` listens for DOM and Tauri `PHYSIC_PAINT_APPLY_RESULT_EVENT`, matches `operationId`, clears timeout, and updates UI. |
| 10 | Invalid apply payloads, stale/wrong contexts, and wrong target layer types fail closed with diagnostics instead of silent mutation. | VERIFIED | `isPhysicPaintApplyPayload` validates shape, frames, rendered PNG URLs, serialized state, and rejects forbidden engine/internals fields; `applyPhysicPaintPayload` rejects unknown/wrong targets and invalid frames; tests cover invalid payloads, wrong target types, engine internals, and hydrated identity fallback. |
| 11 | Physic-paint rendered outputs composite in preview with layer blend mode and opacity, with user controls exposed. | VERIFIED | `previewRenderer.ts` has explicit `layer.type === 'physic-paint'` branch using `physicPaintStore.getFrame`, `blendModeToCompositeOp(layer.blendMode)`, and `effectiveOpacity`; `PhysicPaintProperties.tsx` exposes blend mode select and opacity slider updating `layerStore.updateLayerVisual`. |
| 12 | Save/Load state remains editable physics paint state file workflow and is not rendered-output apply-back. | VERIFIED | `PhysicsPaintStudioToolbar.tsx` and demo `Toolbar.tsx` use `engine.save()` / `engine.load()` for JSON state; Save uses Tauri dialog/fs `writeTextFile` with visible success/cancel/error feedback and browser fallback; apply paths are separate `physic-paint:apply` rendered-output payloads. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/types/layer.ts` | Additive `physic-paint` layer/source type | VERIFIED | Contains `LayerType` member `'physic-paint'` and source `{ type: 'physic-paint'; layerId: string }`, with existing `'paint'` intact. |
| `app/src/types/physicPaint.ts` | Typed launch/apply contracts and validation helpers | VERIFIED | Exports max/default frame constants, clamp helper, launch/apply guards, rendered frame/result types; validates rendered PNG URLs and frame mappings. |
| `app/src/stores/physicPaintStore.ts` | Rendered-output frame store and invalidation | VERIFIED | Provides `physicPaintStore`, `physicPaintVersion`, `applyCanvas`, `applySequence`, MCE output serialization, editable-state storage, and dirty/version invalidation. |
| `app/src/lib/physicPaintBridge.ts` | Launch/open bridge, apply listener/handler, result feedback | VERIFIED | Exports launch/apply constants, `createPhysicPaintLaunchContext`, `openPhysicPaintCanvas`, `applyPhysicPaintPayload`, and `installPhysicPaintApplyListener`. |
| `app/src/components/sidebar/PhysicPaintProperties.tsx` | Physics Paint layer properties and open/apply status UI | VERIFIED | Renders layer/frame/status, compositing controls, `[open fx paint canvas]`, no-output copy, replacement warning, and apply-result success/error messages. |
| `app/src/components/timeline/AddFxMenu.tsx` | Add Physic Paint menu item | VERIFIED | Adds `handleAddPhysicPaintLayer` and menu label `Physic Paint` without changing `handleAddPaintLayer` paint-mode behavior. |
| `app/src/components/layout/LeftPanel.tsx` | Route selected physic-paint layers to the physics properties panel | VERIFIED | Imports `PhysicPaintProperties` and renders it only for `selectedLayer.type === 'physic-paint'`. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | App-hosted standalone live canvas, diagnostics, apply actions/result handling | VERIFIED | Owns `EfxPaintCanvas`, diagnostics, Tauri/browser result listeners, apply still/sequence payload generation, and visible feedback. |
| `app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` | App-hosted real engine toolbar and state save/load | VERIFIED | Real engine settings calls, Save state/Load state, Tauri-first save path, visible save/load feedback. |
| `packages/efx-physic-paint/demo/src/App.tsx` | Package demo standalone controls, diagnostics, apply actions | VERIFIED | Renders local `EfxPaintCanvas`, toolbar, apply controls, readiness diagnostics, and event transport. |
| `packages/efx-physic-paint/demo/src/Toolbar.tsx` | Package demo real engine toolbar | VERIFIED | Real tool/settings APIs and Save state/Load state copy with visible feedback. |
| `app/src/lib/previewRenderer.ts` | Preview compositing for rendered physics frames | VERIFIED | Explicit `physic-paint` branch loads/caches rendered data URLs and composites with blend/opacity; existing paint branch remains. |
| `app/src-tauri/capabilities/default.json` | Native permissions for physics paint window and Save state | VERIFIED | Includes windows `main` and `efx-physic-paint`, `dialog:allow-save`, and `fs:allow-write-text-file`. |
| `app/src/lib/physicPaintBridge.test.ts` | Regression coverage for bridge/apply validation | VERIFIED | Tests launch context, native/browser launch, apply still/sequence placement, invalid payloads, wrong targets, hydrated layer identity, dedupe, and browser listener result dispatch. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `AddFxMenu.tsx` | `layer.ts` / layer store | `source: { type: 'physic-paint', layerId }` | WIRED | `handleAddPhysicPaintLayer` creates and selects a separate physic-paint layer. |
| `LeftPanel.tsx` | `PhysicPaintProperties.tsx` | selected-layer type routing | WIRED | `selectedLayer.type === 'physic-paint'` renders physics properties panel. |
| `PhysicPaintProperties.tsx` | `physicPaintBridge.ts` | open button click | WIRED | Button calls `openPhysicPaintCanvas({ layer, frame })`. |
| `physicPaintBridge.ts` | Tauri/native physics paint window | dynamic `invoke('open_physics_paint_window')` | WIRED | Tauri path uses native command; browser fallback uses `/physics-paint?context=...`. |
| `main.tsx` | `PhysicsPaintStudio.tsx` | route `/physics-paint` | WIRED | The app renders the standalone studio on `/physics-paint`; main editor path installs apply listener. |
| `PhysicsPaintStudio.tsx` | `@efxlab/efx-physic-paint/preact` | `EfxPaintCanvas` / `onEngineReady` | WIRED | Canvas is the engine-owned live painting surface. |
| `PhysicsPaintStudioToolbar.tsx` | engine APIs | real callback handlers | WIRED | Paint/erase/settings call engine methods. |
| `PhysicsPaintStudio.tsx` | `physicPaintBridge.ts` | `physic-paint:apply` / `physic-paint:apply-result` | WIRED | Still/sequence payloads are emitted; DOM and Tauri result listeners route to `handleApplyResult`. |
| `physicPaintBridge.ts` | `physicPaintStore.ts` | `applyCanvas` / `applySequence` after validation | WIRED | Valid payloads mutate rendered-output store; invalid payloads fail closed. |
| `previewRenderer.ts` | `physicPaintStore.ts` | `getFrame` at current frame | WIRED | Preview resolves rendered frame for physics paint layers and draws it. |
| `PhysicPaintProperties.tsx` | `previewRenderer.ts` | layer blend/opacity values | WIRED | Properties update layer visual values consumed by preview compositing. |
| `projectStore.ts` | `physicPaintStore.ts` | MCE serialization/hydration | WIRED | Project serialization includes `physic_paint_outputs` and physic-paint source `layer_id`; hydration restores source layer id and outputs. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `PhysicsPaintStudio.tsx` | `engine`, `canvasMounted`, `settings`, `launchContext`, `applyMessage` | `EfxPaintCanvas.onEngineReady`, DOM/Tauri launch context, toolbar callbacks, apply-result events | Yes | FLOWING |
| `PhysicsPaintStudio.tsx` | apply still payload rendered frame | `engine.exportCompositeCanvas().toDataURL('image/png')` | Yes | FLOWING |
| `PhysicsPaintStudio.tsx` | apply sequence frames | `AnimationPlayer.play` `onFrame` canvas capture, `appFrame = startFrame + frameIndex` | Yes | FLOWING |
| `physicPaintBridge.ts` | apply result | `applyPhysicPaintPayload` validation + `physicPaintStore.applyCanvas/applySequence` | Yes | FLOWING |
| `physicPaintStore.ts` | rendered frame map | Valid apply payloads and project hydration | Yes | FLOWING |
| `previewRenderer.ts` | image source for physic-paint frame | `physicPaintStore.getFrame(paintLayerId, paintLookupFrame)` | Yes | FLOWING |
| `PhysicPaintProperties.tsx` | output status and compositing values | `physicPaintStore.hasOutput`, `timelineStore.currentFrame`, `layer.blendMode`, `layer.opacity` | Yes | FLOWING |
| `PhysicsPaintStudioToolbar.tsx` | Save state JSON | `engine.save()` and user-selected Tauri/browser path | Yes | FLOWING |

### Behavioral Spot-Checks

Automated checks were already run in this session by the caller and are accepted as current execution evidence; no dev server was started per project instructions.

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| App type safety | `pnpm --dir app typecheck` | Caller reports passed | PASS |
| App tests, including bridge/store regression coverage | `pnpm --dir app test --run` | Caller reports passed | PASS |
| Physics paint package type/check | `pnpm --filter @efxlab/efx-physic-paint check` | Caller reports passed | PASS |
| Physics paint demo build | `pnpm --filter @efxlab/efx-physic-paint demo:build` | Caller reports passed | PASS |

### Probe Execution

No phase-declared `probe-*.sh` files were found in the phase plans/summaries, and this is not a migration/probe-driven phase. Step 7c skipped.

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| N/A | N/A | No declared probes | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PAINT-01 | 35-03, 35-04, 35-05, 35-06, 35-07 | User can paint on a live physics canvas using local `@efxlab/efx-physic-paint`. | SATISFIED | `EfxPaintCanvas` rendered from local package in app-hosted studio and package demo; UAT tests 2-3 pass; package check/build passed. |
| PAINT-02 | 35-03, 35-04, 35-05, 35-06, 35-07 | User can change core paint settings such as color, brush size, opacity, and physics controls. | SATISFIED | Toolbar state and handlers call real engine setting APIs and diagnostics display active settings. |
| PAINT-03 | 35-03, 35-04, 35-05, 35-06, 35-07 | User can use at least paint and erase tools through real engine APIs. | SATISFIED | Toolbar tool buttons call `engine.setTool('paint')` / `engine.setTool('erase')`; UAT test 3 pass. |
| PAINT-04 | 35-01, 35-02, 35-04, 35-05, 35-06, 35-07 | User can test efx-physic-paint as a separate physics paint tool without replacing perfect-freehand basic paint or p5.brush FX paint. | SATISFIED | Additive layer/source type, separate menu item, separate properties route, preview branch keeps existing paint branch; AddFxMenu keeps Paint / Rotopaint. |
| DIAG-01 | 35-01, 35-02, 35-03, 35-04, 35-05, 35-06, 35-07 | User can see engine readiness, canvas/session state, active settings, and errors while testing. | SATISFIED | Diagnostics grid and ready/not-ready/missing-condition/error feedback in `PhysicsPaintStudio.tsx`; app sidebar shows open/apply results and replacement warnings. |

No orphaned Phase 35 requirement IDs were found in `.planning/REQUIREMENTS.md`: PAINT-01, PAINT-02, PAINT-03, PAINT-04, and DIAG-01 are all claimed by phase plans and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/lib/physicPaintBridge.ts` | 113 | `return () => {}` | INFO | Safe no-op cleanup only when no browser listener can be installed; not a user-visible stub. |
| `packages/efx-physic-paint/demo/src/App.tsx` | 68, 88 | `return null` | INFO | Parser returns null for invalid/no launch context; diagnostics then show not-ready state. Not a stub. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 57, 85 | `return null` | INFO | Parser returns null for missing/invalid launch context; not-ready diagnostics handle this path. Not a stub. |
| `app/src/lib/previewRenderer.ts` | multiple | `return null` / loading placeholder | INFO | Normal image/video source resolution and async image cache behavior; not a phase stub. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in the phase implementation files scanned.

### Human Verification Required

None for current status. Phase 35 includes live UI behavior that normally requires human UAT, but `35-UAT.md` records completed live checks and the user has provided current status that there are no active issues. Stale UAT/gap details were cross-checked against current code: the previously reported apply-result routing, hydrated layer identity, Save state, and compositing-control gaps have current implementation evidence.

### Gaps Summary

No current blocking gaps found. The phase goal is achieved in the codebase: physics paint is additive, live controls and diagnostics are present, apply canvas/apply play canvas send rendered-output payloads into editor state, preview draws returned outputs with blend/opacity, result feedback is wired, and existing paint systems remain available.

---

_Verified: 2026-06-10T17:02:23Z_
_Verifier: Claude (gsd-verifier)_
