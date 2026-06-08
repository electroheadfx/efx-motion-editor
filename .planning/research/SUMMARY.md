# Project Research Summary

**Project:** EFX-Motion Editor v0.8.0 — Standalone Physics Paint
**Domain:** Standalone runnable/testable physics paint app around `packages/efx-physic-paint`
**Researched:** 2026-06-08
**Confidence:** HIGH

## Executive Summary

The v0.8.0 milestone should make `packages/efx-physic-paint` runnable and testable as a standalone interactive physics paint app/window before any EFX Motion Editor integration. This is a deliberate correction after the failed Phases 27-32 adapter attempt: the physics engine must preserve live incremental simulation behavior, not be driven through editor-owned headless batch replay.

The recommended approach is to keep `@efxlab/efx-physic-paint` as a publishable library built by `tsup`, and add a package-local Vite + Preact standalone demo surface inside the same package. Root `pnpm dev:paint` should run the interactive demo, while library watch/build remains available separately. The standalone app should expose real engine controls, diagnostics, save/load, and output export hooks so the user can visually validate the original package before the editor consumes any result.

Future editor integration should treat the standalone paint app as a producer of rendered outputs and session metadata. The editor should eventually consume cached still frames or frame sequences through a typed transport/cache manifest, not replay physics strokes in-process and not call a batch adapter from the main compositor.

## Key Findings

### Recommended Stack

Use the existing monorepo stack and add only lightweight demo/test tooling:

- **Vite 5 + Preact** inside `packages/efx-physic-paint` for the standalone browser demo.
- **tsup** remains responsible for publishable library builds.
- **pnpm workspace scripts** should make the demo easy to run from the repo root.
- **Playwright** is recommended for browser-level canvas/export testing because the engine depends on real browser APIs.
- **Vitest** is useful only for pure utility/serialization tests, not as the main confidence path for canvas physics behavior.

Do not add Tauri/Electron for this milestone, do not create a heavy new app shell, and do not revive `renderFromStrokes()`/`forceDryAll()` as an editor-driven batch integration path.

### Expected Features

Table-stakes for this milestone:

- A working `pnpm dev:paint` or equivalent command that opens a standalone physics paint demo.
- A live canvas using `EfxPaintEngine`/`EfxPaintCanvas` from the local package source.
- Basic paint controls: brush/tool, size, opacity/color, water/dry/physics controls where supported by current APIs.
- Diagnostics showing engine readiness, canvas size, active tool/settings, stroke/session state, and errors.
- Save/load JSON for the standalone session using the package's real persistence APIs.
- Export/inspection of rendered output: at minimum PNG still export, with a small proof for frame-sequence/cache-manifest output if feasible.
- README/package script updates that accurately document how to run and test the standalone paint package.

Differentiators if scope allows:

- Replay/animation proof using `AnimationPlayer` or equivalent live-engine frame capture.
- Debug hooks such as `window.__efxPaintDemo` for manual inspection.
- Transport-contract types for future editor integration without implementing the editor side.

Anti-features for this milestone:

- No EFX Motion Editor paint-layer integration yet.
- No `.mce` format migration yet.
- No Tauri child-window IPC yet.
- No headless adapter or batch physics replay.
- No removal of p5.brush/perfect-freehand from the editor.

### Architecture Approach

The package should be structured as both a library and a package-local standalone demo:

- Existing library source remains under `packages/efx-physic-paint/src/`.
- Add demo entry files such as `demo/main.tsx`, `demo/App.tsx`, `index.html`, and `vite.config.ts` in the package.
- Add package/root scripts so the user can run the demo from the repo root.
- Demo UI imports from local package source or public exports, proving the package is actually consumable.
- Add small export/session helpers only where they expose live engine state; do not implement a synthetic batch renderer.

Future editor seam:

- **Session JSON**: enough state to reopen/edit a standalone physics paint session.
- **Rendered output**: still PNG/canvas and frame-sequence outputs produced by the live engine.
- **Cache manifest**: typed metadata describing layer/session id, frame range, dimensions, output paths/blob URLs, and invalidation keys.
- **Transport messages**: type-only contract now; runtime Tauri/window IPC later.

### Critical Pitfalls

1. **Repeating the failed adapter architecture** — batch replay destroys physics quality and creates O(n²) work. Prevent by making all export/cache output come from the live standalone engine session.
2. **README/script drift** — the current README claims a demo command that does not exist. Prevent by making scripts and docs part of the milestone gate.
3. **Testing only TypeScript build** — a library build does not prove canvas/pointer/export behavior. Prevent with a browser smoke test and manual run recipe.
4. **Scope creep into editor integration** — the milestone should prove the standalone package first. Editor layer integration belongs to the next milestone/phase after standalone validation.
5. **Public API pollution** — avoid exposing large unstable internals. Prefer small session/export/manifest helpers and demo-only debug hooks.
6. **Canvas/export browser quirks** — validate in a real browser with Playwright/manual testing rather than relying on jsdom-like environments.

## Implications for Roadmap

Recommended build order:

1. **Standalone demo shell and scripts** — package-local Vite/Preact app, root command, README correction.
2. **Interactive engine controls** — live canvas, brush/tool controls, diagnostics, error visibility.
3. **Session persistence and inspection** — save/load JSON, stroke/session viewer, debug hooks.
4. **Rendered output export/cache proof** — PNG still export, frame-sequence or manifest proof from live engine state.
5. **Transport contract and validation** — type-only future message/cache manifest contract plus browser smoke/manual test recipe.
6. **Package hygiene** — build/check/test docs verified and no editor integration attempted prematurely.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Current workspace/package scripts and package source were inspected; Vite + Preact matches existing repo stack. |
| Features | HIGH | User's success criterion is concrete: run and test standalone physics paint before editor integration. |
| Architecture | HIGH | Prior retrospective clearly rejects headless adapter; standalone window + rendered output transport is the recorded direction. |
| Pitfalls | HIGH | Main risks come directly from the failed v0.7 adapter attempt and current README/script mismatch. |

**Overall confidence:** HIGH

### Gaps to Address During Planning

- Decide exact demo file placement inside the package.
- Decide whether root `dev:paint` replaces the current tsup watch behavior or whether watch moves to `dev:paint:watch`.
- Decide minimum export format for frame-sequence proof: multiple PNG downloads, in-memory blobs, or a manifest-only proof.
- Decide how much of the future transport/cache contract is type-only in this milestone.

---
*Research completed: 2026-06-08*
*Ready for roadmap: yes*
