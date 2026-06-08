# Phase 34: Standalone Demo Shell - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/efx-physic-paint/demo/vite.config.ts` | config | request-response | `app/vite.config.ts` | role-match |
| `packages/efx-physic-paint/demo/index.html` | config | request-response | `app/index.html` | exact |
| `packages/efx-physic-paint/demo/src/main.tsx` | component | request-response | `app/src/main.tsx` + `packages/efx-physic-paint/src/preact.tsx` | role-match |
| `packages/efx-physic-paint/demo/src/styles.css` | config | request-response | `app/src/index.css` | role-match |
| `package.json` | config | request-response | `package.json` | exact-existing |
| `packages/efx-physic-paint/package.json` | config | request-response | `packages/efx-physic-paint/package.json` | exact-existing |
| `packages/efx-physic-paint/README.md` | documentation | request-response | `packages/efx-physic-paint/README.md` | exact-existing |
| `packages/efx-physic-paint/tsup.config.ts` | config | batch | `packages/efx-physic-paint/tsup.config.ts` | exact-existing |

## Pattern Assignments

### `packages/efx-physic-paint/demo/vite.config.ts` (config, request-response)

**Analog:** `app/vite.config.ts`

**Imports pattern** (lines 1-4):
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvasModule from '@efxlab/motion-canvas-vite-plugin';
```

**Core Vite plugin pattern** (lines 12-16):
```typescript
export default defineConfig({
  plugins: [
    // Preact preset MUST come first to set default JSX runtime to Preact
    preact(),
```

**Server pattern to simplify for demo** (lines 53-64):
```typescript
  // Tauri-specific config
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
```

**Dependency optimization boundary pattern** (lines 65-69):
```typescript
  // p5.brush standalone uses WebGL2 internally with complex module-scoped state.
  // esbuild pre-bundling breaks its internal variable scoping (ReferenceError: v).
  optimizeDeps: {
    exclude: ['p5.brush', '@efxlab/efx-physic-paint'],
  },
```

**Apply for Phase 34:** Use the `defineConfig` + `preact()` shape, but do not copy Tauri, Tailwind, or Motion Canvas plugins into the package demo. Add `fileURLToPath` / `URL` imports from `node:url` and alias `@efxlab/efx-physic-paint/preact` to `../src/preact.tsx` using an absolute filesystem path. Keep this config demo-local; do not add it to `tsup.config.ts` entries.

---

### `packages/efx-physic-paint/demo/index.html` (config, request-response)

**Analog:** `app/index.html`

**HTML entry pattern** (lines 1-12):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EFX Motion Editor</title>
  </head>
  <body style="background:#0F0F0F">
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Apply for Phase 34:** Copy the simple Vite HTML entry shape, but change the title to identify the standalone `@efxlab/efx-physic-paint` demo. Keep the root element id as `app` so `main.tsx` can use `document.getElementById('app')!`.

---

### `packages/efx-physic-paint/demo/src/main.tsx` (component, request-response)

**Analogs:** `app/src/main.tsx` and `packages/efx-physic-paint/src/preact.tsx`

**Preact render import and mount pattern** from `app/src/main.tsx` (lines 1-5, 20):
```typescript
import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
```
```typescript
  render(<App />, document.getElementById('app')!);
```

**Do not copy Tauri/editor runtime pattern** from `app/src/main.tsx` (lines 3-14):
```typescript
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';
import {mountShortcuts, handleSave, handleNewProject, handleOpenProject, handleCloseProject} from './lib/shortcuts';
import {undo, redo} from './lib/history';
import {canvasStore} from './stores/canvasStore';
import {uiStore} from './stores/uiStore';
import {timelineStore} from './stores/timelineStore';
import {paintStore} from './stores/paintStore';
```

**Public wrapper props pattern** from `packages/efx-physic-paint/src/preact.tsx` (lines 7-17):
```typescript
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
```

**Wrapper usage pattern** from `packages/efx-physic-paint/src/preact.tsx` (lines 22-30):
```tsx
 * <EfxPaintCanvas
 *   width={1000}
 *   height={650}
 *   papers={[{ name: 'canvas1', url: '/img/paper_1.jpg' }]}
 *   onEngineReady={(engine) => { engine.setTool('paint') }}
 * />
```

**Engine initialization lifecycle pattern** from `packages/efx-physic-paint/src/preact.tsx` (lines 36-55):
```typescript
  useEffect(() => {
    if (!containerRef.current) return
    const engine = new EfxPaintEngine(containerRef.current, {
      width: props.width,
      height: props.height,
      papers: props.papers,
      defaultPaper: props.defaultPaper,
    })
    engineRef.current = engine

    // Await async init (paper texture loading) before signaling ready
    engine.init().then(() => {
      props.onEngineReady?.(engine)
    })

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])
```

**Apply for Phase 34:** Render a tiny `DemoApp` directly in `main.tsx`. Import `render` from `preact`, import `EfxPaintCanvas` from the public subpath `@efxlab/efx-physic-paint/preact`, and import `./styles.css`. Do not import from `app/`, Tauri packages, stores, editor shortcuts, or `../src/engine/EfxPaintEngine`. Use current wrapper props: `papers`, optional `defaultPaper`, and `onEngineReady`; do not use stale README props `paperPath` or `onEngine`.

**Mount error pattern:** There is no existing demo-level error boundary. The closest lifecycle error source is wrapper `engine.init().then(...)` above. Planner should add minimal demo-local state/error handling around mount readiness without building diagnostics: e.g. visible error text if the root element is missing or if a demo-level callback detects failure. Keep static strings; do not use `dangerouslySetInnerHTML`.

---

### `packages/efx-physic-paint/demo/src/styles.css` (config, request-response)

**Analog:** `app/src/index.css`

**Theme variable pattern** (lines 3-24):
```css
:root,
[data-theme="dark"] {
  /* Backgrounds */
  --color-bg-root: #0F0F0F;
  --color-bg-sidebar: #111111;
  --color-bg-right: #1A1A1A;          /* Canvas area -- theme-aware dark gray */
  --color-bg-card: #1A1A1A;
  --color-bg-card-alt: #161616;
  --color-bg-input: #1E1E1E;
  --color-bg-settings: #252525;
  --color-bg-toolbar: #1C1C1C;
  --color-bg-menu: #1E1E1E;
  --color-bg-section-header: #111111;
  --color-bg-subsection: #131313;
  --color-bg-selected: #2A2A3A;
  --color-bg-hover-item: #2A2A2A;
  --color-bg-shell: #151515;
```

**Base layout pattern** (lines 300-307):
```css
@layer base {
  html, body, #app {
    height: 100%;
    font-family: "Inter", sans-serif;
    margin: 0;
    background: var(--color-bg-root);
    color: var(--color-text-primary);
  }
```

**Error color tokens** (lines 58-62):
```css
  /* Semantic: error/warning */
  --color-usage-badge-red: #FF4444;
  --color-error-bg: #2A1A1A;
  --color-error-text: #FF6666;
  --color-error-text-faded: #FF666680;
```

**Apply for Phase 34:** Copy the dark, minimal canvas-shell visual vocabulary, but do not import Tailwind unless the demo config intentionally includes it. For a standalone package demo, plain CSS is sufficient: define `html, body, #app` height/margin/background, shell/header/status/canvas container styles, and a small visible mount-error style using the existing error colors.

---

### `package.json` (config, request-response)

**Analog:** `package.json`

**Root workspace script delegation pattern** (lines 4-8):
```json
  "scripts": {
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch",
    "repomix": "npx repomix@latest --config repomix.config.json --compress -o repomix-output.codex.xml",
```

**Package manager and workspace style** (lines 1-7):
```json
{
  "private": true,
  "packageManager": "pnpm@10.27.0+sha512.72d699da16b1179c14ba9e64dc71c9a40988cbdc65c264cb0e489db7de917f20dcf4d64d8723625f2969ba52d4b7e2a1170682d9ac2a5dcaeaab732b7e16f04a",
  "scripts": {
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch",
```

**Apply for Phase 34:** Preserve root `pnpm --filter ...` style. Retarget only `dev:paint` to the package-local demo script, e.g. `pnpm --filter @efxlab/efx-physic-paint demo:dev`. Do not create a Tauri/editor alias for this phase.

---

### `packages/efx-physic-paint/package.json` (config, request-response)

**Analog:** `packages/efx-physic-paint/package.json`

**Exports/files boundary pattern** (lines 20-39):
```json
  "type": "module",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./preact": {
      "types": "./dist/preact.d.ts",
      "import": "./dist/preact.mjs"
    },
    "./animation": {
      "types": "./dist/animation.d.ts",
      "import": "./dist/animation.mjs"
    }
  },
  "files": [
    "dist"
  ],
```

**Existing package script pattern** (lines 48-52):
```json
  "scripts": {
    "build": "tsup",
    "dev:watch": "tsup --watch",
    "check": "tsc --noEmit"
  },
```

**Dependency placement pattern** (lines 40-58):
```json
  "peerDependencies": {
    "preact": ">=10.0.0"
  },
  "peerDependenciesMeta": {
    "preact": {
      "optional": true
    }
  },
```
```json
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "~5.9.3",
    "preact": "^10.29.0",
    "@types/node": "^24.12.0"
  }
```

**Apply for Phase 34:** Add `demo:dev` and likely `demo:build` next to `build`, `dev:watch`, and `check`. Add Vite/Preact preset as dev dependencies if missing. Do not add `demo` to `exports` or `files`. Keep `preact` as optional peer and dev dependency.

---

### `packages/efx-physic-paint/README.md` (documentation, request-response)

**Analog:** `packages/efx-physic-paint/README.md`

**Current stale Preact example to replace** (lines 42-60):
```tsx
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'

function App() {
  return (
    <EfxPaintCanvas
      width={1000}
      height={650}
      paperPath="/img/paper_1.jpg"
      onEngine={(engine) => {
        engine.setTool('paint')
        engine.setBrushSize(20)
      }}
    />
  )
}
```

**Current stale development commands to replace** (lines 94-101):
```markdown
## Development

```bash
pnpm install
pnpm dev        # Start demo app on localhost:5173
pnpm build      # Build library
pnpm check      # Type check
```
```

**Correct current wrapper props source** from `packages/efx-physic-paint/src/preact.tsx` (lines 22-30):
```tsx
 * <EfxPaintCanvas
 *   width={1000}
 *   height={650}
 *   papers={[{ name: 'canvas1', url: '/img/paper_1.jpg' }]}
 *   onEngineReady={(engine) => { engine.setTool('paint') }}
 * />
```

**Apply for Phase 34:** Update README commands to match scripts exactly: root `pnpm dev:paint` for standalone browser demo, package-local filtered demo script if documented, `pnpm --filter @efxlab/efx-physic-paint build`, and `pnpm --filter @efxlab/efx-physic-paint check`. Distinguish app workflows: root `pnpm dev` is app Vite frontend; desktop app uses the app Tauri command; standalone paint is browser-only.

---

### `packages/efx-physic-paint/tsup.config.ts` (config, batch)

**Analog:** `packages/efx-physic-paint/tsup.config.ts`

**Library-only entry pattern** (lines 1-16):
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    preact: 'src/preact.tsx',
    animation: 'src/animation/index.ts',
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

**Apply for Phase 34:** Treat this as a boundary file. It should remain unchanged unless planner adds an explicit verification task. Do not add `demo/index.html`, `demo/src/main.tsx`, or `demo/vite.config.ts` to `entry`.

## Shared Patterns

### Public package boundary
**Source:** `packages/efx-physic-paint/package.json` and `packages/efx-physic-paint/src/preact.tsx`
**Apply to:** `demo/src/main.tsx`, `demo/vite.config.ts`, README examples

```json
    "./preact": {
      "types": "./dist/preact.d.ts",
      "import": "./dist/preact.mjs"
    }
```

```typescript
export interface EfxPaintCanvasProps extends EngineConfig {
  width?: number
  height?: number
  class?: string
  onEngineReady?: (engine: EfxPaintEngine) => void
}
```

Use the consumer-facing import specifier `@efxlab/efx-physic-paint/preact`; use Vite aliasing to source for HMR instead of relative imports from demo code.

### Engine paper configuration
**Source:** `packages/efx-physic-paint/src/types.ts` and `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
**Apply to:** `demo/src/main.tsx`, README examples

```typescript
export interface EngineConfig {
  width?: number           // default 1000
  height?: number          // default 650
  papers: PaperConfig[]
  defaultPaper?: string    // key to auto-select
}
```

```typescript
    // Store paper config for async init() — consumers call init() to load textures
    this._initPapers = config.papers || []
    this._initDefaultPaper = config.defaultPaper || ''
```

```typescript
  private async loadPaperTextures(papers: Array<{ name: string; url: string }>, defaultPaper: string): Promise<void> {
    for (const paper of papers) {
      try {
        const result = await loadPaperTexture(paper.url, this.width, this.height)
        this.paperTextures.set(paper.name, result)
      } catch (e) {
        console.error(`Failed to load paper texture: ${paper.name}`, e)
      }
    }
```

Planner should include a static verification task for whether `papers={[]}` is acceptable or should add demo-local non-secret paper assets and pass `papers={[{ name: 'canvas1', url: '/...' }]}` with `defaultPaper="canvas1"`.

### Workspace command delegation
**Source:** `package.json` and `pnpm-workspace.yaml`
**Apply to:** root `package.json`, package README

```json
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch",
```

```yaml
packages:
  - "app"
  - "packages/*"
```

Retarget the existing root alias; do not introduce `cd`-based shell scripts.

### Demo must not enter published/library outputs
**Source:** `packages/efx-physic-paint/package.json` and `packages/efx-physic-paint/tsup.config.ts`
**Apply to:** package scripts/config, validation tasks

```json
  "files": [
    "dist"
  ],
```

```typescript
  entry: {
    index: 'src/index.ts',
    preact: 'src/preact.tsx',
    animation: 'src/animation/index.ts',
  },
```

Keep demo under `packages/efx-physic-paint/demo`; do not add demo to `exports`, `files`, or `tsup` entries.

### Validation without running the server
**Source:** `CLAUDE.md`, `packages/efx-physic-paint/package.json`, `app/package.json`
**Apply to:** all implementation plans

```text
Please do not run the server, I do on my side
```

```json
  "scripts": {
    "build": "tsup",
    "dev:watch": "tsup --watch",
    "check": "tsc --noEmit"
  },
```

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
```

Use type/build checks and script inspection. Do not run `pnpm dev`, `pnpm dev:paint`, Vite dev server, or Tauri dev server in automation; leave browser UAT to the user.

## No Analog Found

No files are fully without analog. The weakest analog is `packages/efx-physic-paint/demo/src/styles.css` because no package-local standalone demo CSS exists yet; use `app/src/index.css` for visual tokens but keep demo CSS plain and minimal.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All proposed files have at least a role-match analog. |

## Metadata

**Analog search scope:** root package files, `app/` Vite/Preact entry files, `packages/efx-physic-paint/` package/build/wrapper files, project skill indexes.
**Files scanned:** 17 candidate files/skill indexes; 11 files read for excerpts.
**Pattern extraction date:** 2026-06-08
