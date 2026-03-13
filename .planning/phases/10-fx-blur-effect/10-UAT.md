---
status: diagnosed
phase: 10-fx-blur-effect
source: [10-01-SUMMARY.md, 10-02 commits (7152d74, f18bf99, 9899e93)]
started: 2026-03-13T12:00:00Z
updated: 2026-03-13T12:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add Blur FX from Menu
expected: Click "+ FX" in the timeline. A "Blur" entry appears under the ADJUSTMENTS section. Clicking it adds a new blur adjustment layer to the layer list.
result: issue
reported: "works but when on Blur layer and selecting Sequence 1 or another layer, it adds a new bottom bar with opacity — multiple stacked property bars appear instead of showing only the selected layer's panel"
severity: major

### 2. Standalone Blur Adjustment — Radius Slider
expected: Select the blur adjustment layer. In the bottom PropertiesPanel, a radius slider appears. Dragging it from 0 toward ~0.5 progressively blurs the entire canvas preview.
result: issue
reported: "works the first time I add, but at blur 1.0 quality is very bad. When I quit the project and re-select the blur layer, blur settings are missing"
severity: major

### 3. Per-Layer Blur on Content Layer
expected: Select a content layer (image/video). In PropertiesPanel, a BLUR section with a Radius slider appears after CROP. Adjusting it blurs only that specific layer while others remain sharp.
result: pass

### 4. Per-Generator Blur on FX Layer
expected: Add a generator FX (e.g., Film Grain). Select it. A BLUR section with Radius slider appears after the generator controls. Adjusting it blurs the grain. No dark halos around grain particles.
result: pass

### 5. HQ Preview Toggle
expected: An "HQ" button appears in the toolbar. Clicking it turns accent-colored and switches blur to higher-quality rendering (may look slightly smoother). Pressing B key toggles HQ on/off.
result: issue
reported: "can't see any quality difference between fast and HQ blur modes"
severity: minor

### 6. Bypass Blur Toggle
expected: A "Blur Off" button appears in the toolbar. Clicking it turns orange and ALL blur effects disappear across all layers. Pressing Shift+B key toggles bypass on/off.
result: issue
reported: "doesn't work"
severity: major

### 7. Shortcuts Overlay Entries
expected: Press ? to open the shortcuts overlay. A "Blur" section appears with "B — Toggle HQ blur preview" and "Shift+B — Toggle bypass all blur" entries.
result: pass

### 8. Blur During Playback
expected: With blur applied to a layer, play the sequence. Blur renders correctly during playback without flickering or visual artifacts.
result: pass

## Summary

total: 8
passed: 4
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Adding blur FX from menu works; selecting a different layer should show only that layer's properties panel"
  status: failed
  reason: "User reported: works but when on Blur layer and selecting Sequence 1 or another layer, it adds a new bottom bar with opacity — multiple stacked property bars appear instead of showing only the selected layer's panel"
  severity: major
  test: 1
  root_cause: "SequenceList.tsx handleSelect (line 111-116) does not call layerStore.setSelected(null) or uiStore.selectLayer(null) when user clicks a sequence in sidebar, unlike timeline click handlers which do clear selection"
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      issue: "handleSelect missing layerStore.setSelected(null) and uiStore.selectLayer(null)"
  missing:
    - "Add layerStore.setSelected(null) and uiStore.selectLayer(null) to handleSelect in SequenceList.tsx"
  debug_session: ".planning/debug/properties-panel-stacking.md"
- truth: "Blur adjustment layer radius persists after closing and reopening project; quality at max radius should be acceptable"
  status: failed
  reason: "User reported: works the first time I add, but at blur 1.0 quality is very bad. When I quit the project and re-select the blur layer, blur settings are missing"
  severity: major
  test: 2
  root_cause: "adjustment-blur missing from project serialization (buildMceProject), deserialization (hydrateFromMce), and MceLayerSource type in project.ts. Quality at 1.0 is inherent to fast blur (4x halving reduces to ~120x68 intermediate)"
  artifacts:
    - path: "Application/src/stores/projectStore.ts"
      issue: "Missing serialization block for adjustment-blur in buildMceProject (~line 125) and deserialization in hydrateFromMce (~line 197)"
    - path: "Application/src/types/project.ts"
      issue: "MceLayerSource interface missing radius?: number field"
    - path: "Application/src/lib/fxBlur.ts"
      issue: "applyFastBlur 4 passes at radius=1.0 reduces to ~120x68 pixels — too small for smooth upscale"
  missing:
    - "Add radius?: number to MceLayerSource"
    - "Add serialization block for adjustment-blur in buildMceProject"
    - "Add deserialization case for adjustment-blur in hydrateFromMce"
    - "Cap fast blur passes or use hybrid approach for high radii"
  debug_session: ".planning/debug/blur-settings-persistence-and-quality.md"
- truth: "HQ toggle should produce visibly smoother blur compared to fast mode"
  status: failed
  reason: "User reported: can't see any quality difference between fast and HQ blur modes"
  severity: minor
  test: 5
  root_cause: "Preview.tsx render effect does not subscribe to blurStore.hqPreview.value — toggling HQ changes the signal but never triggers a canvas re-render. blurStore.isHQ() uses .peek() which is non-reactive"
  artifacts:
    - path: "Application/src/components/Preview.tsx"
      issue: "Render effect (~line 70) missing blurStore.hqPreview.value subscription"
    - path: "Application/src/stores/blurStore.ts"
      issue: "isHQ() uses .peek() — non-reactive read, correct for render loop but needs reactive trigger elsewhere"
  missing:
    - "Add blurStore.hqPreview.value read to Preview.tsx render effect to create reactive subscription"
  debug_session: ".planning/debug/blur-toolbar-controls.md"
- truth: "Bypass Blur toggle in toolbar and Shift+B shortcut should disable all blur effects"
  status: failed
  reason: "User reported: doesn't work"
  severity: major
  test: 6
  root_cause: "Same as test 5 — Preview.tsx render effect does not subscribe to blurStore.bypassBlur.value. Toggling bypass changes the signal and updates toolbar button visuals, but never triggers a canvas re-render"
  artifacts:
    - path: "Application/src/components/Preview.tsx"
      issue: "Render effect (~line 70) missing blurStore.bypassBlur.value subscription"
    - path: "Application/src/stores/blurStore.ts"
      issue: "isBypassed() uses .peek() — non-reactive read"
  missing:
    - "Add blurStore.bypassBlur.value read to Preview.tsx render effect to create reactive subscription"
  debug_session: ".planning/debug/blur-toolbar-controls.md"
