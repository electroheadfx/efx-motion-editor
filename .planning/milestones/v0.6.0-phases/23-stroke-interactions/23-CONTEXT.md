# Phase 23: Stroke Interactions - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Alt+duplicate stroke and non-uniform scale transform for paint strokes in roto paint edit mode. Also retrofit undo/redo onto all existing transform gestures (drag-move, uniform scale, rotate) that currently lack it.

</domain>

<decisions>
## Implementation Decisions

### Alt+Drag Duplicate (PINT-01)
- **D-01:** Alt+drag on a selected element creates a clone at the original position, then drags the clone to the drop point. Original stays in place. Illustrator/Figma-style behavior.
- **D-02:** Duplicate works on ALL selected element types (strokes, shapes, fills), not just brush strokes.
- **D-03:** Multi-selection supported — Alt+drag with multiple elements selected clones them all, preserving relative positions. One undo entry for the whole batch.

### Non-Uniform Scale (PINT-02)
- **D-04:** Add 4 edge midpoint handles (top, right, bottom, left) for single-axis stretch. Keep existing 4 corner handles for uniform scale. 8 handles total + rotate handle.
- **D-05:** Edge handles scale from the opposite edge (anchor opposite side stays fixed). Dragging the right edge stretches rightward while the left edge stays put.
- **D-06:** Brush size stays fixed during non-uniform scale — only point positions change. Stretch changes shape but not stroke thickness.

### Undo/Redo for Transforms
- **D-07:** Snapshot-before, commit-on-release pattern: capture a deep copy of affected elements' points before gesture starts. On pointer-up, push one undo entry that restores the snapshot. Matches existing addElement/removeElement pushAction pattern.
- **D-08:** Retrofit undo onto ALL existing transform gestures: drag-move, uniform corner scale, rotate — plus the new Alt+duplicate and non-uniform edge scale. Comprehensive fix for consistency.
- **D-09:** One undo entry per gesture (not per pointer-move frame). Ctrl+Z restores to pre-gesture state.

### Claude's Discretion
- Edge handle visual style (size, shape, color differentiation from corner handles)
- Cursor changes for edge handles (ew-resize, ns-resize) vs corner handles
- Alt key visual indicator (if any) during duplicate drag
- Snapshot cloning strategy (structuredClone vs manual deep copy of points arrays)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint interaction code
- `Application/src/components/canvas/PaintOverlay.tsx` — Select tool handler, drag-move, uniform scale, rotate, hit-test, getSelectionBounds, hitTestHandle (all transform gestures live here)
- `Application/src/stores/paintStore.ts` — addElement, removeElement, selectedStrokeIds, pushAction undo pattern, paintVersion signal, markDirty, invalidateFrameFxCache
- `Application/src/types/paint.ts` — PaintElement union (PaintStroke, PaintShape, PaintFill), PaintFrame

### Established patterns
- `Application/src/stores/paintStore.ts` — _notifyVisualChange helper (paintVersion++ + markDirty + invalidateFrameFxCache), pushAction snapshot/restore pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSelectionBounds()` in PaintOverlay: computes bounding box of selected strokes — reuse for edge handle positions (midpoints of edges)
- `hitTestHandle()` in PaintOverlay: checks corner handles — extend to include edge midpoints
- `findStrokeAtPoint()` in PaintOverlay: hit-tests strokes for selection
- `addElement()` in paintStore: already supports adding cloned elements with full undo
- `_notifyVisualChange()` in paintStore: encapsulates paintVersion++ + markDirty + invalidateFrameFxCache

### Established Patterns
- Transform gestures use `isTransforming` ref + `transformType` ref to route pointer-move behavior
- `transformCenter` ref stores the pivot point for scale/rotate operations
- `isDragging` ref + `dragStart` ref for drag-to-move
- All paint mutations must call `paintStore.paintVersion.value++` for reactivity
- `pushAction()` for undo/redo with snapshot/restore via structuredClone or manual copy

### Integration Points
- `handleSelectPointerDown()` in PaintOverlay: where Alt key detection and handle hit-testing must be added
- `handlePointerMove()` in PaintOverlay: where non-uniform scale and duplicate-drag logic runs
- `handlePointerUp()` in PaintOverlay: where undo entries must be committed on gesture end
- Selection rendering in PaintOverlay's paint loop: where edge handle visuals must be drawn

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-stroke-interactions*
*Context gathered: 2026-03-27*
