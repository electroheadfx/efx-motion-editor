---
status: diagnosed
trigger: "Canvas not updating in real-time when keyframe properties change"
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - two-part root cause
test: completed
expecting: n/a
next_action: document root cause and return diagnosis

## Symptoms

expected: Modifying keyframe values (move, resize, rotate) should immediately update the canvas preview and motion path trail
actual: Canvas preview does not update in real-time; user must click "update keyframe" button or refresh
errors: none reported (behavioral bug, not crash)
reproduction: modify any keyframe property on canvas - observe no live update
started: unknown - may have never worked for live canvas updates

## Eliminated

## Evidence

- timestamp: 2026-03-24T00:01:00Z
  checked: Preview.tsx render effect (line 49-58)
  found: subscribes to sequenceStore.sequences.value, frameMap.value, blurStore.bypassBlur.value, and timelineStore.displayFrame.value. Does NOT subscribe to keyframeStore.transientOverrides or displayValues.
  implication: transient edits between keyframes are invisible to canvas renderer

- timestamp: 2026-03-24T00:02:00Z
  checked: exportRenderer.ts interpolateLayers (lines 41-61)
  found: function reads layer.keyframes and calls interpolateAt() to compute transform values, then overwrites layer.transform, opacity, and blur with interpolated results
  implication: any direct update to layer.transform is overwritten by keyframe interpolation during render

- timestamp: 2026-03-24T00:03:00Z
  checked: SidebarProperties.tsx handleKeyframeEdit (lines 36-54)
  found: when BETWEEN keyframes (isOnKf is false), calls keyframeStore.setTransientValue() which only writes to transientOverrides signal. Does NOT write to sequenceStore/layerStore at all.
  implication: between-keyframe edits never reach the renderer pipeline

- timestamp: 2026-03-24T00:04:00Z
  checked: TransformOverlay.tsx move handler (lines 416-425)
  found: updates layer.transform via layerStore.updateLayer() but does NOT update layer.keyframes
  implication: canvas drag on a keyframed layer updates transform that gets immediately overwritten by interpolateLayers in renderer

- timestamp: 2026-03-24T00:05:00Z
  checked: TransformOverlay.tsx kf-drag handler (lines 369-390)
  found: correctly updates layer.keyframes (not just transform), which is why motion path keyframe drag works
  implication: confirms that updating keyframes is the correct approach for the renderer to pick up changes

- timestamp: 2026-03-24T00:06:00Z
  checked: KeyframeNavBar.tsx (lines 77-79, 100-107)
  found: "Update keyframe" button calls keyframeStore.addKeyframe() which snapshots current transient overrides into the keyframes array, then updates layerStore. This is the manual step users must take.
  implication: the button exists because transient edits don't flow to the renderer automatically

- timestamp: 2026-03-24T00:07:00Z
  checked: keyframeStore.ts addKeyframe (lines 122-162)
  found: reads transientOverrides and writes values into keyframes array, then calls layerStore.updateLayer with updated keyframes. This is the bridge between transient edits and the renderer.
  implication: the addKeyframe function IS the manual "commit" step

## Resolution

root_cause: |
  Two-part architectural gap between keyframe edits and the canvas renderer:

  PART 1 - Sidebar property edits between keyframes are invisible to the renderer:
  When the playhead is BETWEEN keyframes, SidebarProperties.handleKeyframeEdit writes to
  keyframeStore.transientOverrides (a local UI signal). The Preview.tsx render effect subscribes
  to sequenceStore.sequences.value but NEVER reads transientOverrides or displayValues. The
  renderer (exportRenderer.ts interpolateLayers) reads layer.keyframes to compute interpolated
  values -- transientOverrides are not in that pipeline. Result: edits are only visible in the
  sidebar, not the canvas.

  PART 2 - Canvas drag (move/scale/rotate) on keyframed layers is overwritten by interpolation:
  TransformOverlay's move/scale/rotate handlers update layer.transform via layerStore.updateLayer,
  but do NOT update layer.keyframes. The renderer's interpolateLayers() then overwrites
  layer.transform with values computed from the unchanged keyframes. Result: drag appears to
  have no effect on the canvas preview because the rendered output reverts to keyframe-interpolated
  values.

  The kf-drag mode (motion path keyframe circle drag) works correctly because it updates
  layer.keyframes directly, which the renderer picks up.

  The "Update keyframe" button (KeyframeNavBar) bridges the gap by calling addKeyframe() which
  copies transientOverrides into the keyframes array -- but this requires a manual step.

fix:
verification:
files_changed: []
