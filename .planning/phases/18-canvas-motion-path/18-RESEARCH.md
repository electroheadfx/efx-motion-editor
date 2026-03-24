# Phase 18: Canvas Motion Path - Research

**Researched:** 2026-03-24
**Domain:** Canvas overlay rendering, spatial keyframe visualization, interactive drag editing
**Confidence:** HIGH

## Summary

This phase adds After Effects-style motion path visualization to the canvas. The existing codebase provides a solid foundation: `keyframeEngine.interpolateAt()` can sample x,y positions at every frame, `TransformOverlay.tsx` provides the pointer event and coordinate mapping infrastructure, and `transformHandles.ts` provides reusable hit-testing patterns. The motion path is a dotted trail connecting interpolated positions with circle markers at keyframe frames, rendered as an SVG overlay in project space.

The core challenge is architectural: the motion path needs to integrate with the canvas overlay system without bloating `TransformOverlay.tsx` (already 590 lines). A new `MotionPath.tsx` component rendered alongside `TransformOverlay` inside the CSS-transformed wrapper div is the right approach. This keeps the path in project-space coordinates natively (no manual coordinate transforms needed for rendering), while drag interactions use the same `clientToCanvas()` pipeline that TransformOverlay uses.

**Primary recommendation:** Create a standalone `MotionPath.tsx` component that renders an SVG overlay with dotted trail and keyframe circles, placed as a sibling of `TransformOverlay` inside the canvas wrapper div.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dotted trail -- sample interpolated x,y positions at every frame and draw a dot for each. Dot spacing naturally reveals easing (tight dots = slow, spaced dots = fast).
- **D-02:** Circle markers at keyframe positions, distinct from timeline diamond shapes. Filled circle when selected, outlined when not.
- **D-03:** Use the app's accent/highlight color for dots and keyframe circles. Selected keyframe in solid accent, others outlined.
- **D-04:** Keyframe circles on the path are draggable -- dragging updates the keyframe's x,y values. The dotted trail updates in real-time during drag. Builds on existing TransformOverlay drag infrastructure (coordinateMapper, coalescing).
- **D-05:** No click-to-add keyframes on the path. Users add keyframes via the existing K shortcut or sidebar button. Path is for visualization and repositioning only.
- **D-06:** Playhead auto-seeks to the keyframe's frame when drag starts. Canvas shows the layer at that keyframe's state during editing.
- **D-07:** No easing type indicator/badge at keyframe circles. Dot spacing already communicates the easing effect. Easing type editing stays in the sidebar (InlineInterpolation component).
- **D-08:** Current frame's dot on the path is highlighted (larger or brighter) to show playhead position along the motion trail. Connects timeline position to spatial position.
- **D-09:** Path appears automatically when a keyframed layer is selected. Disappears when selecting a non-keyframed layer or deselecting. No toggle button needed.
- **D-10:** Path hides during playback and reappears when paused. Keeps the preview canvas clean during playback review.

### Claude's Discretion
- Dot size and spacing aesthetics
- Hit test radius for keyframe circle dragging
- Visual treatment of highlighted current-frame dot (size vs brightness vs both)
- Canvas rendering layer order (path behind or in front of transform handles)
- Performance optimization for high frame-count sequences

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | ^10.28.4 | UI framework (JSX components) | Project standard -- already in use |
| @preact/signals | ^2.8.1 | Reactive state management | Project standard -- all stores use signals |
| SVG (browser native) | N/A | Path/dot rendering on canvas overlay | Zero-dependency, project already uses SVG for bounding box in TransformOverlay |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| keyframeEngine.ts | internal | `interpolateAt()` for sampling x,y at every frame | Generating dot positions along the motion trail |
| coordinateMapper.ts | internal | `clientToCanvas()` for pointer-to-project-space conversion | Drag interactions on keyframe circles |
| history.ts | internal | `startCoalescing()`/`stopCoalescing()` for undo batching | Wrapping keyframe position drag operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG circles for dots | Canvas 2D drawing | Canvas 2D would need a separate `<canvas>` element; SVG integrates naturally with the existing div-based overlay and provides automatic zoom scaling |
| Rendering dots in TransformOverlay | Separate MotionPath component | TransformOverlay is already 590 lines; a separate component is cleaner and follows single-responsibility |

**No installation needed** -- all dependencies are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
Application/src/components/canvas/
  MotionPath.tsx          # NEW: motion path SVG overlay component
  motionPathHitTest.ts    # NEW: hit testing for keyframe circles on path
  TransformOverlay.tsx    # EXISTING: minor integration (render MotionPath)
  coordinateMapper.ts     # EXISTING: reused for drag coordinate mapping
  transformHandles.ts     # EXISTING: patterns referenced for hit testing
  hitTest.ts              # EXISTING: unchanged
```

### Pattern 1: SVG Overlay in Project Space
**What:** The motion path renders as an SVG element inside the CSS-transformed canvas wrapper div. All coordinates are in project space (pixels relative to project dimensions). The CSS `transform: scale(zoom) translate(panX, panY)` on the parent div handles all zoom/pan automatically.
**When to use:** Always -- this is how the existing TransformOverlay works.
**Example:**
```typescript
// MotionPath.tsx -- renders in project space inside the canvas wrapper
// The parent div applies: transform: scale(zoom) translate(panX, panY)
// So all px values here are in project-resolution coordinates.
<svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
  {/* Trail dots -- one per frame */}
  {dots.map((dot, i) => (
    <circle cx={dot.x} cy={dot.y} r={dotRadius / zoom} fill={accentColor} opacity={0.4} />
  ))}
  {/* Keyframe circles -- interactive */}
  {kfCircles.map((kf) => (
    <circle cx={kf.x} cy={kf.y} r={kfRadius / zoom}
      fill={kf.selected ? accentColor : 'none'}
      stroke={accentColor} stroke-width={1.5 / zoom}
    />
  ))}
  {/* Current frame highlight */}
  <circle cx={currentDot.x} cy={currentDot.y} r={highlightRadius / zoom}
    fill={accentColor} opacity={0.8}
  />
</svg>
```

### Pattern 2: Dot Position Sampling via interpolateAt()
**What:** Sample x,y at every frame between first and last keyframe to generate the dot array. The `interpolateAt()` function handles easing automatically -- dots cluster where motion is slow and spread where motion is fast.
**When to use:** Every render cycle when the selected layer has >= 2 keyframes with different x,y values.
**Example:**
```typescript
// Generate dot positions for the motion trail
// keyframes are in sequence-local frame space
// x,y values are offsets from canvas center (transform.x, transform.y convention)
function sampleMotionDots(keyframes: Keyframe[], canvasW: number, canvasH: number): Point[] {
  if (keyframes.length < 2) return [];
  const first = keyframes[0].frame;
  const last = keyframes[keyframes.length - 1].frame;
  const dots: Point[] = [];
  for (let f = first; f <= last; f++) {
    const vals = interpolateAt(keyframes, f);
    if (vals) {
      // Convert from offset-from-center to project-space coordinates
      dots.push({ x: vals.x + canvasW / 2, y: vals.y + canvasH / 2 });
    }
  }
  return dots;
}
```

### Pattern 3: Keyframe Circle Drag with Auto-Seek (D-04, D-06)
**What:** When a user starts dragging a keyframe circle, the playhead auto-seeks to that keyframe's frame (D-06), then drag updates the keyframe's x,y values in real-time with undo coalescing.
**When to use:** For keyframe circle pointer interaction.
**Example:**
```typescript
// On keyframe circle drag start:
// 1. Seek playhead to keyframe frame (D-06)
// 2. Start coalescing for undo batching
// 3. On move: update keyframe values
// 4. On up: stop coalescing

function startKeyframeDrag(layerId: string, kfIndex: number, keyframes: Keyframe[]) {
  const kf = keyframes[kfIndex];
  // Auto-seek: set timeline to this keyframe's global frame
  const ctx = findLayerContext(layerId);
  if (ctx) {
    timelineStore.setFrame(kf.frame + ctx.startFrame);
  }
  startCoalescing();
}

function moveKeyframeDrag(layerId: string, kfIndex: number, newX: number, newY: number, keyframes: Keyframe[]) {
  // newX, newY are in project space -- convert back to offset-from-center
  const offsetX = newX - canvasW / 2;
  const offsetY = newY - canvasH / 2;
  const updated = keyframes.map((kf, i) =>
    i === kfIndex ? { ...kf, values: { ...kf.values, x: offsetX, y: offsetY } } : kf
  );
  layerStore.updateLayer(layerId, { keyframes: updated });
}
```

### Pattern 4: Counter-Scaled Visual Elements
**What:** SVG elements like dot radii, stroke widths, and hit-test radii must be divided by zoom to maintain a constant screen-pixel size regardless of canvas zoom level.
**When to use:** All visual elements and hit-test calculations.
**Example:**
```typescript
// TransformOverlay already uses this pattern:
const strokeWidth = 1.5 / zoom;
const cornerSize = 8 / zoom;
// Motion path follows the same convention:
const dotRadius = 2 / zoom;       // ~2px screen dots
const kfCircleRadius = 5 / zoom;  // ~5px screen circles
const hitTestRadius = 10 / zoom;  // ~10px screen hit area
```

### Anti-Patterns to Avoid
- **Embedding motion path logic inside TransformOverlay.tsx:** TransformOverlay is already 590 lines with complex drag state. Adding motion path drag handling inside it would make it unmaintainable. Use a separate component.
- **Using client/screen coordinates for dot positions:** The overlay sits inside the CSS-transformed wrapper div. All positions must be in project space. Using screen coordinates would cause dots to shift when zooming/panning.
- **Generating dot arrays on every render without memoization:** Interpolation at every frame is O(frames * keyframes). For a 300-frame sequence with 5 keyframes, that is 1500 interpolation calls. Must memoize based on keyframe data.
- **Using Preact signals for the dot position array:** The dot array is derived data computed from `activeLayerKeyframes`. Use `computed()` or memoize in the component, do not create a new signal.
- **Forgetting to counter-scale by zoom:** If dot radius is a fixed px value, dots will shrink to invisible when zoomed out and grow huge when zoomed in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interpolating between keyframes | Custom lerp logic | `interpolateAt()` from keyframeEngine.ts | Already handles easing, edge cases (before first, after last, single keyframe) |
| Client-to-project-space conversion | Manual coordinate math | `clientToCanvas()` from coordinateMapper.ts | Handles zoom, pan, container offset, center-origin conversion |
| Undo batching for drag | Custom undo grouping | `startCoalescing()`/`stopCoalescing()` from history.ts | Already wired into the history system |
| Point-in-circle hit testing | Complex geometry | Distance check: `dx*dx + dy*dy <= r*r` | Simple, matches `hitTestHandles()` pattern |
| Layer context (sequence-local frames) | Manual sequence lookup | `findLayerContext()` pattern from keyframeStore.ts | Handles FX, content-overlay, and content sequences correctly |

**Key insight:** The existing codebase already has every mathematical and infrastructure primitive needed. This phase is purely an assembly/integration task with no novel algorithms required.

## Common Pitfalls

### Pitfall 1: x,y Coordinate Space Confusion
**What goes wrong:** Keyframe `values.x` and `values.y` are offsets from canvas center (the convention used by `LayerTransform`), not absolute project-space coordinates. Drawing dots at `(values.x, values.y)` directly places them near the top-left corner instead of the correct position.
**Why it happens:** The name `x` and `y` suggests absolute coordinates, but they follow the transform convention where `(0, 0)` means centered.
**How to avoid:** Always convert: `projectX = values.x + canvasW / 2`, `projectY = values.y + canvasH / 2`. Reference `getLayerBounds()` in transformHandles.ts line 97-98 for the canonical conversion.
**Warning signs:** Dots appear clustered in the top-left quadrant of the canvas.

### Pitfall 2: Sequence-Local vs. Global Frame Numbers
**What goes wrong:** Keyframe frames are sequence-local offsets. Using `timelineStore.displayFrame` directly to index into keyframes produces wrong positions for layers in sequences that don't start at frame 0.
**Why it happens:** Sequences can start at different global frames. FX sequences use `inFrame`, content sequences use `trackLayouts`.
**How to avoid:** Use `findLayerContext()` to get `startFrame`, then compute `localFrame = globalFrame - startFrame`. The `getLocalFrame()` helper in keyframeStore.ts already does this.
**Warning signs:** Current-frame dot position doesn't match the layer's actual position on canvas.

### Pitfall 3: SVG pointerEvents Blocking TransformOverlay
**What goes wrong:** If the motion path SVG has `pointerEvents: 'all'` or `pointerEvents: 'auto'`, it intercepts clicks meant for the transform handles or layer selection.
**Why it happens:** The motion path SVG overlays the same area as TransformOverlay.
**How to avoid:** Set `pointerEvents: 'none'` on the SVG container. Only enable pointer events on specific interactive elements (keyframe circles) by setting `pointerEvents: 'auto'` on those elements only. OR: handle all pointer events through the TransformOverlay and add motion path hit testing to its existing pipeline.
**Warning signs:** Layer can't be moved or scaled when motion path is visible.

### Pitfall 4: Performance with High Frame Counts
**What goes wrong:** A 600-frame sequence generates 600 SVG circle elements. Each re-render recreates all of them.
**Why it happens:** Naive implementation creates one SVG element per frame.
**How to avoid:** (a) Memoize the dot array based on keyframe data identity. (b) For very long sequences (>200 frames), consider sampling every Nth frame or using an SVG `<path>` with `stroke-dasharray` for the trail instead of individual circles. (c) The dot array only needs recomputation when keyframes change, not on every frame change.
**Warning signs:** Canvas becomes laggy when selecting a layer with many keyframes over a long frame range.

### Pitfall 5: Drag State Conflict with TransformOverlay
**What goes wrong:** If motion path drag and TransformOverlay drag use separate state management, both can be active simultaneously, causing erratic behavior.
**Why it happens:** Two independent pointer event handlers on overlapping elements.
**How to avoid:** Either: (a) Route all pointer events through TransformOverlay, extending its hit-test pipeline to include motion path keyframe circles (checked before transform handles), OR (b) Use the motion path as a sibling component with clear pointer-event isolation (keyframe circles have `pointerEvents: 'auto'`, rest is `pointerEvents: 'none'`).
**Warning signs:** Dragging a keyframe circle also moves the layer, or vice versa.

### Pitfall 6: Stale Interpolated Values During Drag
**What goes wrong:** During a keyframe drag, the `interpolatedValues` computed signal reflects the current frame's interpolation, which changes as the keyframe position updates. If the dot array reads from `interpolatedValues` during drag, it creates feedback loops.
**Why it happens:** Circular dependency: drag changes keyframes -> keyframes change interpolation -> interpolation affects dot positions -> dots re-render during drag.
**How to avoid:** This is actually desired behavior (D-04: "dotted trail updates in real-time during drag"). The dot array should re-sample from the updated keyframes. Just ensure the sampling function reads from `activeLayerKeyframes` (which reacts to `layerStore` updates), not from a cached copy.
**Warning signs:** None -- this pitfall is actually the desired behavior if implemented correctly.

## Code Examples

Verified patterns from the existing codebase:

### Sampling interpolated positions from keyframeEngine
```typescript
// Source: Application/src/lib/keyframeEngine.ts
// interpolateAt returns a fresh KeyframeValues copy (safe to store)
import { interpolateAt } from '../lib/keyframeEngine';
import type { Keyframe } from '../types/layer';

function sampleTrailPositions(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
): { x: number; y: number; frame: number }[] {
  if (keyframes.length < 2) return [];
  const firstFrame = keyframes[0].frame;
  const lastFrame = keyframes[keyframes.length - 1].frame;
  const positions: { x: number; y: number; frame: number }[] = [];
  for (let f = firstFrame; f <= lastFrame; f++) {
    const vals = interpolateAt(keyframes, f);
    if (vals) {
      positions.push({
        x: vals.x + canvasW / 2,
        y: vals.y + canvasH / 2,
        frame: f,
      });
    }
  }
  return positions;
}
```

### Hit testing pattern (from transformHandles.ts)
```typescript
// Source: Application/src/components/canvas/transformHandles.ts:180-196
// Reusable for keyframe circle hit testing
function hitTestKeyframeCircles(
  point: { x: number; y: number },
  circles: { x: number; y: number; frame: number }[],
  zoom: number,
  hitScreenSize: number = 10,
): number | null {
  const hitRadius = hitScreenSize / zoom;
  for (let i = circles.length - 1; i >= 0; i--) {
    const c = circles[i];
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return i;
    }
  }
  return null;
}
```

### Drag infrastructure pattern (from TransformOverlay.tsx)
```typescript
// Source: Application/src/components/canvas/TransformOverlay.tsx
// Pattern for drag with undo coalescing:
import { startCoalescing, stopCoalescing } from '../../lib/history';

// On drag start (after threshold):
startCoalescing();

// On drag move:
layerStore.updateLayer(layerId, {
  keyframes: updatedKeyframes, // with new x,y values
});

// On drag end:
stopCoalescing();
```

### Counter-scaled rendering pattern (from TransformOverlay.tsx)
```typescript
// Source: Application/src/components/canvas/TransformOverlay.tsx:145-148
// Counter-scale sizes for fixed screen-pixel appearance
const strokeWidth = 1.5 / zoom;
const cornerSize = 8 / zoom;
const edgeSize = 6 / zoom;
const borderWidth = 1 / zoom;
```

### Coordinate conversion (from TransformOverlay.tsx)
```typescript
// Source: Application/src/components/canvas/TransformOverlay.tsx:152-166
// Convert client coordinates to project space for pointer events
function getProjectPoint(e: PointerEvent) {
  const container = containerRef.current;
  if (!container) return { x: 0, y: 0 };
  const rect = container.getBoundingClientRect();
  return clientToCanvas(
    e.clientX, e.clientY, rect,
    canvasStore.zoom.peek(),
    canvasStore.panX.peek(),
    canvasStore.panY.peek(),
    projectStore.width.peek(),
    projectStore.height.peek(),
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No motion path | Phase 18 adds motion path | This phase | Users can visualize and edit spatial keyframe trajectories |
| Keyframe positions only editable via sidebar number inputs | Keyframe positions draggable on canvas | This phase | Direct manipulation, AE-like workflow |

**Existing capabilities being leveraged:**
- `interpolateAt()`: Polynomial cubic easing engine, already production-tested
- `TransformOverlay`: Full drag pipeline with undo coalescing, coordinate mapping
- `transformHandles.ts`: Hit testing, geometry, cursor management patterns

## Open Questions

1. **Render order: motion path behind or in front of transform handles?**
   - What we know: TransformOverlay renders bounding box + handles. Motion path dots should be visible but not obstruct handle interaction.
   - Recommendation: Render motion path SVG BEFORE the transform handles in DOM order, so handles appear on top. Set `pointerEvents: 'none'` on the path SVG (with selective `pointerEvents: 'auto'` on keyframe circles only).

2. **Integration approach: sibling component vs. embedded in TransformOverlay?**
   - What we know: TransformOverlay handles all pointer events for the canvas area. Adding a sibling with its own pointer handling risks conflicts.
   - Recommendation: Create `MotionPath.tsx` as a sibling component rendered BEFORE `TransformOverlay` in `CanvasArea.tsx`. Set the entire MotionPath SVG to `pointerEvents: 'none'`. Add keyframe circle hit testing to TransformOverlay's existing `handlePointerDown` pipeline (check keyframe circles BEFORE transform handles). This avoids event conflicts while keeping MotionPath rendering separate.

3. **Performance threshold for dot sampling strategy**
   - What we know: Typical sequences are 24-120 frames. Extreme cases could be 500+ frames.
   - Recommendation: For <= 300 frames, render individual SVG circles. For > 300 frames, use an SVG `<polyline>` with `stroke-dasharray` for the trail dots and only render individual circles at keyframe positions. This keeps SVG DOM size manageable.

## Project Constraints (from CLAUDE.md)

- Do not run the server -- user runs it on their side
- GSD tools located at `.claude/get-shit-done`, not `$HOME/.claude/get-shit-done`
- Current date: 2026-03-24

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | Application/vitest.config.ts |
| Quick run command | `cd Application && npx vitest run --reporter=dot` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements to Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Dot position sampling from keyframes | unit | `cd Application && npx vitest run src/components/canvas/motionPath.test.ts -x` | Wave 0 |
| Keyframe circle hit testing | unit | `cd Application && npx vitest run src/components/canvas/motionPathHitTest.test.ts -x` | Wave 0 |
| Coordinate conversion (center offset to project space) | unit | Covered by existing coordinate tests or new motionPath tests | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=dot`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Application/src/components/canvas/motionPath.test.ts` -- dot sampling, coordinate conversion, current-frame highlight logic
- [ ] `Application/src/components/canvas/motionPathHitTest.test.ts` -- keyframe circle hit testing

## Sources

### Primary (HIGH confidence)
- `Application/src/components/canvas/TransformOverlay.tsx` -- existing overlay pattern, drag infrastructure, coordinate mapping, counter-scaling
- `Application/src/components/canvas/transformHandles.ts` -- hit testing, geometry, bounding box computation
- `Application/src/components/canvas/coordinateMapper.ts` -- clientToCanvas/canvasToClient, coordinate space documentation
- `Application/src/lib/keyframeEngine.ts` -- interpolateAt(), applyEasing(), lerp() implementation
- `Application/src/stores/keyframeStore.ts` -- activeLayerKeyframes, findLayerContext(), getLocalFrame()
- `Application/src/types/layer.ts` -- Keyframe, KeyframeValues, LayerTransform type definitions
- `Application/src/components/layout/CanvasArea.tsx` -- canvas wrapper structure, CSS transform chain, TransformOverlay integration

### Secondary (MEDIUM confidence)
- SVG specification for `stroke-dasharray`, circle rendering, pointerEvents attribute -- browser standard, well-known

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in the project, patterns well-established
- Architecture: HIGH -- follows existing TransformOverlay patterns exactly, all code read and analyzed
- Pitfalls: HIGH -- derived from direct code analysis of coordinate spaces, event handling, and rendering pipeline

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- internal architecture, no external dependencies)
