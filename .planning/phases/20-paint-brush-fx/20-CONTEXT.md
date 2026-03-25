# Phase 20: Paint Brush FX - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Expressive brush styles (watercolor, ink, charcoal, pencil, marker) with WebGL2 offscreen rendering, spectral pigment mixing, watercolor bleed, flow fields, grain/texture, and export integration. Brush style and FX params persist in paint sidecar JSON. Flat brush behavior must not regress.

</domain>

<decisions>
## Implementation Decisions

### Brush style selector UX
- **D-01:** Visual preview strip in PaintProperties panel showing rendered stroke thumbnail per style (flat, watercolor, ink, charcoal, pencil, marker) with checkmark on active style — like Procreate's brush library
- **D-02:** Style list section is collapsible with collapse arrow (matching Tablet/Onion Skin pattern), open by default
- **D-03:** Each stroke remembers its style at draw time — switching style mid-session affects only new strokes, not existing ones on the frame
- **D-04:** Style preview thumbnails are static pre-rendered images (not live-rendered with current color/size) — zero runtime cost, always polished

### FX parameter exposure
- **D-05:** Each style shows only its relevant FX param sliders (e.g., watercolor shows bleed + grain; ink shows edge darken; charcoal shows grain + scatter) — not all 5 params for every style
- **D-06:** FX sliders appear in a separate collapsible "BRUSH FX" section below the BRUSH section, following the Tablet/Onion Skin collapsible pattern
- **D-07:** Each style ships with sensible tuned defaults (e.g., watercolor: bleed=0.6, grain=0.4) — users draw immediately and adjust if desired
- **D-08:** Flat brush hides the BRUSH FX section entirely — no grayed-out sliders, clean panel

### Spectral pigment mixing
- **D-09:** Full Kubelka-Munk 38-band spectral reflectance model (ported from spectral.js) — physically-correct pigment mixing where blue + yellow = green, not gray
- **D-10:** Spectral mixing applies to all non-flat brush styles — consistent physically-correct color blending across watercolor, ink, charcoal, pencil, and marker

### Watercolor rendering
- **D-11:** Hybrid approach — simplified polygon deformation (5-10 layers instead of 20) for rough edge shape, then GPU shader post-pass adds fine bleed and grain detail
- **D-12:** Watercolor bleed appears instantly in final form when stroke completes — no animated spreading. Deterministic for export parity.
- **D-13:** Paper texture uses procedural noise in fragment shader by default (Perlin/simplex, resolution-independent, no asset dependency). Bundled texture image support can be added later as an option.

### Claude's Discretion
- Exact default FX parameter values per brush style (within reasonable ranges)
- WebGL2 offscreen context management (per-layer vs shared)
- Point stamping vs textured quad technique for stroke rasterization
- Flow field preset patterns and implementation
- Specific shader optimization strategies
- Polygon deformation layer count (5-10 range)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint brush FX spec
- `SPECS/paint-brush-fx.md` — Full architecture spec: rendering pipeline, data model extension (BrushStyle, BrushFxParams), integration approach, techniques from p5.brush, spectral.js, and Tyler Hobbs watercolor algorithm

### Requirements
- `.planning/REQUIREMENTS.md` — PAINT-01 through PAINT-13 acceptance criteria for this phase

### Existing paint system
- `Application/src/types/paint.ts` — PaintStroke, PaintElement, PaintFrame type definitions and defaults
- `Application/src/lib/paintRenderer.ts` — Current Canvas 2D rendering pipeline (strokeToPath, renderPaintFrame)
- `Application/src/stores/paintStore.ts` — Signal-based paint state with frame data Map
- `Application/src/components/sidebar/PaintProperties.tsx` — Current sidebar panel (where style selector goes)
- `Application/src/lib/paintPersistence.ts` — Sidecar JSON persistence (where brushStyle/brushParams must persist)

### WebGL2 infrastructure
- `Application/src/lib/glslRuntime.ts` — Existing GLSL shader runtime (shared context, fullscreen quad, lazy-init pattern)
- `Application/src/lib/glBlur.ts` — Existing GPU blur (lazy-init WebGL2 pattern to follow)

### Compositing pipeline
- `Application/src/lib/previewRenderer.ts` — Paint layer compositing via offscreen canvas + renderPaintFrame()
- `Application/src/lib/exportRenderer.ts` — Export uses same PreviewRenderer; paint data must be loaded before export

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paintRenderer.ts` — `strokeToPath()` and `renderPaintFrame()` for flat brush path; stays as fast-path for flat style
- `glslRuntime.ts` — WebGL2 shader compilation, caching, and fullscreen quad rendering; pattern to follow for brush FX shaders
- `glBlur.ts` — Lazy-init WebGL2 context pattern; reusable for offscreen brush rendering context
- `PaintProperties.tsx` — Existing sidebar panel with collapsible sections (Tablet, Onion Skin); style selector and BRUSH FX section follow same pattern
- `perfect-freehand` — Existing dependency for stroke outline generation; continues to provide base geometry for all styles
- `paintPersistence.ts` — Sidecar JSON write/read; `brushStyle` and `brushParams` fields added to PaintStroke are naturally forward-compatible

### Established Patterns
- Signal-based stores with `paintVersion` counter for reactivity (non-reactive Map + explicit bump)
- Offscreen canvas compositing for isolation (eraser destination-out, onion skin global alpha)
- Collapsible sections in sidebar with collapse arrow toggle (Tablet, Onion Skin)
- WebGL2 lazy initialization: create context on first use, cache programs, destroy on dispose

### Integration Points
- `previewRenderer.ts` line 275-291: Paint layer branch creates offscreen canvas, calls `renderPaintFrame()` — this is where WebGL2-rendered styled strokes must be composited back
- `exportRenderer.ts` delegates to PreviewRenderer — export parity comes for free if preview rendering is correct
- `paintStore.ts` signals: new `brushStyle` and `brushFxParams` signals needed alongside existing brushSize/brushColor/brushOpacity
- `paint.ts` types: PaintStroke needs `brushStyle?: BrushStyle` and `brushParams?: BrushFxParams` optional fields (backward-compatible)

</code_context>

<specifics>
## Specific Ideas

- Style selector modeled after Procreate's brush library — visual preview strip with stroke thumbnails
- Hybrid watercolor: simplified Tyler Hobbs polygon deformation for organic edge shape + GPU shader for fine bleed/grain detail — balances fidelity and performance
- Paper texture: procedural noise by default, but architecture allows adding bundled texture images later as an option
- Spectral mixing via spectral.js Kubelka-Munk port — the physically-correct pigment blending that makes blue + yellow = green

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-paint-brush-fx*
*Context gathered: 2026-03-25*
