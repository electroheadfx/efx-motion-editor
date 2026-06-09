---
status: resolved
trigger: "Concrete regression: pressure was killed with this integration. Expected behavior: brush/input pressure affects physics paint strokes as before. Actual behavior: pressure appears gone after integration. Likely root cause is narrow in input/event/serialization/engine params. Do not run the app server; user runs it locally."
created: 2026-06-09
updated: 2026-06-09
---

# Debug Session: pressure-was-killed-with-this

## Symptoms

- Expected behavior: Brush/input pressure affects physics paint strokes as before.
- Actual behavior: Pressure appears gone after integration.
- Error messages: None reported.
- Timeline: Started with the recent integration; this worked before.
- Reproduction: Use physics paint with pressure-capable brush/input and compare pressure variation; user runs the app locally.

## Current Focus

- hypothesis: confirmed: standalone physics paint route used PointerEvent.pressure directly, but macOS WKWebView reports fixed 0.5; native tablet bridge events were only consumed by the legacy paint overlay, not forwarded into EfxPaintEngine.
- test: pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor typecheck
- expecting: native tablet:pressure events are injected into the physics engine and used for pressure/tilt when fresh
- next_action: complete
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-09T00:00:00Z
  observation: EfxPaintEngine.extractPenPoint read pressure from PointerEvent.pressure and only considered pointerType === 'pen' as pen input.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: Existing native macOS tablet bridge emits tablet:pressure because WebKit/WKWebView reports PointerEvent.pressure as fixed 0.5 on macOS.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/tablet.rs
- timestamp: 2026-06-09T00:00:00Z
  observation: The main paint overlay consumed tablet:pressure and substituted nativePressure for pen strokes, but PhysicsPaintStudio had no tablet:pressure listener and did not forward native samples to EfxPaintEngine.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/components/canvas/PaintOverlay.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
- timestamp: 2026-06-09T00:00:00Z
  observation: Build and app typecheck pass after adding native pen input injection.
  source: pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor typecheck

## Eliminated


## Specialist Review

- specialist_hint: typescript
- result: LOOKS_GOOD — forwarding native tablet samples through a typed engine API is the correct integration point; keep the freshness window so stale pressure does not affect mouse input.

## Resolution

- root_cause: Physics paint integration lost real pressure because EfxPaintEngine only used PointerEvent.pressure, while macOS WKWebView reports fixed 0.5 and the native tablet:pressure bridge was not wired into PhysicsPaintStudio.
- fix: Added a native pen input injection API to @efxlab/efx-physic-paint, forwarded tablet:pressure events from PhysicsPaintStudio into the engine, and made extractPenPoint prefer fresh native pressure/tilt samples.
- verification: pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor typecheck
- files_changed: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/types.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/preact.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
