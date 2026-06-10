---
status: diagnosed
phase: 35-interactive-physics-paint-controls
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md, 35-05-PLAN.md, 35-UI-SPEC.md
started: 2026-06-09T11:31:00Z
updated: 2026-06-10T12:00:05Z
---

## Current Test

[testing complete]

## Tests

### 1. Create and Inspect Physic Paint Layer
expected: In the editor, the PAINT layer menu includes a distinct Physic Paint item. Creating/selecting it shows Physic Paint sidebar properties with current layer/frame details, rendered-output status or the empty-state copy, and a visible primary `[open fx paint canvas]` button without removing existing basic paint or p5.brush FX paint controls.
result: pass

### 2. Open Standalone With Layer and Frame Context
expected: Clicking `[open fx paint canvas]` opens the standalone physics paint canvas with the selected layer and current frame context. The standalone diagnostics/apply strip becomes visible and reports ready/not-ready state, layer/frame context, engine/canvas state, active tool/settings, physics mode, bridge transport mode, and last error without requiring the console.
result: pass

### 3. Use Live Standalone Physics Controls
expected: The standalone canvas remains the dominant surface, the existing toolbar controls remain visible, Paint and Erase are mutually exclusive, and changing brush/color/physics settings affects the real live physics paint session rather than a fake preview.
result: pass

### 4. Save and Load Editable State
expected: The standalone persistence controls are labelled `Save state` and `Load state`. Saving downloads or saves editable physics paint state JSON, loading valid state replaces the standalone canvas state, and loading an invalid file shows the required invalid-state-file error copy rather than applying rendered output to the editor.
result: pass

### 5. Apply Current Canvas to Editor Frame
expected: Clicking `[apply canvas]` sends rendered physics paint output back to the editor for the captured current frame. The editor preview visibly updates on that frame, the standalone receives matching apply-result feedback, and success copy says `Applied to frame {frame}`.
result: pass

### 6. Apply Play Canvas Sequence
expected: The standalone shows a `Frames to apply` input with default 120 and valid range 1 to 600. Clicking `[apply play canvas]` applies generated rendered frames starting at the captured app frame, disables apply buttons while applying, shows `Applying physics paint output...`, updates the editor preview across those frames, and success copy says `Applied {count} frames starting at frame {frame}`.
result: pass

### 7. Replace Existing Physics Paint Output
expected: When applying to a frame that already has physics paint output, the app shows non-blocking warning copy `This frame already has physics paint output. Applying will replace it.` Applying again replaces that frame's physics paint output without duplicating or corrupting previous output.
result: pass

### 8. Error and Not-Ready Feedback
expected: If the standalone lacks app layer context, canvas readiness, bridge/listener availability, or another required condition, the apply state is visibly not ready with plain-language missing-condition text. Apply errors remain visible with `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.` until the next successful action or dismissal.
result: pass

### 9. Preview Compositing and Timeline Redraw
expected: Applied physics paint output composites in the editor preview using the layer blend mode and opacity. Moving across frames redraws the correct physics paint output, frames without output draw nothing safely, and existing basic paint and p5.brush FX paint rendering still works.
result: issue
reported: "I can't test there is No layer blend mode and opacity option in Physic Paint layer PROPERTIES"
severity: major

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The standalone persistence controls are labelled `Save state` and `Load state`. Saving downloads or saves editable physics paint state JSON, loading valid state replaces the standalone canvas state, and loading an invalid file shows the required invalid-state-file error copy rather than applying rendered output to the editor."
  status: failed
  reason: "User reported: save button doesn't save a file, I see nothing, maybe its for the next release ?"
  severity: major
  test: 4
  root_cause: "Save state serializes engine state correctly, but the product toolbar uses a fragile browser Blob/download-anchor path inside the Tauri standalone webview. It does not use a native save dialog or fs write, and the app capability file lacks dialog:allow-save, so clicking Save state can produce no visible file."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx"
      issue: "onSave uses detached anchor Blob download instead of Tauri save dialog/writeTextFile"
    - path: "packages/efx-physic-paint/demo/src/Toolbar.tsx"
      issue: "demo toolbar has the same browser-only save behavior"
    - path: "app/src-tauri/capabilities/default.json"
      issue: "missing dialog:allow-save permission for native save dialog"
  missing:
    - "Implement Tauri-first Save state with @tauri-apps/plugin-dialog save and @tauri-apps/plugin-fs writeTextFile"
    - "Add dialog:allow-save capability"
    - "Keep a safer browser fallback with visible success/error feedback"
  debug_session: ".planning/debug/phase-35-uat-save-button.md"
- truth: "Clicking `[apply canvas]` sends rendered physics paint output back to the editor for the captured current frame. The editor preview visibly updates on that frame, the standalone receives matching apply-result feedback, and success copy says `Applied to frame {frame}`."
  status: failed
  reason: "User reported: apply canvas out an error: \"Could not apply physics paint output. The main editor did not return an apply result.\""
  severity: blocker
  test: 5
  root_cause: "The standalone sends native Tauri apply events, and the editor replies with native Tauri apply-result events, but PhysicsPaintStudio only listens for DOM CustomEvent apply results. In native mode the result never reaches the standalone, causing the timeout. A second persistence bug can also hydrate physic-paint layers without source.layerId, causing editor-side validation to reject payloads as not a physic-paint rendered-output layer."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "listens only to DOM CustomEvent apply results, not Tauri event bus results"
    - path: "app/src/lib/physicPaintBridge.ts"
      issue: "editor emits apply-result over Tauri events and strictly validates targetLayer.source.layerId"
    - path: "app/src/stores/projectStore.ts"
      issue: "does not serialize/hydrate source.layerId for physic-paint layers"
  missing:
    - "Add Tauri event listener for PHYSIC_PAINT_APPLY_RESULT_EVENT in PhysicsPaintStudio"
    - "Serialize and hydrate physic-paint layer_id/layerId in projectStore"
  debug_session: ".planning/debug/phase-35-uat-blockers.md"
- truth: "The standalone shows a `Frames to apply` input with default 120 and valid range 1 to 600. Clicking `[apply play canvas]` applies generated rendered frames starting at the captured app frame, disables apply buttons while applying, shows `Applying physics paint output...`, updates the editor preview across those frames, and success copy says `Applied {count} frames starting at frame {frame}`."
  status: failed
  reason: "User reported: apply play canvas : applying (its very slow, maybe a rerender excess ?) [screenshot shows Not ready to apply / Applying physics paint output... / Apply operation is still running], but in end its say the same issue for apply canvas: \"Could not apply physics paint output. The main editor did not return an apply result.\" Additional diagnostic: server says \"RemoteLayerTreeDrawingAreaProxyMac::scheduleDisplayLink(): page has no displayID\""
  severity: blocker
  test: 6
  root_cause: "The same missing native apply-result listener causes sequence apply to time out after sending native Tauri payloads. The reported slowness is likely secondary to synchronously generating up to 120 PNG data URLs and sending one large payload, not the primary missing-result timeout."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "sequence apply shares the same missing native apply-result listener and generates a large synchronous payload"
    - path: "app/src/lib/physicPaintBridge.ts"
      issue: "native apply result is emitted but standalone does not consume it"
  missing:
    - "Route Tauri apply-result events through the same result handler as DOM fallback"
    - "After transport is fixed, consider chunking/yielding sequence frame capture if still slow"
  debug_session: ".planning/debug/phase-35-uat-blockers.md"
- truth: "If the standalone lacks app layer context, canvas readiness, bridge/listener availability, or another required condition, the apply state is visibly not ready with plain-language missing-condition text. Apply errors remain visible with `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.` until the next successful action or dismissal."
  status: failed
  reason: "User reported: I have errors when I apply physics paint canvas. Screenshot shows standalone ready state with \"Could not apply physics paint output. The main editor did not return an apply result.\" and app sidebar error \"Target layer is not a physic-paint rendered-output layer\"."
  severity: blocker
  test: 8
  root_cause: "Editor-side apply validation is rejecting the selected layer because physic-paint source.layerId can be missing after project serialization/hydration. The sidebar error is accurate but reveals the projectStore persistence gap; standalone timeout is the separate missing native apply-result listener."
  artifacts:
    - path: "app/src/stores/projectStore.ts"
      issue: "physic-paint source.layerId is not persisted/hydrated like paint source.layerId"
    - path: "app/src/lib/physicPaintBridge.ts"
      issue: "strict validation rejects hydrated layers without matching source.layerId"
    - path: "app/src/components/sidebar/PhysicPaintProperties.tsx"
      issue: "surfaces the editor-side apply-result error"
  missing:
    - "Persist/hydrate physic-paint layer_id/layerId in projectStore"
    - "Optionally normalize already-saved physic-paint layers when targetLayer.id matches payload.layerId"
  debug_session: ".planning/debug/phase-35-uat-blockers.md"
- truth: "Applied physics paint output composites in the editor preview using the layer blend mode and opacity. Moving across frames redraws the correct physics paint output, frames without output draw nothing safely, and existing basic paint and p5.brush FX paint rendering still works."
  status: failed
  reason: "User reported: I can't test there is No layer blend mode and opacity option in Physic Paint layer PROPERTIES"
  severity: major
  test: 9
  root_cause: "The preview renderer already composites `physic-paint` output with `layer.blendMode` and effective opacity, but `LeftPanel.tsx` routes selected `physic-paint` layers exclusively to `PhysicPaintProperties`, and that component only renders layer/status/open-canvas sections. It never exposes the common layer blend mode select or opacity slider available in `SidebarProperties` and `PaintProperties`, so the user cannot configure or validate the compositing controls from the Physic Paint layer properties panel."
  artifacts:
    - path: "app/src/components/layout/LeftPanel.tsx"
      issue: "selected `physic-paint` layers bypass common layer property controls and render only `PhysicPaintProperties`"
    - path: "app/src/components/sidebar/PhysicPaintProperties.tsx"
      issue: "missing layer blend mode select and opacity slider despite Test 9 requiring user-configurable compositing"
    - path: "app/src/lib/previewRenderer.ts"
      issue: "rendering path already uses `layer.blendMode` and effective opacity for `physic-paint`, but no UI exposes those values for this layer type"
  missing:
    - "Add Physic Paint layer blend mode and opacity controls to the Properties panel"
    - "Wire controls to `layerStore.updateLayer` using existing `BlendMode` semantics"
    - "Keep preview renderer behavior intact and add/extend coverage or source assertions for the compositing control path"
  debug_session: ".planning/debug/phase-35-uat-physic-paint-compositing-controls.md"
