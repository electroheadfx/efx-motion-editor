# Phase 24: Stroke List Panel - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage strokes on the current frame through a dedicated list panel in roto paint edit mode with full CRUD operations, drag-and-drop reorder, visibility toggles, and bidirectional selection sync with the canvas.

</domain>

<decisions>
## Implementation Decisions

### Panel Placement
- **D-01:** Stroke list lives as a new STROKES collapsible section inside PaintProperties, visible only in SELECT tool mode. Uses existing CollapsibleSection pattern.
- **D-02:** STROKES section appears at the top of PaintProperties (above the existing Select All/Delete Selected row) when in select mode. Shows element count in the header: "STROKES (N)".

### Stroke Labeling
- **D-03:** Auto-label strokes by tool type + sequential index: "Brush 1", "Line 2", "Fill 3", "Eraser 4". Index is the element's position in the frame's elements array.
- **D-04:** Each row shows a color swatch dot next to the label, reflecting the stroke's color property.

### Visibility Behavior
- **D-05:** Add an optional `visible` field to PaintElement types (PaintStroke, PaintShape, PaintFill). Default `true` when undefined for backward compatibility with existing data.
- **D-06:** Hidden strokes are fully hidden on canvas — skipped in the render loop. No dimmed/ghost rendering.
- **D-07:** Eye icon toggle on each row. Hidden strokes show a dimmed row in the list with a crossed-out eye icon.
- **D-08:** Visibility toggle is undoable via pushAction pattern.

### Selection Sync
- **D-09:** Click selects a single stroke (clears other selections). Cmd+click toggles individual strokes (add/remove). Shift+click selects a contiguous range. Standard macOS multi-select conventions.
- **D-10:** Bidirectional sync with canvas: selecting in list updates `selectedStrokeIds`, selecting on canvas highlights corresponding rows in the list. Uses Phase 23's existing selectedStrokeIds signal.
- **D-11:** List auto-scrolls to show newly selected strokes when selection changes from canvas interaction.

### Drag-and-Drop Reorder
- **D-12:** SortableJS with `forceFallback:true` for drag reorder (matching SequenceList/LayerList pattern). Reorder updates the elements array in PaintFrame and triggers immediate canvas re-render.
- **D-13:** Reorder is undoable via pushAction pattern. One undo entry per drag-and-drop operation.

### Claude's Discretion
- Exact row height, padding, and spacing for stroke list items
- Eye icon and delete button sizing/styling
- Drag handle visual (grip dots vs implicit row drag)
- Auto-scroll behavior implementation details
- Whether to show stroke list in non-select tools (likely hide for simplicity)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint system
- `Application/src/components/sidebar/PaintProperties.tsx` — Current panel implementation; STROKES section will be added here
- `Application/src/stores/paintStore.ts` — Paint store with selectedStrokeIds, addElement, removeElement, moveElementsForward/Backward/ToFront/ToBack, pushAction, paintVersion signal
- `Application/src/types/paint.ts` — PaintElement union (PaintStroke, PaintShape, PaintFill), PaintFrame; `visible` field needs to be added here

### Canvas rendering
- `Application/src/components/canvas/PaintOverlay.tsx` — Select tool handler, canvas rendering loop, hit-testing; must skip elements with `visible: false`

### Existing list/DnD patterns
- `Application/src/components/sequence/SequenceList.tsx` — SortableJS integration pattern with forceFallback:true and Preact DOM revert
- `Application/src/components/layer/LayerList.tsx` — Another SortableJS list example
- `Application/src/components/sidebar/CollapsibleSection.tsx` — Collapsible section pattern for the STROKES header

### Requirements
- `.planning/REQUIREMENTS.md` — STRK-01 through STRK-05 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CollapsibleSection` component: reusable collapsible header pattern for PaintProperties sections
- `SortableJS` with `forceFallback:true`: proven DnD pattern in SequenceList and LayerList
- `selectedStrokeIds` signal in paintStore: existing selection model from Phase 23
- `moveElementsForward/Backward/ToFront/ToBack` in paintStore: existing reorder functions (may need adaptation for arbitrary reorder)
- `pushAction()` in paintStore: established undo/redo pattern
- `_notifyVisualChange()` in paintStore: encapsulates paintVersion++ + markDirty + invalidateFrameFxCache

### Established Patterns
- Tool-conditional rendering via `activeTool` checks in PaintProperties (BRUSH_TOOLS, SHAPE_TOOLS, etc.)
- SortableJS DOM mutation revert pattern: revert Sortable's DOM change, then let Preact re-render from updated state
- `paintVersion.value++` for triggering visual re-renders after paint data mutations
- Snapshot/restore undo pattern with structuredClone

### Integration Points
- PaintProperties rendered by LeftPanel when paint mode is active — STROKES section adds here
- PaintOverlay render loop must filter out `visible: false` elements
- PaintOverlay hit-testing should skip hidden elements (can't select what you can't see)
- Selection changes from canvas (PaintOverlay) must reflect in stroke list; selection from list must update selectedStrokeIds

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

*Phase: 24-stroke-list-panel*
*Context gathered: 2026-03-27*
