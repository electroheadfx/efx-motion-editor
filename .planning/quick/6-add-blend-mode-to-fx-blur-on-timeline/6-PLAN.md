---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/lib/previewRenderer.ts
  - Application/src/components/layout/PropertiesPanel.tsx
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - "FX blur layer applies blur with user-selected blend mode visible on canvas"
    - "User can change FX blur blend mode via dropdown in properties panel"
    - "Normal blend mode produces same result as current behavior (full replacement)"
    - "Non-normal blend modes (screen, multiply, overlay, add) visibly alter the composited blur output"
  artifacts:
    - path: "Application/src/lib/previewRenderer.ts"
      provides: "Blend-mode-aware adjustment-blur compositing"
      contains: "blendModeToCompositeOp.*blendMode"
    - path: "Application/src/components/layout/PropertiesPanel.tsx"
      provides: "Blend mode dropdown for adjustment-blur FX layers"
      contains: "BLEND_MODES"
  key_links:
    - from: "Application/src/components/layout/PropertiesPanel.tsx"
      to: "layerStore.updateLayer"
      via: "blendMode property change on select onChange"
      pattern: "blendMode.*as BlendMode"
    - from: "Application/src/lib/previewRenderer.ts"
      to: "blendModeToCompositeOp"
      via: "adjustment-blur case reading layer.blendMode"
      pattern: "globalCompositeOperation.*blendMode"
---

<objective>
Add blend mode support to the FX blur adjustment layer on the timeline.

Purpose: Currently the FX blur adjustment layer applies blur in-place on the canvas, always replacing content with the blurred version (effectively "normal" blend). Users need to composite the blurred result with different blend modes (screen for glow, multiply for darkened blur, overlay for contrast-enhanced blur, add for bright bloom).

Output: Updated renderer that composites blurred content using the layer's blend mode, and a blend mode dropdown in the FX blur properties panel.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/lib/previewRenderer.ts
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/types/layer.ts
@Application/src/lib/fxBlur.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From Application/src/types/layer.ts:
```typescript
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSourceData;
  isBase?: boolean;
  blur?: number;
}
```

From Application/src/lib/previewRenderer.ts:
```typescript
function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation;
// Already exists and maps BlendMode to canvas globalCompositeOperation values
```

Current adjustment-blur rendering (in-place, ignores blendMode):
```typescript
case 'adjustment-blur': {
  // Resets transform, applies blur directly on this.canvas in-place
  // Does NOT use layer.blendMode at all
  applyFastBlur(this.canvas, ctx, effectiveRadius, this.canvas.width, this.canvas.height);
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add blend-mode-aware compositing to adjustment-blur rendering</name>
  <files>Application/src/lib/previewRenderer.ts</files>
  <action>
Modify the `adjustment-blur` case in `drawAdjustmentLayer` to support blend modes:

**Current behavior (normal blend -- keep as default path):**
When `layer.blendMode === 'normal'`, the existing in-place blur is correct (replace canvas content with blurred version). Keep this fast path unchanged.

**New behavior (non-normal blend modes):**
When `layer.blendMode !== 'normal'`, use a snapshot-blur-composite approach:

1. Save the current canvas content to a temporary offscreen canvas (snapshot before blur)
2. Apply blur to the main canvas in-place (same as current code)
3. Now the canvas has the fully blurred image. We need to blend it with the original:
   - Clear the main canvas
   - Draw the original snapshot back (the un-blurred content)
   - Set `globalCompositeOperation` to the layer's blend mode via `blendModeToCompositeOp(layer.blendMode)`
   - Set `globalAlpha` to `layer.opacity`
   - Draw the blurred canvas on top

Actually, a cleaner approach that avoids clearing/redrawing the original:

1. Snapshot current canvas pixels to a reusable offscreen canvas (use `this.getBlurOffscreen` or create a second offscreen -- the class already has `blurOffscreen`)
2. Copy canvas to offscreen, apply blur to the offscreen copy
3. Now composite the blurred offscreen onto the original canvas using the blend mode

Implementation steps in the `adjustment-blur` case:

```
case 'adjustment-blur': {
  if (blurStore.isBypassed()) break;
  const blurSource = layer.source as {type: 'adjustment-blur'; radius: number};
  if (blurSource.radius <= 0) break;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const effectiveRadius = blurSource.radius * layer.opacity;

  if (layer.blendMode === 'normal') {
    // Fast path: in-place blur (existing behavior, replaces canvas content)
    if (blurStore.isHQ()) {
      try {
        applyHQBlur(this.canvas, effectiveRadius, this.canvas.width, this.canvas.height, false);
      } catch {
        applyFastBlur(this.canvas, ctx, effectiveRadius, this.canvas.width, this.canvas.height);
      }
    } else {
      applyFastBlur(this.canvas, ctx, effectiveRadius, this.canvas.width, this.canvas.height);
    }
  } else {
    // Blend mode path: blur to offscreen, composite with blend mode
    const w = this.canvas.width;
    const h = this.canvas.height;
    const off = this.getBlurOffscreen(w, h);
    if (off) {
      // Copy current canvas to offscreen
      off.ctx.clearRect(0, 0, w, h);
      off.ctx.drawImage(this.canvas, 0, 0);
      // Apply blur to the offscreen copy
      this.applyBlurToCanvas(off.canvas, off.ctx, effectiveRadius, w, h, false);
      // Composite blurred offscreen onto original canvas using blend mode
      ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(off.canvas, 0, 0);
    }
  }
  ctx.restore();
  break;
}
```

Note: `getBlurOffscreen` and `applyBlurToCanvas` are private methods already on the class. The `blendModeToCompositeOp` function is already module-level. No new dependencies needed.

For the non-normal blend path, opacity should control the blend strength (globalAlpha), NOT scale the radius. The radius should use `blurSource.radius` directly (not multiplied by opacity) since opacity controls how much of the blended blur shows through. This matches how generator layers handle opacity+blendMode.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - adjustment-blur with blendMode 'normal' renders identically to before (in-place replacement)
    - adjustment-blur with non-normal blend modes composites the blurred result using Canvas 2D globalCompositeOperation
    - opacity controls blend strength for non-normal modes, radius controls blur intensity for non-normal modes
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Add blend mode dropdown to FX blur properties panel</name>
  <files>Application/src/components/layout/PropertiesPanel.tsx</files>
  <action>
Modify the FX layer section of PropertiesPanel to show a blend mode dropdown for adjustment-blur layers.

Currently (line 509-583), FX layers show: OPACITY slider + visibility toggle + FX-specific section (BlurSection with just Radius). The comment on line 509 says "no blend mode dropdown" and line 389 says "BlendSection removed".

Add a blend mode dropdown specifically for adjustment-blur layers in the FX panel. Insert it between the OPACITY section and the divider before the FX-specific section.

Inside the FX layer branch (the `if (isFxLayer(selectedLayer))` block), after the visibility toggle button and before the divider `<div class="w-px h-8 ...">`, add a conditional blend mode dropdown that only shows for adjustment-blur:

```tsx
{selectedLayer.source.type === 'adjustment-blur' && (
  <>
    <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="BLEND" />
      <select
        class="text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[3px] outline-none cursor-pointer"
        value={selectedLayer.blendMode}
        onChange={(e) => {
          layerStore.updateLayer(selectedLayer.id, {
            blendMode: (e.target as HTMLSelectElement).value as BlendMode,
          });
        }}
      >
        {BLEND_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {capitalize(mode)}
          </option>
        ))}
      </select>
    </div>
  </>
)}
```

This reuses the existing `BLEND_MODES` array and `capitalize` function already in the file. The `BlendMode` type is already imported.

Place this block right after the visibility toggle button (the `</button>` at ~line 562) and before the divider `<div class="w-px h-8 bg-[var(--color-bg-divider)]" />` at line 564.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - When an adjustment-blur FX layer is selected, a "BLEND" dropdown appears in the properties panel between opacity and blur controls
    - Dropdown shows Normal, Screen, Multiply, Overlay, Add options
    - Changing the dropdown updates the layer's blendMode in layerStore
    - Non-blur FX layers (generators, color grade) do NOT show a blend mode dropdown
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `cd Application && npx tsc --noEmit` -- no errors
2. Dev server: `cd Application && pnpm dev` -- app launches without console errors
3. Functional: Add an FX Blur layer, select it, confirm BLEND dropdown appears in properties panel
4. Rendering: Set blur radius to ~0.3, change blend mode to Screen -- canvas should show a brighter/glowing blur overlay on top of the original content (not a full replacement)
5. Normal mode: With blend mode set to Normal, blur should look identical to the previous behavior (full in-place replacement)
</verification>

<success_criteria>
- FX blur adjustment layer has a blend mode dropdown in the properties panel
- Blend mode visually affects how the blurred image composites onto the canvas
- Normal blend mode preserves existing behavior (backward compatible)
- Screen/multiply/overlay/add produce distinctly different visual results
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/6-add-blend-mode-to-fx-blur-on-timeline/6-SUMMARY.md`
</output>
