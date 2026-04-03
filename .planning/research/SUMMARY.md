# Project Research Summary

**Project:** EFX-Motion Editor v0.7.0 — Physics Paint Engine Integration
**Domain:** pnpm monorepo migration + paint engine replacement for Tauri/Preact desktop app
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

v0.7.0 is a structural refactor and engine swap milestone. Two independent concerns must be executed in strict sequence: (1) convert the single-package repo into a pnpm monorepo with `app/` and `packages/efx-physic-paint/`, then (2) replace `perfect-freehand` + `p5.brush` with the new `@efxlab/efx-physic-paint` engine. The monorepo scaffold is pure infrastructure — no user-visible changes — but it is a hard prerequisite: the engine lives at `workspace:*` and cannot be imported until linking is established. The entire v0.7.0 feature set depends on this being correct before any rendering code is touched.

The recommended approach is a 6-phase build: scaffold first, then engine API adaptations (the engine needs headless constructor support before it can serve the editor's rendering needs), then adapter and type migration, then input enrichment and tool reconnection, then UI and new capabilities, then final cleanup. This ordering is driven by hard dependency chains. The engine's current API was designed for standalone use and cannot serve the editor headlessly without modifications. Building the adapter before those modifications exist produces dead code. The critical path is: scaffold → engine headless API → adapter layer → rendering integration → UI → cleanup.

The highest risk in the milestone is visual regression on brush style mapping. The 6 BrushStyle presets (flat, watercolor, ink, charcoal, pencil, marker) from p5.brush do not have direct equivalents in efx-physic-paint's continuous physics parameter space. Proposed mappings are LOW confidence and require iterative visual comparison against p5.brush reference output. Separately, sidecar data backward compatibility is a data safety risk: existing projects store perfect-freehand parameters that must continue to render after the engine swap, requiring a dual-rendering fallback path rather than a hard cutover.

## Key Findings

### Recommended Stack

No new external dependencies are needed. The engine has zero runtime dependencies; tsup (already its devDep) handles bundling. The monorepo uses pnpm 10.28.0 (already installed) with a single `pnpm-workspace.yaml` at the repo root. The root build script chains `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build` to ensure the library is compiled before the editor bundles it. Vite 5's ESM workspace link detection handles development; an explicit `optimizeDeps.exclude` entry is a safety net against WebGL state issues. For development iteration, aliasing the paint package's source TypeScript directly in Vite's `resolve.alias` gives true HMR without waiting for tsup rebuilds.

Two dependencies must be removed from the editor: `perfect-freehand` (replaced by the engine's stroke rendering with wet paint physics) and `p5.brush` (replaced entirely — the engine covers all FX capabilities plus adds physics). All other editor dependencies are unchanged.

**Core technologies:**
- `pnpm workspaces 10.28.0`: monorepo linking with `workspace:*` protocol — already installed, zero migration cost
- `@efxlab/efx-physic-paint 0.1.0` (workspace): physics paint engine — wet/dry buffers, Stam fluid solver, paper textures, transparency, AnimationPlayer, Preact wrapper, JSON brush format
- `tsup ^8.5.1`: library bundling for paint package — already configured with 3 entry points, ESM output, dts generation
- REMOVE `perfect-freehand ^1.2.3`: replaced by engine's stroke rendering pipeline with wet paint physics
- REMOVE `p5.brush 2.1.3-beta`: replaced entirely; lacks transparency support; incompatible rendering model

### Expected Features

The milestone has two distinct feature tiers. The first tier is migration parity: every existing paint feature must continue to work after the engine swap. Missing any of these is a regression from v0.6.0. The second tier is new capabilities the engine enables that were impossible with the old stack.

**Must have (table stakes — migration parity):**
- Freehand brush rendering with pressure — must produce output at least comparable to perfect-freehand
- All 6 brush style presets (flat, watercolor, ink, charcoal, pencil, marker) — HIGH risk, needs visual tuning phase
- Eraser tool — engine has native `applyEraseStroke()`; compositing model differs, requires dedicated sub-task
- Color selection, brush size, opacity — direct engine API mapping (`setColorHex`, `setBrushSize`, `setBrushOpacity`)
- Sidecar JSON persistence with backward compatibility — old projects must render; dual-format reader required
- Onion skinning — reconnect via `engine.getDisplayCanvas()` capture
- Per-frame FX cache — keep existing cache pattern, store engine canvas output
- Shape tools (line, rect, ellipse), flood fill, eyedropper — engine-independent, keep as-is
- Bezier path editing (v0.6.0) — editor-side; sampled points feed new engine instead of perfect-freehand
- Stroke list management, alt+drag duplicate, non-uniform scale (v0.6.0) — engine-independent, keep as-is

**Should have (new capabilities the swap enables):**
- Transparent background support — `BgMode = 'transparent'`; simplifies paint-over-photo compositing workflow
- Paper/canvas texture interaction — physics-based heightmap modulation; UI selector + bundled textures
- Physics UI controls — waterAmount, drySpeed, physicsStrength exposed in PaintProperties panel
- Wet-on-wet paint mixing — strokes interact via shared wet buffer (automatic, no additional UI required)
- Paint drying simulation — force-dry per frame for reproducibility; natural drying during interactive painting

**Defer to v0.7.x or later:**
- Blow/directional force tool — interesting interaction but not essential for engine swap milestone
- AnimationPlayer stroke replay within a single frame — niche; different from editor's frame model
- Custom user brush presets via JSON — needs UX design for brush management
- Per-stroke physics parameter isolation — architecturally expensive (isolated wet layers per stroke = 6x memory)
- Spectral pigment mixing (Kubelka-Munk) preservation — subtractive mixing from efx-physic-paint is acceptable

### Architecture Approach

The core pattern is a headless engine adapter. `EfxPaintEngine` was designed as a standalone paint app owning its own DOM canvases, pointer events, and render loop. The editor already owns all of those. Direct embedding creates dual ownership conflicts. Instead, the adapter creates the engine without DOM attachment, feeds stroke data programmatically via `load()` + `renderAllStrokes()`, and extracts the result via `getDisplayCanvas()` for compositing. Editor controls layout, events, and undo; engine controls physics rendering. The engine needs API modifications for this to work — specifically a headless constructor and a batch render method.

**Major components and their v0.7.0 changes:**
1. `efxPaintAdapter.ts` (new) — headless engine lifecycle; stroke format conversion; frame render + canvas extraction; replaces `brushP5Adapter.ts`
2. `EfxPaintEngine` in `packages/efx-physic-paint` (modified) — needs headless constructor and `renderFromStrokes()` batch API before adapter can use it
3. `paintStore.ts` (modified) — replaces `renderFrameFx()` calls with adapter; updates BrushStyle/BrushFxParams types; adds paper/transparency signals
4. `paintRenderer.ts` (modified) — removes `getStroke()` / perfect-freehand path; delegates brush rendering to adapter; keeps shape, fill, and bezier-sampling code
5. `PaintOverlay.tsx` (modified) — records full `PenPoint` format (x, y, p, tx, ty, tw, spd) instead of [x, y, pressure]; wires new brush params
6. `PaintProperties.tsx` (modified) — replaces style selector with physics param sliders; adds paper selector
7. `paintPersistence.ts` (modified) — version-bumped sidecar format; backward-compatible reader for old perfect-freehand strokes

### Critical Pitfalls

1. **Git history loss on directory rename** — rename `Application/` to `app/` must be an isolated commit containing zero other changes; use `git mv Application app` with nothing else staged; verify with `git log --follow app/src/main.tsx` before proceeding; combined with other changes drops similarity below Git's 50% detection threshold for 100+ files

2. **Lockfile stale references after restructure** — do NOT move `Application/pnpm-lock.yaml`; delete it entirely; create `pnpm-workspace.yaml` and root `package.json` first, then run `pnpm install` from root to generate a fresh lockfile; also move `pnpm.overrides` block to root `package.json` because child-package overrides are silently ignored in pnpm workspaces

3. **EfxPaintEngine lacks headless API** — the engine currently requires a DOM container; the adapter cannot be built until the engine gains an offscreen constructor and a batch render API; Phase 3 (adapter) must not start before Phase 2 (engine API) passes its gate

4. **PaintStroke type name collision** — both the editor and efx-physic-paint export a type named `PaintStroke` with incompatible shapes; use TypeScript import aliasing (`import { PaintStroke as PhysicStroke }`) and define a discriminator field (`engine: 'physic'`) to route rendering; the adapter layer must be built first before any rendering integration

5. **Brush style mapping is low-confidence** — proposed BrushOpts parameter values for 6 BrushStyle presets are initial estimates; plan for an explicit visual comparison phase against p5.brush reference output; do not declare the engine swap complete until all 6 styles pass visual review

6. **p5.brush removal is a subsystem removal, not a library swap** — `brushP5Adapter.ts` implements spectral mixing, watercolor bleed, paper grain, flow field distortion, and per-frame FX caching; it touches 26 files; keep both adapters alive during development using a per-stroke `engine` discriminator for routing; only remove p5.brush after all 6 styles confirm parity

## Implications for Roadmap

The dependency chain dictates a 6-phase sequence. No phase should begin until the previous phase's gate condition is verified.

### Phase 1: Monorepo Scaffold

**Rationale:** Hard prerequisite for everything else. The engine cannot be imported as a workspace package until the workspace structure exists. No paint code should be touched in this phase. Infrastructure and verification only.
**Delivers:** pnpm workspace with `app/` + `packages/efx-physic-paint/` linked; clean lockfile at repo root; Tauri dev/build verified; Vite HMR workflow confirmed; Preact single-instance verified; pnpm overrides at root
**Addresses:** Infrastructure foundation for all subsequent phases
**Avoids:** Git history loss (rename in isolated commit first); lockfile stale references (delete old, generate fresh); pnpm overrides silently ignored in child package; duplicate Preact instances (`resolve.dedupe`); Tauri CWD confusion (verify `tauri dev` from workspace root); Vite HMR gap (verify two-terminal workflow or alias to source TypeScript)
**Gate:** `pnpm dev` starts identical to v0.6.0; `pnpm tauri build` produces working `.app` bundle; `pnpm install --frozen-lockfile` passes from a clean clone

### Phase 2: Engine API Adaptations

**Rationale:** The editor needs the engine in headless mode. The engine does not currently support this. Building the adapter before these changes exist produces dead code. This phase modifies `packages/efx-physic-paint/` only — no editor code changes.
**Delivers:** EfxPaintEngine with headless constructor (offscreen canvases, no DOM container, no pointer events, no render loop); `renderFromStrokes()` batch API; paper texture injection from pre-loaded ImageData; verified transparent background output
**Uses:** `pnpm --filter @efxlab/efx-physic-paint dev:watch` for iterative development; `pnpm --filter @efxlab/efx-physic-paint build` for gate verification
**Implements:** Headless Engine Adapter foundation; Lazy Engine Instantiation with Size-Keyed Caching
**Gate:** Engine renders a set of strokes headlessly and returns a correct `HTMLCanvasElement`; no DOM required

### Phase 3: Adapter + Type Migration

**Rationale:** With the headless engine available, build the bridge that the editor's rendering pipeline will use. Type migration happens here to prevent the PaintStroke name collision from cascading through 26 files. The frame cache reconnection is included because it defines the performance contract for all subsequent work.
**Delivers:** `efxPaintAdapter.ts`; new `PhysicsBrushOpts` type alongside existing types with discriminator field; stroke format converter; `paintStore` wired to adapter for FX rendering; `_frameFxCache` storing engine output canvases; legacy `strokeToPath()` fallback for old strokes
**Implements:** Headless Engine Adapter pattern; Stroke Format Bridging pattern; dual-rendering path for old and new stroke formats
**Avoids:** Type collision cascade (import aliasing + discriminator field); sidecar backward compat break (dual-format reader keeps old strokes renderable)
**Gate:** Paint strokes render via physics engine; opening a v0.6.0 project renders all existing paint strokes correctly via legacy fallback path

### Phase 4: Input Enrichment + Tool Reconnection

**Rationale:** With the rendering pipeline proven, update the drawing pipeline to produce richer input data and reconnect tools that depend on engine-specific APIs. Eraser is a dedicated sub-task because its compositing model differs fundamentally between the old and new engines.
**Delivers:** `PaintOverlay.tsx` records full `PenPoint` data (tilt, twist, speed); new strokes use `BrushOpts`; eraser routed through engine's `applyEraseStroke()`; onion skinning reconnected via adapter canvas capture; eraser + undo/redo verified in both preview and export render paths
**Avoids:** Eraser compositing conflict (engine erase vs Canvas 2D destination-out); legacy strokes continue to use old eraser path for backward compatibility
**Gate:** Drawing new strokes uses physics engine end-to-end; eraser + undo works correctly; export renderer matches preview renderer output

### Phase 5: UI + Paper + Transparency + Persistence

**Rationale:** With rendering and input pipelines proven, surface the new engine capabilities in the UI and finalize the data format. Brush style visual tuning belongs here — not in Phase 3 — because tuning requires the full rendering path to be stable.
**Delivers:** `PaintProperties.tsx` with physics param sliders (waterAmount, dryAmount, edgeDetail, pickup, physicsStrength); paper texture selector UI; bundled paper texture assets; transparency layer mode (`bgMode: 'transparent'`); sidecar persistence version bump; backward-compatible loading for old paint sidecar data; all 6 brush styles visually reviewed against p5.brush output
**Addresses:** Paper/canvas texture interaction, transparency compositing, physics UI controls (all "should have" features); brush style visual parity (highest-risk requirement)
**Avoids:** Transparency default regression (opt-in only; keep white background as default to match existing project behavior); paper texture async loading gap (pre-load textures at project open)
**Gate:** Full feature parity with v0.6.0 paint PLUS paper textures and transparency; all 6 brush styles pass visual comparison

### Phase 6: Cleanup + Removal

**Rationale:** Remove dead code only after feature parity is confirmed across all previous phases. Cleanup is explicitly last to preserve fallback paths during development. Premature removal of p5.brush or perfect-freehand forecloses rollback options.
**Delivers:** `perfect-freehand` and `p5.brush` removed from dependencies; `brushP5Adapter.ts` deleted; `BrushStyle`, `StrokeFxState`, `BrushFxParams` types removed; flat/FX duality workflow eliminated; stale `paintStore` signals cleaned up; `.mce` format version bumped; `p5brush.d.ts` deleted; all tests passing
**Gate:** No dead code; clean dependency tree; `pnpm build` succeeds; export pipeline produces correct output; `pnpm install --frozen-lockfile` passes from clean clone

### Phase Ordering Rationale

- **Scaffold before everything:** `workspace:*` requires the workspace to exist before any import of the engine is valid. No other phase can start.
- **Engine API before adapter:** The adapter's core function is headless rendering. Without the headless constructor, the adapter has nothing to call. Building the adapter first creates non-compilable stubs.
- **Adapter before input enrichment:** The enriched `PenPoint` input data has no consumer until the rendering path in Phase 3 exists. Input changes in Phase 4 require Phase 3's rendering pipeline.
- **Rendering proven before UI:** Physics param sliders are meaningless until the rendering pipeline confirms those params produce correct visual output. Brush style tuning requires a stable full-stack render path.
- **Cleanup last:** Both p5.brush and the legacy rendering path must remain alive as fallbacks until all 6 brush styles pass visual review. Premature removal breaks existing projects and forecloses rollback.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Engine API):** The headless constructor pattern is inferred from the engine architecture. The exact API surface needs design against engine internals. Key questions: does the engine use `OffscreenCanvas` or plain `HTMLCanvasElement` without DOM attachment? How does paper texture injection work from ImageData vs URL? Does `renderAllStrokes()` require internal state reset between calls?
- **Phase 5 (Brush Style Mapping):** Proposed BrushOpts parameter values for 6 brush styles are initial estimates with LOW confidence. Plan for an explicit iterative tuning sub-phase with visual comparison tooling (side-by-side p5.brush vs efx-physic-paint rendering at matched parameters). This is the highest-uncertainty work in the milestone.

Phases with standard patterns (skip research):
- **Phase 1 (Monorepo Scaffold):** pnpm workspace documentation is authoritative. All specific gotchas are fully documented in PITFALLS.md with verified workarounds.
- **Phase 3 (Adapter + Types):** Adapter pattern is well-established. TypeScript import aliasing for name collision resolution is standard. No novel patterns.
- **Phase 4 (Input/Tools):** `PenPoint` format mapping and eraser routing are straightforward given the complete engine type definitions.
- **Phase 6 (Cleanup):** Dependency removal and dead code cleanup are mechanical tasks with no design decisions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Both codebases directly inspected; pnpm workspace docs authoritative; no external APIs to validate |
| Features | HIGH | Engine source fully reviewed; complete API surface known; one LOW-confidence gap: brush style visual tuning parameters |
| Architecture | HIGH | Both rendering pipelines fully analyzed; adapter pattern is proven; one gap: headless constructor needs design work in Phase 2 |
| Pitfalls | HIGH | Most pitfalls derived from direct codebase inspection + verified community issue trackers; recovery strategies documented |

**Overall confidence:** HIGH

### Gaps to Address

- **Brush style visual mapping (Phase 5):** The 6 proposed `BrushOpts` parameter sets are estimates. Cannot be validated without running both renderers side by side. Allocate explicit time for visual comparison iterations. Consider building a comparison tool (p5.brush on left, efx-physic-paint on right with adjustable params) to accelerate tuning.

- **Engine headless constructor API design (Phase 2):** The headless mode is needed but not yet designed. Key questions: `OffscreenCanvas` vs standard `HTMLCanvasElement` without attachment? Paper texture injection from ImageData vs URL? State reset behavior of `renderAllStrokes()` between calls? Resolve at the start of Phase 2 by reading engine internals in detail.

- **Memory budget at project resolution (Phases 3-6):** Engine buffers consume approximately 40MB at 1920x1080. Projects may use higher resolutions. Research recommends running the engine at viewport/display resolution for interactive use and scaling up only for export. The exact cap threshold and scaling strategy need definition during Phase 3 planning.

- **Export renderer divergence (Phase 4 gate):** `previewRenderer.ts` and `exportRenderer.ts` have separate paint compositing paths. Both paths must be explicitly verified against each other during Phase 4 integration, not just the preview path.

## Sources

### Primary (HIGH confidence)
- `~/Dev/efx-physic-paint/src/` (direct inspection) — full engine API surface, types, all 3 entry points, tsup config, headless capability assessment
- `Application/src/` (direct inspection) — all files identified for modification; current adapter, renderer, store, types, persistence, Vite config, Tauri config
- [pnpm Workspaces documentation](https://pnpm.io/workspaces) — workspace:* protocol, single lockfile, override scope rules
- [Vite Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) — optimizeDeps.exclude behavior, ESM workspace link handling
- `SPECS/milestone-v0.7.0-plan.md` (direct inspection) — confirmed rename to `app/`, workspace layout, feature list

### Secondary (MEDIUM confidence)
- [Vite monorepo HMR issues #6479, #13014](https://github.com/vitejs/vite/issues/) — symlink + HMR gap; workaround: alias to source TypeScript
- [Tauri monorepo discussion #7368](https://github.com/orgs/tauri-apps/discussions/7368) — Tauri 2 monorepo integration; beforeDevCommand CWD behavior
- [pnpm workspace peer dependency behavior #3558](https://github.com/pnpm/pnpm/issues/3558) — override scope rules confirmed

### Tertiary (LOW confidence, requires validation)
- Proposed BrushStyle -> BrushOpts parameter mappings — initial estimates requiring visual validation before committing
- Engine headless constructor API design — inferred from architecture; must be confirmed against engine source during Phase 2

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
