# Phase 12: Layer Keyframe Animation - Research

**Researched:** 2026-03-14
**Domain:** Keyframe animation system, interpolation math, timeline interaction, canvas rendering
**Confidence:** HIGH

## Summary

Phase 12 adds per-layer keyframe animation to content layers (static-image, image-sequence, video). The system captures full property snapshots at specific frames, interpolates between them during playback, and displays editable diamond markers on the timeline. This phase touches five major subsystems: types/data model, a new keyframe store/engine, the Properties Panel UI, the Timeline Renderer/Interaction, and the Preview Renderer pipeline.

The codebase is well-structured for this addition. The `Layer` interface already has all animatable properties (opacity, transform x/y/scaleX/scaleY/rotation, blur). The `sequenceStore` snapshot/restore undo pattern extends naturally to keyframe CRUD. The `TimelineRenderer` Canvas 2D draw loop can add diamond rendering with minimal changes. The `PreviewRenderer.drawLayer()` pipeline applies opacity, transform, and blur in order -- keyframe interpolation injects computed values before this pipeline runs.

**Primary recommendation:** Implement keyframes as a `Map<number, KeyframeSnapshot>` on the Layer interface, with a pure `interpolateAt(frame)` function that returns interpolated property values for any frame. Wire this into `PreviewRenderer` and `PropertiesPanel` via a computed signal. Use simple polynomial easing functions (not bezier-easing library) since only 4 preset curves are needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Explicit [+ Keyframe] button in Properties panel header -- no auto-key mode
- Each keyframe captures a full snapshot of ALL animatable properties (opacity, x, y, scaleX, scaleY, rotation, blur) at the current frame
- User positions playhead, adjusts properties, clicks [+ Keyframe] to save
- If playhead is on an existing keyframe, property edits update that keyframe's values
- Edits between keyframes are transient -- only saved when user clicks [+ Keyframe]
- Properties always show the interpolated value at the current playhead position
- Diamond markers drawn directly on the content sequence track row (no extra sub-rows)
- Keyframe diamonds visible ONLY for the currently selected layer
- Click diamond: select it AND snap playhead to that frame
- Drag diamond left/right to move keyframe to a different frame
- Delete key removes selected keyframe(s)
- Shift+click for multi-select
- Double-click diamond opens interpolation popover menu (not right-click)
- Animatable properties: transform (x, y, scaleX, scaleY, rotation), opacity, blur
- NOT animatable: crop, blend mode
- Content layers only -- FX layers and base layer are NOT animatable
- Before first keyframe: hold first keyframe's values
- After last keyframe: hold last keyframe's values
- Per-keyframe interpolation (one curve for ALL properties between this and next)
- Default interpolation: Ease In-Out
- Available curves: Linear, Ease In, Ease Out, Ease In-Out
- Set via double-click popover on keyframe diamond
- No graph/curve editor -- preset curves only

### Claude's Discretion
- Keyframe data model design (on Layer interface vs separate mapping)
- .mce format version bump (v5 -> v6) and migration strategy
- Interpolation math implementation (cubic bezier control points for each preset)
- Diamond marker visual design (size, color, selected/unselected states, glow on selection)
- Popover menu styling and positioning
- How interpolated values flow into PreviewRenderer.drawLayer() pipeline
- Keyboard shortcut for "Add Keyframe" (if any)
- Performance optimization for interpolation lookups during playback

### Deferred Ideas (OUT OF SCOPE)
- Crop animation
- FX layer keyframe animation
- Graph/curve editor
- Per-property interpolation curves
- Auto-key toggle mode
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @preact/signals | ^2.8.1 | Reactive state for keyframe data changes | Already in use; computed signals for interpolated values |
| Preact | ^10.28.4 | UI components (popover, button) | Already the project's UI framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tinykeys | ^3.0.0 | Keyboard shortcut for Add Keyframe (K key) | Already mounted; extend existing bindings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled easing | bezier-easing npm | Only 4 preset curves needed; polynomial math is ~10 lines, no dependency needed |
| Separate keyframe store | Keyframes on Layer interface | On-Layer is simpler for structuredClone undo/redo; separate store adds cross-reference complexity |

**Installation:**
No new dependencies required. All implementation uses existing stack.

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    layer.ts           # Add Keyframe, KeyframeSnapshot, EasingType types
    project.ts         # Add MceKeyframe type for v6 serialization
  lib/
    keyframeEngine.ts  # NEW: interpolation math, easing functions, interpolateAt()
  stores/
    keyframeStore.ts   # NEW: keyframe CRUD, selected keyframe IDs, interpolated values
  components/
    layout/
      PropertiesPanel.tsx  # Add [+ Keyframe] button, show interpolated values
    timeline/
      TimelineRenderer.ts  # Draw keyframe diamonds on selected layer's track
      TimelineInteraction.ts  # Click/drag/delete/double-click keyframe handlers
      KeyframePopover.tsx  # NEW: interpolation curve selector popover
```

### Pattern 1: Keyframe Data on Layer Interface
**What:** Store keyframes directly on the `Layer` type as `keyframes?: Keyframe[]`
**When to use:** Always -- this is the locked design choice
**Why:** structuredClone snapshot/restore for undo/redo captures keyframes automatically. No cross-referencing between separate stores. Serialization to .mce falls out naturally from the existing layer serialization in `buildMceProject()`.

**RESOLVED: Sequence-local frame offsets (not global).** Keyframe `frame` values are stored as offsets from the owning sequence's start frame. This makes keyframes immune to changes in other sequences (reordering, adding/removing key photos). The conversion from global frame to sequence-local happens at the call site using `trackLayouts` or `activeSequenceStartFrame` from `frameMap.ts`. See Open Questions section for full rationale.

```typescript
// types/layer.ts additions
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface Keyframe {
  frame: number;          // Sequence-local frame offset (NOT global frame number)
  easing: EasingType;     // Interpolation to NEXT keyframe
  values: KeyframeValues; // Snapshot of all animatable properties
}

export interface KeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  blur: number;
}
```

### Pattern 2: Pure Interpolation Engine
**What:** A module-level pure function that takes (keyframes[], currentFrame) and returns interpolated KeyframeValues
**When to use:** Called by PreviewRenderer on every frame render, and by PropertiesPanel to display current values
**Why:** Pure functions are testable, cacheable, and have no signal dependencies. The renderer calls `.peek()` on signals anyway, so a pure function fits the existing pattern.

```typescript
// lib/keyframeEngine.ts
export function interpolateAt(
  keyframes: Keyframe[],
  frame: number,       // sequence-local frame offset
): KeyframeValues | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].values;

  // Before first keyframe: hold first values
  if (frame <= keyframes[0].frame) return keyframes[0].values;

  // After last keyframe: hold last values
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last.values;

  // Find surrounding keyframes
  let prev = keyframes[0];
  let next = keyframes[1];
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].frame >= frame) {
      next = keyframes[i];
      prev = keyframes[i - 1];
      break;
    }
  }

  // Normalize t to [0, 1] between prev and next
  const t = (frame - prev.frame) / (next.frame - prev.frame);
  const easedT = applyEasing(t, prev.easing);

  return lerpValues(prev.values, next.values, easedT);
}
```

### Pattern 3: Keyframe Store with Computed Interpolation
**What:** A reactive store that manages keyframe selection state and provides computed interpolated values for the current frame
**When to use:** Wire into PropertiesPanel and PreviewRenderer
**Why:** Follows the existing store pattern (layerStore, sequenceStore). Computed signals auto-update when frame or keyframes change.

```typescript
// stores/keyframeStore.ts
import { signal, computed } from '@preact/signals';

const selectedKeyframeIds = signal<Set<string>>(new Set());

// Computed: interpolated values for the selected layer at the current frame
const interpolatedValues = computed(() => {
  const layerId = layerStore.selectedLayerId.value;
  if (!layerId) return null;
  // ... find layer, compute sequence-local frame, call interpolateAt()
});

export const keyframeStore = {
  selectedKeyframeIds,
  interpolatedValues,

  addKeyframe(layerId: string, frame: number) { /* ... */ },
  removeKeyframes(layerId: string, frames: number[]) { /* ... */ },
  moveKeyframe(layerId: string, fromFrame: number, toFrame: number) { /* ... */ },
  setEasing(layerId: string, frame: number, easing: EasingType) { /* ... */ },
};
```

### Pattern 4: Timeline Diamond Rendering
**What:** Draw keyframe diamonds in the existing `drawTracks()` loop when a content layer is selected
**When to use:** During TimelineRenderer.draw() for the selected layer's owning track
**Why:** Diamonds render on the content track row at the keyframe's frame position. Only visible when a layer is selected, avoiding clutter.

```typescript
// In TimelineRenderer.draw(), after drawing track content:
if (selectedLayerKeyframes && selectedLayerKeyframes.length > 0) {
  for (const kf of selectedLayerKeyframes) {
    // kf.frame is sequence-local; convert to global for pixel positioning
    const globalFrame = track.startFrame + kf.frame;
    const kfX = globalFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    if (kfX < TRACK_HEADER_WIDTH || kfX > w) continue; // virtualize
    this.drawDiamond(ctx, kfX, trackCenterY, isSelected);
  }
}
```

### Pattern 5: Transient Edits Between Keyframes
**What:** A transient override signal in keyframeStore that holds property values the user edited between keyframes, without persisting them to Layer state
**When to use:** When the user edits properties on a layer with keyframes while the playhead is NOT on a keyframe frame
**Why:** The locked decision states "Edits between keyframes are transient -- only saved when user clicks [+ Keyframe]." Since `layerStore.updateLayer()` immediately writes to the store and creates undo entries, property edits between keyframes must NOT go through `layerStore.updateLayer()`. Instead, they write to `keyframeStore.transientOverrides` -- a signal holding the user's temporary edits. The preview renderer ignores transient overrides (always uses interpolated values). PropertiesPanel shows transient overrides while they exist. On frame change (playhead move), transient overrides are cleared and the display reverts to interpolated values. The [+ Keyframe] button reads from transient overrides (if set) to capture what the user edited.

```typescript
// In keyframeStore:
const transientOverrides = signal<KeyframeValues | null>(null);

// When user edits a property between keyframes:
// - PropertiesPanel calls keyframeStore.setTransientValue(field, value)
// - This updates transientOverrides without touching layerStore
// - Preview renderer always uses interpolateAt() (unaffected)
// - [+ Keyframe] button reads transientOverrides to snapshot user's edits

// When playhead moves (frame change effect):
// - Clear transientOverrides to null
// - PropertiesPanel falls back to interpolatedValues
```

### Anti-Patterns to Avoid
- **Auto-key mode:** User explicitly decided against this. Always require [+ Keyframe] button click.
- **Per-property keyframes:** Full snapshot model is locked. Do NOT create separate keyframe tracks per property.
- **Keyframes on FX layers:** Content layers only. Skip base layer too.
- **Writing property edits to layerStore between keyframes:** When a layer has keyframes and the playhead is NOT on a keyframe frame, property edits must go through `keyframeStore.transientOverrides`, NOT `layerStore.updateLayer()`. This prevents corrupting the animation and creating spurious undo entries.
- **Right-click for interpolation menu:** Tauri reserves right-click. Use double-click.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo/redo for keyframe ops | Custom undo stack | Existing `pushAction()` + `structuredClone` snapshot/restore | Keyframes live on Layer; snapshot captures them automatically |
| Coalesced undo for keyframe drag | Custom coalescing | `startCoalescing()`/`stopCoalescing()` from `lib/history.ts` | Already proven for slider drags and transform drags |
| Hit-testing for diamonds | Custom spatial index | Simple frame-based comparison (`Math.abs(clickFrame - kf.frame) < threshold`) | Diamonds are sparse; brute force is O(n) where n << 100 |
| UUID generation | Custom ID gen | `crypto.randomUUID()` | Already used everywhere in sequenceStore |

**Key insight:** The existing undo/redo system using `structuredClone` snapshot/restore means keyframe data stored ON the Layer interface gets free undo/redo with zero additional work. A separate keyframe store would require its own snapshot/restore logic.

## Common Pitfalls

### Pitfall 1: Global vs Local Frame Numbers (RESOLVED -- use local)
**Decision:** Store keyframe frames as SEQUENCE-LOCAL OFFSETS (e.g., "frame 5 within this sequence"), not global frame numbers.
**Why local is correct:** Global frame numbers become stale when sequences are reordered or key photos are added/removed in OTHER sequences. Local offsets are immune to changes in other sequences. The `activeSequenceStartFrame` computed in `frameMap.ts` provides the conversion factor.
**Conversion pattern:** `localFrame = globalFrame - sequenceStartFrame` at the call site (keyframeStore, Preview renderer, PropertiesPanel). All stored values are sequence-local. All interpolation calls use sequence-local frames.
**Warning signs (if done wrong):** Keyframes appear to "jump" when adding/removing key photos in other sequences.

### Pitfall 2: Transient Edits Persisted Accidentally
**What goes wrong:** Property changes between keyframes get saved to the Layer state, corrupting the animation and creating spurious undo entries
**Why it happens:** The existing `layerStore.updateLayer()` immediately writes to the store with undo support
**How to avoid:** When a layer has keyframes and the playhead is NOT on a keyframe frame, property edits write to `keyframeStore.transientOverrides` (a signal), NOT to `layerStore.updateLayer()`. Transient overrides are cleared on frame change. The [+ Keyframe] button reads transient overrides to capture the user's edits as a new keyframe snapshot. When the playhead IS on a keyframe frame, edits go through `layerStore.updateLayer()` AND update that keyframe's values.
**Warning signs:** Values "stick" after scrubbing to a different frame without clicking [+ Keyframe], or spurious undo entries for transient edits

### Pitfall 3: Interpolation During Playback Performance
**What goes wrong:** Calling `interpolateAt()` creates garbage (new objects) on every frame during 24fps playback
**Why it happens:** Naive implementation allocates new KeyframeValues objects 24+ times per second
**How to avoid:** Pre-compute interpolated values into a reusable object. The binary search for surrounding keyframes can be cached (invalidated only when keyframes change). For 4 preset curves, the easing functions are trivial math -- no library overhead.
**Warning signs:** Frame drops during playback with keyframed layers

### Pitfall 4: Diamond Hit-Testing Conflicts with Existing Timeline Interactions
**What goes wrong:** Clicking a keyframe diamond also triggers playhead seek and sequence selection
**Why it happens:** `TimelineInteraction.onPointerDown` processes clicks sequentially; keyframe clicks need to be handled BEFORE playhead seek
**How to avoid:** In `onPointerDown`, check keyframe diamond hit-test FIRST (before the existing ruler/playhead/track logic). If a diamond is hit, handle it and `return` early.
**Warning signs:** Clicking a diamond seeks the playhead but doesn't select the diamond, or vice versa

### Pitfall 5: Undo Breaks When Editing Keyframe on Existing Frame
**What goes wrong:** Editing properties and clicking [+ Keyframe] on an existing keyframe frame creates duplicate undo entries or loses state
**Why it happens:** The update-existing-keyframe path needs to snapshot BEFORE overwriting values
**How to avoid:** The [+ Keyframe] action should always: (1) snapshot state BEFORE, (2) upsert keyframe, (3) snapshot AFTER, (4) pushAction. Same pattern as all other sequenceStore operations.
**Warning signs:** Undo after updating a keyframe restores wrong values

### Pitfall 6: Format Migration - v5 Files Without Keyframes
**What goes wrong:** Opening a v5 file in v6 code crashes because keyframes field is undefined
**Why it happens:** Serde deserialization of old files doesn't have `keyframes` field on MceLayer
**How to avoid:** Use `#[serde(default)]` in Rust and `layer.keyframes ?? []` in TypeScript deserialization. The existing pattern (e.g., `blur?: number` with `ml.blur ?? 0`) shows exactly how to handle this.
**Warning signs:** App crashes when opening projects saved before Phase 12

### Pitfall 7: Properties Panel Shows Stale Values After Frame Change
**What goes wrong:** NumericInput fields show the previous frame's values until re-render
**Why it happens:** PropertiesPanel reads `layer.opacity` directly; with keyframes, it should read interpolated values
**How to avoid:** When a layer has keyframes, PropertiesPanel must read from `interpolateAt(layer.keyframes, currentFrame)` instead of `layer.opacity`/`layer.transform`. This is the core behavior change: properties show interpolated state, not stored state.
**Warning signs:** Property inputs don't update when scrubbing through keyframed sections

## Code Examples

### Easing Functions (4 presets, pure math)
```typescript
// lib/keyframeEngine.ts
// Source: CSS standard cubic-bezier presets + polynomial equivalents
// https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** Apply easing to normalized t in [0,1] */
export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      // Cubic ease-in: accelerating from zero velocity
      return t * t * t;
    case 'ease-out':
      // Cubic ease-out: decelerating to zero velocity
      const u = t - 1;
      return u * u * u + 1;
    case 'ease-in-out':
      // Cubic ease-in-out: acceleration until halfway, then deceleration
      return t < 0.5
        ? 4 * t * t * t
        : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    default:
      return t;
  }
}
```

### Linear Interpolation of KeyframeValues
```typescript
// lib/keyframeEngine.ts

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpValues(
  a: KeyframeValues,
  b: KeyframeValues,
  t: number,
): KeyframeValues {
  return {
    opacity: lerp(a.opacity, b.opacity, t),
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    scaleY: lerp(a.scaleY, b.scaleY, t),
    rotation: lerp(a.rotation, b.rotation, t),
    blur: lerp(a.blur, b.blur, t),
  };
}
```

### Diamond Drawing on Timeline
```typescript
// In TimelineRenderer.ts

private drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isSelected: boolean,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - size);       // top
  ctx.lineTo(x + size, y);       // right
  ctx.lineTo(x, y + size);       // bottom
  ctx.lineTo(x - size, y);       // left
  ctx.closePath();

  ctx.fillStyle = isSelected ? '#FFD700' : '#E5A020';
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#FFFFFF' : '#88660088';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Selection glow
  if (isSelected) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
```

### [+ Keyframe] Button Action
```typescript
// In PropertiesPanel.tsx or keyframeStore.ts

function addKeyframeAtCurrentFrame(layer: Layer) {
  const globalFrame = timelineStore.currentFrame.peek();
  // Convert global frame to sequence-local offset
  const seqStartFrame = findSequenceStartForLayer(layer.id);
  const localFrame = globalFrame - seqStartFrame;

  // Read values from transient overrides (user edits) or layer stored values
  const overrides = keyframeStore.transientOverrides.peek();
  const values: KeyframeValues = overrides ?? {
    opacity: layer.opacity,
    x: layer.transform.x,
    y: layer.transform.y,
    scaleX: layer.transform.scaleX,
    scaleY: layer.transform.scaleY,
    rotation: layer.transform.rotation,
    blur: layer.blur ?? 0,
  };

  const keyframes = [...(layer.keyframes ?? [])];
  const existingIdx = keyframes.findIndex(kf => kf.frame === localFrame);

  if (existingIdx >= 0) {
    // Update existing keyframe's values
    keyframes[existingIdx] = { ...keyframes[existingIdx], values };
  } else {
    // Insert new keyframe, maintaining frame-sorted order
    const newKf: Keyframe = { frame: localFrame, easing: 'ease-in-out', values };
    keyframes.push(newKf);
    keyframes.sort((a, b) => a.frame - b.frame);
  }

  layerStore.updateLayer(layer.id, { keyframes });
  // Clear transient overrides after committing
  keyframeStore.transientOverrides.value = null;
}
```

### Injecting Interpolated Values into PreviewRenderer
```typescript
// In Preview.tsx renderFromFrameMap(), before calling renderer.renderFrame():

// Apply keyframe interpolation to content layers
const interpolatedLayers = seq.layers.map(layer => {
  if (!layer.keyframes || layer.keyframes.length === 0) return layer;
  if (isFxLayer(layer) || layer.isBase) return layer;

  // Use sequence-local frame for interpolation
  const values = interpolateAt(layer.keyframes, localFrame);
  if (!values) return layer;

  return {
    ...layer,
    opacity: values.opacity,
    transform: {
      ...layer.transform,
      x: values.x,
      y: values.y,
      scaleX: values.scaleX,
      scaleY: values.scaleY,
      rotation: values.rotation,
    },
    blur: values.blur,
  };
});

renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
```

### .mce v6 Serialization (TypeScript side)
```typescript
// In projectStore.ts buildMceProject(), inside layer mapping:

// Keyframes (v6)
...(layer.keyframes && layer.keyframes.length > 0 ? {
  keyframes: layer.keyframes.map(kf => ({
    frame: kf.frame,
    easing: kf.easing,
    values: {
      opacity: kf.values.opacity,
      x: kf.values.x,
      y: kf.values.y,
      scale_x: kf.values.scaleX,
      scale_y: kf.values.scaleY,
      rotation: kf.values.rotation,
      blur: kf.values.blur,
    },
  })),
} : {}),
```

### Rust v6 Deserialization (backward compat)
```rust
// In models/project.rs MceLayer:

#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub keyframes: Vec<MceKeyframe>,

// New struct:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyframe {
    pub frame: u32,
    pub easing: String,
    pub values: MceKeyframeValues,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceKeyframeValues {
    pub opacity: f64,
    pub x: f64,
    pub y: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub rotation: f64,
    #[serde(default)]
    pub blur: f64,
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-property keyframe tracks | Full-snapshot keyframes | User decision (Phase 12) | Simpler data model, but all properties animate together |
| Graph editor for curves | Preset easing functions only | User decision (Phase 12) | 4 lines of math vs. entire curve editor UI |
| Auto-key mode | Explicit [+ Keyframe] button | User decision (Phase 12) | Prevents accidental keyframe creation |

**Deprecated/outdated:**
- bezier-easing library: Not needed for 4 preset curves; polynomial math is simpler and zero-dependency

## Open Questions

1. **Global frame numbers vs. sequence-relative frame numbers -- RESOLVED**
   - **Decision: Sequence-local offsets.** Keyframe `frame` values are stored as offsets from the sequence start frame.
   - **Rationale:** Global frame numbers become stale when sequences are reordered or key photos are added/removed in OTHER sequences. Local offsets are immune to those changes. The `activeSequenceStartFrame` computed in `frameMap.ts` and `trackLayouts` provide the conversion factor at call sites.
   - **Conversion:** `localFrame = globalFrame - sequenceStartFrame` at keyframeStore, Preview renderer, and PropertiesPanel. All stored values and all `interpolateAt()` calls use sequence-local frames.

2. **PropertiesPanel value source when layer has keyframes -- RESOLVED**
   - **Decision:** Use `keyframeStore.transientOverrides` for user edits between keyframes, `keyframeStore.interpolatedValues` for display.
   - When the user edits a property between keyframes, the edit writes to `keyframeStore.transientOverrides` (NOT `layerStore.updateLayer()`). PropertiesPanel shows transient overrides while they exist. On frame change (playhead move), transient overrides are cleared and the display reverts to interpolated values. The [+ Keyframe] button reads from transient overrides to capture user edits. When ON a keyframe frame, edits go through `layerStore.updateLayer()` AND update that keyframe's values directly.

3. **Keyboard shortcut for Add Keyframe -- RESOLVED**
   - **Decision:** Use `I` key (K is taken by JKL shuttle scrub system). I = "Insert keyframe."

## Sources

### Primary (HIGH confidence)
- Project codebase: `types/layer.ts`, `lib/previewRenderer.ts`, `components/timeline/TimelineRenderer.ts`, `components/timeline/TimelineInteraction.ts`, `components/layout/PropertiesPanel.tsx`, `stores/sequenceStore.ts`, `stores/projectStore.ts`, `lib/history.ts`, `models/project.rs` -- all read and analyzed
- [MDN CSS Easing Functions](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function) -- standard cubic-bezier control points for ease-in (0.42,0,1,1), ease-out (0,0,0.58,1), ease-in-out (0.42,0,0.58,1)

### Secondary (MEDIUM confidence)
- [gre/bezier-easing gist](https://gist.github.com/gre/1650294) -- polynomial equivalents for cubic easing: `easeInCubic: t*t*t`, `easeOutCubic: (--t)*t*t+1`, `easeInOutCubic: t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1`
- [Easings.net](https://easings.net/) -- visual reference for easing curve shapes

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official specs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- data model fits existing Layer/structuredClone pattern perfectly
- Interpolation math: HIGH -- standard polynomial easing, verified against CSS spec
- Timeline rendering: HIGH -- existing Canvas 2D draw loop, diamond rendering is trivial geometry
- Pitfalls: HIGH -- identified from direct codebase analysis of interaction handlers and undo system
- .mce migration: HIGH -- follows identical pattern to v4->v5 migration (serde defaults)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- no external dependencies to track)
