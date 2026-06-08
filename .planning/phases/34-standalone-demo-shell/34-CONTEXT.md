# Phase 34: Standalone Demo Shell - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 34 delivers a package-local, repo-root-launchable standalone browser demo shell for `packages/efx-physic-paint`. It proves that the physics paint package can run independently from the EFX Motion Editor/Tauri runtime, with Vite/Preact HMR and documentation that matches the actual scripts. It does not implement the full interactive controls/diagnostics surface; those are Phase 35 unless already exposed by the package wrapper defaults.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and phase scope
- `.planning/ROADMAP.md` — Phase 34 goal/success criteria and Phase 35 boundary. Phase 35 owns interactive paint controls/settings/diagnostics.
- `.planning/REQUIREMENTS.md` — RUN-01/RUN-02/RUN-03 define runnable standalone demo requirements; PAINT/DIAG requirements clarify what is deferred to Phase 35.

### Script/package boundaries
- `package.json` — root script behavior; `pnpm dev:paint` must be changed to launch the standalone browser demo.
- `app/package.json` — app workflow context; `dev` is Vite frontend and `tauri` is the desktop-app command surface.
- `packages/efx-physic-paint/package.json` — package scripts/build/export/files boundaries; demo must stay separate from package library outputs.
- `pnpm-workspace.yaml` — workspace includes `app` and `packages/*`; use this to wire root/package scripts cleanly.

### Physics paint public surface
- `packages/efx-physic-paint/src/preact.tsx` — public Preact wrapper surface to mount first.
- `packages/efx-physic-paint/src/index.ts` — main public package exports.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — engine API backing the wrapper; use for understanding defaults and future Phase 35 controls, not as the primary Phase 34 demo surface.
- `packages/efx-physic-paint/tsup.config.ts` — library build path that must remain separate from the demo Vite path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/efx-physic-paint/src/preact.tsx`: exposes `EfxPaintCanvas`, the public Preact wrapper Phase 34 should mount.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`: existing engine API includes setters such as tool/color/brush and lifecycle methods, but Phase 34 should not build new control UI around them.
- `packages/efx-physic-paint/package.json`: package already has `build`, `dev:watch`, and `check` scripts; planning should avoid conflating these with demo launch.

### Established Patterns
- Root scripts use pnpm filters (`pnpm --filter ...`). Phase 34 should preserve that style for repo-root `pnpm dev:paint`.
- The app is a Tauri app, but root `pnpm dev` currently runs the app's Vite dev server, not the full desktop runtime. The standalone paint demo should be a separate browser workflow.
- The physics paint package exports subpaths for main, Preact, and animation builds. The demo should keep public import shape while using Vite aliasing for HMR.

### Integration Points
- Root `package.json` script `dev:paint` is the user-facing entrypoint to update.
- Package-local demo files should be created under `packages/efx-physic-paint/demo`.
- Package README instructions must document both root and package-local usage accurately.

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants the standalone browser physics paint demo to run with `pnpm dev:paint` from repo root.
- User clarified that `pnpm tauri dev` is the real desktop-app workflow, while the standalone paint demo is browser-based and should not be confused with the Tauri app.
- User expects standalone physics paint to ultimately have its full default UI (tool/color/brush/etc.). Phase 34 must not accidentally define a toy long-term UI; it only defers custom controls to Phase 35 unless defaults already exist in the package wrapper.

</specifics>

<deferred>
## Deferred Ideas

- Full standalone physics paint controls — tool, color, brush size, opacity, physics controls, and diagnostics — belong to Phase 35: Interactive Physics Paint Controls.

</deferred>

---

*Phase: 34-Standalone Demo Shell*
*Context gathered: 2026-06-08*
