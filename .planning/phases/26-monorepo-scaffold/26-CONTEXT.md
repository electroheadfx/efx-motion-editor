# Phase 26: Monorepo Scaffold - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the repository into a pnpm workspace monorepo with `app/` (renamed from `Application/`) and `packages/efx-physic-paint/` (copied from standalone repo). Developer can work on editor and paint engine in a single workspace with shared tooling. No engine integration or API changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Directory rename
- **D-01:** `Application/` renamed to `app/` via isolated `git mv` commit before any other monorepo changes
- **D-02:** The rename commit must be standalone so `git log --follow app/src/stores/paintStore.ts` preserves full history (MONO-05)

### Paint library .planning/ archive
- **D-03:** Archive `efx-physic-paint/.planning/milestones/` into `.planning/milestones/paint-v1.0-phases/` as reference material
- **D-04:** Delete `packages/efx-physic-paint/.planning/` after archiving (also remove `.claude/`, `CLAUDE.md` — keep `src/`, `package.json`, `tsup.config.ts`, `tsconfig.json`, `tsconfig.build.json`, `README.md`, `LICENSE`)

### Workspace script design
- **D-05:** Root `package.json` uses minimal pnpm filter scripts: `dev` (filter editor), `build` (filter paint then editor), `dev:paint` (filter paint watch). No Turborepo or nx.
- **D-06:** pnpm overrides moved from `app/package.json` to workspace root `package.json` (MONO-06)

### Workspace config
- **D-07:** `pnpm-workspace.yaml` lists `"app"` and `"packages/*"` — glob for extensibility
- **D-08:** Root `package.json` inherits exact `packageManager` field with sha hash from current `Application/package.json` (`pnpm@10.27.0+sha512...`)

### Claude's Discretion
- Vite `optimizeDeps.exclude` configuration for the paint workspace package
- `.gitignore` updates for the new monorepo structure
- Root `tsconfig.json` or project references setup if needed
- Exact cleanup of paint package files beyond the listed keepers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Monorepo spec
- `SPECS/milestone-v0.7.0-plan.md` — Complete step-by-step monorepo setup plan with target state diagram, daily workflow, and verification checklist

### Requirements
- `.planning/REQUIREMENTS.md` §Monorepo Infrastructure — MONO-01 through MONO-06 acceptance criteria

### Current editor config
- `Application/package.json` — Current dependencies, scripts, pnpm overrides, and packageManager field to migrate
- `Application/vite.config.ts` — Vite config requiring `optimizeDeps.exclude` update for workspace paint package

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Application/package.json` contains pnpm overrides for `@efxlab/motion-canvas-core`, `preact`, and `@preact/signals` — must migrate to root
- `Application/pnpm-lock.yaml` exists and must move to workspace root

### Established Patterns
- Project uses pnpm (not npm) with exact `packageManager` field and corepack
- `@efxlab/*` scoped packages already in use (motion-canvas-2d/core/player/ui/vite-plugin) — paint package follows same scope
- Tauri app lives inside the editor directory (`Application/src-tauri/`)

### Integration Points
- Root `package.json` is a new file (currently empty `package-lock.json` at root from npm — will be replaced)
- `packages/efx-physic-paint/` source comes from `~/Dev/efx-physic-paint` (copy, not move)
- `app/package.json` will add `"@efxlab/efx-physic-paint": "workspace:*"` dependency (MONO-04)
- Paint package builds with `tsup` and has its own `tsconfig.build.json`

</code_context>

<specifics>
## Specific Ideas

- Follow TanStack monorepo pattern for workspace structure
- Paint library remains independently publishable to npm — `workspace:*` gets rewritten to real version during `npm publish`
- Don't touch the standalone `~/Dev/efx-physic-paint` repo — just copy source. User will suppress it later.
- Root `node_modules/` and stale `package-lock.json` at root should be cleaned up during setup

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-monorepo-scaffold*
*Context gathered: 2026-04-03*
