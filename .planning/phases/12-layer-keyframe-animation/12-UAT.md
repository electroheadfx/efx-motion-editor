---
status: diagnosed
phase: 12-layer-keyframe-animation
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md]
started: 2026-03-15T12:00:00Z
updated: 2026-03-15T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add Keyframe via I Shortcut
expected: Select a content layer, position playhead at a frame, press I. A keyframe is added at the current frame — a gold diamond marker appears on the timeline track at that position.
result: pass

### 2. Properties Panel Keyframe Button
expected: With a keyframed content layer selected: when the playhead is between keyframes, a [+ Keyframe] button (accent color) appears in the properties panel. When the playhead is ON an existing keyframe frame, the button shows as "Update" (gold color).
result: issue
reported: "work but when I select the layer and move the playhead the keyframe disapear, I need to reselect the sidebar layer to view the keyframes"
severity: major

### 3. Interpolated Values in Properties Panel
expected: Add two keyframes at different frames with different transform values (e.g., different X position). Scrub to a frame between them. The properties panel should show the interpolated (in-between) values, not the raw layer values.
result: issue
reported: "The properties panel is not show because when I scrub the keyframes and properties are removed"
severity: major

### 4. Preview Interpolation During Playback
expected: Add 2+ keyframes with different property values (e.g., position, opacity, or scale). Press play. The content layer animates smoothly between keyframe values during playback.
result: pass

### 5. Click-Select Keyframe Diamond
expected: Click a gold diamond on the timeline track. The diamond highlights with a white stroke/glow (selected state). The playhead snaps to that keyframe's frame.
result: issue
reported: "its not possible because the keyframes are removed from UI when I try to select a keyframe or when I scrub to any frame"
severity: blocker

### 6. Shift-Multiselect Keyframe Diamonds
expected: Click one diamond to select it. Then shift-click another diamond. Both diamonds should show the selected (highlighted) state simultaneously.
result: issue
reported: "I can not select any diamond/keyframe, disapear from any action on the timeline"
severity: blocker

### 7. Drag-Move Keyframe Diamond
expected: Click and drag a keyframe diamond horizontally on the timeline. The diamond moves to the new frame position. Releasing the mouse commits the move.
result: issue
reported: "I can't do that due to the previous bug I reported. Keyframes and properties are not visible when I do action in timeline (click on keyframe or scrub)"
severity: blocker

### 8. Delete Selected Keyframes
expected: Select one or more keyframe diamonds on the timeline. Press the Delete key. The selected diamonds are removed from the timeline track. The Delete key should remove keyframes before attempting to delete layers.
result: issue
reported: "Can not work due to the previous issue"
severity: blocker

### 9. Double-Click Interpolation Popover
expected: Double-click a keyframe diamond on the timeline. A popover appears showing 4 interpolation/easing options: Linear, Ease In, Ease Out, Ease In-Out. The current easing is highlighted in gold.
result: issue
reported: "Can not work due to the previous issue"
severity: blocker

### 10. Change Easing via Popover
expected: Open the interpolation popover (double-click diamond). Click a different easing option. The popover closes, and the easing is applied to that keyframe. Playing back should show the new easing curve affect the animation.
result: issue
reported: "Can not work due to the previous issue"
severity: blocker

### 11. Save and Reload Keyframes
expected: Add keyframes to a content layer. Save the project (.mce file). Close and reopen the project. All keyframes should persist — diamonds appear on the timeline, interpolation works during playback, same easing settings are retained.
result: pass

## Summary

total: 11
passed: 3
issues: 8
pending: 0
skipped: 0

## Gaps

- truth: "Properties panel keyframe button and interpolated values persist when moving playhead"
  status: failed
  reason: "User reported: work but when I select the layer and move the playhead the keyframe disapear, I need to reselect the sidebar layer to view the keyframes"
  severity: major
  test: 2
  root_cause: "TimelineInteraction.ts onPointerDown() unconditionally calls layerStore.setSelected(null) and uiStore.selectLayer(null) on content track clicks (lines 388-390, 425-429), destroying the selectedLayerId signal that keyframeStore.activeLayerKeyframes depends on"
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Two code paths unconditionally clear layer selection on any timeline click/scrub"
  missing:
    - "Conditional layer clearing: only clear when selected layer is an FX layer, preserve content layer selection"
  debug_session: ".planning/debug/keyframe-diamonds-disappear.md"

- truth: "Properties panel shows interpolated values when scrubbing between keyframes"
  status: failed
  reason: "User reported: The properties panel is not show because when I scrub the keyframes and properties are removed"
  severity: major
  test: 3
  root_cause: "Same root cause as test 2 — layerStore.setSelected(null) in TimelineInteraction.ts clears the signal chain that PropertiesPanel depends on"
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Unconditional layer selection clearing"
  missing:
    - "Conditional layer clearing: only clear when selected layer is an FX layer"
  debug_session: ".planning/debug/keyframe-diamonds-disappear.md"

- truth: "Keyframe diamonds remain visible and interactive during timeline interaction (click, scrub)"
  status: failed
  reason: "User reported: keyframes are removed from UI when trying to select a keyframe or when scrubbing to any frame"
  severity: blocker
  test: 5
  root_cause: "layerStore.setSelected(null) in TimelineInteraction.ts (lines 388-390, 425-429) breaks the signal chain: selectedLayerId→null → activeLayerKeyframes→[] → DrawState.selectedLayerKeyframes→undefined → drawKeyframeDiamonds returns early → diamonds vanish → keyframeHitTest returns null → cascading failure"
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Two code paths clear layer selection unconditionally"
    - path: "Application/src/stores/keyframeStore.ts"
      issue: "activeLayerKeyframes computed returns [] when selectedLayerId is null"
  missing:
    - "Conditional layer clearing: only clear FX layer selection, not content layers"
  debug_session: ".planning/debug/keyframe-diamonds-disappear.md"

- truth: "Keyframe diamond selection, multiselect, drag, delete, and popover all functional"
  status: failed
  reason: "User reported: keyframes disappear from any action on the timeline, blocking all interaction features (tests 5-10)"
  severity: blocker
  test: 6
  root_cause: "Same root cause — once diamonds vanish from the unconditional setSelected(null), keyframeHitTest returns null, all subsequent clicks fall through to the clearing code again"
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Unconditional layer selection clearing cascades to block all keyframe interactions"
  missing:
    - "Conditional layer clearing: only clear FX layer selection"
  debug_session: ".planning/debug/keyframe-diamonds-disappear.md"
