# Phase 20: Paint Brush FX - Context

**Gathered:** 2026-03-26 (updated — reimplementation discussion)
**Status:** Ready for planning

<domain>
## Phase Boundary

Expressive brush styles (watercolor, ink, charcoal, pencil, marker) applied as a post-drawing FX pass via p5.brush standalone rendering. Users draw flat strokes with pressure/angle/speed, then select strokes and apply FX styles. All FX-applied strokes on a frame render together on the same p5.brush canvas (enabling spectral mixing) and the result is cached as a single raster image per frame. Paint canvas uses a solid background (white default or user color) to avoid p5.brush transparency issues. Brush style and FX params persist in paint sidecar JSON. Flat brush behavior must not regress.

</domain>

<decisions>
## Implementation Decisions

### Rendering architecture
- **D-01:** Always draw in flat mode — pressure, angle, speed with live Canvas 2D preview. p5.brush never runs during drawing.
- **D-02:** FX is applied as a post-process after drawing, not during. User draws flat strokes first, then selects and applies FX styles.
- **D-03:** All FX-applied strokes on a frame are rendered together on the same p5.brush canvas (enabling Kubelka-Munk spectral mixing when strokes overlap). The result is cached as a single HTMLCanvasElement per frame in `paintStore.frameFxCache`. Playback composites the cached frame image only (`drawImage()` call), p5.brush never runs during playback.
- **D-04:** Three stroke states: flat (vector, editable) → FX applied (per-frame cache, stroke-level undo triggers frame re-render) → flattened (frame cache IS already the merged result, fastest playback).

### Select tool
- **D-05:** New select tool added to paint tools — user can tap/lasso to select one or more flat strokes on the current frame.
- **D-06:** Selected strokes can have an FX style applied to them. Selection is the trigger for FX application.
- **D-07:** Eraser in FX mode deletes the whole stroke (removes the cached image), not pixel-based erasing.

### FX application & swapping
- **D-08:** User selects strokes, chooses an FX style (watercolor, ink, charcoal, pencil, marker), and the selected strokes are rendered via p5.brush and cached immediately.
- **D-09:** Changing the FX style on already-applied strokes re-renders immediately — no batch/queue, instant visual feedback (may take a moment per stroke, acceptable).
- **D-10:** Original flat vector stroke data is always preserved. User can rollback from FX to flat at any time (non-destructive).

### Solid paint background
- **D-11:** Paint FX renders on a solid background (white by default) instead of transparent. This solves p5.brush transparency and watercolor compositing issues.
- **D-12:** User can pick a custom background color for the paint layer.
- **D-13:** Toggle button + keyboard shortcut to overlay the sequence frame underneath the paint layer in transparency — reference only for positioning while painting.
- **D-14:** Switch between full solid paint view and sequence preview overlay.

### Compositing & playback
- **D-15:** When done painting, the paint layer composites into the sequence with blend mode and/or opacity controls, like any other layer.
- **D-16:** Each frame is a composite of multiple cached stroke images. For typical stroke counts (10-30) this is fast enough for playback.
- **D-17:** Flatten option merges all cached stroke images into one raster image per frame — fastest possible playback (single `drawImage()`). Destructive for cached FX images, but flat vector strokes are preserved for rollback and re-application.

### Style selector UX (carried forward)
- **D-18:** Visual preview strip in PaintProperties panel showing rendered stroke thumbnail per style — like Procreate's brush library (from original D-01).
- **D-19:** Each style shows only its relevant FX param sliders. Flat/marker show none; watercolor shows bleed, grain, flow; etc. (from original D-05).
- **D-20:** Each style ships with sensible tuned defaults — users apply and adjust if desired (from original D-07).

### Claude's Discretion
- Select tool interaction design (tap vs lasso vs both)
- Flatten UI placement and confirmation flow
- Cached image format and resolution strategy
- How rollback from flattened state re-applies FX (re-render all or selective)
- Overlay transparency level for sequence preview

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint brush FX spec
- `SPECS/paint-brush-fx.md` — Original architecture spec (reference only — rendering approach changed per this context)

### Requirements
- `.planning/REQUIREMENTS.md` — PAINT-01 through PAINT-13 acceptance criteria

### Existing paint system
- `Application/src/types/paint.ts` — PaintStroke, BrushStyle, BrushFxParams type definitions and defaults
- `Application/src/lib/paintRenderer.ts` — Canvas 2D rendering pipeline (strokeToPath, renderPaintFrame)
- `Application/src/lib/brushP5Adapter.ts` — Current p5.brush adapter (render-once caching pattern to preserve, integration architecture to rework)
- `Application/src/stores/paintStore.ts` — Signal-based paint state with frame data Map
- `Application/src/components/sidebar/PaintProperties.tsx` — Sidebar panel with style selector and FX sliders
- `Application/src/components/canvas/PaintOverlay.tsx` — Stroke capture with pressure/angle, where select tool will integrate
- `Application/src/lib/paintPersistence.ts` — Sidecar JSON persistence

### Compositing pipeline
- `Application/src/lib/previewRenderer.ts` — Paint layer compositing (where cached images are composited for playback)
- `Application/src/lib/exportRenderer.ts` — Export uses same PreviewRenderer; cached images must export identically

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `brushP5Adapter.ts` — p5.brush singleton, lazy init, hash-based seeding, style mapping. Core rendering logic reusable; needs rewiring from "render all strokes per frame" to "render single stroke on demand."
- `paintRenderer.ts` — `strokeToPath()` and flat rendering pipeline stays as-is for flat mode. `renderPaintFrame()` needs new branch: composite cached raster images for FX-applied strokes.
- `brushPreviewData.ts` — SVG thumbnail data URIs for style selector (reuse as-is).
- `PaintProperties.tsx` — Collapsible style selector and FX sliders (reuse, may need minor adjustments for post-draw workflow).

### Established Patterns
- Signal-based stores with `paintVersion` counter for reactivity
- Offscreen canvas compositing for isolation (eraser destination-out, onion skin global alpha)
- Collapsible sections in sidebar with collapse arrow toggle
- p5.brush lazy initialization: create context on first use, cache, destroy on dispose

### Integration Points
- `PaintOverlay.tsx` — Stroke capture stays flat-only. New select tool mode needed here for stroke selection and FX application trigger.
- `previewRenderer.ts` paint layer branch — needs to composite cached stroke images instead of re-rendering via p5.brush.
- `paintStore.ts` — Needs per-stroke state tracking (flat / fx-applied / flattened), cached image storage or references, background color signal.
- `paint.ts` types — PaintStroke needs `fxCachedImage?: ImageBitmap | HTMLCanvasElement` or similar field for the cached raster.

</code_context>

<specifics>
## Specific Ideas

- Paint FX as a post-process filter, not a drawing mode — "draw flat, apply FX after" workflow inspired by non-destructive editing
- Select tool for strokes enables FX application and stroke-level erasing — no pixel-based operations in FX mode
- Solid background solves all p5.brush transparency issues observed in v1 implementation
- Sequence overlay toggle for reference while painting — preview only, not composited
- Flatten as explicit user action for playback performance — not automatic, user controls when

</specifics>

<deferred>
## Deferred Ideas

- **Grain/texture paper background** — procedural noise or texture image as paint background instead of flat solid. Future phase.
- **Apply stroke to all frames mode** — paint one stroke and have it appear on multiple frames. New capability, separate phase.
- ~~**Spectral pigment mixing (Kubelka-Munk)**~~ — Now implemented via per-frame caching: all FX strokes render on shared p5.brush canvas, enabling spectral mixing (PAINT-06).

</deferred>

---

*Phase: 20-paint-brush-fx*
*Context gathered: 2026-03-26*
