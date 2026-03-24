---
status: diagnosed
trigger: "Investigate why timeline thumbnails don't show gradient previews for gradient key photos, while solid color thumbnails work fine."
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two gaps in the data+rendering pipeline prevent gradient thumbnails from appearing
test: Traced data from sequenceStore -> frameMap trackLayouts -> TimelineRenderer
expecting: Found missing gradient field in KeyPhotoRange type and missing gradient branch in renderer
next_action: Report diagnosis

## Symptoms

expected: Timeline thumbnails should show gradient previews for gradient key photos (matching the canvas preview)
actual: Solid color thumbnails render correctly, but gradient key photos show no gradient preview in timeline
errors: None reported (visual bug)
reproduction: Set a key photo to gradient type, observe timeline thumbnail
started: Likely since gradient feature was added

## Eliminated

## Evidence

- timestamp: 2026-03-24T00:01:00Z
  checked: KeyPhotoStrip.tsx (sidebar thumbnail component)
  found: Correctly passes gradient prop and renders via buildGradientCSS on backgroundImage (line 368-370). This is CSS-based rendering so works fine.
  implication: The sidebar key photo strip handles gradients. The bug is isolated to the Canvas 2D timeline renderer.

- timestamp: 2026-03-24T00:02:00Z
  checked: KeyPhotoRange interface in types/timeline.ts (lines 53-61)
  found: Interface has solidColor and isTransparent fields but NO gradient field. Missing `gradient?: GradientData`.
  implication: Even if the data pipeline tried to pass gradient data, TypeScript would strip it / it wouldn't be typed.

- timestamp: 2026-03-24T00:03:00Z
  checked: trackLayouts computed in lib/frameMap.ts (lines 66-77)
  found: When building KeyPhotoRange, only solidColor and isTransparent are spread from keyPhoto data. Gradient is NOT propagated (line 75-76 spread solidColor and isTransparent, but gradient is missing).
  implication: Gradient data is lost at the frameMap -> trackLayouts pipeline stage.

- timestamp: 2026-03-24T00:04:00Z
  checked: frameMap (per-frame entries) in lib/frameMap.ts (lines 26-28)
  found: The per-frame `frameMap` DOES propagate gradient data (line 28). But `trackLayouts` (which feeds the timeline renderer) does NOT.
  implication: The inconsistency between frameMap and trackLayouts is the data pipeline gap.

- timestamp: 2026-03-24T00:05:00Z
  checked: TimelineRenderer.ts draw logic (lines 582-656)
  found: The renderer has three branches: (1) solidColor && !isTransparent -> fill with solid color, (2) isTransparent -> checkerboard, (3) else -> image thumbnail. There is NO branch for gradient rendering. A gradient key photo would fall through to the "else" (image thumbnail) branch and show a placeholder since it has no imageId.
  implication: Even if gradient data were propagated through the pipeline, the renderer has no code to draw it.

## Resolution

root_cause: Two-part gap in the gradient-to-timeline-thumbnail pipeline. (1) The KeyPhotoRange type (types/timeline.ts) and the trackLayouts builder (lib/frameMap.ts) do not propagate the gradient field from key photo data. (2) The TimelineRenderer (TimelineRenderer.ts) has no Canvas 2D rendering branch for gradient key photos -- gradient entries fall into the image-thumbnail else branch and show as empty placeholders.
fix: Three files need changes -- (A) Add `gradient?: GradientData` to KeyPhotoRange interface in types/timeline.ts, (B) Spread gradient data in the trackLayouts computed in lib/frameMap.ts (add `...(kp.gradient ? { gradient: kp.gradient } : {})` alongside the solidColor/isTransparent spreads), (C) Add a gradient rendering branch in TimelineRenderer.ts between the isTransparent and image-thumbnail branches that uses Canvas 2D createLinearGradient/createRadialGradient/createConicGradient based on gradient.type to fill the key photo range cells.
verification:
files_changed: []
