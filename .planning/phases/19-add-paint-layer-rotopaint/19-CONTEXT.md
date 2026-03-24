# Phase 19: Add Paint Layer Rotopaint - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a paint/rotopaint layer type for frame-by-frame drawing and rotoscoping directly on the canvas. Users can paint strokes on each timeline frame using a brush engine powered by perfect-freehand, with tools for brush, eraser, color picker, fill, and geometric shapes. Paint layers participate in standard layer compositing.

</domain>

<decisions>
## Implementation Decisions

### Brush Engine
- **D-01:** Brush engine is based on [perfect-freehand](https://github.com/steveruizok/perfect-freehand) library — smooth, pressure-sensitive strokes with variable width based on velocity/pressure
- **D-02:** Strokes stored as point arrays (x, y, pressure) — perfect-freehand generates outline polygons at render time
- **D-03:** Each stroke carries its own color and opacity (per-stroke color + opacity model)

### Tool Types
- **D-04:** Full tool suite: Brush, Eraser, Color picker (eyedropper), Fill (flood-fill), Line/shape tools (straight lines, rectangles, ellipses)
- **D-05:** Brush and eraser use perfect-freehand for freehand strokes; shapes are geometric primitives

### Per-Frame Paint Model
- **D-06:** Vector strokes per frame — each frame stores an array of stroke objects using perfect-freehand's point format, rendered at display time
- **D-07:** One paint frame per timeline frame — every single timeline frame gets its own paint canvas, independent of key photos. True frame-by-frame animation support
- **D-08:** Onion skinning with configurable range — show ghosted paint from N previous and N next frames while painting, with configurable opacity falloff and frame range

### Canvas Interaction
- **D-09:** Toggle button in canvas toolbar to enter/exit paint mode — clear visual indicator (cursor change, border color), mouse events route to paint instead of layer transforms
- **D-10:** Tool options in both sidebar properties panel AND compact floating toolbar on canvas — full controls in sidebar, quick access to size/color in floating bar
- **D-11:** Space+drag to pan, pinch/scroll to zoom while in paint mode — release Space to resume painting (Photoshop/Procreate convention)

### Rendering & Export
- **D-12:** Standard layer compositing — paint layer sits in the layer stack like any other layer, supports existing blend modes (normal, screen, multiply, overlay, add) and opacity
- **D-13:** Renders during preview and export via existing pipeline — paint strokes rasterized to canvas at render time per frame

### Persistence
- **D-14:** Paint data stored in sidecar files alongside the .mce project (e.g., `paint/layer-id/frame-001.json`) — keeps .mce file small, paint data lazy-loaded
- **D-15:** Project format version bump required for paint layer type recognition

### Claude's Discretion
- Brush size range and default values
- Stroke undo granularity (per-stroke vs grouped)
- Keyboard shortcuts for tool switching
- Onion skin default opacity falloff curve
- Exact floating toolbar layout and positioning
- Export performance optimization (raster caching strategy during export)
- Fill tool algorithm (scanline vs flood-fill)
- Shape tool rendering approach (stroke outline vs filled path)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brush Engine
- [perfect-freehand GitHub](https://github.com/steveruizok/perfect-freehand) — Core brush engine library, provides `getStroke()` API for converting input points to outline polygons

### Layer System
- `Application/src/types/layer.ts` — LayerType union, LayerSourceData discriminated union, Layer interface, transform/keyframe types
- `Application/src/types/sequence.ts` — Sequence interface with layers array, KeyPhoto type
- `Application/src/lib/previewRenderer.ts` — Canvas rendering pipeline, layer compositing, blend modes
- `Application/src/lib/exportRenderer.ts` — Export rendering pipeline (must render paint layers identically)
- `Application/src/lib/frameMap.ts` — Frame mapping logic, FX color palette

### Existing Patterns
- `Application/src/types/project.ts` — .mce project format, serialization types (for persistence design)
- `Application/src/stores/projectStore.ts` — Project save/load, format version management

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Layer type system** (`types/layer.ts`): Well-established `LayerType` union + `LayerSourceData` discriminated union pattern — new paint type follows same pattern
- **previewRenderer** (`lib/previewRenderer.ts`): Canvas2D rendering pipeline with per-layer compositing, blend modes, transforms — paint layer plugs into this
- **exportRenderer** (`lib/exportRenderer.ts`): Export pipeline mirrors preview — paint rendering code shared
- **Undo/redo engine**: Existing command pattern (100+ levels) — stroke actions integrate as commands
- **Keyframe animation**: Per-layer keyframe system could animate paint layer opacity/transform

### Established Patterns
- **LayerSourceData discriminated union**: Each layer type has a `{ type: 'xxx'; ...params }` source data shape — paint layer adds `{ type: 'paint'; ... }`
- **Properties panel**: Context-sensitive sidebar panel pattern (e.g., color grade, blur controls) — paint tools panel follows same approach
- **Add layer dialogs**: Existing pattern for adding new layer types via sidebar
- **FX sequence colors**: `frameMap.ts` has `fxColorForLayerType()` for timeline colors — needs paint layer entry

### Integration Points
- `LayerType` union in `types/layer.ts` — add `'paint'` type
- `LayerSourceData` union — add paint source data shape (references sidecar files)
- `previewRenderer.ts` render switch — add paint layer rendering case
- `exportRenderer.ts` — mirror paint rendering for export
- `projectStore.ts` — handle paint sidecar file save/load alongside .mce
- Canvas event handling — paint mode intercepts mouse events when active
- Toolbar area — add paint mode toggle button

</code_context>

<specifics>
## Specific Ideas

- Brush engine specifically based on perfect-freehand library (https://github.com/steveruizok/perfect-freehand) — not a custom brush engine
- Per-stroke color + opacity model matches traditional digital painting tools
- Sidecar file approach for paint data similar to how video editing apps store render caches externally
- Onion skinning is essential for rotoscoping workflow — frame-by-frame paint without it would be impractical

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-add-paint-layer-rotopaint*
*Context gathered: 2026-03-24*
