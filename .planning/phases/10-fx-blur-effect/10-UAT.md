---
status: complete
phase: 10-fx-blur-effect
source: [10-01-SUMMARY.md, 10-02 commits (7152d74, f18bf99, 9899e93), 10-03 fixes (526d429, 4f6f07d)]
started: 2026-03-13T14:00:00Z
updated: 2026-03-13T14:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add Blur FX from Menu
expected: Click "+ FX" in the timeline. A "Blur" entry appears under ADJUSTMENTS. Clicking it adds a blur adjustment layer. Selecting a different layer or sequence shows only that item's properties panel — no stacked panels.
result: pass

### 2. Blur Radius Slider and Persistence
expected: Select the blur adjustment layer. A radius slider appears in PropertiesPanel. Dragging it blurs the canvas preview. Close and reopen the project — the blur layer and its radius setting are preserved.
result: issue
reported: "I set the blur layer to 1.0, I save, quit then re-open the project: the blur layer is to 0.3 instead 1.0"
severity: major

### 3. Per-Layer Blur on Content Layer
expected: Select a content layer (image/video). In PropertiesPanel, a BLUR section with Radius slider appears. Adjusting it blurs only that specific layer while others remain sharp.
result: issue
reported: "in sidebar LAYERS I select a content layer, set a blur: it works, but if I save, close an re-open the project the blur setting is not saved"
severity: major

### 4. Per-Generator Blur on FX Layer
expected: Add a generator FX (e.g., Film Grain). Select it. A BLUR section with Radius slider appears after the generator controls. Adjusting it blurs the grain. No dark halos around grain particles.
result: pass

### 5. HQ Preview Toggle
expected: An "HQ" button appears in the toolbar. Clicking it turns accent-colored and blur visibly switches to smoother, higher-quality rendering. Pressing B key toggles HQ on/off. Canvas re-renders on toggle.
result: issue
reported: "HQ no work, it make disapear the blur, then when I desactivate HQ the image is strangely zoomed and cropped, I need to fit make HQ and remove HQ. its very weird. The High quality blur no work at all"
severity: blocker

### 6. Bypass Blur Toggle
expected: A "Blur Off" button appears in the toolbar. Clicking it turns orange and ALL blur effects disappear across all layers. Pressing Shift+B toggles bypass on/off. Canvas re-renders immediately.
result: pass

### 7. Shortcuts Overlay Entries
expected: Press ? to open the shortcuts overlay. A "Blur" section appears with "B — Toggle HQ blur preview" and "Shift+B — Toggle bypass all blur" entries.
result: pass

### 8. Blur During Playback
expected: With blur applied to a layer, play the sequence. Blur renders correctly during playback without flickering or visual artifacts.
result: pass

## Summary

total: 8
passed: 5
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Blur adjustment layer radius persists correctly after save/reopen (1.0 saved → 1.0 restored)"
  status: failed
  reason: "User reported: I set the blur layer to 1.0, I save, quit then re-open the project: the blur layer is to 0.3 instead 1.0"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Per-layer blur on content layers persists after save/reopen"
  status: failed
  reason: "User reported: in sidebar LAYERS I select a content layer, set a blur: it works, but if I save, close an re-open the project the blur setting is not saved"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "HQ toggle produces visibly smoother blur without visual artifacts or canvas corruption"
  status: failed
  reason: "User reported: HQ no work, it make disapear the blur, then when I desactivate HQ the image is strangely zoomed and cropped, I need to fit make HQ and remove HQ. its very weird. The High quality blur no work at all"
  severity: blocker
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
