# Phase 26: Monorepo Scaffold - Research

**Researched:** 2026-04-03
**Domain:** pnpm workspace monorepo setup, directory rename with git history, Tauri build integration
**Confidence:** HIGH

## Summary

Phase 26 converts the existing single-package repository into a pnpm workspace monorepo. The core operations are: (1) rename `Application/` to `app/` via isolated `git mv` for history preservation, (2) create workspace root config, (3) copy `efx-physic-paint` source into `packages/`, (4) wire workspace dependency resolution and Vite configuration. All decisions are locked in CONTEXT.md -- no technology choices remain open.

The critical technical risks are: `git mv` must be an isolated commit to preserve `--follow` history (MONO-05), the lockfile must be regenerated at the workspace root after the directory rename, and the Tauri build commands in `tauri.conf.json` resolve relative to `src-tauri/` parent directory so they remain correct after rename. pnpm v10 (10.28.0 installed) supports `overrides` in both root `package.json` and `pnpm-workspace.yaml`, but the `package.json` approach is more reliable due to known lockfile issues with workspace-yaml overrides.

**Primary recommendation:** Execute the rename as the very first commit, then build the workspace config on top. Keep `pnpm.overrides` in root `package.json` (not `pnpm-workspace.yaml`) for reliability.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `Application/` renamed to `app/` via isolated `git mv` commit before any other monorepo changes
- **D-02:** The rename commit must be standalone so `git log --follow app/src/stores/paintStore.ts` preserves full history (MONO-05)
- **D-03:** Archive `efx-physic-paint/.planning/milestones/` into `.planning/milestones/paint-v1.0-phases/` as reference material
- **D-04:** Delete `packages/efx-physic-paint/.planning/` after archiving (also remove `.claude/`, `CLAUDE.md` -- keep `src/`, `package.json`, `tsup.config.ts`, `tsconfig.json`, `tsconfig.build.json`, `README.md`, `LICENSE`)
- **D-05:** Root `package.json` uses minimal pnpm filter scripts: `dev` (filter editor), `build` (filter paint then editor), `dev:paint` (filter paint watch). No Turborepo or nx.
- **D-06:** pnpm overrides moved from `app/package.json` to workspace root `package.json` (MONO-06)
- **D-07:** `pnpm-workspace.yaml` lists `"app"` and `"packages/*"` -- glob for extensibility
- **D-08:** Root `package.json` inherits exact `packageManager` field with sha hash from current `Application/package.json` (`pnpm@10.27.0+sha512...`)

### Claude's Discretion
- Vite `optimizeDeps.exclude` configuration for the paint workspace package
- `.gitignore` updates for the new monorepo structure
- Root `tsconfig.json` or project references setup if needed
- Exact cleanup of paint package files beyond the listed keepers

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONO-01 | Repository uses pnpm workspace with root `package.json`, `pnpm-workspace.yaml`, and single lockfile at root | Workspace config patterns verified via pnpm.io docs; root package.json structure documented below |
| MONO-02 | `Application/` renamed to `app/` with git history preserved via isolated `git mv` commit | `git mv` behavior researched; isolated commit is the proven approach for `--follow` tracking |
| MONO-03 | `efx-physic-paint` source copied into `packages/efx-physic-paint/` as publishable workspace package | Paint package structure audited; keepers list and cleanup documented |
| MONO-04 | `@efxlab/efx-physic-paint` resolves via `workspace:*` in `app/package.json` | pnpm `workspace:*` protocol confirmed; symlink verification pattern documented |
| MONO-05 | `pnpm dev` starts editor identically to v0.6.0; `pnpm tauri build` produces working `.app` | Tauri `beforeDevCommand` resolves relative to `src-tauri/` parent -- no config change needed after rename |
| MONO-06 | pnpm overrides moved to workspace root; Vite `optimizeDeps.exclude` configured for paint package | Overrides go in root `package.json` `pnpm.overrides`; Vite exclude pattern documented |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| pnpm | 10.27.0 (declared) / 10.28.0 (installed) | Package manager + workspace | Already in use; `packageManager` field enforces version |
| pnpm workspaces | (built-in) | Monorepo package linking | Native pnpm feature, no additional tooling needed |
| tsup | 8.5.1+ | Paint package bundler | Already configured in paint package |
| Vite | 5.4.21 | Editor dev server + build | Already in use |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| git mv | (built-in) | Directory rename with history | First commit only |
| corepack | (built-in) | pnpm version enforcement | Already active via `packageManager` field |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pnpm workspaces alone | Turborepo / nx | REJECTED by D-05 -- overkill for 2-package monorepo |
| `workspace:*` | `file:` protocol | `workspace:*` is standard for pnpm; auto-rewrites to real version on npm publish |

## Architecture Patterns

### Target Project Structure
```
efx-motion-editor/
  ├── .planning/                  # Single GSD for everything
  │   └── milestones/
  │       └── paint-v1.0-phases/  # Archived from paint repo (D-03)
  ├── package.json                # Root workspace (private, scripts, overrides)
  ├── pnpm-workspace.yaml         # packages: ["app", "packages/*"]
  ├── pnpm-lock.yaml              # Single lockfile at root
  ├── .gitignore                  # Updated for monorepo paths
  ├── app/                        # Renamed from Application/ (D-01)
  │   ├── package.json            # depends on "@efxlab/efx-physic-paint": "workspace:*"
  │   ├── vite.config.ts          # optimizeDeps.exclude updated
  │   ├── tsconfig.json
  │   ├── src/
  │   └── src-tauri/
  │       └── tauri.conf.json     # No changes needed -- commands relative to parent
  └── packages/
      └── efx-physic-paint/
          ├── package.json        # Publishable (@efxlab/efx-physic-paint)
          ├── tsup.config.ts      # ESM build, 3 entry points
          ├── tsconfig.json
          ├── tsconfig.build.json
          ├── README.md
          ├── LICENSE
          └── src/
```

### Pattern 1: Isolated Rename Commit (D-01, D-02)
**What:** `git mv Application app` as a standalone commit with NO other changes
**When to use:** Always when renaming directories where `--follow` history matters
**Why:** Git's rename detection works on a per-commit basis. If a commit both renames a directory AND modifies files inside it, `git log --follow` may fail to detect the rename because the similarity index drops below the threshold (default 50%). An isolated rename commit has 100% similarity.
```bash
git mv Application app
git commit -m "refactor: rename Application/ to app/"
# Verify:
git log --follow app/src/stores/paintStore.ts  # Should show full history
```

### Pattern 2: Root Workspace Package.json
**What:** Minimal root package.json that delegates to workspace packages
```json
{
  "private": true,
  "packageManager": "pnpm@10.27.0+sha512.72d699da16b1179c14ba9e64dc71c9a40988cbdc65c264cb0e489db7de917f20dcf4d64d8723625f2969ba52d4b7e2a1170682d9ac2a5dcaeaab732b7e16f04a",
  "scripts": {
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch"
  },
  "pnpm": {
    "overrides": {
      "@efxlab/motion-canvas-core": "4.0.0",
      "preact": "^10.28.4",
      "@preact/signals": "^2.8.1"
    },
    "onlyBuiltDependencies": [
      "esbuild"
    ]
  }
}
```

### Pattern 3: Workspace Dependency
**What:** `workspace:*` protocol for local package linking
```json
// In app/package.json dependencies:
"@efxlab/efx-physic-paint": "workspace:*"
```
When published, pnpm auto-rewrites `workspace:*` to the actual version from the package's `package.json`.

### Anti-Patterns to Avoid
- **Modifying files in the same commit as `git mv`:** Breaks `--follow` rename detection
- **Putting overrides in `pnpm-workspace.yaml`:** Known pnpm v10 issue where overrides in workspace yaml are not reflected in lockfile (GitHub issue #10614)
- **Running `pnpm install` before moving lockfile to root:** Will create a new lockfile; move the lockfile first, then install
- **Keeping paint package's `vite.config.ts`:** It's for the standalone demo app, not needed in monorepo context -- remove it
- **Forgetting `onlyBuiltDependencies`:** pnpm v10 requires explicit allowlist for install scripts; paint package needs `esbuild` in this list

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package linking | Symlinks or `file:` protocol | `workspace:*` | pnpm handles symlinks, hoisting, and npm publish rewriting |
| Build orchestration | Custom scripts chaining builds | `pnpm --filter` | Built-in topological ordering and caching |
| Version pinning across packages | Manual version alignment | `pnpm.overrides` in root package.json | Single source of truth for resolved versions |

## Common Pitfalls

### Pitfall 1: Lockfile Location After Rename
**What goes wrong:** After `git mv Application app`, the lockfile at `Application/pnpm-lock.yaml` no longer exists at the expected path. Running `pnpm install` at root with the workspace config will generate a fresh lockfile, potentially changing resolved versions.
**Why it happens:** pnpm workspace expects `pnpm-lock.yaml` at the workspace root, not inside a package.
**How to avoid:** Move the lockfile to root (`git mv Application/pnpm-lock.yaml pnpm-lock.yaml`) BEFORE running `pnpm install`. The lockfile will need updating anyway (new workspace packages), but starting from the existing one preserves version pins.
**Warning signs:** `pnpm install` resolving many new versions or taking unusually long.

### Pitfall 2: Tauri Build Path Resolution
**What goes wrong:** Assumption that `tauri.conf.json` `beforeDevCommand` / `beforeBuildCommand` need updating.
**Why it happens:** It's tempting to think renaming `Application/` breaks Tauri builds.
**How to avoid:** These commands resolve relative to `src-tauri/`'s parent directory. Since `src-tauri/` stays inside `app/`, `pnpm dev` and `pnpm build` still resolve to `app/package.json` scripts. No tauri.conf.json changes needed.
**Warning signs:** Editing `tauri.conf.json` unnecessarily.

### Pitfall 3: Vite Pre-bundling of Workspace Package
**What goes wrong:** Vite tries to pre-bundle `@efxlab/efx-physic-paint` through esbuild, breaking the live development experience (changes in paint package don't trigger HMR).
**Why it happens:** Vite pre-bundles all dependencies by default. Workspace packages need to be excluded so Vite treats them as source code.
**How to avoid:** Add `@efxlab/efx-physic-paint` to `optimizeDeps.exclude` in `app/vite.config.ts`. The existing `p5.brush` exclude can stay for now (it's still a dependency until PERS-03 in Phase 32).
**Warning signs:** Changes to paint package source not reflecting in dev server without restart.

### Pitfall 4: Paint Package `onlyBuiltDependencies`
**What goes wrong:** `pnpm install` fails or warns about blocked install scripts for `esbuild`.
**Why it happens:** pnpm v10 blocks install scripts by default. The paint package's `package.json` has `pnpm.onlyBuiltDependencies: ["esbuild"]`, but in a workspace this needs to be at the root level.
**How to avoid:** Include `"esbuild"` in root `package.json` `pnpm.onlyBuiltDependencies`. The editor's `Application/package.json` currently doesn't have this field, but esbuild is a transitive dependency of both vite and tsup.
**Warning signs:** pnpm warnings about blocked scripts during install.

### Pitfall 5: Root `node_modules/` and `package-lock.json` Stale Files
**What goes wrong:** Stale root `node_modules/` (from a previous npm install) and `package-lock.json` interfere with pnpm workspace resolution.
**Why it happens:** Current repo root has `node_modules/` and a near-empty `package-lock.json` from npm.
**How to avoid:** Delete `rm -rf node_modules package-lock.json` at root before setting up the workspace.
**Warning signs:** Module resolution errors or unexpected node_modules structure.

### Pitfall 6: `.gitignore` Not Updated for Monorepo Paths
**What goes wrong:** Build artifacts or node_modules from new locations not ignored.
**Why it happens:** Current `.gitignore` references `Application/dist/` and `Application/src-tauri/` paths.
**How to avoid:** Update `.gitignore` to use `app/` paths and add `packages/*/dist/` and `packages/*/node_modules/`.
**Warning signs:** `git status` showing untracked dist files or node_modules.

### Pitfall 7: Paint Package Has Demo Files
**What goes wrong:** Including unnecessary files from the paint repo (demo vite config, index.html, public/ folder, .research/).
**Why it happens:** The standalone paint repo has a demo app setup with its own `vite.config.ts`, `index.html`, and `public/` directory.
**How to avoid:** D-04 lists the keepers: `src/`, `package.json`, `tsup.config.ts`, `tsconfig.json`, `tsconfig.build.json`, `README.md`, `LICENSE`. Remove everything else, including: `.planning/`, `.claude/`, `.collaborator/`, `.research/`, `.gitignore`, `CLAUDE.md`, `vite.config.ts`, `index.html`, `public/`, `dist/`, `node_modules/`.
**Warning signs:** Extra build configs or demo pages in the paint package.

## Code Examples

### pnpm-workspace.yaml
```yaml
# Source: pnpm.io/workspaces
packages:
  - "app"
  - "packages/*"
```

### Vite optimizeDeps.exclude Update
```typescript
// In app/vite.config.ts -- add paint package to existing exclude
optimizeDeps: {
  exclude: ['p5.brush', '@efxlab/efx-physic-paint'],
},
```
Note: The existing `fix-preact-optimize-conflict` plugin that removes preact entries from exclude will continue to work correctly -- it only targets preact-related entries.

### Paint Package dev:watch Script
```json
// In packages/efx-physic-paint/package.json scripts, add:
"dev:watch": "tsup --watch"
```
The paint package already has `"build": "tsup"` and `"dev": "vite"` (demo). The `dev:watch` script is what the root workspace `dev:paint` filter targets.

### Updated .gitignore
```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.*

# Caches
.cache/
*.tsbuildinfo

# Build output
app/dist/
packages/*/dist/

# Tauri
app/src-tauri/target/
app/src-tauri/gen/

# OS
.DS_Store

# Editor
*.swp
*.swo

.opencode
.Mockup
SPECS
.claude/pnpm-lock.yaml
.collaborator
```

### Verification Commands
```bash
# After full setup, verify all success criteria:

# 1. Workspace resolution
pnpm install --frozen-lockfile  # Must pass from clean clone

# 2. Symlink verification
ls -la app/node_modules/@efxlab/efx-physic-paint  # Should be symlink

# 3. Dev server
pnpm dev  # Must start editor identically to v0.6.0

# 4. Tauri build
pnpm tauri build  # Must produce working .app (run from app/ or root)

# 5. Import compilation
# Add to any editor .ts file:
# import { EfxPaintEngine } from '@efxlab/efx-physic-paint'
# Should compile without errors

# 6. Git history
git log --follow app/src/stores/paintStore.ts  # Must show pre-rename history
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pnpm.overrides` in package.json only | Also supported in `pnpm-workspace.yaml` (pnpm v10) | Jan 2025 | Has known bugs (#10614) -- use package.json for reliability |
| `pnpm-workspace.yaml` packages only | Settings also in `pnpm-workspace.yaml` (pnpm v10) | Jan 2025 | `onlyBuiltDependencies` can go in workspace yaml, but root package.json is safer |
| npm/yarn workspaces | pnpm workspaces | Stable since pnpm v7 | Already in use via pnpm |

## Open Questions

1. **Paint package `src/demo/` directory**
   - What we know: The paint package has a `src/demo/` directory (excluded in tsconfig.build.json), likely containing the standalone demo app components
   - What's unclear: Whether any demo code should be kept for development testing within the monorepo
   - Recommendation: Remove `src/demo/` since the standalone demo is out of scope. The editor IS the demo now. If needed later, it can be restored from the standalone repo's git history.

2. **TypeScript project references**
   - What we know: Both packages have independent `tsconfig.json` files. Editor uses `moduleResolution: "bundler"`, paint uses `moduleResolution: "bundler"` with `target: "ES2023"`.
   - What's unclear: Whether a root `tsconfig.json` with project references would improve IDE experience
   - Recommendation: Skip root tsconfig for now -- both packages resolve independently and Vite handles the bundling. Can add later if IDE issues arise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | Workspace setup | Yes | 10.28.0 | -- |
| Node.js | Runtime | Yes | v22.22.1 | -- |
| git | Directory rename + history | Yes | (system) | -- |
| corepack | pnpm version enforcement | Yes | (bundled with Node 22) | -- |
| tsup | Paint package build | Yes (dev dep) | 8.5.1+ | -- |

**Missing dependencies:** None. All tools available.

## Sources

### Primary (HIGH confidence)
- pnpm.io/workspaces -- workspace configuration format
- pnpm.io/settings -- pnpm v10 settings in pnpm-workspace.yaml
- v2.tauri.app/reference/config/ -- Tauri beforeDevCommand/beforeBuildCommand path resolution
- Direct audit of `Application/package.json`, `Application/vite.config.ts`, `Application/src-tauri/tauri.conf.json`
- Direct audit of `~/Dev/efx-physic-paint/package.json`, `tsup.config.ts`, `tsconfig.json`

### Secondary (MEDIUM confidence)
- GitHub pnpm/pnpm#10614 -- overrides in pnpm-workspace.yaml lockfile issue
- pnpm.io/pnpm-workspace_yaml -- workspace yaml format (partial docs)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in use, no new dependencies
- Architecture: HIGH -- well-established pnpm workspace pattern with 2 packages
- Pitfalls: HIGH -- verified against actual project config files and known pnpm v10 issues

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable tooling, unlikely to change)
