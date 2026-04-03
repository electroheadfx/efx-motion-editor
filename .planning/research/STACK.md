# Stack Research

**Domain:** pnpm monorepo scaffold + physics paint engine integration
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

v0.7.0 requires two structural changes: (1) converting the single-package repo into a pnpm monorepo with `app/` and `packages/efx-physic-paint/`, and (2) replacing `perfect-freehand` + `p5.brush` with `@efxlab/efx-physic-paint` as the paint engine. No new external dependencies are needed -- the paint engine has zero runtime deps, and tsup (already its devDependency) handles builds. The primary work is workspace configuration, Vite config updates, and rewriting the editor's paint adapter layer to target the new engine API.

## What the Existing Stack Already Covers

| Concern | Covered By | Notes |
|---------|-----------|-------|
| Package management & workspace linking | pnpm 10.28.0 (installed) | Already the project's PM; workspace protocol built in |
| Library bundling | tsup ^8.5.1 (paint's devDep) | Already configured with 3 entry points, ESM output, dts |
| Dev HMR for linked packages | Vite 5.4.21 | Auto-detects ESM workspace links as source code |
| Preact integration | `@efxlab/efx-physic-paint/preact` export | Paint engine ships a Preact wrapper component |
| Animation/frame replay | `@efxlab/efx-physic-paint/animation` export | AnimationPlayer for onion skinning and export |
| TypeScript | TS ~5.9.3 in both packages | Identical versions, no conflict |
| Bezier path editing | fit-curve + bezier-js (editor) | Stays in editor; paint engine has no bezier editing |

## Recommended Stack

### Core Technologies (NEW for v0.7.0)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pnpm workspaces | 10.28.0 (installed) | Monorepo package linking with single lockfile | Already the project's package manager; `workspace:*` protocol auto-rewrites on publish; content-addressable store |
| tsup | ^8.5.1 | Build `@efxlab/efx-physic-paint` library | Already configured in paint package; ESM-only `.mjs` output with dts; `--watch` mode for dev |
| @efxlab/efx-physic-paint | 0.1.0 (workspace) | Physics paint engine replacing perfect-freehand + p5.brush | Wet/dry physics, stable fluids, paper texture, transparency, animation, Preact wrapper, JSON brush format |

### Libraries to REMOVE

| Library | Current Version | Reason for Removal |
|---------|----------------|-------------------|
| perfect-freehand | ^1.2.3 | Replaced by `@efxlab/efx-physic-paint` stroke engine; physics paint handles pressure/tilt with wet paint simulation |
| p5.brush | 2.1.3-beta | Replaced by `@efxlab/efx-physic-paint`; p5.brush lacks transparency support; new engine has its own FX pipeline |

### Libraries to KEEP (unchanged)

| Library | Why Keep |
|---------|---------|
| fit-curve ^0.2.0 | Bezier path fitting remains in editor -- paint engine has no bezier editing |
| bezier-js ^6.1.4 | Cubic bezier math for path editing -- editor-side concern |
| All other deps | Unchanged -- Tauri, Preact, Signals, Motion Canvas, Tailwind, SortableJS, tinykeys, etc. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `pnpm --filter` | Run scripts in specific workspace packages | `pnpm --filter @efxlab/efx-physic-paint build` |
| `tsup --watch` | Hot-rebuild paint library during dev | Paint changes rebuild dist/, Vite HMR picks up linked package changes |

## Workspace Configuration

### pnpm-workspace.yaml (root)

```yaml
packages:
  - "app"
  - "packages/*"
```

Use `app/` not `Application/` -- shorter, conventional for monorepos (TanStack, Turborepo templates all use `app` or `apps`). The milestone spec explicitly considers this rename.

### Root package.json

```json
{
  "private": true,
  "packageManager": "pnpm@10.28.0",
  "scripts": {
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch"
  }
}
```

Use installed pnpm 10.28.0 (not 10.27.0 from milestone spec -- the installed version is current).

### app/package.json dependency addition

```json
{
  "dependencies": {
    "@efxlab/efx-physic-paint": "workspace:*"
  }
}
```

`workspace:*` always resolves to the local package; pnpm rewrites to the real version on `npm publish`.

### Vite Configuration for Workspace Package

Vite 5 automatically detects linked workspace packages exported as ESM and treats them as source code (no pre-bundling). Since `@efxlab/efx-physic-paint` outputs ESM (.mjs), Vite will skip pre-bundling automatically.

**Replace** the current `p5.brush` exclude with `@efxlab/efx-physic-paint`:

```typescript
optimizeDeps: {
  exclude: ['@efxlab/efx-physic-paint'],
}
```

This is a safety net. Vite handles workspace links automatically, but explicit exclusion prevents edge cases with the dual-canvas WebGL state in the paint engine (same class of issue p5.brush had with module-scoped state).

### TypeScript Configuration

Both packages use `"moduleResolution": "bundler"` and `"jsxImportSource": "preact"`. No conflicts.

The paint package has a separate `tsconfig.build.json` extending the base with `declaration: true` and `declarationMap: true` for tsup's dts generation. Stays as-is.

**Note:** The editor targets ES2020, paint targets ES2023. This is fine -- the editor consumes the paint library's compiled output (ES module), not its source directly. Vite re-bundles everything to `safari13` anyway.

## Paint Engine Integration Points

### Entry Points (3 sub-path exports)

| Export | Import Path | Use in Editor |
|--------|-------------|---------------|
| Main | `@efxlab/efx-physic-paint` | `EfxPaintEngine` class, all types -- core replacement for perfect-freehand + p5.brush |
| Preact | `@efxlab/efx-physic-paint/preact` | `EfxPaintCanvas` component -- optional, editor may use engine directly for tighter control |
| Animation | `@efxlab/efx-physic-paint/animation` | `AnimationPlayer` -- frame-based stroke replay for onion skinning / export |

### Key API Mapping (current stack -> new engine)

| Current (to remove) | New (efx-physic-paint) | Notes |
|---------------------|------------------------|-------|
| `getStroke()` from perfect-freehand | Engine internal stroke recording via pointer events | Engine handles stroke rendering internally; editor feeds `PenPoint` events |
| `brushP5Adapter.ts` (p5.brush wrapper, ~200 LOC) | `engine.setTool()`, `setBrushSize()`, `setWaterAmount()`, etc. | Flat setter API replaces adapter pattern |
| `paintRenderer.ts` FX cache per frame | `engine.renderAllStrokes()` / `renderPartialStrokes()` | Engine manages wet/dry buffers and compositing |
| p5.brush spectral mixing (Kubelka-Munk) | Paint engine's wet layer physics (density-based alpha, Porter-Duff accumulated) | Different model but achieves color mixing with physics |
| No transparency support | `engine.setBgMode('transparent')` | Native `BgMode` enum |
| No paper texture in editor | `engine.setPaperGrain(key)`, `setEmbossStrength()`, `setWetPaper()` | Paper configs via `PaperConfig[]` in constructor |
| No physics simulation | `engine.startPhysics('local')`, `setPhysicsStrength()`, `setViscosity()` | Stable fluids solver for wet paint spreading |
| Manual undo via paintStore snapshots | `engine.undo()` + paintStore coordination | Engine has internal undo; editor wraps with command pattern |
| `PaintStroke` in `paint.ts` | `PaintStroke` from `@efxlab/efx-physic-paint` | Import type from library |
| Manual brush size/opacity/pressure | `BrushOpts` type with size, opacity, pressure, waterAmount, dryAmount, edgeDetail, pickup, eraseStrength, antiAlias | Richer parameter set |

### JSON Brush Format

The paint engine's `SerializedProject` (version 2) defines the JSON format:

```typescript
interface SerializedProject {
  version: 2
  width: number; height: number
  strokes: Array<{
    tool: string
    pts: Array<[x, y, p, tx, ty, tw, spd]>  // 7-tuple per point
    color: string | null
    params: Record<string, number>  // BrushOpts flattened
    time: number
    diffusionFrames?: number
  }>
  settings: { bgMode, paperGrain, embossStrength, wetPaper }
}
```

The editor's paint sidecar format (`frame-NNN.json`) will need to adopt this structure or bridge to it. The engine's `save()`/`load()` methods handle serialization.

### Files to Modify/Remove in Editor

| File | Action | Reason |
|------|--------|--------|
| `src/lib/brushP5Adapter.ts` | **Remove** | Replaced by direct engine API calls |
| `src/types/p5brush.d.ts` | **Remove** | No longer needed |
| `src/lib/paintRenderer.ts` | **Rewrite** | Delegate to EfxPaintEngine instead of perfect-freehand + p5.brush |
| `src/types/paint.ts` | **Update** | Import types from `@efxlab/efx-physic-paint`; bridge with editor-specific extensions |
| `src/stores/paintStore.ts` | **Update** | Store wraps EfxPaintEngine instance; adapts Preact Signals to engine state |
| `src/components/canvas/PaintOverlay.tsx` | **Update** | Use engine's dual-canvas output; feed PenPoint events to engine |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| pnpm 10.28.0 | pnpm-workspace.yaml format | Current format; `packages:` array is the standard |
| tsup ^8.5.1 | TypeScript ~5.9.3 | Both packages use TS 5.9.3 -- no conflicts |
| Vite 5.4.21 (editor) | ESM workspace links | Vite 5 handles linked ESM packages natively |
| @efxlab/efx-physic-paint | preact >=10.0.0 (peer, optional) | Editor has preact ^10.28.4 -- satisfies requirement |
| Paint devDep vite ^8.0.3 | Editor's vite 5.4.21 | **No conflict** -- paint's Vite is devDep for its standalone demo, not consumed by editor |
| Paint devDep @preact/preset-vite ^2.10.5 | Editor's ^2.10.3 | Both minor versions; no conflict since they're separate devDeps |

## Installation

```bash
# At monorepo root after scaffold
pnpm install

# Verify workspace linking
ls -la app/node_modules/@efxlab/efx-physic-paint
# Should be symlink -> ../../packages/efx-physic-paint

# Remove replaced packages from app/
cd app && pnpm remove perfect-freehand p5.brush
```

No new packages to install externally. The paint engine has zero runtime dependencies. tsup is already a devDependency of the paint package.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| pnpm workspaces alone | Turborepo / Nx | Overkill for 2-package monorepo; pnpm workspaces handle linking and `--filter` scripts; no build orchestration needed |
| tsup for paint lib | Vite library mode | tsup already configured and working; Vite lib mode needs rollup config; tsup's multi-entry support is cleaner for 3 exports |
| `workspace:*` protocol | `workspace:^` or file path | `workspace:*` always resolves to local; rewrites to exact version on publish; simplest for co-developed packages |
| Rename Application/ to app/ | Keep Application/ | `app/` is conventional, shorter; milestone spec explicitly considers this |
| Single lockfile at root | Per-package lockfiles | pnpm workspaces require single lockfile at root; not optional |
| Direct engine API in editor | EfxPaintCanvas Preact component | Editor needs fine-grained control (custom pointer handling, custom compositing pipeline); the component wrapper may be too opinionated |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Lerna | Deprecated workflow; pnpm workspaces supersede it | pnpm workspaces native |
| Turborepo/Nx | 2-package monorepo does not justify complexity | pnpm `--filter` scripts |
| Changesets (for now) | Only one publishable package at v0.1.0 | Direct `npm version` + `npm publish` |
| Shared tsconfig via `extends` across packages | Different targets (ES2020 vs ES2023), different includes | Keep separate tsconfigs per package |
| p5.brush alongside efx-physic-paint | Redundant; transparency gap was the reason for the new engine | Full replacement; remove p5.brush |
| perfect-freehand alongside engine | Engine handles stroke rendering with richer physics | Full replacement |
| npm/yarn | pnpm is established; workspace protocol differs | pnpm with `workspace:*` |

## Stack Patterns

**For development (hot reload):**
- Terminal 1: `pnpm dev:paint` (tsup --watch rebuilds dist/)
- Terminal 2: `pnpm dev` (Vite HMR in editor picks up paint changes)
- Vite detects linked ESM package changes automatically

**For production build:**
- `pnpm build` runs paint build first, then editor build (sequential via `&&`)
- Paint produces ESM + types in dist/
- Editor's Vite bundles the paint library output into final build

**For publishing paint to npm:**
- `cd packages/efx-physic-paint && pnpm build && npm publish`
- `workspace:*` in editor's package.json auto-rewrites to real version

**For testing paint changes in editor context:**
- Edit paint source -> tsup --watch rebuilds -> Vite HMR updates editor
- No manual linking, no `pnpm install` needed between changes

## Sources

- [pnpm Workspaces documentation](https://pnpm.io/workspaces) -- workspace:* protocol, single lockfile, package linking (HIGH confidence)
- [pnpm Settings (pnpm-workspace.yaml)](https://pnpm.io/settings) -- overrides, linkWorkspacePackages config (HIGH confidence)
- [Vite Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling) -- linked deps auto-detected as source, optimizeDeps.exclude (HIGH confidence)
- Direct inspection of `~/Dev/efx-physic-paint/` source -- API surface, tsup config, types, 3 exports, EfxPaintEngine public methods (HIGH confidence)
- Direct inspection of `Application/package.json` and `vite.config.ts` -- current deps, Vite config, pnpm overrides (HIGH confidence)
- Direct inspection of editor source files importing perfect-freehand/p5.brush -- 6 files identified for modification (HIGH confidence)

---
*Stack research for: pnpm monorepo scaffold + efx-physic-paint integration (v0.7.0)*
*Researched: 2026-04-03*
