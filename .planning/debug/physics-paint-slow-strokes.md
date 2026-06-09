---
status: investigating
trigger: "The paint experience in EFX Physics paint studio is not fluid, the paint stroke are slow, I can't make fast severals stroked without wait the previous was rendered. From standalone app there is a slowdown, could you inspect the issue? I can accept that strokes render are asynchrone so I can paint next strokes without wait (if I dont wait, the new stroked got not smooth or approximative. Maybe work with worker ? maybe its an preact issue or the code need to be optimized ?"
created: 2026-06-09
updated: 2026-06-09
---

# Debug Session: physics-paint-slow-strokes

## Symptoms

- Expected behavior: Integrated EFX Physics Paint Studio should feel as fluid as the original standalone app at `/Users/lmarques/Dev/new-paint-engine/efx-physic-paint`; if the machine is slow, stroke rendering may complete asynchronously so new strokes can begin without waiting.
- Actual behavior: Painting inside the integrated EFX Physics Paint Studio is slow; rapid strokes cannot be made without waiting for the previous stroke to render, and strokes drawn without waiting become non-smooth or approximate.
- Error messages: None reported.
- Timeline: Started after integrating the standalone physics paint code into the main EFX/Tauri app. The original standalone app running in web mode remains very fast.
- Reproduction: Most reliably triggered by drawing several separate strokes quickly, drawing one long continuous stroke, using heavy brush/particle settings, and general workflows where the base Tauri app/background may be active.

## Current Focus

- hypothesis: The previous live retest did not exercise the edited engine source because the app resolved the workspace package through dist exports.
- test: Alias @efxlab/efx-physic-paint entry points to package source in app Vite config, then retest live consecutive strokes.
- expecting: Integrated app uses the source engine with deferred finalization changes; if lag remains, instrument active hot paths next.
- next_action: retest with package source aliases active
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-09T19:30:00Z
  observation: Integrated sidebar passed the active sequence dimensions into the physics paint launch context, while the standalone reference always uses the engine default 1000x650 canvas.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/components/sidebar/PhysicPaintProperties.tsx; /Users/lmarques/Dev/new-paint-engine/efx-physic-paint/src/types.ts
- timestamp: 2026-06-09T19:32:00Z
  observation: The engine hot path does synchronous main-thread pixel work on pointer down/up and every render frame, including full-canvas getImageData/putImageData, Float32 wet buffers, and synchronous renderPaintStroke on pointerup.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/brush/paint.ts
- timestamp: 2026-06-09T19:35:00Z
  observation: The integrated engine differs from standalone mostly by app integration changes; the paint stroke renderer itself is effectively the same, so the regression is from how it is hosted/launched, not a rewritten renderer.
  source: diff between /Users/lmarques/Dev/new-paint-engine/efx-physic-paint/src/engine/EfxPaintEngine.ts and /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T19:37:00Z
  observation: The native tablet pressure bridge emits Tauri events for every tablet point/mouse dragged event, which can add event-loop pressure during strokes but is secondary to the resolution multiplier.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/tablet.rs
- timestamp: 2026-06-09T19:45:00Z
  observation: After the native-resolution launch fix, user reports painting is only a bit better; they still cannot draw several strokes consecutively in a continuous flow, which remains unacceptable.
  source: user live test feedback
- timestamp: 2026-06-09T20:00:00Z
  observation: User confirms async/deferred stroke finalization is required: actual completed-stroke rendering breaks the next stroke's drawing before that stroke renders, but active stroke drawing must remain perfect/lossless.
  source: user live test feedback
- timestamp: 2026-06-09T20:15:00Z
  observation: Pointerup still synchronously rendered paint/erase strokes and ran local physics before returning, so the next pointerdown/move could not be captured smoothly during rapid consecutive strokes.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T20:25:00Z
  observation: Live retest after deferred finalization still lags between strokes and is not better than before, so the queued-finalization implementation is insufficient or targeting the wrong hot path.
  source: user live test feedback
- timestamp: 2026-06-09T20:35:00Z
  observation: App imports @efxlab/efx-physic-paint through package exports that point at dist; built dist did not contain STROKE_FINALIZATION_QUIET_MS/pending finalization code, so source edits may not have been active in the integrated app.
  source: app/vite.config.ts; packages/efx-physic-paint/package.json; packages/efx-physic-paint/dist/index.mjs

## Specialist Review

LOOKS_GOOD: Keep interactive editing at the standalone/native engine resolution and scale rendered output when compositing back into the sequence. This avoids multiplying CPU pixel work by project resolution. If pen input still stutters after this, throttle/coalesce the native tablet pressure events.

LOOKS_GOOD: Coalesce/throttle the native tablet pressure bridge at the source. The pressure bridge is integrated-only, emits once per native tablet point through Tauri, and can saturate the WebView queue. Keep the latest pressure/tilt semantics but cap emission to frame-ish cadence; pointer move events still provide geometry/coalesced points, so pressure does not need to be emitted for every tablet packet.

LOOKS_GOOD: Deferred stroke finalization is the right fix direction for the remaining input-latency bug. Keep pointer capture and point collection synchronous/lossless, copy the finished stroke data on pointerup, then flush queued work before stateful operations such as save, undo, export, replay, or physics. Main pitfall: avoid running queued finalization while a new stroke is actively drawing, or it will recreate the same event-loop contention.

## Eliminated


## Resolution

- root_cause: After the native-size canvas and tablet event throttling fixes, rapid consecutive strokes were still blocked because `EfxPaintEngine.onPointerUp` synchronously rendered the completed stroke and ran local physics before returning to the input loop.
- fix: Queue completed stroke finalization from pointerup, preserve/copy all captured points synchronously, keep pointerdown lightweight, wait for a short quiet input window before expensive render/physics work, and flush before save, undo, export, replay, force-dry, background, settings, and physics operations.
- verification: `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/lib/physicPaintBridge.test.ts` passed before follow-up; `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec tsc --noEmit` passed after the tablet bridge change and again after deferred finalization.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/app/src/components/sidebar/PhysicPaintProperties.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.test.ts; /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/tablet.rs; /Users/lmarques/Dev/efx-motion-editor/app/vite.config.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
