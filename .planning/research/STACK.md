# Stack Research

**Domain:** standalone runnable/testable physics paint demo app for `packages/efx-physic-paint`
**Researched:** 2026-06-08
**Confidence:** HIGH for repo-local stack/configuration; MEDIUM for exact package latestness due to Vite/Vitest major-version compatibility choices

## Executive Summary

`packages/efx-physic-paint` should become runnable by adding a **package-local Vite + Preact demo app** beside the library source, not by creating a Tauri app and not by reviving the failed headless adapter path. The existing package already exports a browser-first engine (`EfxPaintEngine`) and a Preact wrapper (`EfxPaintCanvas`), and the current repo stack already standardizes on pnpm, Preact, Vite 5, TypeScript 5.9, and tsup. The shortest safe path is to keep tsup for library builds and add Vite only for an interactive demo surface.

Testing should split into two layers: **Node/Vitest unit tests** for pure simulation/math/serialization utilities and **Playwright-driven browser tests** for the interactive canvas app, export buttons, pointer input, and visual regression. Canvas physics depends on real browser APIs (`HTMLCanvasElement`, `PointerEvent`, `requestAnimationFrame`, image loading, and screenshot/export behavior), so `happy-dom`/`jsdom` should not be the primary confidence path for the app. Use them only if a small DOM-only component test is needed later.

The package should gain export/inspection hooks in the **engine API and demo UI**, not via a headless batch renderer. The safe stack addition is lightweight: local demo files, `vite.config.ts`, `index.html`, a small Preact app, optional paper assets under package-local `public/`, Vitest config, and Playwright config. Do not add Redux, heavy UI libraries, a separate bundler, Electron, a new workspace app, or frame-batch `renderFromStrokes`/`forceDryAll` integration tooling in this milestone.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pnpm workspaces | root pins `pnpm@10.27.0` | Run package-local demo/test scripts through `--filter` | Already the repository standard and user preference; no npm/yarn split-brain. Root already has `packages/*` in `pnpm-workspace.yaml`. |
| TypeScript | `~5.9.3` | Engine/demo/test type safety | Already used by both app and package; no version drift needed. |
| tsup | `^8.5.1` | Library build for `dist/*.mjs` and `.d.ts` | Already configured in package scripts; keep it focused on publishable library output rather than asking Vite to do both library and demo jobs. |
| Vite | `5.4.21` | Standalone browser demo dev server/build | Match the existing app’s Vite major/minor to avoid monorepo toolchain churn. Vite docs verify package-local `root`, dev server, and build input patterns. |
| @preact/preset-vite | `^2.10.5` | Preact JSX/HMR integration in package demo | The app already uses Preact, and the package already exposes `src/preact.tsx`; a Preact demo maximizes reuse with the eventual editor/window integration. |
| Preact | use repo override `^10.28.4` or package current `^10.29.0` | Demo UI and wrapper component | Keep Preact rather than React to match EFX Motion Editor and avoid duplicate UI runtime assumptions. Root override currently forces Preact-compatible resolution. |
| @preact/signals | root override `^2.8.1` if state grows | Demo control panel state | Optional but recommended if controls become shared with editor integration; use local `useState` first for very small controls. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | `^1.60.0` current npm; pin a compatible exact/range in package devDeps | Browser E2E, pointer simulation, export/download assertions, screenshot/visual checks | Use for all interactive demo confidence: drawing strokes, changing tools, exporting PNG/project JSON/frame sequence, inspecting debug state. |
| vitest | keep repo-compatible `^2.1.9` initially | Fast unit tests for pure modules | Use for `util/`, color math, serialization, brush parameter normalization, and engine API methods that can be tested without a real canvas. Avoid upgrading the whole repo to Vitest 4 during this milestone. |
| pixelmatch | `^7.2.0` | Deterministic pixel diff for exported PNGs when Playwright snapshots are too coarse | Use for export regression tests comparing generated output to golden PNGs with a tolerance. |
| pngjs | `^7.0.0` | PNG decode/encode in Node-side assertions | Use with `pixelmatch` for inspecting exported frame PNG dimensions/alpha rather than visual screenshots only. |
| vite-plugin-static-copy | `^4.1.1` | Copy demo sample assets only if Vite `public/` is insufficient | Usually avoid; Vite `public/` is simpler. Use only if sample paper/photo fixtures must be copied from a shared non-public folder. |
| lucide-preact | existing app uses `^0.577.0`; optional package devDep only | Small demo toolbar icons | Only add if icons materially improve manual testing. Text buttons/sliders are enough for MVP. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vite --host 127.0.0.1` | Run package demo only | Add as `packages/efx-physic-paint` script `dev`; root can expose `dev:paint` to this script. Do not ask the assistant to run the server per project instruction. |
| `vite build --outDir demo-dist` | Build static standalone demo | Keeps demo artifacts separate from library `dist/`. Do not publish `demo-dist` unless intentionally documenting it. |
| `vitest run` | Unit tests | Add as package script `test:unit`; include only pure/module tests. |
| `playwright test` | Interactive/browser regression tests | Add as package script `test:e2e`; configure `webServer` to start the package Vite demo in CI/local runs. |
| `tsc --noEmit` | Type checking | Existing `check` remains valid; update tsconfig includes if demo/test files need checking. |

## Installation

Use pnpm and install dev dependencies in the package workspace. Recommended command shape:

```bash
pnpm --filter @efxlab/efx-physic-paint add -D vite@5.4.21 @preact/preset-vite@^2.10.5 @playwright/test vitest@^2.1.9 pixelmatch pngjs
```

Optional only if the demo needs icons or asset copying beyond Vite `public/`:

```bash
pnpm --filter @efxlab/efx-physic-paint add -D lucide-preact vite-plugin-static-copy
```

Do **not** install with npm. The root package pins pnpm and the user memory explicitly says this monorepo uses pnpm.

## Package Script Changes

### `packages/efx-physic-paint/package.json`

Recommended scripts:

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite --host 127.0.0.1` | Run the interactive standalone demo. |
| `demo` | `vite --host 127.0.0.1` | Alias if README wants the advertised `pnpm demo` wording. |
| `build` | `tsup` | Keep existing library build unchanged. |
| `build:demo` | `vite build --outDir demo-dist` | Build a static demo without polluting library `dist/`. |
| `dev:watch` | `tsup --watch` | Keep existing library watch for editor consumption. |
| `check` | `tsc --noEmit` | Keep existing type check. |
| `test` | `pnpm test:unit && pnpm test:e2e` | Full package test gate. |
| `test:unit` | `vitest run` | Pure/unit tests. |
| `test:e2e` | `playwright test` | Browser demo tests. |
| `test:e2e:ui` | `playwright test --ui` | Manual debugging only. |

### root `package.json`

Current root `dev:paint` points to `dev:watch`, which only rebuilds the library and does not run the README’s promised demo. Change/add:

| Root Script | Recommended Command | Why |
|-------------|---------------------|-----|
| `dev:paint` | `pnpm --filter @efxlab/efx-physic-paint dev` | Makes the standalone app the default milestone workflow. |
| `dev:paint:watch` | `pnpm --filter @efxlab/efx-physic-paint dev:watch` | Keeps old library watch behavior available. |
| `test:paint` | `pnpm --filter @efxlab/efx-physic-paint test` | Gives roadmap/CI one command for this milestone’s package confidence. |

## Recommended File Additions

Add these files inside `packages/efx-physic-paint/`:

| File/Folder | Purpose | Notes |
|-------------|---------|-------|
| `index.html` | Vite HTML entry for standalone demo | Package-local, not root-level. |
| `vite.config.ts` | Demo dev/build config | Use `@preact/preset-vite`; keep `publicDir: 'public'`; output demo to `demo-dist`. |
| `src/demo/main.tsx` | Preact bootstrap | Imports `DemoApp` and demo CSS. |
| `src/demo/DemoApp.tsx` | Interactive paint surface and controls | Prefer direct `EfxPaintEngine` access or `EfxPaintCanvas` with `onEngineReady`; controls call engine setters. |
| `src/demo/demo.css` | Minimal standalone styling | Use CSS variables/plain CSS; do not add Tailwind build pipeline to this package unless needed later. |
| `src/demo/export.ts` | Demo-only export helpers | PNG download, JSON project save/load, optional frame-sequence capture using `AnimationPlayer`. |
| `src/demo/inspect.ts` | Demo-only inspection helpers | Converts engine state/strokes/canvas metadata into JSON for UI/test hooks. |
| `public/papers/*` | Demo paper texture fixtures | Use local paths in `EngineConfig.papers`; keep small deterministic fixtures. |
| `tests/unit/*.test.ts` | Pure unit tests | Serialization, utility math/color, exported types/API shape. |
| `tests/e2e/*.spec.ts` | Browser tests | Draw, inspect, export, clear/load, frame sequence behavior. |
| `playwright.config.ts` | E2E config | Use `webServer` with package Vite command; artifacts on failure. |
| `vitest.config.ts` | Unit test config | Node environment by default; no fake canvas unless explicitly testing DOM wrapper. |

## Vite Configuration Pattern

Use a package-local Vite config. Recommended shape:

```ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'demo-dist',
    emptyOutDir: true,
  },
})
```

Rationale:

- Package-local `index.html` and config avoid creating a new workspace app just for a milestone demo.
- Port `5174` avoids colliding with the main editor’s default Vite port `5173`.
- `demo-dist` avoids mixing demo build assets with tsup library output in `dist/`.
- Vite official docs verify `root`, dev-server config, and build input/outDir patterns; no custom backend or Tauri bridge is required.

## Demo App Integration Points

The demo should expose the engine as a live, inspectable app:

| Integration Point | Stack/Implementation | Why |
|-------------------|----------------------|-----|
| Engine lifecycle | `new EfxPaintEngine(container, { width, height, papers, defaultPaper })` plus `await engine.init()` | Matches current engine constructor and Preact wrapper; avoids invented adapter layers. |
| UI framework | Preact component in `src/demo/DemoApp.tsx` | Same UI runtime as editor; exercises `src/preact.tsx` if using wrapper. |
| Controls | Native inputs/buttons first | Brush size, opacity, pressure, water, dry speed, edge detail, pickup, erase strength, physics strength, viscosity, bg mode, paper grain. No UI kit. |
| Export PNG | `engine.getDisplayCanvas().toBlob()` or composed export helper | Captures wet overlay/display output, not only dry canvas. Also test transparent bg export. |
| Save/load project | `engine.save()` and `engine.load(json)` | Uses actual `SerializedProject` path and proves data can later feed editor cache. |
| Inspect hooks | `window.__efxPaintDemo = { engine, getState, getStrokes, exportPng, saveProject }` in dev/test builds | Lets Playwright and manual debugging inspect without private DOM scraping. |
| Frame-sequence export | `AnimationPlayer` with `onFrame(frameIndex, canvas)` collecting blobs | Good for future cached compositing; still interactive/replay-based, not a headless batch adapter. |
| Test selectors | `data-testid` on canvas host, export buttons, sliders, inspector panel | Keeps Playwright tests stable without coupling to CSS. |

### Engine API gaps to add for clean inspection/export

The current public API includes `save()`, `load()`, `getCanvas()`, `getDisplayCanvas()`, and `getStrokes()`, but inspection is currently limited. Add small read-only helpers rather than exposing internals:

| API Addition | Purpose | Why |
|--------------|---------|-----|
| `getState(): Readonly<EngineState>` or `getSnapshot()` | Inspector panel and tests | Avoids reading private fields or relying on UI text. Return copies for nested mutable values. |
| `getSize(): { width: number; height: number }` | Export/test metadata | Avoids reaching into private dimensions. |
| `toBlob(options?: { display?: boolean; type?: string; quality?: number }): Promise<Blob>` | Export still image | Centralizes display-vs-dry-canvas choice. |
| `toDataURL(options?: ...)` | Quick manual debugging | Optional; `toBlob` is better for large canvases. |
| `loadFromFile/json validation helper` | Demo load robustness | Keep minimal; full migration/backward compatibility is out of scope. |

Do not add broad mutation APIs or editor-specific cache interfaces yet. Keep export/inspection generic.

## Testing Stack Pattern

### Unit tests with Vitest

Use `vitest@^2.1.9` initially because the root app already uses Vitest 2 and Vite 5. Vitest docs show Browser Mode and newer project config, but this milestone should avoid a major Vitest upgrade unless the main app is upgraded deliberately.

Recommended unit targets:

- `src/util/color.ts`
- `src/util/math.ts`
- `src/core/paper.ts` procedural fallback behavior where feasible
- `SerializedProject` save/load shape using small mocked/stubbed engine fixtures
- exported type/API smoke tests

Avoid using Node canvas as the main strategy. `canvas@3.2.3` exists, but native canvas installs can add macOS build friction and still won’t validate browser pointer/compositing behavior as well as Playwright.

### Browser tests with Playwright

Use Playwright for the demo because it exercises the real browser canvas pipeline. Official Playwright docs verify `webServer`, screenshot-on-failure, trace/video artifacts, and `toHaveScreenshot()` visual comparisons.

Recommended config choices:

| Setting | Recommendation | Why |
|---------|----------------|-----|
| Browser | Chromium first | Fast, stable baseline for canvas regression. Add WebKit later only if Safari-specific issues appear. |
| `webServer` | `pnpm --filter @efxlab/efx-physic-paint dev` on port `5174` | Tests the exact standalone app command. |
| Artifacts | screenshot only-on-failure, trace on-first-retry | Useful for the user’s screenshot-driven feedback loop without huge artifacts every run. |
| Visual tolerance | use Playwright `toHaveScreenshot({ maxDiffPixelRatio })` or `pixelmatch` | Physics/canvas anti-aliasing can vary slightly; use tolerances, not exact full-page diffs. |
| Test controls | `data-testid` and `window.__efxPaintDemo` hooks | Stable and explicit. |

Recommended E2E coverage:

1. Demo loads and `onEngineReady`/inspector reports width, height, paper, tool.
2. Pointer drag creates at least one stroke; `getStrokes().length` increments.
3. Tool/slider changes update `getState()`.
4. `Export PNG` produces a PNG with expected dimensions and non-empty alpha/color content.
5. `Save JSON`, clear, and reload restores stroke count and rendered output.
6. `AnimationPlayer` frame export emits the requested number of frames or a bounded preview sequence.
7. Transparent background export remains transparent where no paint exists.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Package-local Vite demo | New `apps/paint-demo` workspace | Only if the demo grows into a long-lived product with separate deployment, routing, or shared app shell. For v0.8.0 it adds unnecessary workspace complexity. |
| Browser Playwright tests | Node canvas tests | Use Node canvas only for very narrow PNG/pixel utility tests if browser tests are too slow; not as primary interactive confidence. |
| Plain CSS/native inputs | Tailwind v4 in package | Add Tailwind only if demo UI must visually match the editor. For a testable engine demo, Tailwind pipeline is extra config. |
| Preact demo | Vanilla TypeScript demo | Vanilla is viable, but Preact exercises the package’s Preact wrapper and aligns with the editor integration path. |
| Keep tsup for library + Vite for demo | Vite library mode for everything | Use Vite library mode only if tsup becomes a problem. Existing package exports already align with tsup. |
| Playwright visual screenshots | Vitest Browser Mode | Vitest Browser Mode is promising, but repo already has Vitest 2 and Playwright’s screenshot/export tooling is mature for app-level browser tests. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Headless adapter / batch `renderFromStrokes` / forced `forceDryAll` export path | Prior phases failed because batch replay killed incremental physics quality and became O(n²). It also contradicts the milestone requirement to preserve interactive simulation. | Standalone interactive Vite app + `AnimationPlayer`/export hooks from the live engine state. |
| Tauri window/app in this package | The milestone is to prove the package first; Tauri adds Rust/plugin/window lifecycle work before the engine is validated. | Browser Vite demo now; later open it from EFX Motion Editor via a controlled window/transport. |
| React | Duplicates UI runtime assumptions and diverges from editor stack. | Preact. |
| Redux/MobX/Zustand | Demo state is small; the editor already uses Preact Signals, not global store libraries. | Local Preact state; add Signals only if controls/inspector need shared reactive state. |
| Heavy UI kit | Adds CSS/theme/bundle complexity and can mask canvas UX issues. | Native controls and minimal CSS. |
| Tailwind in package by default | The editor uses Tailwind v4, but a package demo does not need a second Tailwind pipeline for validation. | Plain CSS first. Add Tailwind only if maintaining editor-like UI becomes a requirement. |
| Electron | Wrong platform layer for this repo; Tauri is the established desktop shell. | No desktop shell for package demo. |
| npm/yarn scripts | Violates repo and user preference; workspace linking differs. | pnpm scripts only. |
| Broad backward-compatible project migrations | User memory says no backward compatibility for old projects on format changes; standalone package is pre-integration. | Version 2 JSON only; clean format; no legacy migration code. |
| Publishing/demo deployment tooling | Premature for v0.8.0. | Local dev/build/test scripts. |

## Stack Patterns by Variant

**If the goal is manual engine validation:**
- Run `pnpm --filter @efxlab/efx-physic-paint dev`.
- Use the Preact demo with visible controls, inspector JSON, and export buttons.
- Because the user tests live with rapid feedback and screenshots, the app should be polished enough to diagnose visually.

**If the goal is automated confidence:**
- Run `pnpm --filter @efxlab/efx-physic-paint test`.
- Unit tests cover pure logic; Playwright covers canvas interaction/export.
- Because Canvas 2D and pointer behavior are browser-native, do not rely on DOM emulators for final confidence.

**If the goal is future editor integration:**
- Treat standalone output as project JSON + still PNG/frame PNG sequence from live engine state.
- Later editor integration should consume cached outputs/sidecars, not call a headless adapter inside the timeline render loop.
- Because the physics quality depends on incremental simulation, the standalone app/window should remain the source of truth for authoring physical paint.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Vite `5.4.21` | Existing app Vite `5.4.21` | Recommended to match the editor and avoid a Vite 7/8 migration during this milestone. Context7 lists Vite docs and versions including `v5.4.21`. |
| @preact/preset-vite `^2.10.5` | Preact 10.x | Current npm version checked as `2.10.5`; app currently uses `^2.10.3`. Safe minor drift. |
| Preact `^10.29.0` in package | Root override `^10.28.4` | Root pnpm overrides currently force Preact resolution. Keep one Preact major. |
| Vitest `^2.1.9` | Existing app Vitest `^2.1.9`, Vite 5 | Avoid Vitest 4 unless upgrading repo testing stack intentionally. |
| Playwright `^1.60.0` | Vite demo web server | App-level E2E devDep only; does not affect library runtime. |
| tsup `^8.5.1` | TypeScript `~5.9.3` | Already in package and appropriate for multi-entry ESM/dts library output. |
| pixelmatch `^7.2.0` + pngjs `^7.0.0` | Playwright exported PNG artifacts | Dev/test only. |

## Sources

- Repo inspection — `/Users/lmarques/Dev/efx-motion-editor/.planning/PROJECT.md`, root `package.json`, `pnpm-workspace.yaml`, `app/package.json`, and `packages/efx-physic-paint/*` (HIGH confidence).
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — verified current public API includes `init`, setters, physics controls, `save`, `load`, `getCanvas`, `getDisplayCanvas`, `getStrokes`, `renderAllStrokes`, and `renderPartialStrokes` (HIGH confidence).
- `packages/efx-physic-paint/src/preact.tsx` — verified existing Preact wrapper and `onEngineReady` lifecycle shape (HIGH confidence).
- Context7 `/vitejs/vite` — verified Vite dev server/createServer/config patterns, file-system/workspace serving, build input/outDir patterns (HIGH confidence).
- Context7 `/vitest-dev/vitest` — verified Vitest project/browser-mode documentation and DOM environment guidance; recommendation remains Vitest 2-compatible due repo constraints (MEDIUM confidence for not upgrading).
- Context7 `/microsoft/playwright` — verified screenshot-on-failure, trace/video artifact config, and `toHaveScreenshot()` visual comparison support (HIGH confidence).
- npm metadata via `pnpm view` — checked package versions for `@preact/preset-vite`, `vite@5`, `vitest@2`, `@playwright/test`, `canvas`, `pixelmatch`, `pngjs`, and `vite-plugin-static-copy` on 2026-06-08 (MEDIUM confidence; registry versions can change).

---
*Stack research for: v0.8.0 Standalone Physics Paint runnable/testable demo app*
*Researched: 2026-06-08*
