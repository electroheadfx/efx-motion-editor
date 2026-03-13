# Phase 11: Live Canvas Transform - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manipulate layer transforms directly on the canvas preview window (move, scale, rotate) with visible handles, in addition to the existing parameter panel controls. Canvas transform changes sync bidirectionally with the parameter panel values in real-time. Only content layers (static-image, image-sequence, video) are transformable on canvas — FX layers remain sidebar-only.

</domain>

<decisions>
## Implementation Decisions

### Interaction model
- Auto-detect mode (Figma-style): click on a layer = select & show handles, click on empty area = deselect, middle-click or Space+drag = pan (any time), Cmd+scroll = zoom (unchanged)
- Small drag threshold (3-5px) before move begins — click without dragging = just select, prevents accidental nudges
- Left-click pan (current behavior when zoomed beyond fit) is replaced by the auto-detect model — pan moves to middle-click and Space+drag only
- Arrow keys context-based: when layer selected, arrows nudge 1px (Shift+arrows = 10px); when no layer selected, left/right arrows step frames as before
- Escape key deselects layer, hides handles, returns arrows to frame stepping mode

### Handle appearance
- Figma-style: thin blue bounding box outline (1-2px), small white-fill square corner handles with blue border
- Rotation: hover outside corners shows curved arrow rotation cursor — drag to rotate
- Edge midpoint handles for non-uniform scaling (stretch width or height independently)
- Handles maintain fixed screen-pixel size regardless of canvas zoom level (counter-scale with zoom)
- Corner drag = uniform scale (lock aspect ratio). Edge drag = scale one axis only.

### Data model change: scaleX/scaleY
- Split `LayerTransform.scale` into `scaleX` and `scaleY` for non-uniform scaling
- Requires .mce format migration (v4 → v5): convert existing `scale` value to `scaleX: scale, scaleY: scale`
- PropertiesPanel TransformSection needs update from single "Scale" input to "ScaleX" + "ScaleY" inputs (or "W" + "H")

### Layer selection on canvas
- Hit-test topmost visible layer whose non-transparent pixels are under cursor
- If clicked pixel is transparent on topmost layer, test next layer down in z-order
- Click on empty/background area = deselect all, hide handles
- Alt+click at same spot cycles through overlapping layers in z-order
- Only content layers (static-image, image-sequence, video) are selectable on canvas — FX/generator/adjustment layers are selected via sidebar only
- Canvas selection and sidebar selection stay in sync bidirectionally (selecting on canvas highlights in sidebar, selecting in sidebar shows handles on canvas)

### Crop on canvas
- No crop handles on canvas — crop stays as panel-only controls (numeric T/R/B/L inputs)
- Bounding box and handles reflect the cropped (visible) content bounds, not the original uncropped extent

### Claude's Discretion
- Coordinate mapping implementation (mouse → screen → canvas zoom/pan → layer-local space)
- Handle hit-test areas and cursor changes (resize cursors, rotation cursor, move cursor)
- Transform overlay rendering approach (separate overlay canvas vs inline drawing vs HTML overlay)
- Rotation handle UX details (how far from corner to hover, visual indicator)
- Aspect ratio constraint behavior during corner scale (always locked vs Shift to unlock)
- Undo integration for canvas-initiated transforms (coalescing during drag, commit on pointerup)
- Performance optimization for hit-testing (pixel sampling vs bounding box pre-check)

</decisions>

<specifics>
## Specific Ideas

- Figma-style interaction: click to select, drag to move, corner handles for scale, hover outside corners for rotation — no mode switching needed
- User specifically wants a deselect key (Escape) to quickly return arrows to frame stepping mode — quick toggle between transform editing and playback navigation is important
- Edge midpoint handles for non-uniform scaling (stretch width/height independently) — user explicitly requested despite the data model change

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LayerTransform` interface (`layer.ts:41-50`): Has x, y, scale, rotation, crop fields — scale needs splitting to scaleX/scaleY
- `PropertiesPanel.tsx` `TransformSection`: Existing NumericInput controls for X, Y, Scale, Rot — bidirectional sync target
- `PropertiesPanel.tsx` `NumericInput`: Drag-to-scrub label component with coalescing undo support — reusable pattern
- `canvasStore.ts`: Zoom/pan signals and coordinate system — needed for screen-to-canvas coordinate mapping
- `layerStore.selectedLayerId` signal: Already tracks layer selection — canvas selection updates this same signal
- `layerStore.updateLayer()`: Routes through sequenceStore with undo support — canvas transforms use this same path
- `startCoalescing()`/`stopCoalescing()` from history: Batch rapid transform changes into single undo entry — use for drag operations

### Established Patterns
- CSS `transform: scale(zoom) translate(panX, panY)` on canvas container (`CanvasArea.tsx:159`) — transform overlay must account for this
- `PreviewRenderer.drawLayer()` transform pipeline: translate(x + w/2, y + h/2) → rotate → scale → draw centered — handle positions must match this
- Pointer event handling with `setPointerCapture` for drag operations (`CanvasArea.tsx:48-61`)
- `tinykeys` for keyboard shortcuts (nudge arrows, Escape deselect)
- Preact Signals for reactive state — handle visibility tied to `selectedLayerId` signal

### Integration Points
- `CanvasArea.tsx`: Main interaction surface — needs transform overlay rendering and pointer event routing (currently handles zoom/pan only)
- `PreviewRenderer.drawLayer()` transform math: Handle positions must replicate this exact math to stay aligned
- `layerStore.setSelected()`: Canvas click-to-select calls this; sidebar selection triggers handle display
- `.mce` format version: v4 → v5 migration for scale → scaleX/scaleY
- `projectStore.ts` project loading: Backward-compatible migration of older .mce files

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-live-canvas-transform*
*Context gathered: 2026-03-13*
