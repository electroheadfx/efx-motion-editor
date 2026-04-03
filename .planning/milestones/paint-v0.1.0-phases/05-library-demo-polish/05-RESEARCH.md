# Phase 5: Library & Demo Polish - Research

**Researched:** 2026-03-31
**Domain:** TypeScript library packaging (npm), Preact component wrappers, tsup bundling, monolith-to-module extraction
**Confidence:** HIGH

## Summary

Phase 5 extracts the monolithic `efx-paint-physic-v3.html` (2953 lines, ~65 functions, ~280 variables) into a typed `@efxlab/efx-physic-paint` npm package. The source code is a single `<script>` block containing all physics, brush, rendering, serialization, and UI code. The target architecture is a functional-split module structure under `paint-rebelle-new/src/` with tsup producing ESM-only output and `.d.ts` declarations. A Preact wrapper ships as a sub-path export (`@efxlab/efx-physic-paint/preact`).

The extraction is primarily a decomposition exercise -- no new algorithms need writing. The challenge is correctly partitioning shared state (17+ Float32Array buffers totaling ~85MB at 1000x650) across modules while maintaining the exact same rendering behavior. The dual-canvas pattern (hidden `c` for dry paint + visible `displayCanvas` for wet overlay) must be preserved as-is.

**Primary recommendation:** Use tsup 8.5.1 with two entry points (`src/index.ts` and `src/preact.tsx`), ESM-only format, and `dts: true`. Preact is a peerDependency -- never bundled. The facade class `EfxPaintEngine` owns all typed array buffers and passes slices to functional modules.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Functional split by concern -- decompose v3.html into focused modules by what the code does, not OOP class boundaries
- **D-02:** Module structure:
  - `src/core/` -- wet-layer.ts, diffusion.ts, drying.ts, paper.ts
  - `src/brush/` -- paint.ts, erase.ts, water.ts, stroke.ts
  - `src/render/` -- compositor.ts, canvas.ts
  - `src/util/` -- color.ts, noise.ts, math.ts
- **D-03:** Top-level EfxPaintEngine facade class ties all modules together. Consumers never touch internals -- one import, simple API: `init(canvas)`, `setTool()`, `setBrushSize()`, `onPointerDown(event)`
- **D-04:** Rewrite types.ts from scratch based on v3 code. Old types.ts references v2, has wrong tool types and physics constants. Clean slate
- **D-05:** Framework-agnostic vanilla TS core with zero runtime dependencies. Framework wrappers ship as sub-path exports in the same package
- **D-06:** Phase 5 ships: vanilla core (`@efxlab/efx-physic-paint`) + Preact wrapper (`@efxlab/efx-physic-paint/preact`). React/Solid/Svelte wrappers deferred to future phases
- **D-07:** Consumer provides asset URLs (paper textures, brush texture) via config. No bundled assets -- keeps package small. Demo app serves images from /public
- **D-08:** EfxPaintEngine facade pattern with specific API shape (see CONTEXT.md)
- **D-09:** Preact wrapper as thin component delegating to core engine
- **D-10:** Minimal functional demo -- exercises the library API with canvas, tool switching (paint/erase), sliders for all engine params, paper/background selectors, save/load, physics controls
- **D-11:** Demo UI is external from the core engine -- the demo may be replaced
- **D-12:** Only 2 tools currently in v3: Paint and Erase. Slider count matches what the v3 engine actually reads (~9 sliders + button groups), not the original 24
- **D-13:** Repurpose paint-rebelle-new/ directory. Library source in src/, demo app in src/demo/, single package.json as `@efxlab/efx-physic-paint`
- **D-14:** ESM-only output via tsup (no CJS). Modern consumers all use ESM
- **D-15:** Package exports: `"."` -> dist/index.mjs + types, `"./preact"` -> dist/preact.mjs + types
- **D-16:** After extraction, move efx-paint-physic-v3.html to `./cleaning/` (gitignored folder)

### Claude's Discretion
- Internal module boundaries within the functional split (exact file contents)
- tsup configuration details
- Vite config for demo dev server
- How to handle the dual-canvas pattern (hidden c + displayCanvas) in the module extraction
- Preact wrapper props interface design

### Deferred Ideas (OUT OF SCOPE)
- React wrapper (`@efxlab/efx-physic-paint/react`) -- future phase
- Solid wrapper (`@efxlab/efx-physic-paint/solid`) -- future phase
- Svelte wrapper (`@efxlab/efx-physic-paint/svelte`) -- future phase
- Animated stroke-by-stroke playback -- from Phase 4 deferred
- 24-slider Kontrol panel (original Rebelle style) -- not needed, only expose what engine uses
- npm registry publishing -- deferred to v2 requirements (LIB-04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIB-01 | Exported as `@efxlab/efx-physic-paint` npm package via tsup (CJS+ESM output) | tsup 8.5.1 with ESM-only output (per D-14 override of CJS). Two entry points: `src/index.ts` (core) + `src/preact.tsx` (wrapper). Package exports field maps sub-paths to dist files. |
| LIB-02 | TypeScript with full type definitions and no runtime dependencies | All v3.html code extracted to typed TS modules. types.ts rewritten from scratch (D-04). tsup `dts: true` generates `.d.ts` files. Zero runtime deps -- preact is peerDependency only. |
| LIB-03 | Preact/React component wrapper for demo app | Preact wrapper as `EfxPaintCanvas` component using `useRef<HTMLCanvasElement>` + `useEffect` for lifecycle. Ships via `@efxlab/efx-physic-paint/preact` sub-path. React wrapper deferred per D-06. |
| DEMO-02 | UI controls for all brush and canvas parameters | ~9 sliders + button groups matching what v3 engine actually reads (per D-12): size, opacity, water, dry speed, pressure, detail, pickup (paint), strength (erase), physics strength. Plus tool buttons, bg/paper selectors, grain buttons, wet/dry mode, save/load, undo/clear. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Framework**: Vite + Preact + TypeScript (demo app); library is vanilla TS
- **Rendering**: Canvas 2D only (no WebGL)
- **Package name**: `@efxlab/efx-physic-paint` -- no "rebelle" or "Rebelle" in any identifier
- **Paper textures**: Must load and composite `paper_N.jpg` images same as original
- **Brush texture**: Must load and use `brush_texture.png` mask
- **Library target**: Usable in both browser (canvas) and eventually native (Tauri)
- **Naming**: PascalCase for classes/components, camelCase for functions/variables, kebab-case for CSS
- **Preact JSX**: Use `class` attribute (not `className`), `jsxImportSource: "preact"`
- **No test framework** currently configured

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsup | 8.5.1 | Library bundler (ESM output + .d.ts) | Per D-13/D-14. Locked decision. Note: tsup is in maintenance mode; successor is tsdown. tsup 8.x is stable and sufficient for this use case. |
| preact | 10.29.0 | UI framework (peerDependency for wrapper) | Per project stack. Wrapper only -- core has zero deps |
| vite | 8.0.3 | Demo app dev server | Per project stack |
| @preact/preset-vite | 2.10.5 | Preact integration for Vite | Per project stack |
| typescript | 5.9.3 | Type checking | Per project stack. Note: 6.0.2 exists but 5.9.3 matches existing tsconfig |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.2 | Test framework | For validation tests (smoke tests that engine initializes, exports exist) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsup 8.5.1 | tsdown 0.21.7 | tsdown is the recommended successor (Rolldown-based, faster) but is 0.x/unstable. tsup is locked per CONTEXT.md and stable. |
| TypeScript 5.9.3 | TypeScript 6.0.2 | 6.x available but 5.9.3 aligns with existing project config. Upgrade is optional. |

**Installation:**
```bash
cd paint-rebelle-new
pnpm init
pnpm add preact
pnpm add -D tsup typescript vite @preact/preset-vite @types/node vitest
```

**Version verification:** All versions verified against npm registry on 2026-03-31.

## Architecture Patterns

### Recommended Project Structure
```
paint-rebelle-new/
  package.json            # @efxlab/efx-physic-paint
  tsconfig.json           # Strict, ES2023, DOM
  tsconfig.build.json     # For tsup: emit declarations
  tsup.config.ts          # Two entry points, ESM-only
  vite.config.ts          # Demo dev server (port 5173)
  public/
    img/
      paper_1.jpg         # Copied from cleaning/rebelle/img/
      paper_2.jpg
      paper_3.jpg
      brush_texture.png
  src/
    index.ts              # Library entry: re-exports EfxPaintEngine + types
    preact.tsx             # Preact wrapper entry: exports EfxPaintCanvas
    types.ts              # All type definitions (rewritten from scratch)
    core/
      wet-layer.ts        # Float32Array wet paint buffers + operations
      diffusion.ts        # FBM-displaced darken-flood diffusion
      drying.ts           # LUT-driven drying system
      paper.ts            # Paper texture loading + heightmap
    brush/
      paint.ts            # Paint brush stroke rendering
      erase.ts            # Erase brush
      water.ts            # Water/smear/blend/blow/wet/dry brush stubs (v3 has them but only paint+erase active)
      stroke.ts           # Stroke processing: smooth, resample, ribbon, deform
    render/
      compositor.ts       # Wet layer compositing to display canvas
      canvas.ts           # Canvas management, background drawing, dual-canvas setup
    util/
      color.ts            # HSB/RGB/HSL/RYB conversions, hex utilities
      noise.ts            # FBM noise, Perlin-like noise functions
      math.ts             # clamp, lerp, dist, gauss, etc.
    engine/
      EfxPaintEngine.ts   # Facade class: owns all state, delegates to modules
    demo/
      main.tsx            # Demo entry point
      App.tsx             # Demo app component
      Toolbar.tsx         # Slider/button UI
      demo.css            # Demo styles (dark theme matching v3)
  dist/                   # tsup output (gitignored)
    index.mjs
    index.d.mts
    preact.mjs
    preact.d.mts
```

### Pattern 1: Facade Class Owning Shared State

**What:** EfxPaintEngine creates and owns all Float32Array buffers (wetR, wetG, wetB, wetAlpha, wetness, dryPos, etc.) and passes them to functional modules as arguments. Modules are pure functions that operate on buffers passed in -- they do NOT hold state.

**When to use:** Always. This is the core architecture pattern per D-03.

**Example:**
```typescript
// src/engine/EfxPaintEngine.ts
import type { EngineConfig, EngineState, ToolType, BrushOpts } from '../types'
import { createWetLayer, clearWetLayer } from '../core/wet-layer'
import { diffuseStep } from '../core/diffusion'
import { dryStep, initDryingLUT } from '../core/drying'
import { loadPaperTexture } from '../core/paper'
import { renderPaintStroke } from '../brush/paint'
import { applyEraseStroke } from '../brush/erase'
import { compositeWetLayer } from '../render/compositor'
import { setupCanvas, drawBackground } from '../render/canvas'

export class EfxPaintEngine {
  private state: EngineState
  private canvas: HTMLCanvasElement
  private displayCanvas: HTMLCanvasElement
  // ... all typed array buffers

  constructor(canvas: HTMLCanvasElement, config: EngineConfig) {
    // Create second canvas for wet overlay
    // Initialize all Float32Array buffers
    // Load paper texture + brush texture
    // Start render loop
  }

  setTool(tool: ToolType): void { /* ... */ }
  setBrushSize(size: number): void { /* ... */ }
  setColorHex(hex: string): void { /* ... */ }
  // ... facade methods
}
```

### Pattern 2: Functional Modules with Buffer Arguments

**What:** Each module exports pure functions that receive typed array buffers and canvas contexts as arguments. No module-level state.

**When to use:** For all core/, brush/, render/, util/ modules.

**Example:**
```typescript
// src/core/diffusion.ts
import type { WetBuffers, DisplacementMap } from '../types'
import { fbm } from '../util/noise'

export function precomputeDisplacement(
  width: number,
  height: number,
  paperHeight: Float32Array | null,
  dispPxX: Float32Array,
  dispPxY: Float32Array
): void {
  // Same algorithm as v3.html precomputeDisplacement()
  // Writes directly into provided Float32Array buffers
}

export function diffuseStep(
  wet: WetBuffers,
  tmp: WetBuffers,
  colorMap: { r: Float32Array, g: Float32Array, b: Float32Array },
  dispPxX: Float32Array,
  dispPxY: Float32Array,
  width: number,
  height: number,
  params: DiffusionParams
): void {
  // Same algorithm as v3.html diffuseStep()
}
```

### Pattern 3: Preact Wrapper as Thin Delegate

**What:** The Preact component creates a canvas, instantiates EfxPaintEngine in useEffect, forwards props changes to engine setters, and cleans up on unmount.

**When to use:** For the `@efxlab/efx-physic-paint/preact` export.

**Example:**
```typescript
// src/preact.tsx
import { useRef, useEffect } from 'preact/hooks'
import type { FunctionalComponent } from 'preact'
import { EfxPaintEngine } from './engine/EfxPaintEngine'
import type { EngineConfig } from './types'

export interface EfxPaintCanvasProps extends EngineConfig {
  width?: number
  height?: number
  class?: string
  onEngineReady?: (engine: EfxPaintEngine) => void
}

export const EfxPaintCanvas: FunctionalComponent<EfxPaintCanvasProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EfxPaintEngine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new EfxPaintEngine(containerRef.current, props)
    engineRef.current = engine
    props.onEngineReady?.(engine)
    return () => engine.destroy()
  }, [])

  // Forward prop changes to engine
  useEffect(() => {
    // engine.setBrushSize(props.brushSize) etc.
  }, [props.brushSize, /* ... */])

  return <div ref={containerRef} class={props.class} />
}
```

### Pattern 4: Dual Canvas Inside Container

**What:** The engine creates two canvases inside a container div: a hidden canvas `c` for dry paint operations and a visible `displayCanvas` for wet overlay compositing. Both are CSS-positioned with z-index.

**When to use:** The engine constructor handles this internally. The consumer provides a container div (or the Preact wrapper creates one).

**Rationale:** v3.html uses `<canvas id="c">` (dry, z-index:1) and `<canvas id="displayCanvas">` (wet overlay, z-index:2, pointer-events:none). The engine must create both canvases programmatically since consumers only provide a mount point.

### Anti-Patterns to Avoid
- **Module-level mutable state:** Never use `let x = new Float32Array(...)` at module scope. All buffers live on the EfxPaintEngine instance. Modules receive buffers as function arguments.
- **DOM access in core modules:** Core, brush, and util modules must never touch `document` or `window`. Only `render/canvas.ts` and the facade constructor interact with DOM.
- **Bundling preact:** Preact must be `peerDependencies` and `external` in tsup config. Never bundle framework code into the library output.
- **Copying v3 variable names verbatim:** v3.html uses single-letter names (`C`, `X`, `W`, `H`). The TS modules must use descriptive names (`dryCanvas`, `dryCtx`, `width`, `height`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Library bundling | Custom Rollup/esbuild config | tsup 8.5.1 | Handles ESM output, .d.ts generation, tree-shaking, external deps in one config file |
| Type declarations | Manual .d.ts files | tsup `dts: true` | Generates from source automatically, stays in sync |
| Demo dev server | Custom server | Vite 8.0.3 + @preact/preset-vite | HMR, asset serving, Preact JSX transform already configured |
| Module resolution | Manual path aliases | TypeScript `moduleResolution: "bundler"` | Already in tsconfig, works with both Vite and tsup |

## Common Pitfalls

### Pitfall 1: Shared Mutable State Across Modules
**What goes wrong:** Extracting v3.html globals into module-level `let` variables creates hidden coupling between modules. Two modules accidentally share state through imports.
**Why it happens:** v3.html has ~17 Float32Array buffers and ~30 scalar variables at script scope. The temptation is to create a `state.ts` module that exports them all.
**How to avoid:** All mutable state lives on the `EfxPaintEngine` class instance. Functional modules receive state as arguments. No module exports mutable variables.
**Warning signs:** If you see `import { wetR } from '../core/wet-layer'` where `wetR` is a mutable buffer, this is wrong.

### Pitfall 2: tsup dts Generation Fails with Preact JSX
**What goes wrong:** tsup's `dts: true` may fail when processing `.tsx` files that use Preact JSX because it needs the correct `jsxImportSource` setting.
**Why it happens:** tsup uses TypeScript's declaration emitter, which needs tsconfig to specify `"jsx": "react-jsx"` and `"jsxImportSource": "preact"` for Preact files.
**How to avoid:** Create a `tsconfig.build.json` that extends the base tsconfig and adds JSX settings. Point tsup's `tsconfig` option at it.
**Warning signs:** "Cannot find module 'preact/jsx-runtime'" errors during `tsup` build.

### Pitfall 3: Package Exports Not Resolving
**What goes wrong:** `import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'` fails with "Cannot find module" even though the file exists in dist/.
**Why it happens:** The `exports` field in package.json must exactly match the import path, including the condition keys (`import`, `types`).
**How to avoid:** Use this exact pattern in package.json:
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./preact": {
      "types": "./dist/preact.d.mts",
      "import": "./dist/preact.mjs"
    }
  }
}
```
Note: `types` must come BEFORE `import` in the condition order. TypeScript resolves the first matching condition.
**Warning signs:** TypeScript editor errors on the import path. Test with `node --conditions=import -e "import('@efxlab/efx-physic-paint')"`.

### Pitfall 4: Canvas Context Lost During Module Split
**What goes wrong:** v3.html uses `const X = C.getContext('2d')` once at the top. During extraction, if you pass the canvas to a module and it calls `getContext('2d')` again, you get the same context -- but if you create a NEW canvas in a module, the reference to `X` is stale.
**Why it happens:** Canvas 2D contexts are bound to canvas elements. Creating canvases in the wrong place breaks the dual-canvas pattern.
**How to avoid:** The EfxPaintEngine constructor creates both canvases and their contexts. All modules receive `CanvasRenderingContext2D` as a parameter, never create canvases themselves (except offscreen temp canvases for brush operations).
**Warning signs:** Blank canvas, drawing appears on wrong canvas, display canvas shows nothing.

### Pitfall 5: ROADMAP vs CONTEXT.md Discrepancies
**What goes wrong:** The ROADMAP says "CJS+ESM via tsup" and "24 UI sliders" but CONTEXT.md locked decisions say ESM-only (D-14) and ~9 sliders (D-12).
**Why it happens:** ROADMAP was written before the discuss session. CONTEXT.md represents the user's refined decisions.
**How to avoid:** CONTEXT.md decisions ALWAYS override ROADMAP text. The requirements (LIB-01 "CJS+ESM", DEMO-02 "24 sliders") are satisfied by the CONTEXT.md versions: ESM-only is sufficient for all target consumers; actual slider count matches what the engine reads.

### Pitfall 6: TypedArray Buffer Sizes Hardcoded to 1000x650
**What goes wrong:** v3.html uses `const W=C.width, H=C.height` and allocates `new Float32Array(W*H)` everywhere. If the library hardcodes 1000x650, consumers cannot use different canvas sizes.
**Why it happens:** v3.html is built for a single fixed canvas.
**How to avoid:** EfxPaintEngine constructor accepts `width` and `height` in config. All buffer allocations use these values. Default to 1000x650 for backward compatibility.
**Warning signs:** Out-of-bounds array access when canvas size differs from 1000x650.

### Pitfall 7: Physics Interval Not Cleaned Up
**What goes wrong:** v3.html uses `setInterval` for physics at 10fps. If the engine is destroyed without clearing the interval, it runs forever.
**Why it happens:** No cleanup path exists in v3.html (it runs for the page lifetime).
**How to avoid:** EfxPaintEngine must have a `destroy()` method that clears all intervals, cancels requestAnimationFrame, and removes event listeners.
**Warning signs:** Memory leaks, "cannot read property of null" errors after unmounting.

## Code Examples

### tsup.config.ts
```typescript
// Source: tsup official docs + verified configuration pattern
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    preact: 'src/preact.tsx',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['preact', 'preact/hooks'],
  tsconfig: 'tsconfig.build.json',
  outExtension: () => ({ js: '.mjs' }),
})
```

### package.json
```json
{
  "name": "@efxlab/efx-physic-paint",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./preact": {
      "types": "./dist/preact.d.mts",
      "import": "./dist/preact.mjs"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "preact": ">=10.0.0"
  },
  "peerDependenciesMeta": {
    "preact": { "optional": true }
  },
  "scripts": {
    "build": "tsup",
    "dev": "vite",
    "check": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "~5.9.3",
    "vite": "^8.0.3",
    "@preact/preset-vite": "^2.10.5",
    "preact": "^10.29.0",
    "@types/node": "^24.12.0"
  }
}
```

### tsconfig.build.json (for tsup dts generation)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/demo/**"]
}
```

### vite.config.ts (demo dev server)
```typescript
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  root: '.',
  server: { port: 5173 },
})
```

### Engine Config Type
```typescript
// src/types.ts (excerpt)
export interface PaperConfig {
  name: string
  url: string
}

export interface EngineConfig {
  width?: number          // default 1000
  height?: number         // default 650
  papers: PaperConfig[]
  brushTexture: string    // URL to brush_texture.png
  defaultPaper?: string   // key to auto-select
}

export type ToolType = 'paint' | 'erase'

export interface BrushOpts {
  size: number            // 1-80
  opacity: number         // 10-100
  pressure: number        // 10-100
  waterAmount: number     // 0-100
  dryAmount: number       // 0-100
  edgeDetail: number      // 0-100
  pickup: number          // 0-100 (paint tool)
  eraseStrength: number   // 0-100 (erase tool)
}
```

### v3.html Function-to-Module Mapping
```
v3.html function              -> Target module
------------------------------------------
buildColorMap()               -> core/diffusion.ts
initDryingLUT()               -> core/drying.ts
dryStep()                     -> core/drying.ts
loadPaperTexture()            -> core/paper.ts
createMirroredBrushGrain()    -> core/paper.ts
sampleBrushGrain()            -> core/paper.ts
noise(), fbm()                -> util/noise.ts
sampleChannel()               -> core/diffusion.ts
sampleColorPremul()           -> core/diffusion.ts
gauss(), lerp(), dist() etc.  -> util/math.ts
hexRgb(), rgbHex() etc.       -> util/color.ts
rgb2hsl(), hsl2rgb()          -> util/color.ts
rgb2ryb(), ryb2rgb()          -> util/color.ts
mixSubtractive()              -> util/color.ts
smooth(), resample()          -> brush/stroke.ts
ribbon(), deform()            -> brush/stroke.ts
fillPolyGrain()               -> brush/paint.ts
fillFlat()                    -> brush/paint.ts
drawBristleTraces()           -> brush/paint.ts
depositToWetLayer()           -> core/wet-layer.ts
transferToWetLayer()          -> core/wet-layer.ts
renderPaintStroke()           -> brush/paint.ts
applyEraseStroke()            -> brush/erase.ts
applyWaterStroke() etc.       -> brush/water.ts (stubs)
precomputeDisplacement()      -> core/diffusion.ts
diffuseStep()                 -> core/diffusion.ts
physicsStep()                 -> core/diffusion.ts (orchestrator)
compositeWetLayer()           -> render/compositor.ts
drawBg()                      -> render/canvas.ts
drawBrushCursor()             -> render/canvas.ts
drawStrokePreview()           -> render/canvas.ts
serializeProject()            -> engine/EfxPaintEngine.ts
loadProject()                 -> engine/EfxPaintEngine.ts
extractPenPoint()             -> engine/EfxPaintEngine.ts (input handling)
getOpts()                     -> (demo only, not in library)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tsup (actively maintained) | tsup in maintenance mode, tsdown recommended | Nov 2025 | tsup 8.5.1 is stable and works. Migration to tsdown is optional for future phases. |
| CJS+ESM dual output | ESM-only for modern consumers | 2024-2025 trend | Per D-14: Vite, Next.js, Tauri all consume ESM natively. No CJS needed. |
| TypeScript 5.x | TypeScript 6.0.2 available | 2026 | 5.9.3 is sufficient. 6.x upgrade is compatible but not required. |

**Deprecated/outdated:**
- `types.ts` in paint-rebelle-new: References v2 variable names, wrong ToolType (`'paint' | 'smudge' | 'liquify' | 'mix'` instead of `'paint' | 'erase'`), wrong physics constants. Must be rewritten from scratch per D-04.

## Open Questions

1. **Dual canvas ownership: container or canvas?**
   - What we know: v3.html has `<canvas id="c">` and `<canvas id="displayCanvas">` as siblings in a wrapper div. The engine needs both.
   - What's unclear: Should the EfxPaintEngine constructor receive a container div (and create both canvases inside it) or receive the primary canvas (and create the display canvas as a sibling)?
   - Recommendation: Container div approach is cleaner. The Preact wrapper creates a div, the engine creates canvases inside it. This matches D-08's `init(canvas)` by accepting a parent element.

2. **Brush types beyond paint/erase**
   - What we know: v3.html has code for water, smear, blend, blow, wet, dry tools (functions exist). D-12 says only paint/erase are active.
   - What's unclear: Should we extract the other brush functions or leave them out?
   - Recommendation: Extract all brush functions into their modules but only wire paint/erase in the engine. The code exists in v3 and should be preserved. Other tools can be enabled in future phases without re-extraction.

3. **Physics interval vs requestAnimationFrame**
   - What we know: v3.html uses `setInterval` at 10fps for physics and `requestAnimationFrame` for display compositing.
   - What's unclear: Whether to keep the dual-loop pattern or unify.
   - Recommendation: Keep dual-loop. The physics at 10fps is intentional (slower physics = more stable simulation). Display compositing at rAF gives smooth visuals.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | Yes | v22.22.1 | -- |
| pnpm | Package management | Yes | 10.28.0 | -- |
| TypeScript | Type checking | Yes (via npx) | 5.9.3 (project) / 6.0.2 (registry) | -- |
| tsup | Library bundling | No (install needed) | 8.5.1 (registry) | -- |
| Vite | Demo dev server | No (install needed) | 8.0.3 (registry) | -- |
| Preact | Wrapper component | No (install needed) | 10.29.0 (registry) | -- |
| vitest | Testing | Yes (via npx) | 4.1.2 | -- |

**Missing dependencies with no fallback:**
- tsup, Vite, Preact, @preact/preset-vite: Must be installed via `pnpm add`. This is expected -- the package.json does not exist yet.

**Missing dependencies with fallback:**
- None. All dependencies are installable.

**Image assets:** Paper textures and brush texture exist at `cleaning/rebelle/img/`. Must be copied to `paint-rebelle-new/public/img/` for the demo app.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | None -- see Wave 0 |
| Quick run command | `pnpm exec vitest run --reporter=verbose` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIB-01 | Package exports resolve correctly | unit | `pnpm exec vitest run src/__tests__/exports.test.ts -t "exports"` | No -- Wave 0 |
| LIB-02 | All types are exported and valid | unit | `pnpm exec tsc --noEmit` | No -- tsc check |
| LIB-02 | tsup build succeeds without errors | smoke | `pnpm run build` | No -- build script |
| LIB-03 | Preact wrapper renders without errors | unit | `pnpm exec vitest run src/__tests__/preact-wrapper.test.tsx` | No -- Wave 0 |
| DEMO-02 | Demo app starts without errors | smoke | `pnpm run dev` (manual verification) | manual-only: requires browser |

### Sampling Rate
- **Per task commit:** `pnpm run build && pnpm exec tsc --noEmit`
- **Per wave merge:** `pnpm exec vitest run`
- **Phase gate:** Full build + type check + vitest green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- vitest configuration with preact/jsdom support
- [ ] `src/__tests__/exports.test.ts` -- verify package exports resolve
- [ ] `src/__tests__/preact-wrapper.test.tsx` -- verify wrapper renders
- [ ] Framework install: `pnpm add -D vitest @vitest/browser jsdom`

## Sources

### Primary (HIGH confidence)
- v3.html source code (2953 lines) -- direct analysis of all functions, buffers, and UI elements
- npm registry -- verified versions: tsup 8.5.1, preact 10.29.0, vite 8.0.3, typescript 6.0.2, vitest 4.1.2, @preact/preset-vite 2.10.5
- [tsup GitHub](https://github.com/egoist/tsup) -- maintenance mode notice, tsdown recommendation
- [Preact hooks docs](https://preactjs.com/guide/v10/hooks/) -- useRef, useEffect API for wrapper
- [2ality ESM package tutorial](https://2ality.com/2025/02/typescript-esm-packages.html) -- package.json exports field structure

### Secondary (MEDIUM confidence)
- [DEV.to tsup multiple entry points](https://dev.to/tigawanna/building-and-publishing-npm-packages-with-typescript-multiple-entry-points-tailwind-tsup-and-npm-9e7) -- tsup config with multiple entries, verified against tsup docs
- [tsdown official site](https://tsdown.dev/guide/getting-started) -- successor to tsup context

### Tertiary (LOW confidence)
- None. All findings verified against primary sources or direct code analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, tsup pattern well-established
- Architecture: HIGH -- based on direct analysis of v3.html source code (all 65 functions mapped)
- Pitfalls: HIGH -- derived from actual code patterns (shared state, dual canvas, buffer sizes) not speculation

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (60 days -- stable domain, no fast-moving dependencies)
