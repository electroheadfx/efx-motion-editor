# Phase 18: Canvas Motion Path - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

After Effects-style keyframe path editing on the canvas. Visualize the spatial trajectory of animated layers as a dotted trail with interactive keyframe markers. Users can see where a layer moves across frames and drag keyframe positions directly on the canvas.

</domain>

<decisions>
## Implementation Decisions

### Path visualization
- **D-01:** Dotted trail — sample interpolated x,y positions at every frame and draw a dot for each. Dot spacing naturally reveals easing (tight dots = slow, spaced dots = fast).
- **D-02:** Circle markers at keyframe positions, distinct from timeline diamond shapes. Filled circle when selected, outlined when not.
- **D-03:** Use the app's accent/highlight color for dots and keyframe circles. Selected keyframe in solid accent, others outlined.

### Path interaction
- **D-04:** Keyframe circles on the path are draggable — dragging updates the keyframe's x,y values. The dotted trail updates in real-time during drag. Builds on existing TransformOverlay drag infrastructure (coordinateMapper, coalescing).
- **D-05:** No click-to-add keyframes on the path. Users add keyframes via the existing K shortcut or sidebar button. Path is for visualization and repositioning only.
- **D-06:** Playhead auto-seeks to the keyframe's frame when drag starts. Canvas shows the layer at that keyframe's state during editing.

### Easing preview
- **D-07:** No easing type indicator/badge at keyframe circles. Dot spacing already communicates the easing effect. Easing type editing stays in the sidebar (InlineInterpolation component).
- **D-08:** Current frame's dot on the path is highlighted (larger or brighter) to show playhead position along the motion trail. Connects timeline position to spatial position.

### Path visibility
- **D-09:** Path appears automatically when a keyframed layer is selected. Disappears when selecting a non-keyframed layer or deselecting. No toggle button needed.
- **D-10:** Path hides during playback and reappears when paused. Keeps the preview canvas clean during playback review.

### Claude's Discretion
- Dot size and spacing aesthetics
- Hit test radius for keyframe circle dragging
- Visual treatment of highlighted current-frame dot (size vs brightness vs both)
- Canvas rendering layer order (path behind or in front of transform handles)
- Performance optimization for high frame-count sequences

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing keyframe system
- `Application/src/stores/keyframeStore.ts` — Keyframe CRUD, interpolation signals, selection, transient overrides
- `Application/src/lib/keyframeEngine.ts` — Polynomial cubic easing, interpolateAt(), lerp for all properties
- `Application/src/types/layer.ts` — Keyframe/KeyframeValues/LayerTransform types, extractKeyframeValues()

### Canvas overlay system
- `Application/src/components/canvas/TransformOverlay.tsx` — Live transform manipulation, drag infrastructure, pointer events
- `Application/src/components/canvas/coordinateMapper.ts` — Client-to-canvas coordinate mapping
- `Application/src/components/canvas/transformHandles.ts` — Handle geometry, positions, hit testing
- `Application/src/components/canvas/hitTest.ts` — Layer hit testing on canvas

### Easing UI
- `Application/src/components/sidebar/InlineInterpolation.tsx` — Sidebar easing type controls per keyframe

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `keyframeEngine.interpolateAt()`: Can sample x,y at every frame to generate dot positions for the trail
- `TransformOverlay.tsx` drag infrastructure: `coordinateMapper.clientToCanvas()`, `startCoalescing/stopCoalescing` for undo batching, pointer event handling pattern
- `transformHandles.ts`: `getHandlePositions()`, `hitTestHandles()` patterns reusable for keyframe circle hit testing
- `canvasStore`: Canvas zoom/pan state needed for coordinate mapping
- `keyframeStore.selectedKeyframeFrames`: Existing selection signal to reuse for highlighting selected keyframe circles

### Established Patterns
- Canvas overlays render in `TransformOverlay.tsx` using refs and pointer events on the container div
- Coordinate mapping via `clientToCanvas()` converts screen coordinates to canvas space
- Undo batching with `startCoalescing()`/`stopCoalescing()` wraps drag operations
- `keyframeStore.addKeyframe()` / `updateLayer()` for persisting position changes

### Integration Points
- Motion path rendering integrates alongside TransformOverlay on the canvas
- Path needs access to `keyframeStore.activeLayerKeyframes` for dot positions
- Drag edits flow through `layerStore.updateLayer()` (same as transform handle edits)
- Playback state from `timelineStore` determines path visibility (hide during play)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-canvas-motion-path*
*Context gathered: 2026-03-24*
