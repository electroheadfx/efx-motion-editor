---
phase: quick-42
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/types/layer.ts
  - Application/src/types/project.ts
  - Application/src/lib/keyframeEngine.ts
  - Application/src/stores/keyframeStore.ts
  - Application/src/stores/projectStore.ts
  - Application/src/components/Preview.tsx
  - Application/src/components/sidebar/SidebarFxProperties.tsx
  - Application/src/components/timeline/TimelineCanvas.tsx
  - Application/src/components/timeline/TimelineRenderer.ts
autonomous: true
requirements: [QUICK-42]

must_haves:
  truths:
    - "FX layer source properties (grain density, blur radius, color grade brightness, etc.) can be keyframed and interpolated over time"
    - "Keyframe nav bar (add/delete/prev/next) appears in SidebarFxProperties when an FX layer is selected"
    - "FX property edits route through transient overrides when between keyframes, update keyframe when on one"
    - "Timeline renders keyframe diamonds on FX tracks for the selected FX layer"
    - "FX keyframes persist in .mce project file and reload correctly"
    - "Canvas preview applies interpolated FX source properties during playback and scrub"
  artifacts:
    - path: "Application/src/types/layer.ts"
      provides: "sourceOverrides field on KeyframeValues"
    - path: "Application/src/lib/keyframeEngine.ts"
      provides: "sourceOverrides interpolation in lerpValues/interpolateAt"
    - path: "Application/src/stores/keyframeStore.ts"
      provides: "FX layer support in findLayerContext, getSelectedContentLayer, addKeyframe"
    - path: "Application/src/components/sidebar/SidebarFxProperties.tsx"
      provides: "KeyframeNavBar + keyframe-aware FX property editing"
  key_links:
    - from: "SidebarFxProperties.tsx"
      to: "keyframeStore"
      via: "displayValues, addKeyframe, setTransientValue for source overrides"
    - from: "keyframeStore"
      to: "keyframeEngine"
      via: "interpolateAt returns sourceOverrides in KeyframeValues"
    - from: "Preview.tsx"
      to: "layer.source"
      via: "merging interpolated sourceOverrides into FX layer source before renderFrame"
---

<objective>
Add keyframe animation support for FX layer source properties (grain density/size/intensity, blur radius, color grade brightness/contrast/saturation, vignette size/softness, etc.). FX layers will use the same keyframe infrastructure as content layers but animate their type-specific source parameters instead of transform properties.

Purpose: Enables dynamic FX effects that change over time (e.g., grain that fades in, blur that ramps up, color grade that shifts).
Output: Full keyframe animation pipeline for FX layers -- types, interpolation, store, UI, rendering, persistence.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/types/layer.ts
@Application/src/types/project.ts
@Application/src/lib/keyframeEngine.ts
@Application/src/stores/keyframeStore.ts
@Application/src/stores/projectStore.ts
@Application/src/components/Preview.tsx
@Application/src/components/sidebar/SidebarFxProperties.tsx
@Application/src/components/sidebar/SidebarProperties.tsx
@Application/src/components/timeline/TimelineCanvas.tsx
@Application/src/components/timeline/TimelineRenderer.ts
@Application/src/components/sidebar/KeyframeNavBar.tsx

<interfaces>
<!-- Key types and contracts the executor needs -->

From Application/src/types/layer.ts:
```typescript
export interface KeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  blur: number;
  // NEW: sourceOverrides for FX layer properties
}

export interface Keyframe {
  frame: number;
  easing: EasingType;
  values: KeyframeValues;
}

export function extractKeyframeValues(layer: Layer): KeyframeValues;
export function isFxLayer(layer: Layer): boolean;
```

From Application/src/stores/keyframeStore.ts:
```typescript
// These functions currently skip FX layers with `if (seq.kind === 'fx') continue;`
function findLayerContext(layerId: string): { sequenceId: string; startFrame: number } | null;
function getSelectedContentLayer(); // returns null for FX layers

// Computed signals
const activeLayerKeyframes: Signal<Keyframe[]>; // empty for FX
const displayValues: Signal<KeyframeValues | null>;

// Methods
addKeyframe(layerId: string, globalFrame: number): void;
setTransientValue(field: keyof KeyframeValues, value: number): void;
```

From Application/src/components/sidebar/SidebarFxProperties.tsx:
```typescript
// Currently no keyframe awareness -- all edits go directly to layerStore.updateLayer
function updateSource(layerId: string, layer: Layer, updates: Record<string, unknown>): void;
export function SidebarFxProperties({ layer, fxSequenceId }: { layer: Layer; fxSequenceId: string | null }): JSX.Element;
```

Numeric FX source properties per type (these are what gets animated):
- generator-grain: density, size, intensity
- generator-particles: count, speed, sizeMin, sizeMax
- generator-lines: count, thickness, lengthMin, lengthMax
- generator-dots: count, sizeMin, sizeMax, speed
- generator-vignette: size, softness, intensity
- adjustment-color-grade: brightness, contrast, saturation, hue, fade
- adjustment-blur: radius
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend keyframe types, interpolation engine, and keyframeStore for FX layers</name>
  <files>
    Application/src/types/layer.ts
    Application/src/types/project.ts
    Application/src/lib/keyframeEngine.ts
    Application/src/stores/keyframeStore.ts
    Application/src/stores/projectStore.ts
  </files>
  <action>
**1. Application/src/types/layer.ts** -- Add `sourceOverrides` to KeyframeValues:
- Add `sourceOverrides?: Record<string, number>` to the `KeyframeValues` interface. This is an optional bag of numeric FX source properties keyed by their field name (e.g., `{ density: 0.3, size: 1, intensity: 0.5 }`).
- Create a new helper `extractFxSourceValues(layer: Layer): Record<string, number>` that extracts all numeric properties from `layer.source` (excluding `type`, `lockSeed`, `seed`, `tintColor`, `preset`, `fadeBlend` -- only numeric values). Use a simple `for...in` loop over the source, filtering for `typeof value === 'number'` and excluding `lockSeed`/`seed`.
- Update `extractKeyframeValues(layer: Layer)` to also populate `sourceOverrides` when `isFxLayer(layer)` is true, calling `extractFxSourceValues`.

**2. Application/src/types/project.ts** -- Add `source_overrides` to MceKeyframeValues:
- Add `source_overrides?: Record<string, number>` to `MceKeyframeValues`.

**3. Application/src/lib/keyframeEngine.ts** -- Extend interpolation for sourceOverrides:
- In `lerpValues`: if both `a.sourceOverrides` and `b.sourceOverrides` exist, lerp each shared key. If only one side has it, use that side's values directly. Return the result in `sourceOverrides`.
- In `_interpolateAtMutable`: add a `_mutableSourceOverrides: Record<string, number> = {}` alongside `_mutableResult`. When copying keyframe values, also copy `sourceOverrides`. When lerping between two keyframes, lerp `sourceOverrides` the same way.
- In `interpolateAt`: include `sourceOverrides` in the returned fresh copy.

**4. Application/src/stores/keyframeStore.ts** -- Remove FX exclusions and support FX layer keyframes:
- In `findLayerContext`: Remove the `if (seq.kind === 'fx') continue;` guard. For FX sequences, the `startFrame` is `seq.inFrame ?? 0` (same pattern as content-overlay).
- Rename `getSelectedContentLayer` to `getSelectedAnimatableLayer` (or just update the logic). Remove the `if (seq.kind === 'fx') continue;` guard and the `!isFxLayer(layer)` check. The function should now return any non-base selected layer from any sequence kind. Keep the `!layer.isBase` check.
- In `activeLayerKeyframes`: Update to use the renamed function.
- In `addKeyframe`: The `findLayerContext` fix above handles this. But also update the values extraction: when the layer is an FX layer (`isFxLayer(layer)`), call `extractKeyframeValues(layer)` which now includes `sourceOverrides`.
- Add a new method `setTransientSourceValue(field: string, value: number)` that sets a specific key in `transientOverrides.sourceOverrides`. If `transientOverrides` is null, initialize from `interpolatedValues` first (same pattern as `setTransientValue`). Create the `sourceOverrides` sub-object if needed.

**5. Application/src/stores/projectStore.ts** -- Persist sourceOverrides in .mce:
- In the save path (where `keyframes` are mapped to MceKeyframe): add `...(kf.values.sourceOverrides ? { source_overrides: kf.values.sourceOverrides } : {})` to the values object.
- In the load path: read `mkf.values.source_overrides` and map it to `sourceOverrides` in the runtime KeyframeValues.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>KeyframeValues has sourceOverrides field. Interpolation engine lerps source overrides. keyframeStore works for FX layers (no more skip guards). Save/load roundtrips sourceOverrides.</done>
</task>

<task type="auto">
  <name>Task 2: Wire FX keyframe UI in SidebarFxProperties and timeline diamond rendering</name>
  <files>
    Application/src/components/sidebar/SidebarFxProperties.tsx
    Application/src/components/sidebar/KeyframeNavBar.tsx
    Application/src/components/timeline/TimelineCanvas.tsx
    Application/src/components/timeline/TimelineRenderer.ts
    Application/src/components/Preview.tsx
  </files>
  <action>
**1. Application/src/components/sidebar/SidebarFxProperties.tsx** -- Add keyframe-aware editing:
- Import `keyframeStore` from `../../stores/keyframeStore`, `timelineStore` from `../../stores/timelineStore`, `KeyframeNavBar` from `./KeyframeNavBar`, `InlineInterpolation` from `./InlineInterpolation`, `isFxLayer` from `../../types/layer`.
- In `SidebarFxProperties`, add keyframe display values logic (same pattern as SidebarProperties):
  ```
  const kfDisplayValues = keyframeStore.displayValues.value;
  const hasKeyframes = layer.keyframes && layer.keyframes.length > 0;
  const showKfValues = hasKeyframes && kfDisplayValues && kfDisplayValues.sourceOverrides;
  const isOnKf = keyframeStore.isOnKeyframe.value;
  ```
- Create a `handleFxKeyframeEdit(field: string, value: number)` function similar to `handleKeyframeEdit` in SidebarProperties but for source fields:
  - If `isOnKf`: call `updateSource(layer.id, layer, { [field]: value })` then `keyframeStore.addKeyframe(layer.id, timelineStore.currentFrame.peek())`.
  - If NOT `isOnKf` and `hasKeyframes`: call `keyframeStore.setTransientSourceValue(field, value)`.
  - If NO keyframes: fall through to direct `updateSource` (current behavior).
- Update each FX section component (GrainSection, ParticlesSection, etc.) to accept an optional `onFxEdit?: (field: string, value: number) => void` and `fxValues?: Record<string, number>` props. When `fxValues` is provided, use `fxValues[field]` as the displayed value instead of `source[field]`. When `onFxEdit` is provided, call it instead of `updateSource`.
- Pass `handleFxKeyframeEdit` and `kfDisplayValues?.sourceOverrides` down to each FxSection component.
- Add KeyframeNavBar below the layer name (same position as SidebarProperties): render `<KeyframeNavBar layer={layer} />` row with "Key" label. Use the same layout as SidebarProperties (flex row with Key label + nav bar).
- Add InlineInterpolation swap: when `keyframeStore.selectedKeyframeFrames.value.size > 0`, show `<InlineInterpolation />` instead of the opacity row.
- Also make the opacity slider keyframe-aware: when `showKfValues`, display `kfDisplayValues.opacity` and route edits through a keyframe edit handler for opacity (using `keyframeStore.setTransientValue('opacity', val)` when between keyframes, or `layerStore.updateLayer + keyframeStore.addKeyframe` when on a keyframe).

**2. Application/src/components/sidebar/KeyframeNavBar.tsx** -- Remove FX exclusion:
- In `getLocalFrameForLayer`: Remove `if (seq.kind === 'fx') continue;`. For FX sequences, compute local frame as `globalFrame - (seq.inFrame ?? 0)`.
- In `getSequenceStartFrame`: Same fix -- remove FX skip, return `seq.inFrame ?? 0` for FX sequences.

**3. Application/src/components/timeline/TimelineCanvas.tsx** -- Show diamonds for FX layers:
- In the keyframe diamond data section (lines ~96-106): Remove `if (seq.kind === 'fx') continue;` and remove `!isFxLayer(layer)` from the condition on line 100. This allows FX layers to populate `selectedLayerKeyframes` and `selectedLayerSequenceId`.

**4. Application/src/components/timeline/TimelineRenderer.ts** -- Draw diamonds on FX tracks:
- In `drawKeyframeDiamonds`: After the content-overlay check (line 841), add a third check for `kind === 'fx'` tracks:
  ```
  const fxKfTrackIndex = state.fxTracks.findIndex(ft => ft.sequenceId === state.selectedLayerSequenceId && ft.kind === 'fx');
  if (fxKfTrackIndex >= 0) {
    // Same diamond drawing logic as content-overlay but for fx tracks
  }
  ```
  Use the same pattern as the content-overlay diamond drawing (lines 842-858).

**5. Application/src/components/Preview.tsx** -- Apply interpolated FX source properties:
- In both `renderFromFrameMap` and the `disposeRender` effect, where FX sequences are composited (the `else` branch for FX sequences around lines 101-106 and 205-210):
  - For each FX layer, check if it has keyframes. If so, compute localFrame as `globalFrame - (overlaySeq.inFrame ?? 0)`, call `interpolateAt(layer.keyframes, localFrame)`, and merge `values.sourceOverrides` into `layer.source` to create an interpolated layer:
    ```
    const interpolatedLayer = values?.sourceOverrides
      ? { ...layer, source: { ...layer.source, ...values.sourceOverrides } as LayerSourceData, opacity: values.opacity, blur: values.blur }
      : layer;
    ```
  - Also apply the standard KeyframeValues (opacity, blur) from the interpolated result.
  - Pass `interpolatedLayer` instead of `layer` to the fxLayers array.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- SidebarFxProperties shows KeyframeNavBar with add/delete/prev/next buttons when FX layer selected
- FX property edits route through transient overrides when between keyframes
- Timeline shows keyframe diamonds on FX tracks
- Canvas preview applies interpolated FX source properties during playback
- Full keyframe animation workflow: add keyframe on FX layer, scrub to different frame, add another keyframe with different values, see interpolation during playback
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes: `cd Application && npx tsc --noEmit`
2. Select an FX layer (e.g., generator-grain), verify KeyframeNavBar appears in sidebar
3. Add a keyframe at frame 0 with grain density=0.1, scrub to frame 20, change density to 0.8, add another keyframe
4. Scrub between frames 0-20 and observe grain density interpolating smoothly in preview
5. Verify keyframe diamonds appear on the FX track row in the timeline
6. Save project, reload, verify FX keyframes persist and animate correctly
7. Test with adjustment-blur and adjustment-color-grade layers too
</verification>

<success_criteria>
- FX layer source properties are animatable via the same keyframe system as content layers
- Keyframe nav bar and inline interpolation editing work on FX layers
- Timeline diamonds render on FX tracks
- FX keyframes round-trip through .mce save/load
- Preview renders interpolated FX properties during scrub and playback
</success_criteria>

<output>
After completion, create `.planning/quick/260319-qmy-add-properties-animation-to-fx-layers-li/260319-qmy-SUMMARY.md`
</output>
