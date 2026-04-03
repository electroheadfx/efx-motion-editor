# Phase 3: Brush System & Tools - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

All 8 brush types functioning with tablet pen support, brush texture mask with quadrant mirroring, and stroke data model matching efx-motion-editor's PaintStroke format. Work continues in single HTML file (efx-paint-physic-v1.html).

</domain>

<decisions>
## Implementation Decisions

### Tool/brush mapping
- **D-01:** Rename + add new approach. Final tool set: paint, erase, water, smear, blend, blow, wet, dry + liquify (bonus tool)
- **D-02:** **paint** stays — absorbs mix tool's pickup blending behavior. Mix tool removed as separate tool
- **D-03:** **smudge** removed entirely (broken). Build **smear** from scratch as a new Rebelle-style brush type
- **D-04:** **liquify** stays as a bonus tool (not one of the 8 required types)
- **D-05:** **mix** merged into paint — paint tool already does pickup blending which is mix's core behavior
- **D-06:** Fix paint brush edge artifacts — `strokeEdge()` produces jagged/spiky marks on stroke borders (visible with EDGE slider). Fix the rendering rather than keeping the edge slider

### Brush texture mask (BRUSH-03)
- **D-07:** Brush texture mask (brush_texture.png) serves dual purpose: modulates paint deposit amount AND adds per-stroke emboss grain effect on paint surface
- **D-08:** Quadrant mirroring for seamless tiling — texture flipped horizontally and vertically across 4 quadrants
- **D-09:** Current `brushGrain` is loaded (128x128 Float32Array from img region 192,192) but never used — needs to be wired into brush application code

### Parameter controls (BRUSH-02)
- **D-10:** Universal sliders always visible: size, opacity, water amount, dry amount, pressure (base value for mouse users)
- **D-11:** Per-type contextual extras appear when relevant tool is selected (e.g., pickup for paint, blow strength for blow tool)
- **D-12:** Edge slider removed — fix the edge artifacts instead of controlling their intensity
- **D-13:** Mix-specific sliders (mixSmudge, mixLiquify, mixPaint) removed — mix tool is being merged into paint

### Pressure interaction
- **D-14:** Pressure slider acts as multiplier: final pressure = slider value x penPressure. Mouse users get slider value directly. Low slider = light touch even with full pen pressure

### Stroke data model (STROKE-01, STROKE-02)
- **D-15:** Match efx-motion-editor PaintStroke format now — define stroke type with points as `[x, y, pressure][]` minimum, plus extended fields {tiltX, tiltY, twist, speed}
- **D-16:** Metadata per stroke: tool type, color, brush parameters, timestamp
- **D-17:** Current `allActions[]` array to be refactored to use the formal PaintStroke type — Phase 4 serialization becomes trivial

### Claude's Discretion
- Implementation details for each new brush type (erase, water, blend, blow, wet, dry)
- How quadrant mirroring is implemented (at load time vs at sample time)
- Specific pressure curve shape within the multiplier model
- Which per-type contextual parameters each brush type exposes
- Bug fix approach for strokeEdge() artifacts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `efx-paint-physic-v1.html` — THE implementation file. Contains: current 4 tools (paint line 459, smudge line 676, liquify line 705, mix line 733), brush texture loading (line 163), pen input handling (extractPenPoint line 1120), getOpts (line 1245), pointer events (line 1217), strokeEdge bug source (line 400)
- `img/brush_texture.png` — 512x512 brush texture mask for BRUSH-03 quadrant mirroring
- `paint-studio-v9.html` — Reference for pickup blending behavior being merged into paint tool

### Project requirements
- `.planning/ROADMAP.md` §Phase 3 — Phase goal, success criteria, requirements (BRUSH-01, BRUSH-02, BRUSH-03, STROKE-01, STROKE-02)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for BRUSH-01 through BRUSH-03, STROKE-01, STROKE-02

### Prior phase context
- `.planning/phases/01-algorithm-port-foundation/01-CONTEXT.md` — D-04: single HTML file, D-10: Canvas 2D, D-11: package naming
- `.planning/phases/02-rendering-pipeline/02-CONTEXT.md` — D-04/D-05: paper heightmap decoupled from background, density-weighted transparency

### efx-motion-editor reference
- efx-motion-editor `PaintStroke` type uses `[x, y, pressure][]` point format — stroke data model must match for Phase 4 compatibility (see PROJECT.md §Context)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extractPenPoint()` (line 1120): Already returns `{x, y, p, tx, ty, tw, spd}` with PointerEvent coalescing — covers STROKE-01/STROKE-02 input capture
- `renderPaintStroke()` (line 535): Full paint rendering pipeline with pickup blending, bristle traces, polygon grain — base for the unified paint tool
- `brushGrain` (line 164): 128x128 Float32Array loaded from brush_texture.png — ready to wire into brush application
- `getCoalescedEvents()` usage (line 1175): Tablet input coalescing already implemented
- `hasPenInput` flag (line 118): Detects pen vs mouse, adjusts pressure/tilt behavior per tool
- `allActions[]` (line 1206): Stroke recording with tool, points, color, opts — refactor target for PaintStroke type

### Established Patterns
- Tool selection via `data-tool` buttons with CSS `.active` class (line 1260)
- Per-tool cursor styles (line 1263): crosshair, grab, move, cell
- Pen data model: `{x, y, p, tx, ty, tw, spd}` interpolated via `resampleCurve()` and `avgPenData()`
- Pressure modulation: `hasPenInput ? 0.4+pen.p*0.6 : 1` pattern throughout brush code

### Integration Points
- Wet layer arrays (wetR, wetG, wetB, wetAlpha, wetness) — all brush types must write to these
- `compositeWetLayer()` — displays results of all brush operations
- `dryStep()` / `flowStep()` — physics simulation affects wet paint from all brush types
- Paper heightmap (`paperTextures[currentPaper].heightMap`) — influences flow for all wet brush operations

</code_context>

<specifics>
## Specific Ideas

- Paint brush has visible edge artifacts (strokeEdge() at line 400 produces jagged spiky marks on stroke borders) — must be fixed, not controlled via slider
- Mix tool's pickup blending merges into paint as default behavior — paint tool becomes the "full featured" brush
- Brush texture should create visible bristle-like variation in paint coverage AND add 3D emboss grain to strokes
- Stroke data model must be efx-motion-editor compatible from the start — not retrofitted in Phase 4

</specifics>

<deferred>
## Deferred Ideas

- Brush texture mask from Phase 1 deferred items — now addressed in this phase
- Tablet-specific stroke data model from Phase 1 — now addressed in this phase
- Stroke persistence (serialize/deserialize to JSON) — Phase 4
- Stroke replay from JSON (DEMO-04) — Phase 4
- 24-slider Kontrol panel (original Rebelle style) — Phase 5 if desired

</deferred>

---

*Phase: 03-brush-system-tools*
*Context gathered: 2026-03-30*
