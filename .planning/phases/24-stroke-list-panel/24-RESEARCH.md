# Phase 24: Stroke List Panel - Research

**Researched:** 2026-03-27
**Domain:** Preact UI component, SortableJS drag-and-drop, paint store state management
**Confidence:** HIGH

## Summary

Phase 24 adds a stroke list panel inside PaintProperties that shows all paint elements (strokes, shapes, fills) for the current frame when in select tool mode. The implementation follows well-established patterns already in the codebase: SortableJS for drag reorder (SequenceList, LayerList), CollapsibleSection for the panel header, Preact signals for state, and the pushAction undo system.

The main work involves: (1) adding an optional `visible` field to PaintElement types, (2) creating a new StrokeList component with SortableJS, (3) adding a `reorderElements` method to paintStore, (4) filtering hidden elements in the render pipeline and hit-testing, and (5) wiring bidirectional selection sync between the list and canvas.

**Primary recommendation:** Follow the LayerList component pattern closely -- it already implements SortableJS drag reorder, visibility toggle (Eye/EyeOff), selection highlighting, and delete -- adapted for PaintElements instead of Layers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stroke list lives as a new STROKES collapsible section inside PaintProperties, visible only in SELECT tool mode. Uses existing CollapsibleSection pattern.
- **D-02:** STROKES section appears at the top of PaintProperties (above the existing Select All/Delete Selected row) when in select mode. Shows element count in the header: "STROKES (N)".
- **D-03:** Auto-label strokes by tool type + sequential index: "Brush 1", "Line 2", "Fill 3", "Eraser 4". Index is the element's position in the frame's elements array.
- **D-04:** Each row shows a color swatch dot next to the label, reflecting the stroke's color property.
- **D-05:** Add an optional `visible` field to PaintElement types (PaintStroke, PaintShape, PaintFill). Default `true` when undefined for backward compatibility with existing data.
- **D-06:** Hidden strokes are fully hidden on canvas -- skipped in the render loop. No dimmed/ghost rendering.
- **D-07:** Eye icon toggle on each row. Hidden strokes show a dimmed row in the list with a crossed-out eye icon.
- **D-08:** Visibility toggle is undoable via pushAction pattern.
- **D-09:** Click selects a single stroke (clears other selections). Cmd+click toggles individual strokes (add/remove). Shift+click selects a contiguous range. Standard macOS multi-select conventions.
- **D-10:** Bidirectional sync with canvas: selecting in list updates `selectedStrokeIds`, selecting on canvas highlights corresponding rows in the list. Uses Phase 23's existing selectedStrokeIds signal.
- **D-11:** List auto-scrolls to show newly selected strokes when selection changes from canvas interaction.
- **D-12:** SortableJS with `forceFallback:true` for drag reorder (matching SequenceList/LayerList pattern). Reorder updates the elements array in PaintFrame and triggers immediate canvas re-render.
- **D-13:** Reorder is undoable via pushAction pattern. One undo entry per drag-and-drop operation.

### Claude's Discretion
- Exact row height, padding, and spacing for stroke list items
- Eye icon and delete button sizing/styling
- Drag handle visual (grip dots vs implicit row drag)
- Auto-scroll behavior implementation details
- Whether to show stroke list in non-select tools (likely hide for simplicity)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRK-01 | User can see a list of strokes for the current frame in roto paint edit mode | StrokeList component in PaintProperties, renders from `paintStore.getFrame(layerId, frame).elements`, filtered by `activeTool === 'select'` |
| STRK-02 | User can reorder strokes via drag-and-drop in the stroke list | SortableJS with `forceFallback:true` pattern from LayerList/SequenceList; new `reorderElements()` method in paintStore |
| STRK-03 | User can delete strokes from the stroke list | Delete button per row using existing `paintStore.removeElement()` which already has undo support |
| STRK-04 | User can select strokes by clicking in the stroke list | Click handler updates `paintStore.selectedStrokeIds` signal; bidirectional sync via same signal read by PaintOverlay |
| STRK-05 | User can toggle stroke visibility (hide/show) in the stroke list | New `visible?: boolean` field on PaintElement types; visibility toggle via pushAction; render pipeline filters `visible === false` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sortablejs | ^1.15.7 | Drag-and-drop reorder | Already installed, used in SequenceList and LayerList |
| @preact/signals | (installed) | Reactive state for collapsed, selectedStrokeIds | Already used throughout the app |
| lucide-preact | ^0.577.0 | Eye, EyeOff, GripVertical, X icons | Already installed and used in LayerList |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| preact/hooks | (installed) | useRef, useEffect, useCallback, useState | Component lifecycle and state |
| preact/compat | (installed) | N/A for this phase | Not needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SortableJS | @dnd-kit/sortable | SortableJS already integrated; switching adds risk for zero benefit |
| Signal<boolean> for collapsed | useState | CollapsibleSection expects Signal<boolean>; must use useSignal |

**Installation:**
No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Component Structure
```
Application/src/
  components/
    sidebar/
      PaintProperties.tsx         # Modified: add STROKES section at top of select mode
      StrokeList.tsx              # NEW: StrokeList component with SortableJS
  stores/
    paintStore.ts                 # Modified: add reorderElements(), setElementVisibility()
  types/
    paint.ts                      # Modified: add visible? field to PaintStroke, PaintShape, PaintFill
  lib/
    paintRenderer.ts              # Modified: skip visible===false in render loops
  components/canvas/
    PaintOverlay.tsx              # Modified: skip visible===false in hit-testing and findElementAtPoint
```

### Pattern 1: SortableJS DOM Revert (from LayerList/SequenceList)
**What:** SortableJS mutates the DOM directly on drag. Preact also manages the DOM. To avoid conflict, revert SortableJS's DOM mutation in `onEnd`, then update the data model so Preact re-renders from state.
**When to use:** Every SortableJS list in this project
**Example:**
```typescript
// From LayerList.tsx lines 37-46
onEnd(evt) {
  const { oldIndex, newIndex, item, from } = evt;
  if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
    // Revert SortableJS DOM mutation so Preact can re-render correctly
    from.removeChild(item);
    from.insertBefore(item, from.children[oldIndex] ?? null);
    // Update data model
    paintStore.reorderElements(layerId, frame, oldIndex, newIndex);
  }
},
```

### Pattern 2: CollapsibleSection with Signal
**What:** CollapsibleSection expects a `Signal<boolean>` for its collapsed state, not a useState boolean.
**When to use:** When wrapping the STROKES section
**Example:**
```typescript
import { useSignal } from '@preact/signals';

const strokesCollapsed = useSignal(false);

<CollapsibleSection
  title={`STROKES (${elements.length})`}
  collapsed={strokesCollapsed}
>
  <StrokeList ... />
</CollapsibleSection>
```

### Pattern 3: Snapshot/Restore Undo for Reorder
**What:** For reorder operations, capture `before = [...elements]` and `after = [...elements]` arrays, then push an undo entry that restores/replays them. Same pattern used by `moveElementsForward/Backward/ToFront/ToBack`.
**When to use:** `reorderElements` and `setElementVisibility` in paintStore
**Example:**
```typescript
reorderElements(layerId: string, frame: number, oldIndex: number, newIndex: number): void {
  const frameData = _frames.get(layerId)?.get(frame);
  if (!frameData) return;
  const before = [...frameData.elements];
  const [moved] = frameData.elements.splice(oldIndex, 1);
  frameData.elements.splice(newIndex, 0, moved);
  const after = [...frameData.elements];
  _notifyVisualChange(layerId, frame);
  pushAction({
    id: crypto.randomUUID(),
    description: `Reorder elements on frame ${frame}`,
    timestamp: Date.now(),
    undo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...before];
      _notifyVisualChange(layerId, frame);
    },
    redo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...after];
      _notifyVisualChange(layerId, frame);
    },
  });
},
```

### Pattern 4: Visibility Filtering in Render Pipeline
**What:** Hidden elements (visible === false) must be skipped in three places: `renderPaintFrame`, `renderFlatElements`, and `findElementAtPoint`.
**When to use:** Any element with `visible === false`
**Example:**
```typescript
// In paintRenderer.ts -> renderPaintFrame
for (const element of frame.elements) {
  if (element.visible === false) continue;  // D-05: undefined = true (backward compat)
  renderElement(ctx, element, width, height);
}

// In PaintOverlay.tsx -> findElementAtPoint
for (let i = paintFrame.elements.length - 1; i >= 0; i--) {
  const el = paintFrame.elements[i];
  if (el.visible === false) continue;  // Can't select what you can't see
  // ... existing hit-test logic
}
```

### Pattern 5: Bidirectional Selection Sync
**What:** Both the StrokeList and PaintOverlay read from and write to `paintStore.selectedStrokeIds`. When canvas selection changes, the list auto-scrolls to show the selected item. When list selection changes, the canvas highlights the selection.
**When to use:** Click in list -> update signal -> canvas re-renders with highlights. Click on canvas -> update signal -> list re-renders with highlighted rows.
**Example:**
```typescript
// In StrokeList: detect canvas-originated selection change and auto-scroll
useEffect(() => {
  const selected = paintStore.selectedStrokeIds.value;
  if (selected.size > 0) {
    const firstId = [...selected][0];
    const row = listRef.current?.querySelector(`[data-element-id="${firstId}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}, [paintStore.selectedStrokeIds.value]);
```

### Pattern 6: Tool Label Generation (D-03)
**What:** Each element gets a human-readable label based on tool type and its 1-based position in the elements array.
**When to use:** StrokeList row rendering
**Example:**
```typescript
function getElementLabel(el: PaintElement, index: number): string {
  const toolLabels: Record<string, string> = {
    brush: 'Brush',
    eraser: 'Eraser',
    line: 'Line',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    fill: 'Fill',
  };
  return `${toolLabels[el.tool] || el.tool} ${index + 1}`;
}
```

### Anti-Patterns to Avoid
- **Don't use useState for CollapsibleSection collapsed state:** CollapsibleSection requires `Signal<boolean>`. Use `useSignal(false)` from `@preact/signals`.
- **Don't skip the DOM revert in SortableJS onEnd:** Without reverting the DOM mutation, Preact's virtual DOM gets out of sync and subsequent renders corrupt the list.
- **Don't mutate selectedStrokeIds set in-place:** Always create a new `Set()` and assign to `.value` to trigger signal subscribers.
- **Don't check `visible === true`:** Check `visible === false` instead, so that `undefined` (legacy data) is treated as visible per D-05.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reorder | Custom pointer event drag logic | SortableJS with forceFallback:true | Already proven in 2 lists; handles touch, animation, ghost classes |
| Visibility icons | Custom SVG eye icons | lucide-preact Eye/EyeOff | Already imported in LayerList, consistent visual language |
| Collapsible panel | Custom accordion logic | CollapsibleSection component | Exists, handles signal-based collapse with animation |
| Undo/redo | Custom history tracking | paintStore pushAction pattern | Established pattern; all mutations use it |
| UUID generation | Custom ID generation | crypto.randomUUID() | Already used throughout paintStore |

## Common Pitfalls

### Pitfall 1: SortableJS Index Mapping with Reversed Lists
**What goes wrong:** If the stroke list displays elements in reverse order (top-most first, like LayerList does for layers), the SortableJS oldIndex/newIndex must be mapped back to the actual array indices.
**Why it happens:** The visual list order and the data array order may differ.
**How to avoid:** Decide whether to display elements in natural order (first drawn = top of list, matching the paint order) or reversed. For paint elements, natural order (bottom of stack = top of list) matches layer conventions. The decision per D-03 says "Index is the element's position in the frame's elements array" -- so display in array order. Element 0 at the bottom of the list means "rendered first = back-most." However, the more intuitive UX is to show the top-most (last) element at the top of the list, matching how LayerList works. This must be consistent.
**Warning signs:** Elements jump to wrong positions after drag.

### Pitfall 2: Stale Frame Reference After Reorder
**What goes wrong:** Capturing `paintStore.getFrame()` once and using it across async boundaries (like SortableJS onEnd callback) can reference stale data if other mutations happened.
**Why it happens:** The frame object is mutable; elements array can be modified by undo/redo between drag start and end.
**How to avoid:** Always call `paintStore.getFrame()` fresh inside the `onEnd` callback, not from a closure variable.
**Warning signs:** Reorder appears to work but undo restores wrong state.

### Pitfall 3: Missing paintVersion Bump After Visibility Toggle
**What goes wrong:** Toggling visibility updates the element's `visible` field but the canvas doesn't re-render.
**Why it happens:** The render pipeline subscribes to `paintVersion` signal. Without bumping it, no re-render is triggered.
**How to avoid:** Use `_notifyVisualChange()` in the store method which encapsulates `paintVersion++`, `markDirty`, and `invalidateFrameFxCache`.
**Warning signs:** Toggle the eye icon but canvas doesn't change until you do something else.

### Pitfall 4: FX Cache Invalidation on Visibility/Reorder
**What goes wrong:** FX-styled strokes are pre-rendered into a frame-level cache canvas. If a hidden FX stroke still appears in the cache, toggling visibility won't hide it.
**Why it happens:** The FX cache was rendered before the visibility change. `renderFrameFx` receives all brush strokes without filtering hidden ones.
**How to avoid:** After visibility toggle or reorder, call `paintStore.invalidateFrameFxCache(layerId, frame)` followed by `paintStore.refreshFrameFx(layerId, frame)` to rebuild the cache excluding hidden strokes. Also, `renderFrameFx` callers must filter out `visible === false` strokes before passing to the batch renderer.
**Warning signs:** Hidden FX strokes still appear on canvas.

### Pitfall 5: Shift-Click Range Selection Requires Element Order
**What goes wrong:** Shift+click should select a contiguous range from the last-clicked element to the shift-clicked element. Without tracking the "anchor" element, you can't determine the range.
**Why it happens:** The `selectedStrokeIds` Set doesn't track click order or anchor.
**How to avoid:** Track the "last clicked" element index in a ref. On shift+click, select all elements between the anchor index and the clicked index. On plain click, update the anchor.
**Warning signs:** Shift+click selects wrong range or doesn't work.

### Pitfall 6: Rendering Order vs. List Display Order
**What goes wrong:** Elements array index 0 is rendered first (bottom/back). Users expect the top of the list to represent the front-most (last rendered) element, like Photoshop layers.
**Why it happens:** Natural array order is opposite to visual stacking order.
**How to avoid:** Display elements in reverse order (last element at top of list), matching the LayerList convention. Map SortableJS indices accordingly: `actualIndex = elements.length - 1 - visualIndex`.
**Warning signs:** User drags element "to the front" in the list but it moves to the back on canvas.

## Code Examples

### StrokeList Row Component
```typescript
// Source: derived from LayerList.tsx pattern
interface StrokeRowProps {
  element: PaintElement;
  index: number;       // 1-based display position
  isSelected: boolean;
  onSelect: (id: string, e: MouseEvent) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
}

function StrokeRow({ element, index, isSelected, onSelect, onToggleVisibility, onDelete }: StrokeRowProps) {
  const isHidden = element.visible === false;

  return (
    <div
      class="group/row flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer select-none"
      data-element-id={element.id}
      style={{
        backgroundColor: isSelected ? 'var(--sidebar-selected-layer-bg)' : 'transparent',
        opacity: isHidden ? 0.4 : 1,
      }}
      onClick={(e: MouseEvent) => onSelect(element.id, e)}
    >
      {/* Drag handle */}
      <div class="stroke-drag-handle cursor-grab shrink-0 opacity-60 hover:opacity-100">
        <GripVertical size={12} style={{color: 'var(--sidebar-resizer-icon)'}} />
      </div>

      {/* Visibility toggle */}
      <button
        class="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-[#ffffff10]"
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(element.id); }}
      >
        {isHidden
          ? <EyeOff size={12} style={{color: 'var(--sidebar-text-secondary)', opacity: 0.4}} />
          : <Eye size={12} style={{color: 'var(--sidebar-text-secondary)'}} />
        }
      </button>

      {/* Color swatch */}
      <div
        class="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: element.color }}
      />

      {/* Label */}
      <span class="flex-1 truncate text-[11px]" style={{
        color: isSelected ? 'var(--sidebar-text-primary)' : 'var(--sidebar-collapse-line)',
      }}>
        {getElementLabel(element, index)}
      </span>

      {/* Delete button */}
      <button
        class="w-4 h-4 flex items-center justify-center rounded shrink-0 opacity-0 group-hover/row:opacity-100"
        style={{color: 'var(--sidebar-text-secondary)'}}
        onClick={(e) => { e.stopPropagation(); onDelete(element.id); }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
```

### Adding `visible` Field to Types
```typescript
// In types/paint.ts -- add visible? to each interface
export interface PaintStroke {
  // ... existing fields ...
  visible?: boolean;  // D-05: default true when undefined
}

export interface PaintShape {
  // ... existing fields ...
  visible?: boolean;
}

export interface PaintFill {
  // ... existing fields ...
  visible?: boolean;
}
```

### New paintStore Methods
```typescript
// reorderElements -- arbitrary index-based reorder for SortableJS
reorderElements(layerId: string, frame: number, oldIndex: number, newIndex: number): void {
  const frameData = _frames.get(layerId)?.get(frame);
  if (!frameData) return;
  const before = [...frameData.elements];
  const [moved] = frameData.elements.splice(oldIndex, 1);
  frameData.elements.splice(newIndex, 0, moved);
  const after = [...frameData.elements];
  _notifyVisualChange(layerId, frame);
  this.invalidateFrameFxCache(layerId, frame);
  pushAction({
    id: crypto.randomUUID(),
    description: `Reorder elements on frame ${frame}`,
    timestamp: Date.now(),
    undo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...before];
      _notifyVisualChange(layerId, frame);
      paintStore.invalidateFrameFxCache(layerId, frame);
    },
    redo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      f.elements = [...after];
      _notifyVisualChange(layerId, frame);
      paintStore.invalidateFrameFxCache(layerId, frame);
    },
  });
},

// setElementVisibility -- toggle with undo
setElementVisibility(layerId: string, frame: number, elementId: string, visible: boolean): void {
  const frameData = _frames.get(layerId)?.get(frame);
  if (!frameData) return;
  const el = frameData.elements.find(e => e.id === elementId);
  if (!el) return;
  const prevVisible = el.visible !== false;  // undefined = true
  el.visible = visible;
  _notifyVisualChange(layerId, frame);
  this.invalidateFrameFxCache(layerId, frame);
  pushAction({
    id: crypto.randomUUID(),
    description: `Toggle element visibility on frame ${frame}`,
    timestamp: Date.now(),
    undo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      const target = f.elements.find(e => e.id === elementId);
      if (target) {
        target.visible = prevVisible ? undefined : false;
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
      }
    },
    redo: () => {
      const f = _getOrCreateFrame(layerId, frame);
      const target = f.elements.find(e => e.id === elementId);
      if (target) {
        target.visible = visible;
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
      }
    },
  });
},
```

### Visibility Filtering in renderPaintFrame
```typescript
// In paintRenderer.ts
export function renderPaintFrame(ctx, frame, width, height) {
  for (const element of frame.elements) {
    if (element.visible === false) continue;  // Skip hidden
    renderElement(ctx, element, width, height);
  }
}
```

### Visibility Filtering in FX Rendering
```typescript
// In reRenderFrameFx and all callers of renderFrameFx
const brushStrokes = paintFrame.elements.filter(
  (el) => el.tool === 'brush' && el.visible !== false
) as PaintStroke[];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No stroke list | Phase 24 adds stroke list panel | This phase | Users can manage individual strokes |
| moveElementsForward/Backward only | reorderElements for arbitrary drag reorder | This phase | Free-form drag reorder in list |
| No visibility per element | visible? field on PaintElement types | This phase | Per-element show/hide |

## Open Questions

1. **List Display Order: Natural vs. Reversed**
   - What we know: LayerList shows top-most layer at the top (reversed array order). Paint elements array index 0 is bottom/back-most.
   - What's unclear: Should the stroke list follow the same convention (reverse, front-most at top)?
   - Recommendation: Reverse the display order to match LayerList convention. Front-most element (last in array) shows at top of list. This is standard in all professional graphics apps (Photoshop, Illustrator, After Effects).

2. **"Select All" Button Scope**
   - What we know: Current "Select All Strokes" button in PaintProperties only selects `brush` tool elements. But the stroke list shows ALL elements (brush, eraser, shapes, fills per D-03).
   - What's unclear: Should "Select All" be updated to select all element types?
   - Recommendation: Update "Select All" to select all elements to be consistent with the stroke list showing all elements. This is a minor enhancement that falls naturally within this phase.

## Sources

### Primary (HIGH confidence)
- `Application/src/components/layer/LayerList.tsx` -- SortableJS integration pattern, visibility toggle, row selection
- `Application/src/components/sequence/SequenceList.tsx` -- SortableJS DOM revert pattern
- `Application/src/components/sidebar/CollapsibleSection.tsx` -- CollapsibleSection API (Signal<boolean> for collapsed)
- `Application/src/stores/paintStore.ts` -- Complete paint store API, _notifyVisualChange, pushAction pattern
- `Application/src/types/paint.ts` -- PaintElement types that need visible? field
- `Application/src/lib/paintRenderer.ts` -- renderPaintFrame, renderFlatElements render loops
- `Application/src/components/canvas/PaintOverlay.tsx` -- findElementAtPoint hit-testing, selection sync, FX cache management
- `Application/src/components/sidebar/PaintProperties.tsx` -- Current select mode UI structure

### Secondary (MEDIUM confidence)
- `Application/src/lib/history.ts` -- pushAction undo/redo system details
- `Application/src/components/shared/SectionLabel.tsx` -- Section header styling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and integrated in the project
- Architecture: HIGH -- every pattern has an existing codebase example to follow
- Pitfalls: HIGH -- derived from direct analysis of existing SortableJS/Preact interactions in LayerList and SequenceList

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- internal codebase patterns)
