# Phase 2: Rendering Pipeline - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Wet/dry paint composites correctly to canvas with paper texture as background only, with density-weighted transparency. Includes fixing visible flow/diffusion so wet paint actually changes stroke shape before drying (gravity, paper-guided spreading). Paper texture selector verified with new pipeline.

</domain>

<decisions>
## Implementation Decisions

### Compositing model
- **D-01:** Keep dual-canvas overlay approach (main canvas = dry + background, displayCanvas = wet overlay via CSS z-index). Current approach works and doesn't need refactoring to single-canvas merge.
- **D-02:** Fix flow/diffusion visibility — currently strokes keep their shape, wet paint doesn't visibly spread. Flow physics exists in code (`flowStep()`) but isn't producing visible shape changes. This is included in Phase 2 scope.

### Paper texture role
- **D-03:** Paper texture is NOT double-applied — current separation is correct. Paper heightmap influences physics (flow direction, drying modulation), paper image is visual background only. No change needed here.
- **D-04:** Paper grain (heightmap) must be decoupled from background visibility. When painting on transparent background, paper grain STILL influences flow, drying, and emboss in the paint strokes. User gets watercolor-look strokes on transparent canvas.
- **D-05:** Paper selector and background mode are two separate controls:
  - Paper selector: picks the grain/heightmap for physics (always active)
  - Background toggle: transparent or show paper image
  - Default state: paper background visible
- **D-06:** Changing paper mid-session: new strokes use the new paper heightmap, old dried strokes remain unchanged. No visual reset when switching papers or background mode.

### Density-weighted transparency
- **D-07:** Transparency uses density-driven model — paint alpha comes from accumulated pigment density at each pixel. Light strokes = transparent washes, heavy strokes = opaque coverage. Overlapping strokes build up density naturally.
- **D-08:** NOT globalAlpha-based — per-pixel density calculation replaces the current simple `wetAlpha/2000*240` mapping.
- **D-09:** Light washes show paper texture through the paint — thin deposits are semi-transparent, revealing paper grain underneath. Heavier deposits cover more paper. Classic watercolor look.

### Paper selector (DEMO-03)
- **D-10:** Paper selector UI already exists with 3 papers. Phase 2 just verifies it works correctly with the new pipeline — switching papers updates both visual background AND physics heightmap.

### Claude's Discretion
- Exact density-to-alpha mapping curve (linear, logarithmic, or custom)
- Flow/diffusion tuning constants (threshold, fraction, gravity bias values)
- Implementation details for decoupling paper heightmap from background mode
- Whether `ensureHeightMap()` procedural fallback needs adjustment

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `efx-paint-physic-v1.html` — THE implementation file. Contains compositing (`compositeWetLayer()` line 997), drying (`dryStep()`), flow (`flowStep()` line 889), background rendering (`drawBg()` line 1037), paper texture loading
- `paint-studio-v9.html` — Reference for transparency approach (pickup blending, RYB subtractive mixing). Relevant for density-weighted blending concepts

### Project requirements
- `.planning/ROADMAP.md` §Phase 2 — Phase goal, success criteria, requirements (RENDER-01, RENDER-02, DEMO-03)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for RENDER-01, RENDER-02, DEMO-03
- `.planning/phases/01-algorithm-port-foundation/01-CONTEXT.md` — Phase 1 decisions (D-04: single HTML file, D-10: Canvas 2D, D-12: dual-layer concept)

### Debug history
- Memory: transport-velocity-bug — Flow/transport was disabled because velocity accumulated without damping, scattered paint. Relevant to D-02 flow fix.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compositeWetLayer()` (line 997): Existing wet layer display loop — needs density-weighted alpha replacement
- `dryStep()` (line ~825): Wet-to-dry baking with paper modulation — works, needs density integration
- `flowStep()` (line 889): Flow/diffusion with paper heightmap and gravity bias — exists but not producing visible results
- `paperTextures` object (line 140): Paper texture loading and tiling — already loads all 3 papers with heightmaps
- `ensureHeightMap()` (line 875): Procedural heightmap fallback when no paper loaded

### Established Patterns
- Dual canvas: hidden `c` (dry paint) + visible `displayCanvas` (wet overlay) via CSS z-index
- Wet layer as JS arrays: wetR, wetG, wetB, wetAlpha, wetness — 64-bit float precision
- Paper heightmap: 512x512 jpg red channel → Float32Array, tiled across canvas
- Physics at 10fps via setInterval, independent of paint/display framerate
- Background modes: transparent, white, canvas1/2/3, photo — `bgMode` string + `drawBg()` renderer

### Integration Points
- Paper texture images: `img/paper_1.jpg`, `img/paper_2.jpg`, `img/paper_3.jpg`
- Background selector buttons: `.bgb` elements with `data-bg` attribute
- Flow constants: `FLOW_THRESHOLD`, `FLOW_FRACTION`, `GRAVITY_BIAS` — tunable per dry preset

</code_context>

<specifics>
## Specific Ideas

- User wants watercolor strokes on transparent background that still show paper grain in the paint — like painting on textured paper but exporting with transparency
- Flow/diffusion should visibly change stroke shape: gravity makes paint drip, paper texture guides spreading, wet paint bleeds before drying
- The "classic watercolor look" where thin washes are translucent and paper shows through

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-rendering-pipeline*
*Context gathered: 2026-03-29*
