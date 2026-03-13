---
phase: quick-6
plan: 01
subsystem: fx-blur-compositing
tags: [fx, blur, blend-mode, canvas-compositing, properties-panel]
dependency_graph:
  requires: []
  provides: [blend-mode-aware-adjustment-blur, fx-blur-blend-dropdown]
  affects: [previewRenderer, PropertiesPanel]
tech_stack:
  added: []
  patterns: [offscreen-canvas-composite, globalCompositeOperation-blend]
key_files:
  created: []
  modified:
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/layout/PropertiesPanel.tsx
decisions:
  - Normal blend mode preserves fast in-place blur path for backward compatibility
  - Non-normal blend modes use offscreen canvas copy-blur-composite approach
  - Opacity controls blend strength (globalAlpha) for non-normal modes; radius controls blur intensity independently
metrics:
  duration: 77s
  completed: "2026-03-13T15:15:32Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 6: Add Blend Mode to FX Blur on Timeline

Blend-mode-aware adjustment-blur compositing with offscreen canvas copy-blur-composite and properties panel dropdown for screen/multiply/overlay/add modes.

## What Was Done

### Task 1: Blend-mode-aware compositing for adjustment-blur rendering
**Commit:** a653f84

Modified the `adjustment-blur` case in `PreviewRenderer.drawAdjustmentLayer` to branch on blend mode:

- **Normal blend (fast path):** Unchanged in-place blur behavior. Radius scaled by opacity for partial blur application. This is backward-compatible with the pre-change behavior.
- **Non-normal blend modes:** Copy current canvas to reusable `blurOffscreen`, apply blur to the offscreen copy, then composite the blurred offscreen back onto the original canvas using `globalCompositeOperation` set to the layer's blend mode and `globalAlpha` set to the layer's opacity. This produces screen (glow), multiply (darkened blur), overlay (contrast-enhanced blur), and add (bright bloom) effects.

### Task 2: Blend mode dropdown in FX blur properties panel
**Commit:** e89523b

Added a conditional BLEND dropdown in the FX layer section of `PropertiesPanel.tsx`:

- Only appears for `adjustment-blur` source type (not generators, not color grade)
- Positioned between the opacity/visibility controls and the blur radius section
- Reuses existing `BLEND_MODES` array, `capitalize` helper, and `BlendMode` type import
- Updates `layer.blendMode` via `layerStore.updateLayer` on selection change

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors (`npx tsc --noEmit` clean)
- Normal blend mode preserves existing in-place replacement behavior
- Non-normal blend modes composite blurred result using Canvas 2D globalCompositeOperation
- BLEND dropdown only appears for adjustment-blur FX layers

## Self-Check: PASSED
