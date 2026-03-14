# Phase 12: Layer Keyframe Animation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-layer keyframe animation for properties (opacity, transform, blur radius). User selects a layer, positions the playhead, adjusts parameters, and explicitly adds a keyframe. Keyframes are visible on the timeline when a layer is selected, with configurable interpolation curves. Content layers only — FX layers stay static. No graph editor, no per-property curves, no crop animation.

</domain>

<decisions>
## Implementation Decisions

### Keyframe creation workflow
- Explicit [+ Keyframe] button in the Properties panel header (next to layer name) — no auto-key mode
- Each keyframe captures a full snapshot of ALL animatable properties (opacity, x, y, scaleX, scaleY, rotation, blur) at the current frame
- User positions playhead, adjusts properties, clicks [+ Keyframe] to save
- If playhead is on an existing keyframe, property edits are transient until user explicitly adds/updates

### Property panel behavior with keyframes
- Properties always show the interpolated value at the current playhead position
- Properties remain editable at all times (not read-only between keyframes)
- Edits between keyframes are transient — only saved when user clicks [+ Keyframe]
- When playhead is on an existing keyframe frame, edits update that keyframe's values

### Timeline keyframe display
- Diamond markers drawn directly on the content sequence track row (no extra sub-rows)
- Keyframe diamonds are visible ONLY for the currently selected layer — deselect the layer and diamonds disappear
- Clicking a keyframe diamond selects it AND snaps the playhead to that frame
- Drag diamond left/right to move keyframe to a different frame
- Delete key removes selected keyframe(s)
- Shift+click for multi-select
- Double-click diamond opens interpolation popover menu (not right-click — Tauri reserves right-click for dev context menu)

### Animatable properties
- Transform: x, y, scaleX, scaleY, rotation (all 5 transform values)
- Opacity (0.0–1.0)
- Blur radius (from Phase 10)
- NOT animatable: crop, blend mode
- Content layers only (static-image, image-sequence, video) — FX layers and base layer are NOT animatable

### Extrapolation behavior
- Before the first keyframe: hold the first keyframe's values
- After the last keyframe: hold the last keyframe's values
- No looping, no extrapolation beyond keyframe range

### Interpolation
- Per-keyframe interpolation (one curve applies to ALL properties between this keyframe and the next)
- Default interpolation: Ease In-Out
- Available curves: Linear, Ease In, Ease Out, Ease In-Out
- Set via double-click popover menu on the keyframe diamond in the timeline
- No graph/curve editor — preset curves only

### Claude's Discretion
- Keyframe data model design (on Layer interface vs separate mapping)
- .mce format version bump (v5 → v6) and migration strategy
- Interpolation math implementation (cubic bezier control points for each preset)
- Diamond marker visual design (size, color, selected/unselected states, glow on selection)
- Popover menu styling and positioning
- How interpolated values flow into PreviewRenderer.drawLayer() pipeline
- Keyboard shortcut for "Add Keyframe" (if any)
- Performance optimization for interpolation lookups during playback

</decisions>

<specifics>
## Specific Ideas

- The [+ Keyframe] button lives in the Properties panel header, right next to the layer name — always visible when a layer is selected
- Double-click (not right-click) for the interpolation menu because Tauri reserves right-click for its dev tools context menu
- Full-snapshot keyframes (all properties captured) keeps the data model simple and avoids per-property keyframe complexity
- Selected-layer-only diamonds keeps the timeline clean and uncluttered

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Layer` interface (`types/layer.ts`): Already has opacity, transform (x, y, scaleX, scaleY, rotation), blur — all animatable properties exist
- `layerStore.updateLayer()`: Routes through sequenceStore with undo support — keyframe CRUD can follow the same pattern
- `startCoalescing()`/`stopCoalescing()` from history: Batch keyframe drag operations into single undo entries
- `NumericInput` component: Drag-to-scrub with coalescing — already shows interpolated values if wired correctly
- `TransformOverlay` (Phase 11): Live canvas transform — keyframe button could also be accessible here
- `TimelineRenderer`: Canvas 2D drawing with virtualization — add diamond rendering in draw loop
- `TimelineInteraction`: Pointer event handling with hit-testing — add keyframe click/drag/delete handlers

### Established Patterns
- Canvas 2D for timeline rendering with `TRACK_HEIGHT=52px`, `BASE_FRAME_WIDTH=60px`
- Preact Signals for reactive state — keyframe data changes trigger re-renders automatically
- `structuredClone()` snapshot/restore for undo/redo — keyframes included in snapshot
- Resolution-independent parameters (normalized 0–1) scaled at render time
- `PreviewRenderer.drawLayer()` transform pipeline: translate → rotate → scale → draw centered

### Integration Points
- `PreviewRenderer.drawLayer()`: Inject interpolated values before applying opacity, transform, and blur to canvas context
- `PropertiesPanel.tsx`: Add [+ Keyframe] button in header, wire property inputs to show interpolated values
- `TimelineRenderer.ts`: Draw keyframe diamonds in `drawTracks()` for selected layer
- `TimelineInteraction.ts`: Add keyframe hit-testing, click/drag/delete handlers
- `projectStore.ts` `buildMceProject()`: Serialize keyframes in .mce format (v6)
- `types/layer.ts`: Extend Layer interface with keyframe data
- `frameMap.ts`: Potentially add keyframe layout computation for timeline rendering

</code_context>

<deferred>
## Deferred Ideas

- Crop animation — adds 4 extra interpolated values, can be added later
- FX layer keyframe animation (grain intensity, vignette strength over time) — separate phase
- Graph/curve editor for fine-tuning bezier interpolation — future enhancement
- Per-property interpolation curves (different easing per property) — future if needed
- Auto-key toggle mode — could be added later as a workflow preference

</deferred>

---

*Phase: 12-layer-keyframe-animation*
*Context gathered: 2026-03-14*
