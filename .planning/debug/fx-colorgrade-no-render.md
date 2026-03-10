---
status: diagnosed
trigger: "Color Grade FX sequence does not render on canvas - no tonal shift visible on content"
created: 2026-03-10T14:00:00Z
updated: 2026-03-10T14:15:00Z
---

## Current Focus

hypothesis: The hasDrawable pre-check in PreviewRenderer.renderFrame() skips adjustment-only FX sequences because it treats adjustment layers as non-drawable, causing an early return before the color grade ever executes
test: Trace renderFrame with clearCanvas=false for a single adjustment-color-grade layer
expecting: hasDrawable remains false, function returns at line 111-113 before reaching the draw loop
next_action: Return structured diagnosis

## Symptoms

expected: Color Grade FX sequence applies tonal shift (brightness, contrast, saturation, hue, fade) to all content visible on the preview canvas
actual: No visual change at all -- the canvas shows content without any color grading applied
errors: No runtime errors
reproduction: Add any Color Grade FX from AddLayerMenu; observe preview canvas shows no tonal change regardless of parameter values
started: Since FX sequences were moved to timeline-level architecture (Phase 07)

## Eliminated

(none - root cause was immediately identifiable from code trace)

## Evidence

- timestamp: 2026-03-10T14:02:00Z
  checked: Preview.tsx FX compositing loop (lines 30-38, 63-71)
  found: For each FX sequence, calls renderer.renderFrame(fxLayers, localFrame, frames, fps, false). The fxLayers array for a color grade FX sequence contains exactly one adjustment-color-grade layer.
  implication: The renderer receives a layers array containing only an adjustment layer, with clearCanvas=false

- timestamp: 2026-03-10T14:04:00Z
  checked: PreviewRenderer.renderFrame() hasDrawable pre-check (lines 92-113)
  found: The loop checks each layer: isGeneratorLayer -> sets hasDrawable=true. isAdjustmentLayer -> continue (skips). content layer -> resolves source, sets hasDrawable=true. For an adjustment-only layers array, hasDrawable is NEVER set to true.
  implication: When layers contains only adjustment layers, hasDrawable remains false and the function returns early at line 111-113

- timestamp: 2026-03-10T14:06:00Z
  checked: The hasDrawable early-return logic purpose (line 87-88 comment)
  found: Comment says "If nothing will draw, keep the previous frame visible (avoids black flashes while images load asynchronously)." This guard was designed for the first-pass content rendering where clearing + drawing nothing = black flash.
  implication: The guard is correct for content rendering but incorrect for FX overlay passes where clearCanvas=false and adjustment layers should modify existing pixels

- timestamp: 2026-03-10T14:08:00Z
  checked: fxColorGrade.ts applyColorGrade implementation (lines 34-99)
  found: The function is correctly implemented. It copies canvas to offscreen buffer, clears canvas, draws back with CSS filters. It handles the tainted-canvas issue by using ctx.filter instead of getImageData. The implementation itself is sound.
  implication: The color grade function never gets called -- the problem is upstream in renderFrame's early return

- timestamp: 2026-03-10T14:10:00Z
  checked: AddLayerMenu.tsx handleAddFxLayer (lines 292-310)
  found: Creates a single-layer FX sequence via sequenceStore.createFxSequence(). The layers array in the created FX sequence will always contain exactly one layer. For color grade, that's an adjustment-color-grade layer.
  implication: Confirms FX sequences with only adjustment layers are a normal/expected case

## Resolution

root_cause: PreviewRenderer.renderFrame() has a hasDrawable pre-check (lines 92-113) that treats adjustment layers as non-drawable (line 100-101: "Adjustments only matter if there's content below; continue checking"). When an FX sequence containing only an adjustment-color-grade layer is rendered in overlay mode (clearCanvas=false), hasDrawable remains false and the function returns early at line 111-113 before ever reaching the draw loop (lines 127-157) where drawAdjustmentLayer() would be called. The canvas already has content from the first pass, so the adjustment layer IS meaningful, but the pre-check doesn't account for the clearCanvas=false case.

fix: (not applied - diagnosis only)
verification: (not applicable)
files_changed: []
