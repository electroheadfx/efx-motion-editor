# Phase 34: Standalone Demo Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 34-Standalone Demo Shell
**Areas discussed:** Demo location, Command naming, Import boundary, Shell minimalism

---

## Demo Location

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Where should the demo files live? | Package demo | Put the Vite/Preact app under `packages/efx-physic-paint/demo`. | ✓ |
| Where should the demo files live? | src demo | Put demo entrypoints under `packages/efx-physic-paint/src/demo`. | |
| Where should the demo files live? | Sibling app | Create a separate workspace package for the demo. | |
| Should the package-local demo be kept outside the published library build/output? | Demo-only files | Demo has its own Vite entry/config and is not part of `tsup` outputs or exported package subpaths. | ✓ |
| Should the package-local demo be kept outside the published library build/output? | Shared entries | Allow demo entrypoints to share source/export surfaces with the package. | |
| Should the demo use internals or public API? | Public API only | Keep demo code using `EfxPaintCanvas`/public exports where possible. | ✓ |
| Should the demo use internals or public API? | Internal allowed | Let demo import internals freely. | |
| Should Phase 34 include routing? | Single page | One Vite page focused on launching the standalone canvas. | ✓ |
| Should Phase 34 include routing? | Simple routes | Lightweight routes for future examples/diagnostics. | |

**User's choice:** Package-local single-page demo, demo-only files, public API only.
**Notes:** Demo ownership should be visually and structurally tied to `packages/efx-physic-paint` without leaking into package build outputs.

---

## Command Naming

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What should the root command do? | Repurpose `dev:paint` | Root `pnpm dev:paint` launches the standalone browser demo. | ✓ |
| What should the root command do? | Add `dev:paint-demo` | Keep existing `pnpm dev:paint` as package library watch. | |
| Preserve current tsup watch as root command? | Keep watch command | Move current `tsup --watch` behavior to something like `pnpm dev:paint:watch`. | |
| Preserve current tsup watch as root command? | No root watch command | Standalone demo uses Vite HMR; package build/watch is not needed for Phase 34 demo loop. | ✓ |

**User's choice:** `pnpm dev:paint` should launch the standalone browser paint demo.
**Notes:** User clarified that the app is a Tauri app run with `pnpm tauri dev` from `app/`. Current root `pnpm dev` is only app Vite frontend. Current root `pnpm dev:paint` is `tsup --watch`; user confirmed this is not needed for the standalone demo because HMR is enough.

---

## Import Boundary

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should Vite HMR import the package? | Alias public entry | Demo imports public package entry shape, but Vite aliases it to source for fast HMR. | ✓ |
| How should Vite HMR import the package? | Relative source | Import source files directly with relative paths. | |
| How should Vite HMR import the package? | Built package | Import built dist/package subpaths. | |
| Which public surface should the demo prove first? | Preact wrapper | Mount `EfxPaintCanvas` from the public Preact entry. | ✓ |
| Which public surface should the demo prove first? | Core engine | Instantiate `EfxPaintEngine` directly. | |
| Should the demo avoid editor imports? | No app imports | Demo must not import from `app/` or Tauri/editor runtime. | ✓ |
| Should build verification stay separate? | Separate build | `pnpm dev:paint` starts Vite demo; build/check commands verify package dist/types separately. | ✓ |

**User's choice:** Public Preact entry shape aliased to source for HMR; no app/editor imports; build verification separate.
**Notes:** This balances HMR ergonomics with proof of public API shape.

---

## Shell Minimalism

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How minimal should the UI be? | Canvas + header | Single page with standalone title/header plus mounted paint canvas. | ✓ |
| How minimal should the UI be? | Canvas only | Pure mount smoke test with almost no chrome. | |
| How minimal should the UI be? | Mini toolbar | Add basic tool/color/clear controls now. | |
| What should the header make explicit? | Standalone package | Title/copy says this is standalone `@efxlab/efx-physic-paint`, not editor integration. | ✓ |
| Should there be runtime status text? | Tiny status | Small status line such as Vite demo / public Preact API / no editor runtime. | ✓ |
| Should controls be implemented now? | No new custom controls | Prove standalone launch, HMR, and canvas mount only. | ✓ |
| Should controls be implemented now? | Keep package-provided defaults | Do not strip any default UI already exposed by the wrapper. | ✓ |
| Should controls be implemented now? | Full controls | Implement tool/color/brush controls now. | |
| Should error/empty-state chrome exist? | Basic mount error | Minimal visible error state if canvas fails to mount. | ✓ |
| Should error/empty-state chrome exist? | Diagnostic panel | Visible diagnostic details. | |

**User's choice:** Canvas + header, standalone package messaging, tiny status, basic mount error. No new custom controls in Phase 34, but do not define this as the long-term UI.
**Notes:** User challenged whether a standalone physics paint should have all default UI such as tool/color/brush. Roadmap verification showed Phase 35 owns interactive controls/settings/diagnostics. Phase 34 should mount the real canvas with defaults and not build a toy long-term UI.

---

## Claude's Discretion

None.

## Deferred Ideas

- Full standalone physics paint UI: tool, color, brush size, opacity, physics controls, and diagnostics — Phase 35.
