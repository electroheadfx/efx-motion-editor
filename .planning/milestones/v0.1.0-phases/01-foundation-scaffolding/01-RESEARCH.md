# Phase 1: Foundation & Scaffolding - Research

**Researched:** 2026-03-02
**Domain:** Tauri 2.0 + Preact + Vite + Tailwind v4 + Motion Canvas embedding + Signal stores
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- One signal per field for fine-grained reactivity (e.g., `projectName`, `projectFps` as separate signals)
- All 6 stores created: project, sequences, layers, timeline, ui, history
- Stores can import and read signals from other stores directly (no computed bridge layer)
- History store gets a skeleton with HistoryEntry type and basic signals (historyStack, pointer), but no undo/redo logic -- Phase 8 fills that in
- Store objects with methods pattern (e.g., `projectStore.setName()`, `timelineStore.seek()`) for discoverability via autocomplete
- Test scene: single image loaded via asset protocol, displayed composited in the Motion Canvas player -- proves the full pipeline
- Player sized in a fixed preview area with 16:9 aspect ratio that fills available space and resizes with the window
- Scene defined in a separate file (src/scenes/testScene.ts) following standard Motion Canvas pattern
- Tauri app scaffolded inside Application/ directory -- Mockup/ stays separate as reference
- Frontend organized by concern: src/stores/, src/components/, src/scenes/, src/lib/, src/types/
- TypeScript types manually mirrored from Rust structs in src/types/ -- no auto-generation tooling
- Rust backend split into domain modules from the start: src-tauri/src/commands/, src-tauri/src/models/
- Typed async wrapper functions in src/lib/ipc.ts for each Rust command -- central IPC abstraction layer
- Result type pattern for error handling (data or typed error, mirroring Rust's Result)
- Bundled test image in app resources -- asset protocol validation is automatic on launch
- Rust command naming: domain_action snake_case (e.g., `image_load`, `project_save`)
- Package manager is pnpm (mandatory)
- macOS only -- native title bar, macOS conventions
- @efxlab/motion-canvas-* packages are v4.0.0

### Claude's Discretion
- Exact Vite config and plugin setup
- Tailwind v4 configuration approach
- Tauri 2.0 permissions and capabilities config
- Testing setup (if any for foundation phase)
- Dev tooling (linting, formatting config)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold builds and runs on macOS | Standard Stack section: Vite 5.4.x chosen for compatibility, manual scaffold approach since create-tauri-app dropped Preact template, @preact/preset-vite + @tailwindcss/vite plugins verified |
| FOUN-02 | Rust backend IPC bridge with type-safe invoke wrappers | Architecture Patterns: IPC wrapper pattern with typed invoke, Code Examples: Rust command + TS wrapper examples |
| FOUN-03 | Asset protocol configured for image loading (no binary IPC) | Architecture Patterns: asset protocol config with convertFileSrc, CSP configuration, assetProtocol scope |
| FOUN-04 | Motion Canvas player embeds in Preact app and renders a test scene | Architecture Patterns: player is a web component (custom element), JSX conflict resolution strategy, Vite plugin integration |
| FOUN-05 | Signal stores established (project, sequences, layers, timeline, ui, history) | Architecture Patterns: signal store pattern with @preact/signals, per-field signals with method objects |
| FOUN-06 | TypeScript types mirror Rust data models | Architecture Patterns: manual type mirroring, Result type pattern |
</phase_requirements>

## Summary

This phase scaffolds a Tauri 2.0 desktop application with Preact, Vite, and Tailwind v4 on macOS, then validates three critical integrations: (1) Motion Canvas player embedding via a web component, (2) Tauri asset protocol for image loading, and (3) Preact Signals-based state management with six stores.

The most significant technical finding is a **Vite version constraint**: the `@efxlab/motion-canvas-vite-plugin@4.0.0` declares peer dependency on `"vite": "4.x || 5.x"` and uses Vite 4/5 WebSocket APIs (`server.ws.on()`) that changed in Vite 6+. The recommendation is to **use Vite 5.4.21** (latest 5.x) which satisfies all dependencies: Motion Canvas vite plugin, @preact/preset-vite (supports 2.x-7.x), @tailwindcss/vite 4.0.x (supports ^5.2.0), and Tauri (any Vite version). The react-ui prototype uses Vite 7.3, but the Application/ scaffold is independent.

A secondary critical finding is a **JSX runtime conflict**: Motion Canvas scenes use their own JSX runtime (`@efxlab/motion-canvas-2d/lib`) while Preact components use `preact/jsx-runtime`. The Motion Canvas vite plugin sets `esbuild.jsxImportSource` globally to its runtime, which would break Preact components. The solution is to configure the default JSX for Preact and use per-file `/** @jsxImportSource @efxlab/motion-canvas-2d/lib */` pragmas in scene files.

**Primary recommendation:** Scaffold with Vite 5.4.21, use @preact/preset-vite as the default JSX handler, integrate the Motion Canvas vite plugin with JSX pragma overrides in scene files, and configure Tauri's asset protocol with convertFileSrc for image loading.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.10.x (CLI 2.10.0, API 2.10.1) | Desktop app framework (Rust + WebView) | Locked decision; latest stable v2 |
| Preact | 10.28.4 | UI framework (lightweight React alternative) | Locked decision; 4kB, signals-native |
| @preact/signals | 2.8.1 | Fine-grained reactive state management | Locked decision; peer dep preact >= 10.25.0 |
| Vite | 5.4.21 | Build tool and dev server | Latest 5.x -- required for Motion Canvas vite plugin compatibility |
| Tailwind CSS | 4.x (via @tailwindcss/vite) | Utility-first CSS framework | Locked decision; v4 uses CSS-first config |
| @efxlab/motion-canvas-core | 4.0.0 | Animation engine core | Locked decision; published 2 days ago by project author |
| @efxlab/motion-canvas-2d | 4.0.0 | 2D rendering nodes (Img, Rect, etc.) | Required for scene composition |
| @efxlab/motion-canvas-player | 4.0.0 | Web component `<motion-canvas-player>` | Custom element for embedding player in Preact |
| @efxlab/motion-canvas-vite-plugin | 4.0.0 | Vite plugin for scene/project transforms | Handles `?scene` imports, meta files, project bootstrap |
| TypeScript | ~5.9.3 | Type safety | Matches prototype; needed for both TS and TSX |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/preset-vite | 2.10.3 | Preact Vite integration (JSX, HMR, compat aliases) | Always -- handles Preact JSX transform and prefresh HMR |
| @tailwindcss/vite | 4.0.x (any that supports ^5.2.0) | Tailwind v4 Vite integration | Always -- replaces PostCSS-based setup |
| @tauri-apps/api | 2.10.1 | Frontend Tauri API (invoke, convertFileSrc, etc.) | All IPC and asset protocol calls |
| @tauri-apps/cli | 2.10.0 | Tauri CLI for dev/build | Dev dependency for `pnpm tauri dev` / `pnpm tauri build` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite 5.4.21 | Vite 7.3.x | Vite 7 is newer but breaks @efxlab/motion-canvas-vite-plugin (uses `server.ws.on()` API removed in Vite 6+). Would require forking/patching the plugin. |
| @efxlab/motion-canvas-vite-plugin | Manual scene/project shims | Could avoid the plugin entirely by manually calling `bootstrap()` and writing `?scene` transform logic, but this duplicates complex HMR and meta file handling. Not worth it. |
| @preact/preset-vite | Manual esbuild JSX config | Preset handles compat aliases, prefresh HMR, devtools bridge. Manual config misses edge cases. |

**Installation:**
```bash
# In Application/ directory
pnpm create vite . --template preact-ts
# Then add Tauri:
pnpm add -D @tauri-apps/cli
pnpm tauri init
# Add Motion Canvas:
pnpm add @efxlab/motion-canvas-core@4.0.0 @efxlab/motion-canvas-2d@4.0.0 @efxlab/motion-canvas-player@4.0.0
pnpm add -D @efxlab/motion-canvas-vite-plugin@4.0.0
# Ensure Vite 5:
pnpm add -D vite@5.4.21
# Tailwind v4:
pnpm add -D tailwindcss@4 @tailwindcss/vite
```

> **Note:** `pnpm create vite` with `--template preact-ts` scaffolds a Preact + TypeScript project. Tauri is then added on top via `pnpm tauri init`. The Preact template was removed from create-tauri-app v3+ but this Vite-first approach is the officially documented method at v2.tauri.app/start/frontend/vite/.

## Architecture Patterns

### Recommended Project Structure
```
Application/
  src/
    components/       # Preact UI components (JSX uses preact runtime)
    scenes/           # Motion Canvas scenes (JSX uses motion-canvas-2d runtime)
    stores/           # Signal stores (project, sequences, layers, timeline, ui, history)
    lib/              # Shared utilities
      ipc.ts          # Typed IPC wrapper functions
    types/            # TypeScript types mirroring Rust models
    app.tsx           # Root Preact component
    main.tsx          # Entry point (renders app)
    project.ts        # Motion Canvas project definition (makeProject)
    index.css         # Tailwind v4 entry (CSS variables + @import "tailwindcss")
  src-tauri/
    src/
      commands/       # Tauri command handlers (domain_action.rs)
      models/         # Rust data models (mirrored in src/types/)
      lib.rs          # Command registration
      main.rs         # App entry
    capabilities/     # Permission/capability configs
    tauri.conf.json   # Tauri configuration
    Cargo.toml
  index.html          # Vite entry HTML
  vite.config.ts      # Vite + Preact + Tailwind + Motion Canvas plugins
  package.json
  tsconfig.json
```

### Pattern 1: Motion Canvas Player as Web Component in Preact
**What:** The `@efxlab/motion-canvas-player` is a **custom element** (web component), not a React/Preact component. It registers as `<motion-canvas-player>` via `customElements.define()`. The `src` attribute accepts a URL to a JS module that default-exports a Motion Canvas Project object. The player dynamically imports this module.

**When to use:** Always -- this is the only way to embed the Motion Canvas player.

**How it works (verified from source code):**
1. Player loads the `src` URL via dynamic `import(src)`
2. The imported module must `export default` a Project instance (created by `bootstrap()`)
3. The Motion Canvas vite plugin transforms `project.ts?project` imports to call `bootstrap()` automatically
4. In production builds, the project is a separate entry point (rollup input)

**Example (Preact component wrapping the player):**
```tsx
// src/components/Preview.tsx
// Uses default Preact JSX (no pragma needed)
import { useRef, useEffect } from 'preact/hooks';
import '@efxlab/motion-canvas-player';

export function Preview() {
  const playerRef = useRef<HTMLElement>(null);

  return (
    <div class="relative w-full aspect-video bg-black">
      <motion-canvas-player
        ref={playerRef}
        src="/src/project.ts?project"
        auto
        responsive
        aspect-ratio="16:9"
        background="#000000"
        no-controls
      />
    </div>
  );
}
```

**TypeScript declaration needed for the custom element:**
```typescript
// src/types/motion-canvas.d.ts
declare namespace preact.JSX {
  interface IntrinsicElements {
    'motion-canvas-player': {
      src?: string;
      auto?: boolean;
      responsive?: boolean;
      'aspect-ratio'?: string;
      width?: number;
      height?: number;
      quality?: number;
      variables?: string;
      background?: string;
      'no-controls'?: boolean;
      fullscreen?: boolean;
      timescale?: number;
      ratio?: string;
      ref?: any;
      class?: string;
      style?: any;
    };
  }
}
```

### Pattern 2: JSX Runtime Conflict Resolution
**What:** Motion Canvas scenes and Preact components use different JSX runtimes. The vite plugin sets `esbuild.jsxImportSource` to `@efxlab/motion-canvas-2d/lib` globally.

**Solution:** Override the vite plugin's global JSX setting. Configure `@preact/preset-vite` as the default (Preact JSX), and use per-file JSX pragma in scene files:

```typescript
// src/scenes/testScene.tsx
/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import { makeScene2D, Img } from '@efxlab/motion-canvas-2d';
import { createRef } from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  const imageRef = createRef<Img>();
  view.add(<Img ref={imageRef} src={testImageUrl} width={1920} height={1080} />);
  yield; // Single frame -- just display the image
});
```

**Vite config approach:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvas from '@efxlab/motion-canvas-vite-plugin';

export default defineConfig({
  plugins: [
    // Preact preset MUST come first to set default JSX
    preact(),
    tailwindcss(),
    // Motion Canvas plugin adds scene/project transforms
    // Its esbuild.jsxImportSource will be overridden by preact preset
    ...motionCanvas({
      project: './src/project.ts',
    }),
  ],
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
  build: {
    target: 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

> **CRITICAL:** The Motion Canvas vite plugin's `projectsPlugin` sets `esbuild.jsx: 'automatic'` and `esbuild.jsxImportSource: '@efxlab/motion-canvas-2d/lib'`. The `@preact/preset-vite` plugin also configures esbuild JSX for Preact. Plugin order and config merging will determine which wins. If the Motion Canvas plugin's config takes priority, all Preact components break. The per-file `@jsxImportSource` pragma on scene files is the safest approach regardless -- it always wins over global config.

### Pattern 3: Tauri Asset Protocol for Image Loading
**What:** Load images from the local filesystem into the WebView without binary IPC. Tauri 2's asset protocol converts file paths to `https://asset.localhost/` URLs.

**Configuration in tauri.conf.json:**
```json
{
  "app": {
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost; script-src 'self' 'unsafe-eval'",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

**Frontend usage:**
```typescript
// src/lib/ipc.ts
import { convertFileSrc } from '@tauri-apps/api/core';

export function assetUrl(filePath: string): string {
  return convertFileSrc(filePath);
  // Returns: https://asset.localhost/path/to/file.jpg (macOS)
}
```

> **Note:** `convertFileSrc` is from `@tauri-apps/api/core` in Tauri v2 (was `@tauri-apps/api/tauri` in v1). The `'unsafe-eval'` in CSP is needed because the Motion Canvas vite plugin may use eval for HMR during development. For production builds this can be tightened.

### Pattern 4: Signal Store with Per-Field Signals
**What:** Each store is an object with individual signals per field and methods that update those signals. Stores are created once at module level (singletons).

**Example:**
```typescript
// src/stores/projectStore.ts
import { signal, computed } from '@preact/signals';

// Per-field signals
const name = signal('Untitled Project');
const fps = signal(24);
const width = signal(1920);
const height = signal(1080);

// Computed values
const aspectRatio = computed(() => width.value / height.value);

// Store object with methods
export const projectStore = {
  // Read-only signal access
  name,
  fps,
  width,
  height,
  aspectRatio,

  // Mutators
  setName(v: string) { name.value = v; },
  setFps(v: number) { fps.value = v; },
  setResolution(w: number, h: number) {
    width.value = w;
    height.value = h;
  },
  reset() {
    name.value = 'Untitled Project';
    fps.value = 24;
    width.value = 1920;
    height.value = 1080;
  },
};
```

**Consuming in components:**
```tsx
// src/components/ProjectInfo.tsx
import { projectStore } from '../stores/projectStore';

export function ProjectInfo() {
  // Signals auto-subscribe when .value is read in render
  return (
    <div>
      <span>{projectStore.name}</span>
      <span>{projectStore.fps} fps</span>
    </div>
  );
}
```

> **Key insight:** Preact Signals integrate deeply with Preact -- passing a signal directly to JSX (not `.value`) enables fine-grained updates without re-rendering the whole component.

### Pattern 5: Typed IPC Wrappers with Result Pattern
**What:** Central IPC abstraction with typed wrappers for each Rust command, using a Result-like pattern for error handling.

**Rust side:**
```rust
// src-tauri/src/models/project.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    pub name: String,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
}

// src-tauri/src/commands/project.rs
use tauri::command;
use crate::models::project::ProjectData;

#[command]
pub fn project_get_default() -> ProjectData {
    ProjectData {
        name: "Untitled Project".into(),
        fps: 24,
        width: 1920,
        height: 1080,
    }
}
```

**TypeScript side:**
```typescript
// src/types/project.ts
export interface ProjectData {
  name: string;
  fps: number;
  width: number;
  height: number;
}

// src/lib/ipc.ts
import { invoke } from '@tauri-apps/api/core';
import type { ProjectData } from '../types/project';

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Typed wrappers
export async function projectGetDefault(): Promise<Result<ProjectData>> {
  return safeInvoke<ProjectData>('project_get_default');
}
```

### Anti-Patterns to Avoid
- **Global JSX config for Motion Canvas:** Do NOT set `jsxImportSource` globally to `@efxlab/motion-canvas-2d/lib`. Use per-file pragmas in scene files instead.
- **Binary IPC for images:** Do NOT load images via IPC invoke returning bytes. Use the asset protocol (`convertFileSrc`) which streams directly from disk to WebView.
- **React-style useState in stores:** Do NOT use hooks for global state. Preact Signals work outside components and are module-level singletons.
- **Importing between scene and component JSX contexts:** Keep scene files and Preact component files separate. Scene files should not import Preact components and vice versa.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Motion Canvas project/scene transforms | Custom Vite plugin for `?scene` imports | `@efxlab/motion-canvas-vite-plugin` | Handles HMR, meta files, bootstrap wrapping, project entry points -- complex and tightly coupled to Motion Canvas internals |
| Preact JSX transform + HMR | Manual esbuild config | `@preact/preset-vite` | Handles JSX, prefresh HMR, compat aliases, devtools bridge |
| Asset URL conversion | Custom protocol handler | `convertFileSrc` from `@tauri-apps/api/core` | Platform-specific URL formats (asset: on macOS, https://asset.localhost on others) |
| Tailwind v4 integration | PostCSS config | `@tailwindcss/vite` | Vite plugin is the v4-recommended approach; faster than PostCSS |
| Tauri scaffolding | Manual Rust/config setup | `pnpm tauri init` | Generates correct directory structure, cargo config, tauri.conf.json |

**Key insight:** This phase has many integration points between independent libraries. Each integration (Tauri+Vite, Preact+Vite, MotionCanvas+Vite, Tauri asset protocol) has its own configuration surface. Using the official plugins/tools for each reduces the surface area where custom glue code can fail.

## Common Pitfalls

### Pitfall 1: Vite Version Mismatch
**What goes wrong:** Using Vite 6+ or 7+ causes the Motion Canvas vite plugin to fail silently or crash. The plugin uses `server.ws.on()` (Vite 4/5 API) which was replaced by `server.hot.on()` in Vite 6.
**Why it happens:** The react-ui prototype uses Vite 7.3, tempting developers to use the same version.
**How to avoid:** Pin Vite to 5.4.21 in package.json. All other deps (Preact preset, Tailwind, Tauri) support Vite 5.
**Warning signs:** Plugin errors during dev server startup, HMR not working for scenes, "ws is not a function" errors.

### Pitfall 2: JSX Runtime Collision
**What goes wrong:** All JSX in the project compiles with the wrong runtime -- either all Preact components render Motion Canvas nodes (broken), or all Motion Canvas scenes try to use Preact h() (broken).
**Why it happens:** Both `@preact/preset-vite` and the Motion Canvas vite plugin set `esbuild.jsxImportSource` globally. Whichever plugin runs last wins.
**How to avoid:** Use `/** @jsxImportSource @efxlab/motion-canvas-2d/lib */` pragma at the top of every scene `.tsx` file. Preact preset handles the default. Scene files can also use `.ts` with explicit `createRef`/imperative API instead of JSX.
**Warning signs:** "h is not a function", "Cannot read property of undefined" in JSX, Motion Canvas nodes appearing as `[object Object]` in DOM.

### Pitfall 3: Asset Protocol CSP Blocking
**What goes wrong:** Images loaded via `convertFileSrc` are blocked by Content Security Policy. The console shows "Refused to load the image" errors.
**Why it happens:** Tauri's default CSP doesn't include `asset:` or `http://asset.localhost` in `img-src`.
**How to avoid:** Explicitly add `img-src 'self' asset: http://asset.localhost` to the CSP in tauri.conf.json.
**Warning signs:** Images show as broken, 403 errors in network tab for asset:// URLs.

### Pitfall 4: Asset Protocol Scope Too Restrictive
**What goes wrong:** `convertFileSrc` returns a URL but the server returns 403 Forbidden.
**Why it happens:** The `assetProtocol.scope` in tauri.conf.json doesn't include the file's directory.
**How to avoid:** Set scope to `["**"]` during development. Tighten for production to specific directories (e.g., project directory, app resources).
**Warning signs:** 403 responses on asset:// URLs despite correct CSP.

### Pitfall 5: Motion Canvas Player Not Loading
**What goes wrong:** The `<motion-canvas-player>` shows a loading spinner indefinitely or an error message.
**Why it happens:** The `src` attribute must point to a module that exports a bootstrapped Project. If the path is wrong or the module doesn't go through the vite plugin's `?project` transform, the dynamic import fails.
**How to avoid:** Ensure the `src` attribute uses the correct path with `?project` query parameter during development. The Motion Canvas vite plugin intercepts this and serves the transformed module.
**Warning signs:** "An error occurred while loading the animation" message in the player overlay, console errors about failed dynamic imports.

### Pitfall 6: Preact Signals Not Triggering Re-renders
**What goes wrong:** Changing a signal value doesn't update the UI.
**Why it happens:** Reading `signal.value` in a callback or async function (not during render) doesn't create a subscription. Or wrapping signals in `useState` which copies the value.
**How to avoid:** Pass signals directly to JSX text positions (`{store.name}` not `{store.name.value}`), or use `useComputed`/`useSignalEffect` for derived values in components.
**Warning signs:** Console-logging signal changes shows updates, but UI remains stale.

### Pitfall 7: create-tauri-app Missing Preact Template
**What goes wrong:** Running `pnpm create tauri-app` doesn't offer Preact as a template option.
**Why it happens:** The Preact template was removed in create-tauri-app v3+ to focus on popular frameworks.
**How to avoid:** Create the Vite project first with `pnpm create vite --template preact-ts`, then add Tauri with `pnpm add -D @tauri-apps/cli && pnpm tauri init`. This is the officially documented Vite-first approach.
**Warning signs:** No "preact" option in interactive template selection.

## Code Examples

### Motion Canvas Project File
```typescript
// src/project.ts
// Source: verified from @efxlab/motion-canvas-vite-plugin source + Motion Canvas docs
import { makeProject } from '@efxlab/motion-canvas-core';
import testScene from './scenes/testScene?scene';

export default makeProject({
  scenes: [testScene],
});
```

### Motion Canvas Test Scene with Image
```tsx
// src/scenes/testScene.tsx
/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
// Source: verified from Motion Canvas docs (media.mdx) + @efxlab/motion-canvas-2d source
import { makeScene2D, Img } from '@efxlab/motion-canvas-2d';
import { createRef, waitFor } from '@efxlab/motion-canvas-core';

// The image URL will come from the asset protocol
// During dev, use a static import or public/ path
import testImage from '../assets/test-image.jpg';

export default makeScene2D(function* (view) {
  const imageRef = createRef<Img>();

  view.add(
    <Img
      ref={imageRef}
      src={testImage}
      width={1920}
      height={1080}
    />
  );

  yield* waitFor(1); // Hold for 1 second
});
```

### Tauri Rust Command with Serde Serialization
```rust
// src-tauri/src/commands/image.rs
// Source: verified from Tauri v2 docs (calling-rust.mdx)
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[command]
pub fn image_get_info(path: String) -> Result<ImageInfo, String> {
    // Placeholder -- actual implementation in later phases
    Ok(ImageInfo {
        path,
        width: 1920,
        height: 1080,
        format: "jpeg".into(),
    })
}
```

### Tauri Command Registration
```rust
// src-tauri/src/lib.rs
mod commands;
mod models;

use commands::image;
use commands::project;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            image::image_get_info,
            project::project_get_default,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Tauri Configuration for Asset Protocol
```json
// src-tauri/tauri.conf.json (relevant sections)
{
  "productName": "EFX Motion Editor",
  "identifier": "com.efxlab.motion-editor",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "EFX Motion Editor",
        "width": 1440,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 680
      }
    ],
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

### Capabilities Configuration
```json
// src-tauri/capabilities/default.json
// Source: verified from Tauri v2 docs (using-plugin-permissions.mdx)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:app:default",
    "core:path:default",
    "core:event:default"
  ]
}
```

### Signal Store Example (Timeline Store Skeleton)
```typescript
// src/stores/timelineStore.ts
import { signal, computed } from '@preact/signals';

const currentFrame = signal(0);
const isPlaying = signal(false);
const zoom = signal(1);
const scrollX = signal(0);

export const timelineStore = {
  currentFrame,
  isPlaying,
  zoom,
  scrollX,

  // Computed
  get currentTime() {
    return computed(() => currentFrame.value / 24); // Will use project fps
  },

  seek(frame: number) { currentFrame.value = Math.max(0, frame); },
  setPlaying(v: boolean) { isPlaying.value = v; },
  setZoom(v: number) { zoom.value = Math.max(0.1, Math.min(10, v)); },
  setScrollX(v: number) { scrollX.value = v; },
};
```

### History Store Skeleton (Phase 8 fills in logic)
```typescript
// src/stores/historyStore.ts
import { signal } from '@preact/signals';

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

const stack = signal<HistoryEntry[]>([]);
const pointer = signal(-1);

export const historyStore = {
  stack,
  pointer,
  // Undo/redo logic deferred to Phase 8
};
```

### Tailwind v4 CSS Entry
```css
/* src/index.css */
/* Source: verified from react-ui prototype + Tailwind v4 docs */
@import "tailwindcss";

:root {
  --color-bg-root: #0F0F0F;
  --color-bg-sidebar: #111111;
  --color-bg-right: #0A0A0A;
  --color-bg-card: #1A1A1A;
  --color-bg-card-alt: #161616;
  --color-bg-input: #1E1E1E;
  --color-bg-settings: #252525;
  --color-accent: #2D5BE3;
  --color-accent-hover: #3A68F0;
  --color-separator: #222222;
  --color-text-primary: #E8E8E8;
  --color-text-secondary: #888888;
  --color-text-muted: #666666;
  --color-text-dim: #555555;
  --color-text-dimmer: #444444;
  --color-text-white: #FFFFFF;
  --color-text-link: #AAAAAA;
}

@layer base {
  html, body {
    height: 100%;
    font-family: "Inter", sans-serif;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `@tauri-apps/api/tauri` | Tauri v2 `@tauri-apps/api/core` | Tauri 2.0 (2024) | Import paths changed; `convertFileSrc` moved to core |
| create-tauri-app with Preact template | Vite-first scaffold + `pnpm tauri init` | create-tauri-app v3 (2024) | Preact template removed; manual setup required |
| Tailwind v3 with PostCSS + tailwind.config.js | Tailwind v4 with `@tailwindcss/vite` + CSS-first config | Tailwind v4 (2025) | No JS config file; `@import "tailwindcss"` in CSS; theme in CSS variables |
| Motion Canvas v3 `@motion-canvas/*` | @efxlab fork v4 `@efxlab/motion-canvas-*` | v4.0.0 (2026-02-28) | Scoped under @efxlab; fork by project author; same API surface |
| Tauri v1 CSP in `tauri.conf.json > tauri > security` | Tauri v2 CSP in `tauri.conf.json > app > security` | Tauri 2.0 | Config path changed |

**Deprecated/outdated:**
- `@motion-canvas/vite-plugin` (3.x): Use `@efxlab/motion-canvas-vite-plugin@4.0.0` instead
- `@tauri-apps/api/tauri`: Replaced by `@tauri-apps/api/core` in v2
- Tailwind v3 config-based setup: v4 uses CSS-first approach with `@tailwindcss/vite` plugin

## Open Questions

1. **Vite Plugin Order and JSX Priority**
   - What we know: Both `@preact/preset-vite` and the Motion Canvas vite plugin configure `esbuild.jsxImportSource`. Plugin order matters for config merging.
   - What's unclear: Which plugin's config wins when both are present. Vite merges configs from plugins in order, with later plugins potentially overriding earlier ones.
   - Recommendation: Test during scaffolding. If global JSX defaults to Motion Canvas, add explicit `esbuild: { jsxImportSource: 'preact' }` in the top-level vite config (overrides plugin configs). Scene files always use pragma.

2. **Motion Canvas Player `src` Attribute in Production Builds**
   - What we know: In dev mode, `src="/src/project.ts?project"` works because Vite serves the transformed module. In production, the project is built as a separate rollup entry.
   - What's unclear: The exact URL/path for the built project module in a Tauri app (where frontend is bundled into the app binary).
   - Recommendation: Validate during scaffolding. The built output should be in `dist/` and accessible via relative path. May need to adjust the `src` attribute between dev and production.

3. **Motion Canvas Vite Plugin `server.ws` Compatibility**
   - What we know: The meta and settings plugins use `server.ws.on()` which is a Vite 4/5 API. These are used for HMR of meta files (editor-specific features).
   - What's unclear: Whether these specific features are needed in our use case (we're not using the Motion Canvas editor).
   - Recommendation: Use Vite 5.4.21 as planned. If we later want to upgrade Vite, the `server.ws` usage in meta/settings plugins could be safely removed or patched since we don't use the Motion Canvas editor UI.

4. **Asset Protocol Image Loading in Motion Canvas Scenes**
   - What we know: `convertFileSrc` converts file paths to `https://asset.localhost/...` URLs. Motion Canvas `Img` node takes a `src` string.
   - What's unclear: Whether Motion Canvas `Img` node can load images from `https://asset.localhost/` URLs (cross-origin considerations within Tauri WebView).
   - Recommendation: Test during scaffolding with the bundled test image first (static import), then try asset protocol URL. CSP `img-src` already includes `asset: http://asset.localhost`.

## Sources

### Primary (HIGH confidence)
- `@efxlab/motion-canvas-player@4.0.0` npm package source code -- examined full dist/main.js, types/main.d.ts, package.json. Confirmed web component architecture, `customElements.define("motion-canvas-player", ...)`, dynamic `import(src)` loading.
- `@efxlab/motion-canvas-vite-plugin@4.0.0` npm package source code -- examined lib/main.js, lib/partials/scenes.js, lib/partials/projects.js. Confirmed `?scene` and `?project` virtual module transforms, JSX config, Vite 4/5 peer deps.
- `@efxlab/motion-canvas-core@4.0.0` npm package -- examined lib/app/bootstrap.d.ts, lib/app/Project.d.ts. Confirmed bootstrap() API and ProjectSettings interface.
- `@efxlab/motion-canvas-2d@4.0.0` npm package -- examined lib/jsx-runtime.d.ts. Confirmed custom JSX runtime.
- Context7 `/tauri-apps/tauri-docs` -- Tauri v2 IPC invoke, Vite configuration, CSP, capabilities, filesystem permissions
- Context7 `/preactjs/preact-www` -- Signal store patterns, createAppState, effect/computed usage
- Context7 `/motion-canvas/motion-canvas` -- makeProject, makeScene2D, Img node, media loading

### Secondary (MEDIUM confidence)
- npm registry metadata -- verified versions, peer dependencies for all packages
- Tauri v2 official docs (v2.tauri.app) -- Vite frontend setup, asset protocol configuration
- GitHub discussion [tauri-apps/discussions#11498](https://github.com/orgs/tauri-apps/discussions/11498) -- Asset protocol v2 configuration patterns
- Tauri blog post on IPC rewrite -- `convertFileSrc` remains recommended for file access
- create-tauri-app v3 release notes -- confirmed Preact template removal

### Tertiary (LOW confidence)
- WebSearch results on Vite 7 compatibility with Motion Canvas -- no direct evidence found; relied on peer dependency analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via npm, peer dependencies cross-checked, source code inspected
- Architecture: MEDIUM-HIGH - Patterns verified from source code and official docs; JSX conflict resolution and plugin ordering need runtime validation
- Pitfalls: HIGH - Identified from source code analysis (Vite version, JSX conflict, CSP) not just web searches

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable ecosystem, @efxlab packages are very new -- may update)
