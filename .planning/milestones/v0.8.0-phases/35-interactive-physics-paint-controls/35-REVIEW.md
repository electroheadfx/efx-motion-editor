---
phase: 35-interactive-physics-paint-controls
status: issues_found
depth: standard
files_reviewed: 29
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
created: 2026-06-09
---

# Code Review: Phase 35 — Interactive Physics Paint Controls

## Scope

Reviewed source files listed from Phase 35 SUMMARY artifacts, with emphasis on the gap-closure changes around Tauri native windowing, event transport, editable state save, source identity persistence, and physics paint demo/app UI.

## Findings

### WR-35-01: Native physics paint window command is available to all capability windows

- **Severity:** Warning
- **File:** `app/src-tauri/src/lib.rs`
- **Related config:** `app/src-tauri/capabilities/default.json`
- **Issue:** `open_physics_paint_window` accepts arbitrary `PhysicsPaintLaunchContext` and is exposed through the shared `main-capability`, whose `windows` now include both `main` and `efx-physic-paint`. That lets any webview covered by this capability invoke the command and refocus/relaunch the physics paint window with attacker-controlled layer/operation context if that webview is compromised or if future code accidentally calls it from the standalone window.
- **Risk:** This is not direct filesystem or code execution, but it broadens the trust boundary for a command that should logically be main-editor initiated only. It can cause spoofed launch contexts, confusing apply diagnostics, or nuisance window focus loops.
- **Recommendation:** Split capabilities or add a Rust-side caller/window label guard so only the `main` window can invoke `open_physics_paint_window`. Keep the physics paint window permissions scoped to the event/dialog/fs operations it needs.

## Positive Checks

- `PhysicPaintApplyPayload` validation still rejects editable engine internals before mutating rendered output state.
- Native and browser apply-result handling match by `operationId` before clearing apply status.
- Save state writes only serialized editable physics paint state JSON and preserves separation from rendered apply-back.
- The package demo avoids static app-only Tauri plugin dependencies by lazy-loading them only in a Tauri runtime.

## Verification Context

Latest validation observed during execution:

- `pnpm --dir app test --run src/lib/physicPaintBridge.test.ts` — passed.
- `pnpm --dir app typecheck` — passed.
- `pnpm --filter @efxlab/efx-physic-paint check` — passed.
- `pnpm --filter @efxlab/efx-physic-paint demo:build` — passed.
