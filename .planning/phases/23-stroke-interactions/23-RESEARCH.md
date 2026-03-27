# Phase 23: Stroke Interactions - Research

**Researched:** 2026-03-27
**Domain:** Paint stroke transforms, duplication, and undo/redo in Canvas 2D overlay
**Confidence:** HIGH

## Summary

Phase 23 adds Alt+drag duplication, non-uniform (edge-handle) scale, and undo/redo for all transform gestures in the PaintOverlay select tool. The entire feature set lives in a single file (`PaintOverlay.tsx`) and the supporting store (`paintStore.ts`), with a well-established history system (`history.ts`) providing `pushAction` and `startCoalescing`/`stopCoalescing`.

The critical finding is that **all three existing transform gestures (drag-move, uniform corner scale, rotate) currently have zero undo support** -- they mutate stroke points in place with no history entry. Decision D-08 requires retrofitting undo onto all of these, plus the two new gestures. The snapshot-before/commit-on-release pattern (D-07) and the existing `startCoalescing`/`stopCoalescing` API are the right tools for this.

A secondary finding is that **all current selection, hit-testing, and transform code only handles `tool === 'brush'` elements** (PaintStroke). Decision D-02 requires duplicate to work on all element types (strokes, shapes, fills), requiring the hit-test and bounding-box functions to be generalized.

**Primary recommendation:** Implement in three logical waves: (1) retrofit undo onto existing transforms and generalize element handling, (2) add Alt+drag duplicate, (3) add non-uniform edge-handle scale. This ordering ensures undo infrastructure is stable before new features build on it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Alt+drag on a selected element creates a clone at the original position, then drags the clone to the drop point. Original stays in place. Illustrator/Figma-style behavior.
- **D-02:** Duplicate works on ALL selected element types (strokes, shapes, fills), not just brush strokes.
- **D-03:** Multi-selection supported -- Alt+drag with multiple elements selected clones them all, preserving relative positions. One undo entry for the whole batch.
- **D-04:** Add 4 edge midpoint handles (top, right, bottom, left) for single-axis stretch. Keep existing 4 corner handles for uniform scale. 8 handles total + rotate handle.
- **D-05:** Edge handles scale from the opposite edge (anchor opposite side stays fixed). Dragging the right edge stretches rightward while the left edge stays put.
- **D-06:** Brush size stays fixed during non-uniform scale -- only point positions change. Stretch changes shape but not stroke thickness.
- **D-07:** Snapshot-before, commit-on-release pattern: capture a deep copy of affected elements' points before gesture starts. On pointer-up, push one undo entry that restores the snapshot. Matches existing addElement/removeElement pushAction pattern.
- **D-08:** Retrofit undo onto ALL existing transform gestures: drag-move, uniform corner scale, rotate -- plus the new Alt+duplicate and non-uniform edge scale. Comprehensive fix for consistency.
- **D-09:** One undo entry per gesture (not per pointer-move frame). Ctrl+Z restores to pre-gesture state.

### Claude's Discretion
- Edge handle visual style (size, shape, color differentiation from corner handles)
- Cursor changes for edge handles (ew-resize, ns-resize) vs corner handles
- Alt key visual indicator (if any) during duplicate drag
- Snapshot cloning strategy (structuredClone vs manual deep copy of points arrays)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PINT-01 | User can duplicate a stroke with Alt+move on the same frame in roto paint edit mode | Alt+drag detection in handleSelectPointerDown, deep clone via structuredClone, batch addElement with single undo entry |
| PINT-02 | User can apply non-uniform scale to individual paint strokes | Edge midpoint handles in hitTestHandle, single-axis scaling math with opposite-edge anchor in handlePointerMove transform block |
</phase_requirements>

## Architecture Patterns

### Current PaintOverlay Transform Architecture

The select tool uses a ref-based state machine in `PaintOverlay.tsx`:

```
handleSelectPointerDown:
  1. Check transform handles (rotate handle, corner handles)
  2. Check stroke hit-test (findStrokeAtPoint)
  3. Route to: isTransforming + transformType, isDragging, or selection change

handlePointerMove:
  - isTransforming + 'rotate' -> apply rotation delta to all selected stroke points
  - isTransforming + 'scale'  -> apply uniform scale to all selected stroke points + size
  - isDragging               -> translate all selected stroke points by delta

handlePointerUp:
  - Clear transform/drag refs
  - Re-render FX cache
  - Release pointer capture
```

**Key refs:**
- `isTransforming: useRef(false)` -- gate for scale/rotate
- `transformType: useRef<'scale' | 'rotate' | null>(null)` -- discriminator
- `transformCorner: useRef<string>('')` -- which handle was grabbed
- `transformCenter: useRef<{x,y}>` -- pivot point for scale/rotate
- `isDragging: useRef(false)` -- gate for drag-move
- `dragStart: useRef<{x,y} | null>(null)` -- previous pointer position for delta

### Pattern: Snapshot-Before / Commit-On-Release (D-07)

This is the core undo pattern for all transforms. Implementation approach:

```typescript
// New ref for transform undo
const transformSnapshot = useRef<Map<string, any> | null>(null);

// On gesture start (pointerdown):
transformSnapshot.current = captureSnapshot(paintFrame, selected);

// On pointer-move: mutate points directly (no pushAction per frame)

// On pointer-up: commit single undo entry
const before = transformSnapshot.current;
const after = captureSnapshot(paintFrame, selected);
pushAction({
  id: crypto.randomUUID(),
  description: 'Transform strokes',
  timestamp: Date.now(),
  undo: () => { restoreSnapshot(before); _notifyVisualChange(); },
  redo: () => { restoreSnapshot(after); _notifyVisualChange(); },
});
transformSnapshot.current = null;
```

### Pattern: Deep Clone Strategy (Discretion Area)

**Recommendation: `structuredClone` for the snapshot.** Rationale:
- Already used throughout the codebase (6+ instances in assetRemoval.ts, sequenceStore.ts, audioStore.ts)
- PaintStroke.points is `[number, number, number][]` -- plain data, no class instances, no functions
- PaintShape/PaintFill are also plain objects
- Performance: snapshots are per-gesture (not per-frame), so clone cost is negligible

```typescript
function captureElementSnapshot(elements: PaintElement[], ids: Set<string>): Map<string, PaintElement> {
  const snapshot = new Map<string, PaintElement>();
  for (const el of elements) {
    if (ids.has(el.id)) {
      snapshot.set(el.id, structuredClone(el));
    }
  }
  return snapshot;
}

function restoreElementSnapshot(
  elements: PaintElement[],
  snapshot: Map<string, PaintElement>,
): void {
  for (let i = 0; i < elements.length; i++) {
    const saved = snapshot.get(elements[i].id);
    if (saved) {
      elements[i] = structuredClone(saved);
    }
  }
}
```

### Pattern: Alt+Drag Duplicate (D-01, D-02, D-03)

Detection point: `handleSelectPointerDown`, after handle check, when clicking on an already-selected element.

```typescript
// In handleSelectPointerDown, when hit is on already-selected element:
if (selected.has(hitStrokeId)) {
  if (e.altKey) {
    // Clone all selected elements
    const clones = cloneSelectedElements(paintFrame, selected);
    // Add clones to frame (originals stay at original positions)
    for (const clone of clones) {
      frameData.elements.push(clone);
    }
    // Update selection to clones (user will drag clones, not originals)
    paintStore.selectedStrokeIds.value = new Set(clones.map(c => c.id));
    // Begin drag of clones
    isDragging.current = true;
    dragStart.current = {x: point.x, y: point.y};
    // Snapshot for undo: removing clones restores original state
  }
}
```

### Pattern: Non-Uniform Edge Scale (D-04, D-05, D-06)

Edge handles are positioned at midpoints of bounding box edges. Scale uses opposite-edge anchor.

```typescript
// Edge handle positions (midpoints)
const edges: [string, number, number][] = [
  ['t',  (minX + maxX) / 2, minY],           // top
  ['r',  maxX,              (minY + maxY) / 2], // right
  ['b',  (minX + maxX) / 2, maxY],           // bottom
  ['l',  minX,              (minY + maxY) / 2], // left
];

// Non-uniform scale math (e.g., dragging right edge):
// anchor = left edge X (bounds.minX)
// newWidth = point.x - anchor
// scaleX = newWidth / originalWidth
// For each point: point.x = anchor + (point.x - anchor) * scaleX
// point.y unchanged (single-axis)
```

### Anti-Patterns to Avoid

- **Mutating points without snapshot:** Every transform gesture MUST capture a snapshot on pointerdown. The existing code mutates points in place during every pointer-move -- this is fine for live updates, but without a snapshot the original positions are lost forever.
- **pushAction per pointer-move frame:** This would flood the undo stack. Use snapshot-before/commit-on-release (D-07, D-09).
- **Scaling brush size during non-uniform scale:** D-06 explicitly forbids this. Only point positions change. (Note: existing uniform scale DOES scale brush size -- that behavior stays for corner handles only.)
- **Using coalescing for transform undo:** The `startCoalescing`/`stopCoalescing` API is designed for cases where each frame pushes a separate action. Transform gestures only push ONE action on pointer-up, so coalescing is unnecessary and would add complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep cloning paint elements | Manual point-by-point copy | `structuredClone()` | Already standard in codebase; handles nested arrays/objects correctly |
| Undo coalescing | Custom frame-by-frame coalescing | Single pushAction on pointer-up | Simpler than coalescing; matches D-07/D-09 requirement |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used everywhere in paintStore |
| FX cache invalidation | Manual cache management | `paintStore.invalidateFrameFxCache()` + `reRenderFrameFx()` | Established pattern already in PaintOverlay |

**Key insight:** The existing codebase has all the infrastructure needed. This phase is about wiring existing patterns (pushAction, structuredClone, invalidateFrameFxCache) into the transform gesture lifecycle, plus adding new handle geometry and duplication logic.

## Common Pitfalls

### Pitfall 1: Forgetting _notifyVisualChange in undo/redo closures
**What goes wrong:** Undo/redo restores point data but canvas doesn't repaint.
**Why it happens:** The undo/redo closures restore snapshot data but forget to bump `paintVersion`, `markDirty`, and `invalidateFrameFxCache`.
**How to avoid:** Every undo/redo closure must call the three-step notification: `_notifyVisualChange` helper (which does paintVersion++ and markDirty) plus `invalidateFrameFxCache`. Since `_notifyVisualChange` is internal to paintStore, the PaintOverlay undo closures must replicate the three calls manually: `paintStore.markDirty(layerId, frame); paintStore.paintVersion.value++; paintStore.invalidateFrameFxCache(layerId, frame);`.
**Warning signs:** Undo appears to do nothing (data restored but canvas stale).

### Pitfall 2: Only handling brush strokes in duplicate (D-02 violation)
**What goes wrong:** Alt+drag only clones brush strokes, ignoring shapes and fills.
**Why it happens:** All existing select/transform code uses `if (el.tool !== 'brush') continue`. Copy-pasting this pattern into duplicate logic would skip shapes/fills.
**How to avoid:** For duplication, iterate ALL elements in the selection, not just brushes. The clone function must handle all three PaintElement union types. For hit-testing and bounding-box calculation, also generalize beyond brush-only.
**Warning signs:** User selects a shape, Alt+drags, nothing duplicates.

### Pitfall 3: Snapshot captures references instead of deep copies
**What goes wrong:** Undo restores the "snapshot" but it contains the same mutated data because the snapshot holds references to the same point arrays.
**Why it happens:** Shallow copy of PaintStroke copies the `points` array reference, not the array contents.
**How to avoid:** Use `structuredClone()` which deep-clones everything. Verify in tests that modifying points after snapshot doesn't affect the snapshot.
**Warning signs:** Undo "works" but restores the current state instead of the original.

### Pitfall 4: Transform center shifts during drag but pivot should stay fixed
**What goes wrong:** During non-uniform scale, the anchor edge visually drifts because the bounding box is recalculated each frame.
**Why it happens:** If the scale anchor is recalculated from current bounds on each pointer-move, accumulated floating-point error causes drift.
**How to avoid:** Capture the anchor position (opposite edge coordinate) on pointer-down and store it in a ref. Use that fixed anchor for all subsequent scale calculations during the gesture.
**Warning signs:** The "fixed" edge slowly moves during a scale drag.

### Pitfall 5: Alt+drag on unselected element does nothing
**What goes wrong:** User expects Alt+click-and-drag to select + duplicate in one action, but the code only checks altKey when clicking on an already-selected element.
**Why it happens:** The current flow is: unselected click -> select, then next click on selected -> can start drag. Alt is only checked in the "already selected" branch.
**How to avoid:** When Alt+clicking on an unselected element, auto-select it first, then proceed to duplicate+drag. Alternatively, require selection first (Illustrator behavior). The decision D-01 says "on a selected element", so selection must precede Alt+drag.
**Warning signs:** User frustration at two-step workflow. Note: this matches Illustrator behavior where selection is prerequisite.

### Pitfall 6: Non-uniform scale applies to all axes for shapes (PaintShape)
**What goes wrong:** PaintShape has `x1,y1,x2,y2` coordinates, not a points array. Scale logic written for PaintStroke (array of points) won't work on PaintShape.
**Why it happens:** PaintShape and PaintStroke have different data structures.
**How to avoid:** The scale function must branch on element type: for PaintStroke, scale the `points` array; for PaintShape, scale the `x1,y1,x2,y2` coordinates; for PaintFill, scale the `x,y` click point.
**Warning signs:** Shape elements throw errors or don't scale.

## Code Examples

### Generalizing hitTestHandle for edge midpoints

```typescript
// Source: PaintOverlay.tsx lines 115-130 (current), extended per D-04
function hitTestHandle(
  x: number, y: number,
  bounds: {minX: number; minY: number; maxX: number; maxY: number},
): string | null {
  const hs = HANDLE_SIZE + 3;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  // Corner handles (uniform scale) -- existing
  const corners: [string, number, number][] = [
    ['tl', bounds.minX, bounds.minY],
    ['tr', bounds.maxX, bounds.minY],
    ['bl', bounds.minX, bounds.maxY],
    ['br', bounds.maxX, bounds.maxY],
  ];
  for (const [name, cx, cy] of corners) {
    if (Math.abs(x - cx) <= hs && Math.abs(y - cy) <= hs) return name;
  }

  // Edge midpoint handles (non-uniform scale) -- new per D-04
  const edges: [string, number, number][] = [
    ['t', midX, bounds.minY],
    ['r', bounds.maxX, midY],
    ['b', midX, bounds.maxY],
    ['l', bounds.minX, midY],
  ];
  for (const [name, cx, cy] of edges) {
    if (Math.abs(x - cx) <= hs && Math.abs(y - cy) <= hs) return name;
  }

  return null;
}
```

### Non-uniform scale math (single-axis, opposite-edge anchor)

```typescript
// Dragging edge 'r' (right): scale X only, anchor at left edge
// anchorX captured on pointerdown = bounds.minX
// originalWidth captured on pointerdown = bounds.maxX - bounds.minX

const newWidth = point.x - anchorX;
const scaleX = newWidth / originalWidth;

for (const el of paintFrame.elements) {
  if (!selected.has(el.id)) continue;
  if (el.tool === 'brush') {
    const stroke = el as PaintStroke;
    for (let i = 0; i < stroke.points.length; i++) {
      stroke.points[i] = [
        anchorX + (stroke.points[i][0] - anchorX) * scaleX,
        stroke.points[i][1],  // Y unchanged
        stroke.points[i][2],  // pressure unchanged
      ];
    }
    // D-06: brush size stays fixed (no size *= scaleX)
  } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
    const shape = el as PaintShape;
    shape.x1 = anchorX + (shape.x1 - anchorX) * scaleX;
    shape.x2 = anchorX + (shape.x2 - anchorX) * scaleX;
  } else if (el.tool === 'fill') {
    const fill = el as PaintFill;
    fill.x = anchorX + (fill.x - anchorX) * scaleX;
  }
}
```

### Alt+Drag duplicate with batch undo

```typescript
// In handleSelectPointerDown, when hitStrokeId is in selected set:
if (e.altKey) {
  const clones: PaintElement[] = [];
  const cloneIdMap = new Map<string, string>(); // old ID -> new ID

  for (const el of paintFrame.elements) {
    if (!selected.has(el.id)) continue;
    const clone = structuredClone(el);
    clone.id = crypto.randomUUID();
    cloneIdMap.set(el.id, clone.id);
    clones.push(clone);
  }

  // Add clones to frame
  const frameData = paintStore.getFrame(layerId, frame)!;
  for (const clone of clones) {
    frameData.elements.push(clone);
  }

  // Switch selection to clones
  paintStore.selectedStrokeIds.value = new Set(clones.map(c => c.id));

  // Push single undo entry for entire batch
  const cloneIds = clones.map(c => c.id);
  pushAction({
    id: crypto.randomUUID(),
    description: `Duplicate ${clones.length} element(s)`,
    timestamp: Date.now(),
    undo: () => {
      const f = paintStore.getFrame(layerId, frame);
      if (f) {
        f.elements = f.elements.filter(e => !cloneIds.includes(e.id));
        paintStore.markDirty(layerId, frame);
        paintStore.paintVersion.value++;
        paintStore.invalidateFrameFxCache(layerId, frame);
      }
    },
    redo: () => {
      const f = paintStore.getFrame(layerId, frame);
      if (f) {
        for (const clone of clones) f.elements.push(structuredClone(clone));
        paintStore.markDirty(layerId, frame);
        paintStore.paintVersion.value++;
        paintStore.invalidateFrameFxCache(layerId, frame);
      }
    },
  });

  // Start dragging the clones
  isDragging.current = true;
  dragStart.current = {x: point.x, y: point.y};
  // Snapshot for the drag's undo will be captured separately
}
```

### Edge handle rendering (visual differentiation)

```typescript
// Recommendation: slightly smaller circular handles for edges (vs square corners)
const EDGE_HANDLE_RADIUS = 3;

const edges: [number, number][] = [
  [(minX + maxX) / 2, minY],           // top
  [maxX, (minY + maxY) / 2],           // right
  [(minX + maxX) / 2, maxY],           // bottom
  [minX, (minY + maxY) / 2],           // left
];
for (const [cx, cy] of edges) {
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#4A90D9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, EDGE_HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
```

### Cursor changes for handles

```typescript
// Recommendation: set cursor based on which handle is hovered
function cursorForHandle(handleName: string): string {
  switch (handleName) {
    case 't': case 'b': return 'ns-resize';
    case 'l': case 'r': return 'ew-resize';
    case 'tl': case 'br': return 'nwse-resize';
    case 'tr': case 'bl': return 'nesw-resize';
    default: return 'default';
  }
}
```

## Existing Code Gaps

### Gap 1: Selection only handles brush strokes

All code paths in PaintOverlay use `if (el.tool !== 'brush') continue`:
- `findStrokeAtPoint()` (line 59) -- only brush
- `getSelectionBounds()` (line 95) -- only brush
- All transform loops (lines 746, 765, 802) -- only brush
- All FX application loops (lines 1028, 1050, 1087) -- only brush

**Impact on D-02:** Duplicate must work on shapes and fills too. Functions need generalization.

**Recommended approach:** Generalize `findStrokeAtPoint` to `findElementAtPoint` (handle shape bounding boxes, fill click points). Generalize `getSelectionBounds` to include shapes (x1/y1/x2/y2) and fills (x/y point). Transform loops must handle point mutation differently per element type.

### Gap 2: No undo for any transform gesture

None of the transform code paths (drag, scale, rotate) in PaintOverlay call `pushAction`. Lines 727-821 (transform and drag handlers) and lines 880-921 (pointer-up finalization) have no undo logic.

**Impact on D-07, D-08, D-09:** Critical. All five gestures need undo.

### Gap 3: transformType only supports 'scale' | 'rotate'

The `transformType` ref is typed as `'scale' | 'rotate' | null`. Non-uniform scale needs a new discriminator (e.g., `'edge-scale'`) or the existing `'scale'` type with a subtype indicator via `transformCorner` containing 't', 'r', 'b', 'l' for edges vs 'tl', 'tr', 'bl', 'br' for corners.

**Recommended approach:** Keep `transformType` as `'scale'` for both uniform and non-uniform. Use `transformCorner` value to distinguish: single-letter = edge (non-uniform), two-letter = corner (uniform). This minimizes type changes.

## Open Questions

1. **Duplicate + drag undo interaction**
   - What we know: D-03 says one undo entry for the batch duplicate. D-07 says snapshot-before/commit-on-release for transforms. The Alt+drag combines both (duplicate + immediate drag).
   - What's unclear: Should Ctrl+Z after Alt+drag undo BOTH the duplicate AND the drag position in one step? Or should it be two undo entries (one for duplicate, one for drag)?
   - Recommendation: Single undo entry that removes the clones entirely (restores to pre-Alt+drag state). The alternative (two entries) would leave orphaned clones at the original position on first undo, which is confusing. Capture the undo as "remove clones" on pointer-up, not as separate duplicate+move.

2. **Generalizing element handling scope**
   - What we know: D-02 says duplicate works on all element types. Current code is brush-only.
   - What's unclear: Should this phase also generalize drag-move, scale, and rotate to support shapes/fills? Or only generalize for duplicate?
   - Recommendation: Generalize all transform operations to support all element types while we're touching the code. The additional effort is minimal (just branching per element type in the transform loops) and prevents inconsistency.

## Project Constraints (from CLAUDE.md)

- Find GSD tools from `.claude/get-shit-done`, NOT from `$HOME/.claude/get-shit-done`
- Do NOT run the dev server -- user runs it separately
- Use p5.brush for brush FX rendering (not relevant to this phase -- transforms don't re-render FX)
- Always bump paintVersion for any visual paint change
- Guard shortcuts in paint mode -- check isPaintEditMode() for conflicting keys

## Sources

### Primary (HIGH confidence)
- `Application/src/components/canvas/PaintOverlay.tsx` -- full read of all 1224 lines, all transform/select/drag logic
- `Application/src/stores/paintStore.ts` -- full read of all 601 lines, addElement, removeElement, pushAction pattern, _notifyVisualChange
- `Application/src/types/paint.ts` -- full read, PaintStroke/PaintShape/PaintFill union, PaintElement type
- `Application/src/lib/history.ts` -- full read, pushAction, startCoalescing/stopCoalescing, undo/redo
- `Application/src/types/history.ts` -- HistoryEntry interface

### Secondary (MEDIUM confidence)
- Grep audit of `structuredClone` usage across codebase (6+ instances confirming it as standard pattern)
- Grep audit of `altKey` usage (4 instances, none in PaintOverlay currently)
- Grep audit of `startCoalescing`/`stopCoalescing` usage (20+ instances across 7 files)

## Metadata

**Confidence breakdown:**
- Architecture: HIGH -- full source code read of all relevant files, patterns clear
- Pitfalls: HIGH -- derived from actual code analysis showing real gaps (no undo, brush-only filtering)
- Implementation patterns: HIGH -- code examples derived from existing patterns in the same codebase

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- internal codebase, no external dependency changes)
