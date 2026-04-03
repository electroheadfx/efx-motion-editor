# Phase 5: Library & Demo Polish - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the monolithic `efx-paint-physic-v3.html` (2953 lines) into a typed `@efxlab/efx-physic-paint` npm package with framework-agnostic vanilla TS core, Preact wrapper as sub-path export, and minimal functional demo app. After extraction, move v3.html to `./cleaning/`.

</domain>

<decisions>
## Implementation Decisions

### Module extraction strategy
- **D-01:** Functional split by concern — decompose v3.html into focused modules by what the code does, not OOP class boundaries
- **D-02:** Module structure:
  - `src/core/` — wet-layer.ts, diffusion.ts, drying.ts, paper.ts
  - `src/brush/` — paint.ts, erase.ts, water.ts, stroke.ts
  - `src/render/` — compositor.ts, canvas.ts
  - `src/util/` — color.ts, noise.ts, math.ts
- **D-03:** Top-level EfxPaintEngine facade class ties all modules together. Consumers never touch internals — one import, simple API: `init(canvas)`, `setTool()`, `setBrushSize()`, `onPointerDown(event)`
- **D-04:** Rewrite types.ts from scratch based on v3 code. Old types.ts references v2, has wrong tool types and physics constants. Clean slate

### Library architecture
- **D-05:** Framework-agnostic vanilla TS core with zero runtime dependencies. Framework wrappers ship as sub-path exports in the same package
- **D-06:** Phase 5 ships: vanilla core (`@efxlab/efx-physic-paint`) + Preact wrapper (`@efxlab/efx-physic-paint/preact`). React/Solid/Svelte wrappers deferred to future phases
- **D-07:** Consumer provides asset URLs (paper textures, brush texture) via config. No bundled assets — keeps package small. Demo app serves images from /public

### Library public API
- **D-08:** EfxPaintEngine facade pattern:
  ```ts
  import { EfxPaintEngine } from '@efxlab/efx-physic-paint'
  const engine = new EfxPaintEngine(canvas, {
    width: 1000, height: 650,
    papers: [{ name: 'smooth', url: '/img/paper_1.jpg' }],
    brushTexture: '/img/brush_texture.png'
  })
  engine.setTool('paint')
  engine.setBrushSize(12)
  ```
- **D-09:** Preact wrapper as thin component delegating to core engine:
  ```ts
  import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
  ```

### Demo app
- **D-10:** Minimal functional demo — exercises the library API with canvas, tool switching (paint/erase), sliders for all engine params, paper/background selectors, save/load, physics controls. No fancy styling, not production UI
- **D-11:** Demo UI is external from the core engine — the demo may be replaced. Real UI comes from efx-motion-editor
- **D-12:** Only 2 tools currently in v3: Paint and Erase. Slider count matches what the v3 engine actually reads (~9 sliders + button groups), not the original 24

### Package & build
- **D-13:** Repurpose paint-rebelle-new/ directory. Library source in src/, demo app in src/demo/, single package.json as `@efxlab/efx-physic-paint`
- **D-14:** ESM-only output via tsup (no CJS). Modern consumers (Vite, Next.js, efx-motion-editor/Tauri) all use ESM
- **D-15:** Package exports:
  ```json
  {
    ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.ts" },
    "./preact": { "import": "./dist/preact.mjs", "types": "./dist/preact.d.ts" }
  }
  ```
- **D-16:** After extraction, move efx-paint-physic-v3.html to `./cleaning/` (gitignored folder)

### Claude's Discretion
- Internal module boundaries within the functional split (exact file contents)
- tsup configuration details
- Vite config for demo dev server
- How to handle the dual-canvas pattern (hidden c + displayCanvas) in the module extraction
- Preact wrapper props interface design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `efx-paint-physic-v3.html` — THE monolithic implementation file (2953 lines). All physics, brushes, rendering, UI, serialization. This is what gets extracted into TypeScript modules
- `paint-rebelle-new/src/types.ts` — Outdated type definitions (v2 era). Will be rewritten from scratch but useful as reference for interface patterns

### Project requirements
- `.planning/ROADMAP.md` §Phase 5 — Phase goal, success criteria, requirements (LIB-01, LIB-02, LIB-03, DEMO-02)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for LIB-01, LIB-02, LIB-03, DEMO-02

### Prior phase context
- `.planning/phases/04.1-physics-simulation-fix-load-render-fidelity/04.1-CONTEXT.md` — D-01/D-02/D-03: FBM diffusion algorithm (the physics to extract)
- `.planning/phases/04-drying-persistence/04-CONTEXT.md` — D-01/D-04/D-05: LUT drying and serialization format
- `.planning/phases/03-brush-system-tools/03-CONTEXT.md` — D-01 through D-17: brush types and PaintStroke format
- `.planning/phases/01-algorithm-port-foundation/01-CONTEXT.md` — D-11: package name constraint

### Build tooling
- `paint-rebelle-new/tsconfig.json` — Existing TypeScript base config
- `paint-rebelle-new/vite.config.ts` — Existing Vite config (demo dev server)
- `paint-rebelle-new/package.json` — Existing package manifest (to be updated with @efxlab/efx-physic-paint)

### Integration target
- efx-motion-editor `PaintStroke` type — the library must produce compatible stroke JSON (see PROJECT.md §Context)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `efx-paint-physic-v3.html` — Full working paint engine: FBM diffusion, LUT drying, density-weighted transparency, 2 brush types (paint/erase), save/load serialization, dual-canvas compositing
- `paint-rebelle-new/tsconfig.json` — TypeScript config with strict mode, ES2023 target, Preact JSX
- `paint-rebelle-new/vite.config.ts` — Vite dev server config with Preact preset (port 5173)
- `img/paper_1.jpg`, `img/paper_2.jpg`, `img/paper_3.jpg` — Paper textures (512x512)
- `img/brush_texture.png` — Brush texture mask (512x512)

### Established Patterns
- Dual canvas: hidden `c` (dry paint + operations) + visible `displayCanvas` (wet overlay) via CSS z-index
- Wet layer as Float32Array arrays (wetR, wetG, wetB, wetAlpha, wetness)
- Physics at 10fps via setInterval, independent of paint framerate
- Paper heightmap: 512x512 jpg red channel → Float32Array, tiled across canvas
- FBM-displaced darken-flood diffusion with precomputed displacement map
- LUT-driven drying (dL/ao two-table system)
- Pen data model: `{x, y, p, tx, ty, tw, spd}` via PointerEvent coalescing

### Integration Points
- Library will be consumed by efx-motion-editor as `@efxlab/efx-physic-paint`
- PaintStroke JSON format must remain compatible with efx-motion-editor
- Preact wrapper used by demo app and eventually by efx-motion-editor's paint layer
- Paper texture images served from consumer's static assets (not bundled)

</code_context>

<specifics>
## Specific Ideas

- Vanilla core with zero framework dependencies — wrappers for Preact, React, Solid, Svelte added as sub-path exports over time
- The demo app is a throwaway reference implementation — real UI comes from efx-motion-editor
- Only Paint and Erase tools exist in v3 — don't add dead UI for tools that aren't implemented
- After extraction, v3.html moves to `./cleaning/` (gitignored), not deleted from disk

</specifics>

<deferred>
## Deferred Ideas

- React wrapper (`@efxlab/efx-physic-paint/react`) — future phase
- Solid wrapper (`@efxlab/efx-physic-paint/solid`) — future phase
- Svelte wrapper (`@efxlab/efx-physic-paint/svelte`) — future phase
- Animated stroke-by-stroke playback — from Phase 4 deferred
- 24-slider Kontrol panel (original Rebelle style) — not needed, only expose what engine uses
- npm registry publishing — deferred to v2 requirements (LIB-04)

</deferred>

---

*Phase: 05-library-demo-polish*
*Context gathered: 2026-03-31*
