# Phase 35 UAT Test 9 — Physic Paint Compositing Controls

## Report

User could not test preview compositing because the Physic Paint layer Properties panel has no layer blend mode or opacity controls.

## Expected

Applied physics paint output composites in the editor preview using the layer blend mode and opacity. The user can change those values from the selected Physic Paint layer properties and then validate preview/timeline redraw behavior.

## Evidence

- `app/src/lib/previewRenderer.ts` already handles `layer.type === 'physic-paint'` by setting `ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode)` and `ctx.globalAlpha = effectiveOpacity` before drawing the rendered physics paint frame.
- `app/src/components/layout/LeftPanel.tsx` routes selected `physic-paint` layers exclusively to `PhysicPaintProperties` and excludes them from the generic `SidebarProperties` branch.
- `app/src/components/sidebar/PhysicPaintProperties.tsx` renders layer/frame diagnostics, rendered-output status, and `[open fx paint canvas]`, but has no blend mode select or opacity slider.
- Existing controls for the same layer-level fields are available in `SidebarProperties.tsx` and `PaintProperties.tsx` via `layerStore.updateLayer`.

## Root cause

The render path supports blend mode and opacity, but the Physic Paint-specific properties panel does not expose the controls, so users cannot configure or validate the compositing behavior required by UAT Test 9.

## Fix direction

Add compact layer compositing controls to `PhysicPaintProperties.tsx` using the existing `BlendMode` values and `layerStore.updateLayer` pattern. Keep the preview renderer unchanged unless tests reveal a rendering regression.
