---
status: resolved
trigger: "Blend mode and opacity controls work on image layers but NOT on video layers"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: No bug exists - blend/opacity work identically for all layer types
test: Code review of renderer and UI
expecting: Finding a code path that skips blend/opacity for video
next_action: Report findings

## Symptoms

expected: Blend mode and opacity controls should work on video layers
actual: Reported as not working on video layers
errors: None specified
reproduction: Add video layer, change blend mode or opacity
started: Unknown

## Eliminated

- hypothesis: PropertiesPanel conditionally hides blend/opacity for video layers
  evidence: BlendSection renders for ALL layers unconditionally (line 244). No layer.type check.
  timestamp: 2026-03-10

- hypothesis: PreviewRenderer skips blend/opacity when drawing video layers
  evidence: drawLayer() applies blendMode and opacity from layer properties for ALL sources (lines 259-260). No type check.
  timestamp: 2026-03-10

- hypothesis: Video layers are created without blendMode/opacity fields
  evidence: AddLayerMenu creates video layers with opacity:1 and blendMode:'screen' (lines 187-197). Fields are present.
  timestamp: 2026-03-10

- hypothesis: layerStore.updateLayer doesn't persist changes for video layers
  evidence: updateLayer delegates to sequenceStore.updateLayer with no type filtering (line 30-32).
  timestamp: 2026-03-10

## Evidence

- timestamp: 2026-03-10
  checked: PreviewRenderer.drawLayer() method (lines 248-333)
  found: blend mode and opacity are applied universally via ctx.globalCompositeOperation and ctx.globalAlpha on lines 259-260. No conditional logic based on layer type or source type.
  implication: Rendering treats all layer types identically for blend/opacity.

- timestamp: 2026-03-10
  checked: PropertiesPanel.tsx BlendSection component (lines 57-123)
  found: BlendSection is rendered for ALL selected layers (line 244) with no conditional on layer.type. The dropdown and slider update layerStore.updateLayer which works for any layer type.
  implication: UI controls are visible and functional for all layer types.

- timestamp: 2026-03-10
  checked: AddLayerMenu handleAddVideo (lines 150-201)
  found: Video layers are created with opacity:1, blendMode:'screen', visible:true - same structure as image layers.
  implication: Video layers have proper initial values.

- timestamp: 2026-03-10
  checked: resolveVideoSource (lines 216-243)
  found: Returns HTMLVideoElement only when readyState >= 2. If video hasn't loaded enough data, returns null and layer is skipped entirely.
  implication: If video is still loading, the layer won't render at all - user might confuse "not rendering yet" with "blend/opacity not working".

- timestamp: 2026-03-10
  checked: Layer type definition (layer.ts lines 10-20)
  found: Layer interface has opacity and blendMode as required fields for ALL layer types. No type-specific exclusions.
  implication: Type system enforces blend/opacity on all layers.

## Resolution

root_cause: The code applies blend mode and opacity identically for all layer types (image, image-sequence, video). There is NO code path that skips or ignores these properties for video layers. The likely user-observed issue is one of two things: (1) video readyState < 2 causes the layer to not render at all (resolveVideoSource returns null), which could be misinterpreted as "controls not working", or (2) video layers default to blendMode 'screen' (not 'normal' like images), which may produce unexpected visual results that the user interprets as "not working".
fix: N/A - no code bug found
verification: Full code path review confirms identical treatment
files_changed: []
