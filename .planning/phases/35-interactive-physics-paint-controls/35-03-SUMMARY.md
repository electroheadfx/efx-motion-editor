---
phase: 35-interactive-physics-paint-controls
plan: 03
subsystem: packages/efx-physic-paint/demo
tags: [standalone, physics-paint, diagnostics, apply-transport]
dependency_graph:
  requires: [35-01]
  provides: [standalone-readiness-diagnostics, rendered-apply-actions, state-file-toolbar-copy]
  affects: [packages/efx-physic-paint/demo]
tech_stack:
  added: []
  patterns: [Preact hooks, local engine ownership, Tauri dynamic event fallback, browser CustomEvent fallback]
key_files:
  created:
    - .planning/phases/35-interactive-physics-paint-controls/35-03-SUMMARY.md
  modified:
    - packages/efx-physic-paint/demo/src/App.tsx
    - packages/efx-physic-paint/demo/src/Toolbar.tsx
    - packages/efx-physic-paint/demo/src/styles.css
decisions:
  - Standalone apply-back sends rendered canvas PNG data only; editable engine state remains limited to Save state / Load state.
  - Browser fallback remains available for local same-window/opener testing when Tauri event APIs are unavailable.
metrics:
  duration: TBD
  completed_date: 2026-06-08
---

# Phase 35 Plan 03: Interactive Standalone Controls Summary

## One-liner

Standalone physics paint now exposes readiness diagnostics, full visible engine controls, state-file copy, and rendered-output apply actions for still and generated frame sequences.

## What Changed

- Added launch-context parsing from URL search/hash with validated `layerId`, `operationId`, and `startFrame` before reporting `Ready to apply`.
- Added a non-modal diagnostics/apply strip showing ready/not-ready status, missing conditions, layer/frame context, engine/canvas state, active tool/settings, physics mode, bridge transport mode, and last error.
- Added `[apply canvas]`, `[apply play canvas]`, and `Frames to apply` controls with a 1..600 clamp and default 120 frames.
- Implemented rendered-output-only `physic-paint:apply` payload emission through dynamic Tauri events when available and browser `CustomEvent` fallback for dev/opener testing.
- Added `physic-paint:apply-result` feedback handling with operation matching and visible success/error copy.
- Preserved the broad toolbar surface and renamed file persistence actions to `Save state` / `Load state` with the required invalid-state-file error copy.
- Styled diagnostics, apply controls, ready/warning/error states, disabled buttons, and focus rings using compact dark-panel spacing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add standalone readiness diagnostics and app launch context display | e4d721a | `packages/efx-physic-paint/demo/src/App.tsx`, `packages/efx-physic-paint/demo/src/styles.css` |
| 2 | Preserve full toolbar controls and emit rendered-output apply actions | e4d721a | `packages/efx-physic-paint/demo/src/App.tsx`, `packages/efx-physic-paint/demo/src/Toolbar.tsx`, `packages/efx-physic-paint/demo/src/styles.css` |

## Verification

- `pnpm --filter @efxlab/efx-physic-paint check` passed.
- `pnpm --filter @efxlab/efx-physic-paint demo:build` passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed locked workspace dependencies before verification**
- **Found during:** Task verification
- **Issue:** The worktree had no `node_modules`, causing TypeScript to fail resolving existing `preact` dependencies.
- **Fix:** Ran `pnpm install --frozen-lockfile` using the existing lockfile. No package names or versions were changed.
- **Files modified:** None
- **Commit:** e4d721a

## Known Stubs

None found. The disabled-control helper copy exists in the stylesheet contract area, but no newly introduced disconnected visible control is shipped as a stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local-event-transport | `packages/efx-physic-paint/demo/src/App.tsx` | The standalone now emits rendered PNG apply payloads through Tauri/browser local events. This surface is covered by plan threats T-35-08 and T-35-18 with frame-count clamping, apply-button disabling, visible errors, and rendered-output-only payloads. |

## Self-Check: PASSED

- Found `packages/efx-physic-paint/demo/src/App.tsx`.
- Found `packages/efx-physic-paint/demo/src/Toolbar.tsx`.
- Found `packages/efx-physic-paint/demo/src/styles.css`.
- Found task commit `e4d721a`.
