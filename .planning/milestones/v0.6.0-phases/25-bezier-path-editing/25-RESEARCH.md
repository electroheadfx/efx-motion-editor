# Phase 25: Bezier Path Editing - Research

**Researched:** 2026-04-03
**Domain:** Bezier curve editing, path simplification, interactive Canvas2D handle manipulation
**Confidence:** HIGH

## Summary

This phase adds Illustrator-style bezier path editing to existing paint strokes. The core challenge breaks into three sub-problems: (1) converting freehand point arrays to cubic bezier anchor arrays via curve fitting, (2) rendering strokes from bezier data instead of raw points, and (3) building an interactive overlay for dragging anchors, handles, and segments.

The existing codebase provides strong foundations: `PaintOverlay.tsx` already has a complete gesture pipeline with snapshot-based undo, `paintRenderer.ts` uses quadratic bezier curves for stroke outlines, and the `PaintToolType` union is designed for extension. The `fit-curve` npm package (Schneider's algorithm) is the standard solution for freehand-to-bezier conversion. No heavy external libraries are needed for the editor UI itself -- it is pure Canvas2D geometry with hit testing and pointer event handling, following the same patterns already established in the select mode.

**Primary recommendation:** Use `fit-curve` for point-to-bezier conversion. Implement the bezier editor as a new tool mode in PaintOverlay.tsx following the existing select-mode gesture pattern. Store anchors as a new `anchors` field on PaintStroke that replaces `points` for rendering when present.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Dedicated pen tool button in paint toolbar. When pen tool active and stroke clicked, bezier anchors auto-show immediately.
- D-02: Selecting a different stroke while pen tool active automatically shows its anchors.
- D-03: Pen tool works on ALL element types: brush, eraser, shapes. Shapes undergo one-way conversion to bezier paths.
- D-04: Auto-simplify freehand points on pen tool activation. Run Douglas-Peucker or similar to reduce points to ~10-30 cubic bezier anchors.
- D-05: Preserve pressure data per bezier anchor.
- D-06: Shapes convert to minimal anchors: rect=4, ellipse=4 with handles, line=2.
- D-07: Store bezier data as new field on PaintStroke (e.g., `anchors`). Replaces original `points` array. Once bezier-edited, stroke uses bezier data for rendering.
- D-08: Smooth (coupled) handles by default. Alt+drag breaks tangent for corner points.
- D-09: Illustrator-style visuals: square anchors (filled=selected, hollow=unselected), round handles with thin lines. Blue/white color scheme.
- D-10: Segment dragging supported -- dragging curve between anchors adjusts nearby handles.
- D-11: Click on path segment to insert new anchor. Path shape preserved.
- D-12: Select anchor + Delete/Backspace to remove. Path reconnects smoothly.
- D-13: Undo/redo follows Phase 23's snapshot-before/commit-on-release pattern.

### Claude's Discretion
- Douglas-Peucker tolerance calibration and simplification algorithm details
- Exact anchor/handle sizes, colors, and hit-test radii for the dark theme
- Segment drag handle adjustment algorithm
- Smooth reconnection algorithm when deleting anchors
- Pen tool icon design and toolbar placement
- How shape-to-path conversion handles filled vs outline shapes
- Whether eraser strokes need special handling

### Deferred Ideas (OUT OF SCOPE)
- Dedicated bezier pen drawing tool (draw new paths from scratch) -- PINT-05, future phase
- Bezier path for new shape creation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PINT-03 | User can edit stroke paths as bezier/spline curves in roto paint edit mode | fit-curve for conversion, BezierAnchor data model, Canvas2D bezier rendering path, pen tool mode in PaintOverlay |
| PINT-04 | User can add, move, and delete bezier control points on existing strokes | Point insertion via de Casteljau subdivision, deletion with handle auto-adjustment, snapshot undo pattern |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Find GSD tools from `.claude/get-shit-done`, not `$HOME/.claude/get-shit-done`
- Do not run the server (user runs it)

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fit-curve | 0.2.0 | Convert freehand point arrays to cubic bezier curves | Industry-standard Schneider algorithm implementation; handles error tolerance, tangent estimation, and multi-segment fitting |
| bezier-js | 6.1.4 | Bezier curve utilities (splitting, projection, length) | Comprehensive bezier math library by Pomax; needed for point-on-curve projection, de Casteljau splitting for point insertion, and nearest-point calculations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simplify-js | 1.2.4 | Pre-simplification of dense freehand points via RDP | Optional: run before fit-curve to reduce very dense strokes (>500 points) for faster fitting. Most strokes may not need this step. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fit-curve | Hand-rolled least-squares fitting | fit-curve is proven, handles corner detection; hand-rolling is error-prone |
| bezier-js | Manual de Casteljau implementation | bezier-js handles edge cases (degenerate curves, numerical stability); ~50KB but worth it |
| simplify-js | No pre-simplification | fit-curve handles large point sets, but pre-simplification improves speed for very long strokes |

**Installation:**
```bash
cd Application && npm install fit-curve bezier-js
```

**Type definitions:** `fit-curve` ships JS only -- needs a local `.d.ts` shim. `bezier-js` ships with TypeScript types.

## Architecture Patterns

### Data Model: BezierAnchor Type

```typescript
// New type in paint.ts
interface BezierAnchor {
  x: number;           // anchor point position
  y: number;
  pressure: number;    // preserved from original stroke data (D-05)
  handleIn: { x: number; y: number } | null;   // control point toward previous anchor
  handleOut: { x: number; y: number } | null;   // control point toward next anchor
  cornerMode?: boolean; // true = broken tangent (Alt+drag), false/undefined = smooth
}

// Extended PaintStroke (D-07)
interface PaintStroke {
  // ... existing fields ...
  anchors?: BezierAnchor[];  // When present, replaces points for rendering
}
```

**Key design points:**
- `handleIn`/`handleOut` are absolute coordinates (not relative offsets) -- simpler for drag math
- `null` handle means the handle is at the anchor position (no curvature on that side)
- First anchor has no `handleIn`, last anchor has no `handleOut` (open path)
- `cornerMode` tracks whether handles are decoupled (Alt+drag broke tangent)

### Recommended Module Structure

```
src/
├── types/
│   └── paint.ts                    # Add BezierAnchor interface, extend PaintStroke
├── lib/
│   └── bezierPath.ts               # Pure math: fitting, subdivision, deletion, segment projection
├── lib/
│   └── paintRenderer.ts            # Add renderBezierStroke() alongside existing renderStroke()
├── components/canvas/
│   └── PaintOverlay.tsx            # Add pen tool mode with anchor/handle/segment interaction
└── components/overlay/
    └── PaintToolbar.tsx            # Add pen tool button (PenTool icon from lucide-preact)
```

### Pattern 1: Freehand-to-Bezier Conversion (fit-curve)

**What:** Convert `[x, y, pressure][]` to `BezierAnchor[]` using Schneider's algorithm.
**When to use:** First time pen tool activates on a stroke that has `points` but no `anchors`.

```typescript
import fitCurve from 'fit-curve';

function pointsToBezierAnchors(
  points: [number, number, number][],
  tolerance: number = 4.0
): BezierAnchor[] {
  // Extract 2D positions for fit-curve (it expects [x,y][] )
  const positions = points.map(([x, y]) => [x, y]);

  // fit-curve returns array of cubic bezier segments:
  // each segment = [[x0,y0], [cp1x,cp1y], [cp2x,cp2y], [x3,y3]]
  const segments = fitCurve(positions, tolerance);

  const anchors: BezierAnchor[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i === 0) {
      // First segment: create first anchor with handleOut only
      const pressure = findNearestPressure(points, seg[0]);
      anchors.push({
        x: seg[0][0], y: seg[0][1],
        pressure,
        handleIn: null,
        handleOut: { x: seg[1][0], y: seg[1][1] },
      });
    }
    // End point of segment: handleIn from cp2, handleOut from next segment's cp1
    const pressure = findNearestPressure(points, seg[3]);
    const handleIn = { x: seg[2][0], y: seg[2][1] };
    const handleOut = (i < segments.length - 1)
      ? { x: segments[i + 1][1][0], y: segments[i + 1][1][1] }
      : null;
    anchors.push({
      x: seg[3][0], y: seg[3][1],
      pressure,
      handleIn,
      handleOut,
    });
  }
  return anchors;
}

function findNearestPressure(
  points: [number, number, number][],
  pos: number[]
): number {
  let minDist = Infinity;
  let pressure = 0.5;
  for (const [x, y, p] of points) {
    const d = (x - pos[0]) ** 2 + (y - pos[1]) ** 2;
    if (d < minDist) { minDist = d; pressure = p; }
  }
  return pressure;
}
```

### Pattern 2: Rendering Bezier Strokes

**What:** When `stroke.anchors` exists, render using Canvas2D `bezierCurveTo` instead of perfect-freehand.
**When to use:** In `paintRenderer.ts` `renderStroke()` function.

```typescript
function renderBezierStroke(ctx: CanvasRenderingContext2D, stroke: PaintStroke): void {
  const anchors = stroke.anchors!;
  if (anchors.length < 2) return;

  // Build variable-width outline from bezier path + pressure
  // Strategy: sample points along bezier at regular intervals,
  // interpolate pressure, then feed to perfect-freehand's getStroke
  const sampledPoints = sampleBezierPath(anchors, 2.0); // spacing in px
  const path = strokeToPath(sampledPoints, stroke.size, stroke.options);
  if (!path) return;

  ctx.save();
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
  } else {
    ctx.globalAlpha = stroke.opacity;
    ctx.fillStyle = stroke.color;
  }
  ctx.fill(path);
  ctx.restore();
}

// Re-densify bezier back to [x, y, pressure][] for perfect-freehand
function sampleBezierPath(
  anchors: BezierAnchor[],
  spacing: number
): [number, number, number][] {
  const result: [number, number, number][] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const cp1 = a.handleOut ?? { x: a.x, y: a.y };
    const cp2 = b.handleIn ?? { x: b.x, y: b.y };
    // Sample cubic bezier at regular t intervals
    const steps = Math.max(10, Math.ceil(
      Math.hypot(b.x - a.x, b.y - a.y) / spacing
    ));
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      const pt = cubicBezierPoint(a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y, u);
      const pressure = a.pressure + (b.pressure - a.pressure) * u;
      result.push([pt.x, pt.y, pressure]);
    }
  }
  return result;
}
```

### Pattern 3: Snapshot-Based Undo for Pen Tool

**What:** Follow Phase 23's snapshot-before/commit-on-release pattern.
**When to use:** Every drag gesture, point add, point delete.

```typescript
// On pointerdown (start dragging anchor/handle):
const snapshot = structuredClone(stroke.anchors);

// On pointermove: mutate anchors directly for real-time feedback

// On pointerup: push single undo action
pushAction({
  id: crypto.randomUUID(),
  description: 'Edit bezier anchor',
  timestamp: Date.now(),
  undo: () => {
    stroke.anchors = structuredClone(snapshot);
    _notifyVisualChange(layerId, frame);
  },
  redo: () => {
    stroke.anchors = structuredClone(currentAnchors);
    _notifyVisualChange(layerId, frame);
  },
});
```

### Pattern 4: Point Insertion via De Casteljau Subdivision

**What:** Insert a new anchor at a clicked position on a bezier segment.
**When to use:** User clicks on a curve segment with pen tool active (D-11).

```typescript
// Using bezier-js for precise subdivision
import { Bezier } from 'bezier-js';

function insertAnchorOnSegment(
  anchors: BezierAnchor[],
  segmentIndex: number,  // index of the anchor BEFORE the clicked segment
  t: number,             // parameter on the segment [0,1]
): BezierAnchor[] {
  const a = anchors[segmentIndex];
  const b = anchors[segmentIndex + 1];
  const cp1 = a.handleOut ?? { x: a.x, y: a.y };
  const cp2 = b.handleIn ?? { x: b.x, y: b.y };

  const bez = new Bezier(a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
  const split = bez.split(t);
  const left = split.left;
  const right = split.right;

  // Update anchor A's handleOut
  a.handleOut = { x: left.points[1].x, y: left.points[1].y };
  // New anchor at split point
  const pressure = a.pressure + (b.pressure - a.pressure) * t;
  const newAnchor: BezierAnchor = {
    x: left.points[3].x,
    y: left.points[3].y,
    pressure,
    handleIn: { x: left.points[2].x, y: left.points[2].y },
    handleOut: { x: right.points[1].x, y: right.points[1].y },
  };
  // Update anchor B's handleIn
  b.handleIn = { x: right.points[2].x, y: right.points[2].y };

  // Splice new anchor into array
  const result = [...anchors];
  result.splice(segmentIndex + 1, 0, newAnchor);
  return result;
}
```

### Pattern 5: Shape-to-Path Conversion (D-03, D-06)

**What:** Convert PaintShape to PaintStroke with bezier anchors when pen tool activates on a shape.
**When to use:** One-way conversion triggered by pen tool click on a shape element.

```typescript
function shapeToAnchors(shape: PaintShape): BezierAnchor[] {
  switch (shape.tool) {
    case 'line':
      return [
        { x: shape.x1, y: shape.y1, pressure: 0.5, handleIn: null, handleOut: null },
        { x: shape.x2, y: shape.y2, pressure: 0.5, handleIn: null, handleOut: null },
      ];
    case 'rect': {
      const x1 = Math.min(shape.x1, shape.x2);
      const y1 = Math.min(shape.y1, shape.y2);
      const x2 = Math.max(shape.x1, shape.x2);
      const y2 = Math.max(shape.y1, shape.y2);
      // 4 corners, null handles = straight segments
      return [
        { x: x1, y: y1, pressure: 0.5, handleIn: null, handleOut: null },
        { x: x2, y: y1, pressure: 0.5, handleIn: null, handleOut: null },
        { x: x2, y: y2, pressure: 0.5, handleIn: null, handleOut: null },
        { x: x1, y: y2, pressure: 0.5, handleIn: null, handleOut: null },
      ];
    }
    case 'ellipse': {
      // 4 quadrant points with handles approximating a circle
      // Magic number: 0.5522847498 (kappa) for cubic bezier circle approximation
      const cx = (shape.x1 + shape.x2) / 2;
      const cy = (shape.y1 + shape.y2) / 2;
      const rx = Math.abs(shape.x2 - shape.x1) / 2;
      const ry = Math.abs(shape.y2 - shape.y1) / 2;
      const k = 0.5522847498;
      return [
        { x: cx, y: cy - ry, pressure: 0.5,
          handleIn: { x: cx - rx * k, y: cy - ry },
          handleOut: { x: cx + rx * k, y: cy - ry } },
        { x: cx + rx, y: cy, pressure: 0.5,
          handleIn: { x: cx + rx, y: cy - ry * k },
          handleOut: { x: cx + rx, y: cy + ry * k } },
        { x: cx, y: cy + ry, pressure: 0.5,
          handleIn: { x: cx + rx * k, y: cy + ry },
          handleOut: { x: cx - rx * k, y: cy + ry } },
        { x: cx - rx, y: cy, pressure: 0.5,
          handleIn: { x: cx - rx, y: cy + ry * k },
          handleOut: { x: cx - rx, y: cy - ry * k } },
      ];
    }
  }
}
```

### Anti-Patterns to Avoid
- **Storing handles as relative offsets:** Use absolute coordinates. Relative offsets cause compounding errors during drag operations and make hit testing harder.
- **Modifying the original `points` array:** Bezier data replaces `points` for rendering but the original `points` field stays for backward compatibility on non-edited strokes.
- **Rendering bezier path as a filled outline path directly:** Re-sample bezier to dense points and feed through existing `getStroke()` / `strokeToPath()` for variable-width rendering with pressure. This preserves all existing stroke styling (thinning, smoothing, taper).
- **Creating undo entries during drag:** Only push undo on `pointerup`. Snapshot on `pointerdown`. Never on `pointermove`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Freehand to bezier conversion | Custom least-squares bezier fitter | `fit-curve` (Schneider algorithm) | Corner detection, tangent estimation, recursive subdivision are non-trivial; Schneider's algorithm is the standard |
| Bezier subdivision at parameter t | Manual de Casteljau implementation | `bezier-js` Bezier.split(t) | Handles degenerate cases, numerical precision, and also provides project() for nearest point |
| Nearest point on bezier curve | Manual Newton-Raphson iteration | `bezier-js` Bezier.project(point) | Finding nearest t on a cubic bezier is a root-finding problem with multiple local minima |
| Ellipse-to-bezier approximation | Manual kappa calculation | Use kappa constant 0.5522847498 | This is a well-known constant; no need for a library, but DO NOT compute it from scratch |

**Key insight:** The interactive UI (hit testing, dragging, visual overlay) is best hand-built because it must integrate tightly with the existing PaintOverlay gesture pipeline. The math (curve fitting, subdivision, projection) should use libraries.

## Common Pitfalls

### Pitfall 1: fit-curve Tolerance Too Tight
**What goes wrong:** Setting tolerance too low produces too many anchors (50+), defeating the purpose of simplification. Too high produces angular approximations.
**Why it happens:** Tolerance is in pixel units and depends on stroke scale and point density.
**How to avoid:** Start with tolerance=4.0 for typical strokes. Clamp result to 5-40 anchors. If > 40, increase tolerance and re-fit. If < 5 and stroke is complex, decrease tolerance.
**Warning signs:** More than 30 anchors on a simple curve, or visible deviation from original path.

### Pitfall 2: Handle Coupling Math Error
**What goes wrong:** When dragging one handle of a smooth point, the opposite handle must mirror the angle but maintain its own length. Beginners mirror both angle AND length, or break the 180-degree coupling.
**Why it happens:** The smooth constraint is: `handleIn` and `handleOut` must be collinear through the anchor point, at 180 degrees to each other.
**How to avoid:** On handle drag, compute new angle from anchor to dragged handle. Set opposite handle to same distance from anchor but at angle + PI. Preserve opposite handle's original distance.
**Warning signs:** Handles that "jump" when you start dragging, or curves that distort on the opposite side.

### Pitfall 3: Missing paintVersion Bump
**What goes wrong:** Bezier edits don't appear in the preview canvas because `paintVersion` signal was not bumped.
**Why it happens:** This is an established pattern but easy to forget in new code paths.
**How to avoid:** Every mutation that changes visual output must call `paintStore.paintVersion.value++`. Also call `paintStore.markDirty(layerId, frame)` and invalidate FX cache.
**Warning signs:** Edits visible on the overlay canvas but not in the rendered preview.

### Pitfall 4: Undo Flooding on Drag
**What goes wrong:** Each `pointermove` event creates an undo entry, filling the undo stack with hundreds of micro-steps.
**Why it happens:** Not following the snapshot-before/commit-on-release pattern from Phase 23.
**How to avoid:** Capture `structuredClone(anchors)` on `pointerdown`. Mutate in-place during `pointermove`. Push single undo action on `pointerup`.
**Warning signs:** User hits Ctrl+Z and sees tiny incremental position changes instead of reverting the full drag.

### Pitfall 5: Segment Hit Test Inaccuracy
**What goes wrong:** Clicking near a bezier curve does not register as a segment click for point insertion.
**Why it happens:** Simple distance-to-line checks don't work for curved paths. Need to project point onto actual bezier curve.
**How to avoid:** Use `bezier-js` `Bezier.project(point)` to find the nearest point on each segment. Compare distance against a hit threshold (8-12 pixels, adjusted for zoom).
**Warning signs:** User has to click exactly on the curve to insert a point; unusable with tablet.

### Pitfall 6: Shape Conversion Losing Visual Properties
**What goes wrong:** Converting a shape to a PaintStroke bezier loses filled state, rotation, or stroke width.
**Why it happens:** PaintShape has fields (`filled`, `rotation`, `strokeWidth`) that don't map 1:1 to PaintStroke.
**How to avoid:** When converting shape to stroke: apply rotation to anchor positions (bake it in), map `strokeWidth` to `size`, map `color`/`opacity` directly. For filled shapes, the stroke becomes a closed bezier path.
**Warning signs:** Shape visually changes color, size, or orientation after conversion.

### Pitfall 7: Persistence Breaking Backward Compat
**What goes wrong:** Old project files fail to load because the deserializer expects `anchors` field.
**Why it happens:** Adding a new optional field to PaintStroke.
**How to avoid:** `anchors` is optional (`anchors?: BezierAnchor[]`). Renderer checks `if (stroke.anchors)` and falls back to existing `points`-based rendering. Old files without `anchors` work unchanged.
**Warning signs:** Opening old projects shows blank strokes or crashes.

## Code Examples

### Canvas2D Bezier Overlay Rendering (Anchor/Handle Visuals)

```typescript
// Draw bezier editing overlay on the temp canvas
function drawBezierOverlay(
  ctx: CanvasRenderingContext2D,
  anchors: BezierAnchor[],
  selectedAnchorIdx: number | null,
  zoom: number,
): void {
  const anchorSize = 4 / zoom;  // constant screen size
  const handleRadius = 3 / zoom;
  const lineWidth = 1 / zoom;

  // Draw path segments (thin blue line showing the bezier path)
  ctx.save();
  ctx.strokeStyle = '#4A90D9';
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (anchors.length > 0) {
    ctx.moveTo(anchors[0].x, anchors[0].y);
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const cp1 = a.handleOut ?? { x: a.x, y: a.y };
      const cp2 = b.handleIn ?? { x: b.x, y: b.y };
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    }
  }
  ctx.stroke();
  ctx.restore();

  // Draw handles and anchor points
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const isSelected = i === selectedAnchorIdx;

    // Handle lines + circles
    ctx.save();
    ctx.strokeStyle = '#4A90D9';
    ctx.fillStyle = '#4A90D9';
    ctx.lineWidth = lineWidth;

    if (a.handleIn) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.handleIn.x, a.handleIn.y);
      ctx.stroke();
      // Round handle dot
      ctx.beginPath();
      ctx.arc(a.handleIn.x, a.handleIn.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (a.handleOut) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.handleOut.x, a.handleOut.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(a.handleOut.x, a.handleOut.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Square anchor point
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = isSelected ? '#4A90D9' : 'transparent';
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(a.x - anchorSize, a.y - anchorSize, anchorSize * 2, anchorSize * 2);
    ctx.fillRect(a.x - anchorSize, a.y - anchorSize, anchorSize * 2, anchorSize * 2);
    ctx.restore();
  }
}
```

### Smooth Handle Coupling (D-08)

```typescript
// When dragging handleOut, update handleIn to maintain 180-degree coupling
function updateCoupledHandle(
  anchor: BezierAnchor,
  draggedSide: 'in' | 'out',
  newHandlePos: { x: number; y: number },
  isAltHeld: boolean,
): void {
  if (draggedSide === 'out') {
    anchor.handleOut = { ...newHandlePos };
  } else {
    anchor.handleIn = { ...newHandlePos };
  }

  // Alt breaks tangent (D-08)
  if (isAltHeld) {
    anchor.cornerMode = true;
    return;
  }

  if (anchor.cornerMode) return; // already broken, don't re-couple

  // Mirror the opposite handle: same angle + PI, preserve its own length
  const opposite = draggedSide === 'out' ? 'handleIn' : 'handleOut';
  const current = draggedSide === 'out' ? anchor.handleOut! : anchor.handleIn!;
  const otherHandle = anchor[opposite];

  const angle = Math.atan2(current.y - anchor.y, current.x - anchor.x);
  const oppositeAngle = angle + Math.PI;

  if (otherHandle) {
    const dist = Math.hypot(otherHandle.x - anchor.x, otherHandle.y - anchor.y);
    anchor[opposite] = {
      x: anchor.x + Math.cos(oppositeAngle) * dist,
      y: anchor.y + Math.sin(oppositeAngle) * dist,
    };
  }
}
```

### Segment Dragging Algorithm (D-10)

```typescript
// Drag a point on the curve between two anchors.
// Adjust the two control handles (handleOut of A, handleIn of B) to pass through the drag point.
function dragSegment(
  anchorA: BezierAnchor,
  anchorB: BezierAnchor,
  t: number,           // parameter of the dragged point on the segment
  targetPos: { x: number; y: number },
): void {
  // Current point at t on the bezier
  const cp1 = anchorA.handleOut ?? { x: anchorA.x, y: anchorA.y };
  const cp2 = anchorB.handleIn ?? { x: anchorB.x, y: anchorB.y };
  const currentPt = cubicBezierPoint(
    anchorA.x, anchorA.y, cp1.x, cp1.y, cp2.x, cp2.y, anchorB.x, anchorB.y, t
  );

  // Delta from current position to target
  const dx = targetPos.x - currentPt.x;
  const dy = targetPos.y - currentPt.y;

  // Distribute delta to both handles proportionally
  // Weight by (1-t) for handleOut, t for handleIn
  const w1 = 1 - t;
  const w2 = t;
  anchorA.handleOut = {
    x: cp1.x + dx * w1,
    y: cp1.y + dy * w1,
  };
  anchorB.handleIn = {
    x: cp2.x + dx * w2,
    y: cp2.y + dy * w2,
  };
}

function cubicBezierPoint(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
    y: mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
  };
}
```

### Anchor Deletion with Smooth Reconnection (D-12)

```typescript
function deleteAnchor(anchors: BezierAnchor[], idx: number): BezierAnchor[] {
  if (anchors.length <= 2) return anchors; // Cannot delete below 2 anchors

  const result = [...anchors];
  result.splice(idx, 1);

  // Auto-adjust handles of neighbors for smooth reconnection
  if (idx > 0 && idx < result.length) {
    const prev = result[idx - 1];
    const next = result[idx];
    // Point handles toward each other at 1/3 distance (smooth approximation)
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    prev.handleOut = { x: prev.x + dx / 3, y: prev.y + dy / 3 };
    next.handleIn = { x: next.x - dx / 3, y: next.y - dy / 3 };
  }

  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Quadratic bezier through midpoints (paintRenderer.ts) | Cubic bezier from anchor data | This phase | Cubic beziers give independent control over entry/exit tangents at each point; essential for an editing UI |
| perfect-freehand direct rendering | Bezier-to-points re-sampling then perfect-freehand | This phase | Keeps existing stroke styling (pressure, thinning, taper) while allowing bezier editing |
| PaintShape as separate type | Shape converts to PaintStroke with anchors | This phase | One-way conversion simplifies the data model -- once edited, everything is a stroke with bezier data |

## Open Questions

1. **fit-curve tolerance calibration**
   - What we know: Tolerance is in pixel-space distance. fit-curve docs suggest values around 50 for rough fit, lower for precise.
   - What's unclear: Optimal default for typical freehand strokes in this editor (strokes are in project-space coords, not screen pixels). Will need empirical tuning.
   - Recommendation: Start with tolerance=4.0, expose as internal constant, adjust based on testing.

2. **Closed paths for converted shapes**
   - What we know: Rect and ellipse shapes are closed. Line is open.
   - What's unclear: Whether bezier anchor array should have a `closed` flag, or just duplicate first/last anchor.
   - Recommendation: Add an optional `closed?: boolean` field next to `anchors`. When true, renderer draws a segment from last anchor back to first. Simpler than duplicating anchors.

3. **FX cache invalidation for bezier-edited strokes**
   - What we know: FX strokes use p5.brush frame cache. Editing bezier anchors changes the path.
   - What's unclear: Whether p5.brush can render from bezier anchor data or only from dense points.
   - Recommendation: Re-sample bezier to dense points before passing to p5.brush adapter, same as for Canvas2D rendering. Invalidate FX cache on every bezier edit commit.

## Sources

### Primary (HIGH confidence)
- Project codebase: `paint.ts`, `paintRenderer.ts`, `paintStore.ts`, `PaintOverlay.tsx`, `paintPersistence.ts`, `PaintToolbar.tsx`, `shortcuts.ts` -- direct code analysis
- Phase 23 CONTEXT.md -- snapshot-before/commit-on-release undo pattern
- Phase 24 CONTEXT.md -- selection sync, visibility conventions

### Secondary (MEDIUM confidence)
- [fit-curve npm](https://www.npmjs.com/package/fit-curve) -- Schneider algorithm implementation, v0.2.0
- [bezier-js](https://pomax.github.io/bezierjs/) -- Bezier curve utilities, v6.1.4
- [Simplify.js](https://mourner.github.io/simplify-js/) -- RDP simplification, v1.2.4
- [A Primer on Bezier Curves](https://pomax.github.io/bezierinfo/) -- Comprehensive bezier math reference
- [Illustrator-style handles gist](https://gist.github.com/paulkaplan/6050105) -- Reference implementation pattern
- [Konva bezier anchor demo](https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html) -- Drag handle interaction pattern

### Tertiary (LOW confidence)
- Segment dragging algorithm -- derived from first principles (proportional handle adjustment). May need refinement based on user testing. Real implementations often use more sophisticated constraint solving.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- fit-curve and bezier-js are well-established, actively used packages
- Architecture: HIGH -- directly derived from existing codebase patterns (PaintOverlay gesture pipeline, snapshot undo, PaintStroke type extension)
- Pitfalls: HIGH -- based on direct code analysis (paintVersion pattern, persistence format, hit testing)
- Algorithms (segment drag, handle coupling): MEDIUM -- standard techniques but segment drag proportional weighting may need empirical tuning

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain, no rapidly moving dependencies)
