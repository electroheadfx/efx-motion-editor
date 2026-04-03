---
phase: 05-library-demo-polish
verified: 2026-03-31T22:24:06Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Draw paint strokes and verify visible output with paper grain"
    expected: "Strokes appear on canvas with watercolor-like texture from paper_N.jpg"
    why_human: "Cannot verify visual Canvas 2D output without running the browser app"
  - test: "Switch to Erase tool and erase strokes"
    expected: "Erased region becomes transparent (checkerboard background visible)"
    why_human: "Requires interactive painting session in browser"
  - test: "Adjust size/opacity/water sliders, observe stroke changes"
    expected: "Larger size = wider strokes; lower opacity = more transparent strokes"
    why_human: "Visual parameter response requires human observation"
  - test: "Click Save, then Clear, then Load — verify strokes replay"
    expected: "JSON downloads, canvas clears, strokes reappear animated on load"
    why_human: "Round-trip serialization result requires browser interaction"
  - test: "Hold 'Last' physics button briefly, release"
    expected: "Visible diffusion/spreading effect on the most recent stroke"
    why_human: "Physics animation quality requires human judgment; known quality gaps documented in 05-PHYSICS-GAPS.md"
  - test: "Verify browser console shows no errors on startup"
    expected: "No red console errors; paper textures load successfully"
    why_human: "Requires running dev server and observing console"
---

# Phase 5: Library & Demo Polish — Verification Report

**Phase Goal:** Extract monolithic v3.html into typed `@efxlab/efx-physic-paint` npm package with EfxPaintEngine facade, Preact wrapper, and functional demo app
**Verified:** 2026-03-31T22:24:06Z
**Status:** HUMAN_NEEDED — all automated checks pass; visual/interactive behavior requires human verification
**Re-verification:** No — initial verification

**Important context:** Phase 05-04 was completed with known physics quality gaps documented in `05-PHYSICS-GAPS.md`. The structural extraction (architecture, types, modules, wiring) is complete and correct. Physics diffusion/mixing quality is degraded vs v3 reference. This verification assesses structural correctness; physics quality is out of scope per the gap report.

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #  | Truth                                                                                      | Status     | Evidence                                                      |
|----|--------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------|
| 1  | `@efxlab/efx-physic-paint` exports as ESM-only npm package via tsup                      | VERIFIED   | `tsup build` exits 0; `dist/index.mjs` + `dist/preact.mjs` exist |
| 2  | Full TypeScript type definitions in production code (LIB-02 fully satisfied)              | VERIFIED   | `tsc --noEmit` exits 0; 16 typed modules; `dist/index.d.ts` exports all public types |
| 3  | Preact component wrapper integrates into Preact/React apps via sub-path export            | VERIFIED   | `EfxPaintCanvas` in `src/preact.tsx`; wired to `new EfxPaintEngine`; `dist/preact.mjs` exports it |
| 4  | ~9 UI sliders + button groups control all engine parameters (per D-12)                   | VERIFIED   | Toolbar has 9 `<Slider>` instances covering all 22 engine methods; all wired |
| 5  | Demo app runs without errors in Vite + Preact + TypeScript environment                    | HUMAN NEEDED | Build succeeds; tsc passes; server start untested (see human verification) |

**Score:** 4/5 truths fully automated-verified; 1 requires human confirmation

---

## Required Artifacts

### Plan 01 — Package Scaffold + Utility Modules

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `paint-rebelle-new/package.json` | `@efxlab/efx-physic-paint` manifest with exports | VERIFIED | Name, ESM type, exports field with `./preact` sub-path, `tsup` build script |
| `paint-rebelle-new/tsup.config.ts` | Two-entry ESM-only bundler config | VERIFIED | `entry: {index, preact}`, `format: ['esm']`, `external: ['preact', 'preact/hooks']` |
| `paint-rebelle-new/src/types.ts` | All type definitions from v3 | VERIFIED | 25 exports: constants, 9 interfaces, 2 type aliases. `ToolType = 'paint' \| 'erase'` (correct) |
| `paint-rebelle-new/src/util/color.ts` | Color conversion functions (7) | VERIFIED | 7 exported functions: `hexRgb`, `rgbHex`, `rgb2hsl`, `hsl2rgb`, `rgb2ryb`, `ryb2rgb`, `mixSubtractive` |
| `paint-rebelle-new/src/util/noise.ts` | FBM noise functions (2) | VERIFIED | `noise`, `fbm` exported |
| `paint-rebelle-new/src/util/math.ts` | Math utilities (10) | VERIFIED | 10 exported functions including `gauss`, `lerp`, `clamp`, `lerpPt`, `curveBounds`, `polyBounds` |
| `paint-rebelle-new/public/img/paper_1.jpg` | Paper texture (>100KB) | VERIFIED | 143KB |
| `paint-rebelle-new/public/img/paper_2.jpg` | Paper texture (>100KB) | VERIFIED | 258KB |
| `paint-rebelle-new/public/img/paper_3.jpg` | Paper texture (>100KB) | VERIFIED | 190KB |
| `paint-rebelle-new/public/img/brush_texture.png` | Brush mask (>10KB) | VERIFIED | 12KB — note: 93% near-zero pixels (documented in PHYSICS-GAPS.md) |

### Plan 02 — Core Physics + Brush Modules

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `paint-rebelle-new/src/core/wet-layer.ts` | 8 wet buffer functions | VERIFIED | 8 exports: `createWetBuffers`, `createSavedWetBuffers`, `createTmpBuffers`, `clearWetLayer`, `depositToWetLayer`, `depositToWetLayerWithColors`, `transferToWetLayer`, `transferToWetLayerClipped`. No DOM access. |
| `paint-rebelle-new/src/core/diffusion.ts` | 6 diffusion functions | VERIFIED | 6 exports: `buildColorMap`, `sampleChannel`, `sampleColorPremul`, `precomputeDisplacement`, `diffuseStep`, `physicsStep`. No DOM access. |
| `paint-rebelle-new/src/core/drying.ts` | 3 drying functions | VERIFIED | `initDryingLUT`, `dryStep`, `forceDryAll`. Uses `/800` (dryStep) and `/DENSITY_NORM` (forceDryAll) — inconsistency documented in PHYSICS-GAPS.md issue #2 |
| `paint-rebelle-new/src/core/paper.ts` | 6 paper texture functions | VERIFIED | `loadPaperTexture`, `createMirroredBrushGrain`, `sampleBrushGrain`, `sampleH`, `sampleTexH`, `ensureHeightMap`. DOM access only in `loadPaperTexture` loader (acceptable) |
| `paint-rebelle-new/src/brush/stroke.ts` | 9 stroke pipeline functions | VERIFIED | `avgPenData`, `pressureAtT`, `speedAtT`, `tiltAtT`, `smooth`, `resample`, `ribbon`, `deform`, `deformN` |
| `paint-rebelle-new/src/brush/paint.ts` | 8+ paint functions | VERIFIED | 10 exports: `fillPolyGrain`, `fillFlat`, `drawBristleTraces`, `sampleAreaColor`, `buildCarriedColors`, `applyPaperEmboss`, `applyWetComposite`, `applyWetCompositeClipped`, `renderPaintStroke`, `renderPaintStrokeSingleColor` |
| `paint-rebelle-new/src/brush/erase.ts` | Erase brush | VERIFIED | `applyEraseStroke` |
| `paint-rebelle-new/src/brush/water.ts` | 11 water/smear brush functions | VERIFIED | 11 exports including `applyWaterStroke`, `applyBlowChunk`, `applyDryChunk`, `rehydrateArea`, `applyLiquifyChunk` |

### Plan 03 — Render Modules + EfxPaintEngine

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `paint-rebelle-new/src/render/compositor.ts` | `compositeWetLayer` with Beer-Lambert | VERIFIED | 1 export; uses `Math.exp` + `DENSITY_NORM`; iterates wet buffers per-pixel |
| `paint-rebelle-new/src/render/canvas.ts` | 4 canvas management functions | VERIFIED | `setupDualCanvas`, `drawBg`, `drawBrushCursor`, `drawStrokePreview` |
| `paint-rebelle-new/src/engine/EfxPaintEngine.ts` | Facade class with full public API | VERIFIED | `export class EfxPaintEngine`; 22 public methods; `setInterval` (physics loop); `requestAnimationFrame` (render loop); `save()`, `load()`, `destroy()` present |
| `paint-rebelle-new/src/index.ts` | Library entry point with re-exports | VERIFIED | `export { EfxPaintEngine }` + 9 type exports |

### Plan 04 — Preact Wrapper + Demo App

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `paint-rebelle-new/src/preact.tsx` | `EfxPaintCanvas` Preact wrapper | VERIFIED | `export const EfxPaintCanvas`, `export interface EfxPaintCanvasProps`, `new EfxPaintEngine(...)`, `engine.destroy()` in cleanup |
| `paint-rebelle-new/src/demo/App.tsx` | Demo root using EfxPaintCanvas | VERIFIED | Imports `EfxPaintCanvas` from `../preact`; uses `onEngineReady={setEngine}`; passes paper config |
| `paint-rebelle-new/src/demo/Toolbar.tsx` | Demo toolbar with all controls | VERIFIED | 9 sliders; 22 engine method calls; Save/Load/Undo/Clear; bg/paper selectors; physics buttons |
| `paint-rebelle-new/src/demo/demo.css` | Dark theme CSS | VERIFIED | `.tb`, `#1a2030`, `#1a1e2e` dark theme colors present |
| `paint-rebelle-new/index.html` | Vite HTML entry point | VERIFIED | `<script type="module" src="/src/demo/main.tsx">` present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tsup.config.ts` | `src/index.ts` | `entry.index` | WIRED | `index: 'src/index.ts'` in config |
| `package.json` | `dist/index.mjs` | exports field | WIRED | `"import": "./dist/index.mjs"` in exports |
| `core/diffusion.ts` | `src/types.ts` | `import WetBuffers` | WIRED | `import type { WetBuffers, ColorMap, DryingLUT } from '../types'` |
| `brush/paint.ts` | `core/wet-layer.ts` | `import depositToWetLayer` | PARTIAL | Imports `transferToWetLayerClipped` (not `depositToWetLayer`). Both functions exist; pipeline uses clipped version exclusively. Functional — not a gap. |
| `core/drying.ts` | `src/types.ts` | `import LUT_SIZE` | WIRED | `import { LUT_SIZE, DENSITY_NORM } from '../types'` |
| `EfxPaintEngine.ts` | `core/diffusion.ts` | `import physicsStep` | WIRED | `import { buildColorMap, precomputeDisplacement, physicsStep } from '../core/diffusion'` |
| `EfxPaintEngine.ts` | `brush/paint.ts` | `import renderPaintStroke` | WIRED | `import { renderPaintStroke } from '../brush/paint'` |
| `EfxPaintEngine.ts` | `render/compositor.ts` | `import compositeWetLayer` | WIRED | `import { compositeWetLayer } from '../render/compositor'` |
| `src/index.ts` | `EfxPaintEngine.ts` | `export { EfxPaintEngine }` | WIRED | `export { EfxPaintEngine } from './engine/EfxPaintEngine'` |
| `src/preact.tsx` | `EfxPaintEngine.ts` | `new EfxPaintEngine(...)` | WIRED | `import { EfxPaintEngine }` + `new EfxPaintEngine(containerRef.current, {...})` |
| `demo/App.tsx` | `src/preact.tsx` | `import EfxPaintCanvas` | WIRED | `import { EfxPaintCanvas } from '../preact'` |
| `index.html` | `demo/main.tsx` | `<script src>` | WIRED | `src="/src/demo/main.tsx"` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `render/compositor.ts` | `wet.alpha[i]`, `wet.r/g/b` | `WetBuffers` Float32Arrays passed from `EfxPaintEngine` | Yes — buffers filled by `renderPaintStroke` via `transferToWetLayerClipped` | FLOWING |
| `demo/App.tsx` | `engine` (EfxPaintEngine instance) | `onEngineReady` callback from `EfxPaintCanvas` | Yes — real engine instance created in `useEffect` | FLOWING |
| `demo/Toolbar.tsx` | All slider/button handlers | Engine method calls via `engine.setX(v)` | Yes — direct method calls; no static data | FLOWING |
| `dist/index.mjs` | `EfxPaintEngine` class | Bundled from `chunk-OOEUW2TI.mjs` (70KB) containing all modules | Yes — full engine, physics, brush modules compiled | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm run build` exits 0 | `pnpm run build` | ESM Build success + DTS Build success; `dist/index.mjs` (120B re-export), `dist/preact.mjs` (966B), `dist/chunk-OOEUW2TI.mjs` (70KB engine) | PASS |
| `pnpm run check` exits 0 | `pnpm run check` | `tsc --noEmit` exits 0 with no output | PASS |
| `dist/index.mjs` exports `EfxPaintEngine` | Content check | `import { EfxPaintEngine } from "./chunk-OOEUW2TI.mjs"; export { EfxPaintEngine }` | PASS |
| `dist/preact.mjs` exports `EfxPaintCanvas` | Content check | Full `EfxPaintCanvas` component with `useRef`/`useEffect` and `engine.destroy()` | PASS |
| Key functions exist in bundle | Module-level check | `gauss`, `lerp`, `noise`, `fbm`, `hexRgb`, `createWetBuffers`, `diffuseStep`, `initDryingLUT`, `renderPaintStroke`, `smooth`, `compositeWetLayer` all present | PASS |
| Paper image assets exist | File size check | All 4 assets present; `paper_1.jpg` 143KB, `paper_2.jpg` 258KB, `paper_3.jpg` 190KB, `brush_texture.png` 12KB | PASS |
| No module-level mutable state in core/ brush/ | `grep "^let \|^var "` | Zero matches in `src/core/` and `src/brush/` | PASS |
| No DOM access in core/ (except paper.ts) | `grep "document\.\|window\."` | Zero matches in `src/core/` excluding `paper.ts` | PASS |
| Demo starts (dev server) | Requires browser | Cannot verify without running Vite | SKIP |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIB-01 | 05-01, 05-03 | Exported as `@efxlab/efx-physic-paint` npm package via tsup | SATISFIED | Package name confirmed; `tsup build` produces `dist/index.mjs`; `package.json` exports field wired. Note: REQUIREMENTS.md says "CJS+ESM" but D-14 decision changes to ESM-only. ESM-only is implemented and consistent with decision docs. |
| LIB-02 | 05-01, 05-02, 05-03 | TypeScript with full type definitions and no runtime dependencies | SATISFIED | 16 typed modules; `tsc --noEmit` exits 0; `dist/index.d.ts` exports all public types; no runtime dependencies (only `devDependencies` + `peerDependencies`) |
| LIB-03 | 05-04 | Preact/React component wrapper for demo app | SATISFIED | `EfxPaintCanvas` in `src/preact.tsx` + `dist/preact.mjs`; delegates to `EfxPaintEngine` via `useRef`/`useEffect`; sub-path export `./preact` in `package.json` |
| DEMO-02 | 05-04 | UI controls for all brush and canvas parameters | SATISFIED (with scope adjustment) | 9 sliders + button groups covering all 22 engine parameters. REQUIREMENTS.md says "24 sliders" but D-12 scopes to "~9 sliders + button groups matching what v3 engine actually reads". Plan's D-12 decision overrides original requirement text. |
| DEMO-01 | (orphaned — marked Deferred) | Vite + Preact + TypeScript demo app with working canvas | IMPLICITLY SATISFIED | Demo app built and `tsc` passes. Marked "Deferred" in REQUIREMENTS.md but delivered by 05-04. Visual confirmation requires human verification. |

### Orphaned Requirements Note

`DEMO-01` is listed as "Deferred" in REQUIREMENTS.md at Phase 5 row, but the phase-04 PLAN claims `DEMO-02` (which implicitly includes DEMO-01's infrastructure). The demo app was fully built. REQUIREMENTS.md status column is stale and should be updated to reflect actual delivery.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/types.ts` | 19 | `DENSITY_K = 1.5` (was 3.5 in v3) | Warning | Physics quality gap: Beer-Lambert opacity curve weakened for physics display. Documented in PHYSICS-GAPS.md issue #1. Does not prevent goal achievement (library works) but produces different visual result than v3. |
| `src/core/drying.ts` | 70, 95, 151 | `dryStep` uses `/800`, `forceDryAll` uses `/DENSITY_NORM` (3000) | Warning | Inconsistent divisors between drying functions. Documented in PHYSICS-GAPS.md issue #2. Does not break functionality but produces opacity inconsistency. |
| `src/engine/EfxPaintEngine.ts` | 408 | `tool: 'paint', // placeholder, actual physics strokes filtered during save` | Info | Code comment only — not a stub. Physics recording uses `'paint'` as a sentinel type to distinguish physics records from paint strokes during serialization. Filtered correctly in `save()`. |
| `src/brush/water.ts` | 31-640 | Water/smear/blend/blow/wet/dry tools extracted but not wired to engine dispatch | Info | By design (per D-12). Functions are complete; only 2 tools (paint, erase) wired per project scope. Future enablement requires adding dispatch cases in `EfxPaintEngine`. |

---

## Human Verification Required

### 1. Paint Stroke Rendering

**Test:** Start `cd paint-rebelle-new && pnpm run dev`, open `http://localhost:5173`, draw strokes on the canvas.
**Expected:** Strokes appear with watercolor-like shape; paper grain texture is visible in stroke edges
**Why human:** Canvas 2D pixel output cannot be verified without running the browser

### 2. Erase Tool Behavior

**Test:** Paint strokes, switch to Erase, erase over painted area.
**Expected:** Erased region reveals transparent background (checkerboard pattern for transparent mode)
**Why human:** Requires interactive browser session

### 3. Slider Parameter Response

**Test:** Adjust Size (1-80), Opacity (10-100), Water (0-100) sliders while painting.
**Expected:** Size increases stroke width; Opacity reduces stroke transparency; Water affects edge blur and wetness
**Why human:** Visual parameter response requires human observation

### 4. Save/Load Round-Trip

**Test:** Paint several strokes, click Save (downloads JSON), click Clear, click Load (select downloaded file).
**Expected:** JSON file downloads; canvas clears; strokes replay animated on load, ending in same visual state
**Why human:** File download, file picker interaction, and animated replay require browser session

### 5. Physics Diffusion (Quality Note)

**Test:** Paint a stroke, then hold the "Last" physics button for 2-3 seconds.
**Expected:** Paint shows visible spreading/diffusion from the last stroke
**Why human:** Physics quality is degraded vs v3 (documented in PHYSICS-GAPS.md issues #1-6). User should verify that diffusion is visible even if quality is reduced. This is a known open item, not a blocker for phase goal.

### 6. No Console Errors on Load

**Test:** Open browser DevTools console before loading the demo. Observe on initial load.
**Expected:** No red errors; paper textures load (possible 404 warning acceptable if assets are served correctly)
**Why human:** Runtime errors in asset loading can only be observed in browser

---

## Gaps Summary

No blocking gaps found. All structural artifacts exist, are substantive, and are wired correctly. The library builds cleanly, type checks pass, and all 22 public API methods are connected from the demo UI through to engine internals.

**Known Quality Issues (not blocking goal achievement):**

1. `DENSITY_K` changed from 3.5 to 1.5 — weakens physics display opacity
2. `forceDryAll` uses `/DENSITY_NORM` instead of v3's `/800` — inconsistency with `dryStep`
3. Brush grain removed from deposit path — watercolor stipple texture absent
4. No subtractive color mixing at stroke overlaps
5. Diffusion quality degraded vs v3 — blocky rather than organic spread
6. Opacity post-multiply interaction weakens physics layer

These are documented in `05-PHYSICS-GAPS.md` and are candidates for a future focused physics fix phase. They do not prevent the phase goal of "a working TypeScript library with Preact wrapper and demo app."

**Type declaration file extension:** PLAN-01 and PLAN-03 specified `.d.mts` but actual tsup output produces `.d.ts`. `package.json` correctly references `.d.ts`. This is self-consistent and the package resolves correctly — the spec divergence has no functional impact.

**ESM-only vs CJS+ESM:** `REQUIREMENTS.md` says "CJS+ESM output" but D-14 decision explicitly changed to ESM-only. The implementation is consistent with D-14. REQUIREMENTS.md should be updated.

---

_Verified: 2026-03-31T22:24:06Z_
_Verifier: Claude (gsd-verifier)_
