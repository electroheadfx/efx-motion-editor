# Phase 1: Algorithm Port Foundation - Context

**Gathered:** 2026-03-29 (updated — replaces 2026-03-28 context)
**Status:** Ready for planning

<domain>
## Phase Boundary

Working wet/dry physics engine with all 5 core physics features functioning in `efx-paint-physic-v1.html`. The file builds on paint-studio-v9.html (user's working brush engine) and adds watercolor physics. This phase completes the rendering flow redesign so all physics features work together correctly.

</domain>

<decisions>
## Implementation Decisions

### Source approach
- **D-01:** Build from `efx-paint-physic-v1.html` — a standalone HTML file based on paint-studio-v9.html with watercolor physics added on top
- **D-02:** The Processing.js port approach (rebelle-paint.js → TypeScript) is abandoned. rebelle-paint.js is conceptual reference only, not a porting source
- **D-03:** No line-by-line porting from obfuscated code — build fresh using physics concepts

### Implementation target
- **D-04:** Stay in single HTML file (`efx-paint-physic-v1.html`). No TypeScript modularization in Phase 1
- **D-05:** TypeScript module extraction and npm packaging are future phases (Phase 5 scope)

### Physics scope
- **D-06:** All 5 physics features must work in Phase 1:
  1. Paint deposits to wet layer ONLY (not direct canvas rendering)
  2. Wet layer compositing becomes the PRIMARY display
  3. Drying gradually bakes wet paint into the canvas
  4. Flow/diffusion spreads wet paint before it dries
  5. Paper texture modulates where paint settles
- **D-07:** Current state is partially working — physics infrastructure exists but rendering flow needs redesign

### Verification approach
- **D-08:** Manual visual verification — all 5 physics features visibly working together
- **D-09:** Success = wet paint spreads along paper texture, dries over time, compositing shows correct result

### Carried forward (still valid)
- **D-10:** Canvas 2D rendering (not WebGL)
- **D-11:** Package name: `@efxlab/efx-physic-paint` — no "rebelle" or "Rebelle" in any identifier
- **D-12:** Dual-layer wet/dry concept (wetR/G/B/Alpha arrays + canvas as dry layer)

### efx-paint/ cleanup
- **D-13:** User will delete `efx-paint/` directory themselves (old Processing.js port, abandoned)

### Claude's Discretion
- Physics tuning constants (drying rate, diffusion strength, flow speed)
- Rendering pipeline implementation details
- Bug fix prioritization within the 5 features

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `efx-paint-physic-v1.html` — THE implementation file. Contains all code: wet layer, paper texture, drying, diffusion, compositing, tools, UI
- `efx-paint-physic-v1.md` — Notes on what needs to happen next (5-step rendering flow redesign)
- `paint-studio-v9.html` — Original working brush engine (baseline that v1.html builds on)

### Project requirements
- `.planning/ROADMAP.md` §Phase 1 — Phase goal, success criteria, requirements (PHYS-01, PHYS-02, PHYS-03, CANVAS-01, CANVAS-02, LIB-02, DEMO-01)
- `.planning/REQUIREMENTS.md` — Full v1 requirement definitions

### Debug history (reference only)
- `.planning/debug/efx-paint-no-painting.md` — Documents 10 bugs found in the old Processing.js port. Some physics concepts may be relevant but the code fixes apply to the abandoned efx-paint/ directory

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `efx-paint-physic-v1.html` — Full working baseline with: wet layer arrays (JS arrays, 64-bit precision), paper texture loading from img/paper_1.jpg, noise/math/color mixing utils, pen point helpers with pressure/tilt, curve smoothing and resampling, ribbon polygon generation, paint/smudge/liquify/mix tools, drying simulation (10fps), diffusion flow (10fps), wet layer compositing overlay, background mode selector, PointerEvent input handling
- `paint-studio-v9.html` — Brush engine foundation: RYB subtractive color mixing, bristle traces, polygon grain fills, pickup blending, all tool types

### Established Patterns
- Dual canvas approach: hidden `c` canvas for paint data + visible `displayCanvas` for composited output
- Wet layer as plain JS arrays (wetR, wetG, wetB, wetAlpha, wetness) — 64-bit float precision
- Paper texture: 512x512 jpg tiled across canvas, red channel as heightmap (Float32Array)
- Physics runs at 10fps via setInterval, independent of painting framerate
- Pen data model: `{x, y, p, tx, ty, tw, spd}` (position, pressure, tilt X/Y, twist, speed)
- RYB subtractive mixing via HSL→RYB wheel mapping

### Integration Points
- Paper texture images: `img/paper_1.jpg`, `img/paper_2.jpg`, `img/paper_3.jpg`
- No external dependencies — pure vanilla JS
- Tools: paint, smudge, liquify, mix (with mix combining all three)

</code_context>

<specifics>
## Specific Ideas

- The 5-step rendering redesign from efx-paint-physic-v1.md is the core work: make paint deposit ONLY to wet layer, make wet compositing the primary display, wire up drying→canvas transfer, enable diffusion flow pre-drying, and paper texture modulation
- Physics already partially works — this is a redesign/fix task, not greenfield

</specifics>

<deferred>
## Deferred Ideas

- TypeScript modularization — Phase 5 (Library & Demo Polish)
- npm package export — Phase 5
- Brush texture mask (brush_texture.png with quadrant mirroring) — Phase 3
- Tablet-specific stroke data model — Phase 3
- Multi-layer compositing pipeline refinement — Phase 2
- Density-weighted transparency (from paint-studio-v9) — Phase 2

</deferred>

---

*Phase: 01-algorithm-port-foundation*
*Context gathered: 2026-03-29 (updated)*
