---
status: resolved
updated: 2026-06-20T10:45:00Z
resolved_by: 36.4-02
---

# Debug: Physics Paint clean close window destroy permission

## Symptom

Phase 36.4 UAT Test 1 failed: clean Physics Paint Roto close rejects with `window.destroy not allowed` and requires `core:window:allow-destroy`.

## Root Cause

`PhysicsPaintStudio` closes the current Tauri window via `getCurrentWindow().close()`, but the app capability for the `efx-physic-paint` window does not grant Tauri's destroy command permission. Tauri's close path invokes the window destroy command, so the runtime blocks the close before the clean-close flow can finish.

## Evidence

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1163` defines `closePhysicsPaintWindow`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1165` imports `@tauri-apps/api/window`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1168` awaits `appWindow.close()`.
- `app/src-tauri/capabilities/default.json:5` includes the `efx-physic-paint` window in `main-capability`.
- `app/src-tauri/capabilities/default.json:8` grants `core:window:default`, but the permissions list does not include `core:window:allow-destroy`.

## Resolution

Phase 36.4-02 added `core:window:allow-destroy` and `core:window:allow-close` to `app/src-tauri/capabilities/default.json`, with regression coverage in `PhysicsPaintStudio.test.ts`. Live Phase 36.4 UAT passed all six close behavior tests after the capability fix.
