# Phase 34: Standalone Demo Shell - Research

**Researched:** 2026-06-08
**Domain:** pnpm workspace package-local Vite/Preact demo shell for `@efxlab/efx-physic-paint` [VERIFIED: codebase]
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Phase Boundary

Phase 34 delivers a package-local, repo-root-launchable standalone browser demo shell for `packages/efx-physic-paint`. It proves that the physics paint package can run independently from the EFX Motion Editor/Tauri runtime, with Vite/Preact HMR and documentation that matches the actual scripts. It does not implement the full interactive controls/diagnostics surface; those are Phase 35 unless already exposed by the package wrapper defaults.

## Implementation Decisions

### Demo Location
- **D-01:** The browser demo lives under `packages/efx-physic-paint/demo`.
- **D-02:** Demo files are demo-only: they use their own Vite entry/config and must not become part of `tsup` library outputs, published `files`, or exported package subpaths.
- **D-03:** The demo should use the public package API shape where possible, not package internals.
- **D-04:** Phase 34 uses a single page only. Do not add routing/navigation for examples or diagnostics in this phase.

### Command Naming
- **D-05:** Repo-root `pnpm dev:paint` launches the standalone browser paint demo.
- **D-06:** The previous root-level `pnpm dev:paint` behavior (`tsup --watch` via package `dev:watch`) does not need a new root alias for Phase 34. Use Vite HMR for the standalone demo feedback loop.
- **D-07:** Document the distinction between the app workflows and standalone paint workflow: root `pnpm dev` runs the app Vite frontend, the actual desktop app is run via the app Tauri command, and root `pnpm dev:paint` is the standalone physics paint browser demo.

### Import Boundary
- **D-08:** The demo imports the public Preact entry shape and Vite aliases it to source for HMR. This keeps the consumer-facing import shape while avoiding `tsup --watch` during demo iteration.
- **D-09:** The first public surface to prove is the Preact wrapper (`EfxPaintCanvas` from the public Preact entry).
- **D-10:** The demo must not import from `app/` or depend on the Tauri/editor runtime.
- **D-11:** Package build/type verification stays separate from demo launch. `pnpm dev:paint` starts only the Vite demo; build/check commands verify dist/types separately.

### Shell UI
- **D-12:** The Phase 34 shell is canvas + header: a single page with a standalone title/header plus the mounted paint canvas.
- **D-13:** The header/copy must clearly identify this as the standalone `@efxlab/efx-physic-paint` package demo, not editor integration.
- **D-14:** Include a tiny status line such as `Vite demo / public Preact API / no editor runtime` for quick UAT clarity.
- **D-15:** Include a minimal visible mount error state if the canvas fails to mount. Do not build a diagnostic panel in Phase 34.
- **D-16:** Do not implement new custom tool/color/brush controls in Phase 34. Mount the real standalone physics paint canvas with engine/package defaults; if the Preact wrapper already exposes default UI, keep it. The full standalone physics paint UI (tool, color, brush size, opacity, physics controls, diagnostics) belongs to Phase 35.

### Claude's Discretion
No areas were delegated to Claude discretion. User made explicit choices for all discussed gray areas.

### Deferred Ideas (OUT OF SCOPE)
- Full standalone physics paint controls — tool, color, brush size, opacity, physics controls, and diagnostics — belong to Phase 35: Interactive Physics Paint Controls.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can start standalone physics paint from the repo root with a documented pnpm command. [VERIFIED: requirements] | Root `package.json` already uses pnpm filters and current `dev:paint` points to package `dev:watch`; planner should retarget it to a package demo script. [VERIFIED: codebase] pnpm supports `--filter <package_selector> <command>` to restrict commands to workspace packages. [CITED: https://pnpm.io/filtering] |
| RUN-02 | User can iterate on the standalone demo with Vite/Preact HMR while the library build remains separate. [VERIFIED: requirements] | Use a package-local Vite config under `packages/efx-physic-paint/demo` with `@preact/preset-vite`; alias `@efxlab/efx-physic-paint/preact` to `src/preact.tsx` for source HMR while keeping `tsup.config.ts` entries limited to `src/index.ts`, `src/preact.tsx`, and `src/animation/index.ts`. [VERIFIED: codebase] [CITED: https://vite.dev/config/shared-options.html] |
| RUN-03 | User can follow README instructions that match the actual package scripts. [VERIFIED: requirements] | Existing package README development instructions say `pnpm dev` starts a demo app, but package scripts currently expose only `build`, `dev:watch`, and `check`; planner must update README after script changes. [VERIFIED: codebase] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use project-local GSD tooling from `.claude/get-shit-done`, not `$HOME/.claude/get-shit-done`. [VERIFIED: codebase]
- Do not run the server; the user runs server/demo commands on their side. [VERIFIED: codebase]
- The repository uses pnpm, not npm, for project workflows. [VERIFIED: user memory]
- Do not recommend editor/Tauri coupling for this phase; Phase 34 is a standalone browser package demo. [VERIFIED: context]

## Summary

Phase 34 should be planned as a small workspace-script and package-demo shell phase, not as an engine feature phase. The locked decisions require a package-local `packages/efx-physic-paint/demo` Vite/Preact single page that mounts `EfxPaintCanvas` from the public subpath shape `@efxlab/efx-physic-paint/preact`, with Vite aliasing that subpath to source for HMR. [VERIFIED: context] [VERIFIED: codebase] The demo must not import from `app/`, must not run the Tauri/editor runtime, and must not expand into Phase 35 controls/diagnostics. [VERIFIED: context]

The main implementation risk is conflating three separate workflows: app frontend Vite (`pnpm dev`), desktop/Tauri runtime (`app` package `tauri` script), and standalone physics paint demo (`pnpm dev:paint`). [VERIFIED: codebase] The planner should make the command contract explicit in root `package.json`, package `package.json`, and package README, then validate with non-server commands (`check`/`build`) plus a manual UAT instruction for the user-run demo because project instructions forbid Claude from running the server. [VERIFIED: codebase]

**Primary recommendation:** Add a package-local Vite/Preact demo script (`demo:dev`) in `@efxlab/efx-physic-paint`, retarget root `pnpm dev:paint` to `pnpm --filter @efxlab/efx-physic-paint demo:dev`, mount `EfxPaintCanvas` through a public-subpath alias to `src/preact.tsx`, and update README instructions to distinguish standalone demo, app Vite, and Tauri workflows. [VERIFIED: context] [VERIFIED: codebase]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Repo-root launch command | Workspace tooling | Package script | Root `package.json` owns user-facing workspace commands; package `package.json` owns package-local demo command implementation. [VERIFIED: codebase] |
| Demo HMR loop | Browser / Client | Vite dev server | Preact UI modules and canvas shell update in browser; Vite provides dev-server HMR and alias resolution. [CITED: https://vite.dev/config/server-options.html] [CITED: https://preactjs.com/guide/v10/getting-started] |
| Physics paint rendering | Browser / Client | Package engine | `EfxPaintCanvas` creates `EfxPaintEngine` in a DOM container and the engine owns canvases, buffers, pointer handlers, intervals, and RAF lifecycle. [VERIFIED: codebase] |
| Library build/type output | Package build tooling | TypeScript compiler | `tsup.config.ts` controls ESM/dts library outputs and currently excludes demo files through `files: ["dist"]`; demo must remain outside exports/files. [VERIFIED: codebase] |
| README workflow instructions | Documentation | Workspace/package scripts | RUN-03 is satisfied only if documented root/package commands match actual scripts. [VERIFIED: requirements] |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pnpm` | 10.27.0 installed locally [VERIFIED: environment] | Workspace package script orchestration. [CITED: https://pnpm.io/workspaces] | Project root declares `packageManager: pnpm@10.27.0` and workspace packages include `app` and `packages/*`. [VERIFIED: codebase] |
| `vite` | Project app uses 5.4.21; npm latest 8.0.16 modified 2026-06-01. [VERIFIED: npm registry] | Package-local browser demo dev server and HMR. [CITED: https://vite.dev/config/server-options.html] | Vite config supports project `root`, `resolve.alias`, `publicDir`, and HMR server configuration needed for a package-local demo. [CITED: https://vite.dev/config/shared-options.html] |
| `@preact/preset-vite` | Project app uses ^2.10.3; npm latest 2.10.5 modified 2026-03-20. [VERIFIED: npm registry] | Vite plugin preset for Preact JSX/HMR/devtools aliases. [VERIFIED: npm registry README] | The package README states the preset is an all-in-one preset for writing Preact apps with Vite and sets up HMR via prefresh. [VERIFIED: npm registry README] |
| `preact` | Package devDependency ^10.29.0; npm latest 10.29.2 modified 2026-05-17. [VERIFIED: npm registry] | Demo UI runtime and public wrapper peer dependency. [CITED: https://preactjs.com/guide/v10/getting-started] | The package already exposes a Preact wrapper and declares `preact >=10.0.0` as an optional peer dependency. [VERIFIED: codebase] |
| `tsup` | Package devDependency ^8.5.1; npm latest 8.5.1 modified 2025-11-12. [VERIFIED: npm registry] | Existing library build/dts output. [VERIFIED: codebase] | Phase 34 must keep `tsup` library build separate from Vite demo launch. [VERIFIED: context] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typescript` | Package devDependency ~5.9.3. [VERIFIED: codebase] | `check` script and TS/TSX demo source type checking. [VERIFIED: codebase] | Use for package-local `pnpm --filter @efxlab/efx-physic-paint check`; do not rely on starting Vite for type correctness. [VERIFIED: codebase] |
| `@efxlab/efx-physic-paint` public subpath `./preact` | Local workspace package 0.1.0. [VERIFIED: codebase] | Consumer-facing import shape for demo. [VERIFIED: context] | Import `EfxPaintCanvas` from `@efxlab/efx-physic-paint/preact`; alias that specifier to source in Vite for HMR. [VERIFIED: context] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite demo script | `tsup --watch` | Rejected by locked decision D-06; `tsup --watch` verifies/builds library output but does not provide browser HMR for demo iteration. [VERIFIED: context] |
| Public subpath import with Vite alias | Relative import from `../src/preact` | Relative source import may HMR, but violates D-08's consumer-facing public import shape. [VERIFIED: context] |
| Package-local demo | Root-level demo app | Rejected by D-01; package-local demo keeps standalone package proof separate from app runtime. [VERIFIED: context] |
| Full controls/diagnostic UI | Phase 35 UI surface | Rejected by D-16 and deferred ideas; Phase 34 is shell-only unless wrapper defaults already expose UI. [VERIFIED: context] |

**Installation:**
```bash
pnpm --filter @efxlab/efx-physic-paint add -D vite@5.4.21 @preact/preset-vite@^2.10.5
```
Use pnpm, not npm, for project dependency changes. [VERIFIED: user memory] Prefer reusing the app's Vite major/version (`5.4.21`) unless the planner explicitly decides to upgrade the whole workspace Vite version. [VERIFIED: codebase]

**Version verification:** npm registry checks in this session reported: `vite` latest 8.0.16, `@preact/preset-vite` latest 2.10.5, `preact` latest 10.29.2, and `tsup` latest 8.5.1. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `vite` | npm | Created 2020-04-21; modified 2026-06-01. [VERIFIED: npm registry] | Not returned by `npm view` in this session. [VERIFIED: npm registry] | github.com/vitejs/vite [VERIFIED: npm registry] | OK [VERIFIED: slopcheck] | Approved; official docs at vite.dev also confirm package identity. [CITED: https://vite.dev/config/shared-options.html] |
| `@preact/preset-vite` | npm | Created 2021-03-12; modified 2026-03-20. [VERIFIED: npm registry] | Not returned by `npm view` in this session. [VERIFIED: npm registry] | github.com/preactjs/preset-vite [VERIFIED: npm registry] | OK [VERIFIED: slopcheck] | Approved; npm README confirms it is the Preact Vite preset. [VERIFIED: npm registry README] |
| `preact` | npm | Created 2015-09-11; modified 2026-05-17. [VERIFIED: npm registry] | Not returned by `npm view` in this session. [VERIFIED: npm registry] | github.com/preactjs/preact [VERIFIED: npm registry] | SUS: suspiciously close to `react`. [VERIFIED: slopcheck] | Approved with note: this is an intentional existing project dependency and official Preact docs confirm package identity. [CITED: https://preactjs.com/guide/v10/getting-started] |
| `tsup` | npm | Created 2020-05-10; modified 2025-11-12. [VERIFIED: npm registry] | Not returned by `npm view` in this session. [VERIFIED: npm registry] | github.com/egoist/tsup [VERIFIED: npm registry] | OK [VERIFIED: slopcheck] | Existing approved package build tool; no new install required for Phase 34 if unchanged. [VERIFIED: codebase] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]
**Packages flagged as suspicious [SUS]:** `preact`; planner should not block on this because Preact is already a locked/existing project dependency and official Preact documentation verifies the package identity. [VERIFIED: codebase] [CITED: https://preactjs.com/guide/v10/getting-started]

## Architecture Patterns

### System Architecture Diagram

```text
Developer runs from repo root
  |
  v
root package.json: pnpm dev:paint
  |
  v
pnpm --filter @efxlab/efx-physic-paint demo:dev
  |
  v
packages/efx-physic-paint/demo/vite.config.ts
  |       |                         |
  |       | resolve.alias           | dev server HMR
  |       v                         v
  |  @efxlab/efx-physic-paint/preact --> ../src/preact.tsx
  |                                      |
  v                                      v
demo/index.html --> demo/src/main.tsx --> <EfxPaintCanvas />
                                              |
                                              v
                                      EfxPaintEngine owns canvas,
                                      pointer input, buffers, RAF,
                                      physics/drying intervals
```

This flow keeps Vite demo serving/HMR separate from `tsup` library builds and keeps the demo out of app/Tauri runtime boundaries. [VERIFIED: context] [VERIFIED: codebase]

### Recommended Project Structure
```text
packages/efx-physic-paint/
├── demo/                         # Demo-only Vite/Preact app; not exported/published. [VERIFIED: context]
│   ├── index.html                # Vite HTML entry; Vite root points here. [CITED: https://vite.dev/config/shared-options.html]
│   ├── vite.config.ts            # Preact plugin + public-subpath alias to source. [CITED: https://vite.dev/config/shared-options.html]
│   └── src/
│       ├── main.tsx              # Preact render entry. [CITED: https://preactjs.com/guide/v10/getting-started]
│       └── styles.css            # Shell-only layout: header/status/canvas/mount error. [VERIFIED: context]
├── src/
│   ├── preact.tsx                # Public Preact wrapper source. [VERIFIED: codebase]
│   └── index.ts                  # Main public engine exports. [VERIFIED: codebase]
├── package.json                  # Add demo:dev/demo:build script; keep build/dev:watch/check separate. [VERIFIED: codebase]
├── tsup.config.ts                # Library-only entries; do not include demo. [VERIFIED: codebase]
└── README.md                     # Update root/package workflow docs. [VERIFIED: requirements]
```

### Pattern 1: Package-local Vite root with public import alias
**What:** Put `vite.config.ts` in `packages/efx-physic-paint/demo`, set Vite `root` to the demo directory if config is not colocated, and add `resolve.alias` for `@efxlab/efx-physic-paint/preact` to the absolute source file path. [CITED: https://vite.dev/config/shared-options.html]

**When to use:** Use when a local package demo must exercise the same import specifier consumers will use, while HMR should update source without waiting for `tsup --watch`. [VERIFIED: context]

**Example:**
```ts
// Source: Vite shared options docs for root and resolve.alias. [CITED: https://vite.dev/config/shared-options.html]
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../src/preact.tsx', import.meta.url)),
    },
  },
})
```

### Pattern 2: Thin shell mounts public wrapper, not internals
**What:** Demo `main.tsx` should render a shell component that displays the standalone package heading/status, a visible error state, and `<EfxPaintCanvas />`. [VERIFIED: context]

**When to use:** Use for RUN-01/RUN-02 proof without creating Phase 35 controls or depending on engine internals. [VERIFIED: context]

**Example:**
```tsx
// Source: Preact getting-started docs show rendering a Preact app; package code exposes EfxPaintCanvas. [CITED: https://preactjs.com/guide/v10/getting-started] [VERIFIED: codebase]
import { render } from 'preact'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import './styles.css'

function DemoApp() {
  return (
    <main class="demo-shell">
      <header>
        <h1>@efxlab/efx-physic-paint standalone demo</h1>
        <p>Vite demo / public Preact API / no editor runtime</p>
      </header>
      <EfxPaintCanvas width={1000} height={650} papers={[]} />
    </main>
  )
}

render(<DemoApp />, document.getElementById('app')!)
```

Planner note: `EngineConfig` currently requires `papers: PaperConfig[]`; confirm whether an empty array is valid at runtime or provide demo-local static paper assets and `defaultPaper`. [VERIFIED: codebase]

### Pattern 3: Root command delegates to package script
**What:** Keep root `dev:paint` as a stable user-facing alias and delegate actual implementation to package-local script. [VERIFIED: context]

**When to use:** Use for monorepo workflows where package internals may change but root command remains user-facing. [VERIFIED: codebase]

**Example:**
```json
{
  "scripts": {
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint demo:dev"
  }
}
```

pnpm filtering restricts commands to selected packages. [CITED: https://pnpm.io/filtering]

### Anti-Patterns to Avoid
- **Importing package internals from demo:** Avoid `../src/engine/EfxPaintEngine` in Phase 34; use `@efxlab/efx-physic-paint/preact` to prove the public wrapper surface. [VERIFIED: context]
- **Adding demo to `exports` or `files`:** Demo is not a published API or library output. Keep package `files` as `dist` and keep `tsup` entries library-only. [VERIFIED: context] [VERIFIED: codebase]
- **Replacing `dev:paint` with `tsup --watch`:** D-06 explicitly says root `dev:paint` should be the Vite demo feedback loop. [VERIFIED: context]
- **Building Phase 35 controls:** Do not add custom tool/color/brush/diagnostic panels in Phase 34. [VERIFIED: context]
- **Running the server during implementation:** Project CLAUDE.md says the user runs the server. [VERIFIED: codebase]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser dev server/HMR | Custom static server, file watcher, or `tsup --watch` browser reload glue | Vite + `@preact/preset-vite` | Vite officially supports HMR configuration; the Preact preset sets up Preact HMR via prefresh. [CITED: https://vite.dev/config/server-options.html] [VERIFIED: npm registry README] |
| Workspace command routing | Shell scripts that `cd` into package directories | `pnpm --filter @efxlab/efx-physic-paint demo:dev` | pnpm filtering is the standard workspace selector mechanism. [CITED: https://pnpm.io/filtering] |
| Public/private import boundary | Relative source imports in app code | Vite `resolve.alias` for public subpath specifier | Vite aliases replace import specifiers and should use absolute filesystem paths for filesystem aliases. [CITED: https://vite.dev/config/shared-options.html] |
| Demo diagnostics/controls | New bespoke control panel | Phase 35 implementation | Phase 34 shell is header + canvas + tiny status + mount error only. [VERIFIED: context] |
| Package publishing filters | Custom publish scripts to exclude demo | Existing `files: ["dist"]` + tsup entries | Package already publishes only `dist`; keep demo out of build/export paths. [VERIFIED: codebase] |

**Key insight:** The hard part is boundary discipline, not UI complexity: the phase succeeds when the same local package can be edited with browser HMR while its public import shape, build output, and editor runtime boundaries stay clean. [VERIFIED: context]

## Common Pitfalls

### Pitfall 1: README contradicts actual scripts
**What goes wrong:** README says `pnpm dev` starts a demo, but package scripts do not expose `dev`; user cannot follow instructions. [VERIFIED: codebase]
**Why it happens:** Documentation predates the monorepo script split. [ASSUMED]
**How to avoid:** Update README after package/root scripts are final; include both root `pnpm dev:paint` and package-local filtered command. [VERIFIED: requirements]
**Warning signs:** README command names do not appear in root/package `package.json`. [VERIFIED: codebase]

### Pitfall 2: Vite alias points to a relative filesystem path
**What goes wrong:** Alias may resolve relative to unexpected directories or fail across package roots. [ASSUMED]
**Why it happens:** Vite docs state filesystem alias replacement values should be absolute paths. [CITED: https://vite.dev/config/shared-options.html]
**How to avoid:** Use `fileURLToPath(new URL('../src/preact.tsx', import.meta.url))` in demo Vite config. [CITED: https://vite.dev/config/shared-options.html]
**Warning signs:** Browser imports compiled `dist/preact.mjs` instead of source, or HMR does not react to `src/preact.tsx` edits. [ASSUMED]

### Pitfall 3: Demo accidentally becomes a package export
**What goes wrong:** Demo files enter library build, emitted types, package `files`, or `exports`, making a private test harness part of public API. [VERIFIED: context]
**Why it happens:** Putting demo under `src/` or adding `demo` to `tsup` entries/exports. [VERIFIED: codebase]
**How to avoid:** Put demo under `packages/efx-physic-paint/demo`; leave `tsup.config.ts` entries unchanged; keep package `files` as `dist`. [VERIFIED: context] [VERIFIED: codebase]
**Warning signs:** `dist/demo*` appears after build or package `exports` contains `./demo`. [ASSUMED]

### Pitfall 4: Engine wrapper props mismatch README examples
**What goes wrong:** README examples use old props such as `paperPath` or `onEngine`, but actual wrapper expects `papers`, `defaultPaper`, and `onEngineReady`. [VERIFIED: codebase]
**Why it happens:** README is stale relative to `src/preact.tsx` and `types.ts`. [VERIFIED: codebase]
**How to avoid:** Base README/demo examples on current `EfxPaintCanvasProps` and `EngineConfig`. [VERIFIED: codebase]
**Warning signs:** TypeScript errors on README-copied examples or demo fails because required `papers` is missing. [VERIFIED: codebase]

### Pitfall 5: Running editor/Tauri paths to validate standalone demo
**What goes wrong:** Validation proves app Vite or desktop runtime, not package standalone execution. [VERIFIED: context]
**Why it happens:** Root `pnpm dev` already runs app Vite and `app` package has Tauri scripts. [VERIFIED: codebase]
**How to avoid:** Document command distinction and validate `pnpm dev:paint` points to package demo script. [VERIFIED: context]
**Warning signs:** Demo imports from `app/`, references Tauri APIs, or README tells users to run app Tauri commands for package demo. [VERIFIED: context]

## Code Examples

### Package demo script split
```json
// Source: pnpm filtering docs and current package scripts. [CITED: https://pnpm.io/filtering] [VERIFIED: codebase]
{
  "scripts": {
    "build": "tsup",
    "dev:watch": "tsup --watch",
    "demo:dev": "vite --config demo/vite.config.ts",
    "demo:build": "vite build --config demo/vite.config.ts",
    "check": "tsc --noEmit"
  }
}
```

### Vite config alias for source HMR
```ts
// Source: Vite resolve.alias docs; filesystem aliases should be absolute. [CITED: https://vite.dev/config/shared-options.html]
resolve: {
  alias: {
    '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../src/preact.tsx', import.meta.url)),
  },
}
```

### Preact render entry
```tsx
// Source: Preact getting-started docs for Preact app rendering pattern. [CITED: https://preactjs.com/guide/v10/getting-started]
import { render } from 'preact'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'

render(<EfxPaintCanvas width={1000} height={650} papers={[]} />, document.getElementById('app')!)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Root `pnpm dev:paint` runs `tsup --watch` via package `dev:watch`. [VERIFIED: codebase] | Root `pnpm dev:paint` should run the Vite standalone demo. [VERIFIED: context] | Phase 34 decision D-06 on 2026-06-08. [VERIFIED: context] | Faster browser HMR loop; build/type verification remains separate. [VERIFIED: context] |
| README says package `pnpm dev` starts demo. [VERIFIED: codebase] | README should document actual root `pnpm dev:paint` and package demo scripts. [VERIFIED: requirements] | Phase 34 RUN-03. [VERIFIED: requirements] | User instructions become executable and reduce workflow confusion. [VERIFIED: requirements] |
| Proving physics paint through editor integration. [VERIFIED: state] | Prove `packages/efx-physic-paint` standalone first. [VERIFIED: state] | v0.8.0 milestone decision. [VERIFIED: state] | Avoids failed headless adapter/batch replay path and postpones editor integration. [VERIFIED: state] |

**Deprecated/outdated:**
- README `paperPath`/`onEngine` examples are stale; current wrapper uses `papers` and `onEngineReady`. [VERIFIED: codebase]
- Root `dev:paint` as library watcher is outdated for Phase 34; D-06 requires Vite demo feedback loop. [VERIFIED: context]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | README is stale because it predates the current monorepo/script split. | Common Pitfalls | Low; remediation is still to update README to actual scripts. |
| A2 | Relative Vite filesystem aliases may resolve unexpectedly across package roots. | Common Pitfalls | Medium; using absolute aliases follows official docs and avoids the risk. |
| A3 | Browser imports compiled `dist` instead of source if alias is missing or wrong. | Common Pitfalls | Medium; HMR requirement RUN-02 would not be satisfied. |
| A4 | `papers={[]}` may or may not be valid at runtime despite satisfying the type shape. | Architecture Patterns / Code Examples | Medium; planner should verify engine init behavior or include demo paper assets. |
| A5 | `dist/demo*` or `exports["./demo"]` are useful warning signs of accidental public API expansion. | Common Pitfalls | Low; checking build output/exports is still valid. |

## Open Questions (RESOLVED)

1. **RESOLVED: `EfxPaintEngine.init()` tolerates an empty `papers` array for the Phase 34 shell.**
   - Resolution: Use `papers={[]}` and do not add a demo/public paper asset in Phase 34. `EfxPaintEngine` stores `config.papers || []`, `init()` calls `loadPaperTextures([])`, the loader loop is a no-op, and when no texture exists the engine uses existing procedural/empty height-map fallback paths through `sampleH(this.paperHeight, ...)` and `ensureHeightMap(null, ...)` when grain is selected. [VERIFIED: codebase]
   - Planning impact: Plan 34-02 must pass `papers={[]}` explicitly, must not include a conditional demo asset branch, and must verify that no `demo/public` paper asset or `defaultPaper` is required for the shell. [VERIFIED: codebase]

2. **RESOLVED: package Vite uses the project-pinned Vite 5.4.21 for Phase 34.**
   - Resolution: Add/reuse `vite@5.4.21`, matching the existing app Vite version, instead of upgrading to latest Vite 8.0.16. [VERIFIED: codebase] [VERIFIED: npm registry]
   - Planning impact: Plan 34-01 dependency changes stay limited to the package-local demo requirements; workspace-wide Vite upgrades are out of Phase 34 scope. [VERIFIED: context]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite/pnpm scripts | Yes [VERIFIED: environment] | v24.15.0 [VERIFIED: environment] | None needed |
| pnpm | Workspace command execution | Yes [VERIFIED: environment] | 10.27.0 [VERIFIED: environment] | None; project standard is pnpm [VERIFIED: user memory] |
| npm registry access | Version/package audit | Yes [VERIFIED: npm registry] | npm CLI 11.12.1 [VERIFIED: environment] | Use pnpm registry commands during implementation; npm was used only for research audit [VERIFIED: environment] |
| slopcheck | Package legitimacy audit | Yes [VERIFIED: environment] | 0.6.1 [VERIFIED: environment] | Manual official-doc verification if unavailable |
| Browser/Vite dev server | User UAT for `pnpm dev:paint` | Not run by Claude [VERIFIED: codebase] | — | User runs demo command per project instruction |

**Missing dependencies with no fallback:** none found for planning. [VERIFIED: environment]

**Missing dependencies with fallback:** Browser/server runtime is intentionally not exercised by Claude because CLAUDE.md says the user runs the server. [VERIFIED: codebase]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler + Vite build smoke; app has Vitest config, package has no package-local Vitest config. [VERIFIED: codebase] |
| Config file | `packages/efx-physic-paint/tsconfig.json`, `packages/efx-physic-paint/tsconfig.build.json`, and future `packages/efx-physic-paint/demo/vite.config.ts`. [VERIFIED: codebase] |
| Quick run command | `pnpm --filter @efxlab/efx-physic-paint check` [VERIFIED: codebase] |
| Full suite command | `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint demo:build` after `demo:build` exists. [VERIFIED: codebase] |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | Root `pnpm dev:paint` delegates to standalone package demo script. [VERIFIED: requirements] | static/script smoke | Inspect root/package scripts; do not run server. `pnpm --filter @efxlab/efx-physic-paint check` for TS health. [VERIFIED: codebase] | Root/package `package.json` exists. [VERIFIED: codebase] |
| RUN-02 | Demo imports public Preact entry shape and HMR can update source while build remains separate. [VERIFIED: requirements] | build/static smoke + manual UAT | `pnpm --filter @efxlab/efx-physic-paint demo:build` once script exists; user manually runs `pnpm dev:paint`. [VERIFIED: codebase] | `demo/vite.config.ts` missing; Wave 0 creates it. [VERIFIED: codebase] |
| RUN-03 | README instructions match actual scripts. [VERIFIED: requirements] | documentation/static review | Compare README command blocks to root/package scripts; optional grep in plan task. [VERIFIED: codebase] | README exists but is stale. [VERIFIED: codebase] |

### Sampling Rate
- **Per task commit:** `pnpm --filter @efxlab/efx-physic-paint check` after TS/TSX changes. [VERIFIED: codebase]
- **Per wave merge:** `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter @efxlab/efx-physic-paint demo:build` after demo build script exists. [VERIFIED: codebase]
- **Phase gate:** User-run manual UAT: `pnpm dev:paint` from repo root opens standalone package demo and header/status identify no editor runtime. [VERIFIED: context]

### Wave 0 Gaps
- [ ] `packages/efx-physic-paint/demo/vite.config.ts` — required for RUN-02 package-local Vite demo. [VERIFIED: codebase]
- [ ] `packages/efx-physic-paint/demo/index.html` — required Vite entry. [CITED: https://vite.dev/config/shared-options.html]
- [ ] `packages/efx-physic-paint/demo/src/main.tsx` — required Preact render entry. [CITED: https://preactjs.com/guide/v10/getting-started]
- [ ] Package scripts `demo:dev` and `demo:build` — required for root delegation and build smoke. [VERIFIED: requirements]
- [ ] README command corrections — required for RUN-03. [VERIFIED: requirements]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No [VERIFIED: context] | No auth in standalone local demo. [VERIFIED: context] |
| V3 Session Management | No [VERIFIED: context] | No sessions/cookies required. [VERIFIED: context] |
| V4 Access Control | No [VERIFIED: context] | No backend/resource authorization. [VERIFIED: context] |
| V5 Input Validation | Yes [ASSUMED] | Keep demo inputs static/minimal in Phase 34; avoid accepting arbitrary HTML/URLs. [ASSUMED] |
| V6 Cryptography | No [VERIFIED: context] | No crypto or secrets required. [VERIFIED: context] |
| V14 Configuration | Yes [ASSUMED] | Keep Vite public assets non-secret; do not expose `.env` or editor/Tauri config. [CITED: https://vite.dev/config/shared-options.html] |

### Known Threat Patterns for Vite/Preact Local Demo

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain confusion from new dev dependencies | Tampering | Use pnpm, official docs, npm registry verification, and slopcheck audit before adding packages. [VERIFIED: slopcheck] [VERIFIED: npm registry] |
| Accidental secret exposure through Vite public directory | Information Disclosure | Vite serves `publicDir` files as-is at `/`; keep demo public assets limited to non-secret images/static files. [CITED: https://vite.dev/config/shared-options.html] |
| XSS through demo header/status rendering | Tampering | Use static JSX strings; do not use `dangerouslySetInnerHTML` or render user-provided HTML. [ASSUMED] |
| Editor runtime boundary breach | Elevation of Privilege / Information Disclosure | Do not import `app/` or Tauri APIs; demo is browser-only package shell. [VERIFIED: context] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/34-standalone-demo-shell/34-CONTEXT.md` — locked Phase 34 decisions, boundaries, deferred Phase 35 controls. [VERIFIED: codebase]
- `.planning/REQUIREMENTS.md` — RUN-01/RUN-02/RUN-03 definitions. [VERIFIED: codebase]
- `.planning/STATE.md` — v0.8.0 standalone-first milestone decisions. [VERIFIED: codebase]
- `package.json`, `app/package.json`, `pnpm-workspace.yaml`, `packages/efx-physic-paint/package.json`, `tsup.config.ts`, `src/preact.tsx`, `src/types.ts` — current script/export/wrapper/build state. [VERIFIED: codebase]
- Vite official docs — `root`, `publicDir`, `resolve.alias`, `server.hmr`. [CITED: https://vite.dev/config/shared-options.html] [CITED: https://vite.dev/config/server-options.html]
- pnpm official docs — workspace root and filtering. [CITED: https://pnpm.io/workspaces] [CITED: https://pnpm.io/filtering]
- Preact official docs — Vite recommended getting-started route and Preact render setup. [CITED: https://preactjs.com/guide/v10/getting-started]

### Secondary (MEDIUM confidence)
- npm registry metadata for `vite`, `@preact/preset-vite`, `preact`, and `tsup`. [VERIFIED: npm registry]
- npm README for `@preact/preset-vite` package purpose/HMR behavior. [VERIFIED: npm registry README]
- slopcheck 0.6.1 package audit output. [VERIFIED: slopcheck]

### Tertiary (LOW confidence)
- Assumptions in the Assumptions Log about likely failure modes not fully executed in browser due project instruction not to run the server. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stack is locked by existing project dependencies and official Vite/Preact/pnpm docs; versions verified via npm registry and environment probes. [VERIFIED: codebase] [VERIFIED: npm registry]
- Architecture: HIGH — phase boundary and public-import pattern are explicit locked decisions; codebase confirms current wrapper/export/build shape. [VERIFIED: context] [VERIFIED: codebase]
- Pitfalls: MEDIUM — most pitfalls are directly confirmed by stale README/scripts and locked constraints, but runtime paper-init behavior still needs implementation-time validation. [VERIFIED: codebase] [ASSUMED]

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 for project-local architecture; 2026-06-15 for npm latest-version recommendations because Vite is fast-moving. [ASSUMED]
