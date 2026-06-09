---
status: resolved
trigger: "Debug Phase 35 physics paint integration regressions."
created: "2026-06-09"
updated: "2026-06-09"
---

# Debug Session: Phase 35 Physics Paint Integration Regressions

## Symptoms

### Expected behavior
The same physics stroke should render consistently across live physics paint window, saved physics state, cleared + loaded physics state, applied app canvas/layer, and app frame/playback render.

### Actual behavior
- Applying canvas only transfers part of the strokes.
- Save/load changes stroke appearance: initial paint looks textured/thick, but after save, clear, and load, it becomes thinner/smoother/different.
- Applying from physics to app canvas changes appearance: physics paint looks opaque/textured, app canvas looks faded/transparent and sometimes applies after the second paint instead of the original paint.
- Loaded state does not apply to canvas.
- Rendering inside physics paint is slow after applying strokes; original standalone app did not have this delay.
- Opening physics paint layers loses the original stroke/state; maybe the integration is not preserving the state path/source identity.
- Applying canvas should close the physics paint modal/window after successful apply.
- When painting with paper/background, the background paper is visible in physics paint but not in the app layer. Transparent painting should stay transparent, but colored strokes should preserve original opacity/look instead of becoming faded.
- Apply/play canvas on frames does not work.

### Error messages
No explicit runtime errors reported. Visual regressions shown in screenshots:
- Initial live physics render: /Users/lmarques/.claude/image-cache/27a05168-5619-4d22-bc87-e74448251ea6/1.png
- After save/clear/load render: /Users/lmarques/.claude/image-cache/27a05168-5619-4d22-bc87-e74448251ea6/2.png
- Physics render before apply: /Users/lmarques/.claude/image-cache/27a05168-5619-4d22-bc87-e74448251ea6/4.png
- App canvas after apply: /Users/lmarques/.claude/image-cache/27a05168-5619-4d22-bc87-e74448251ea6/5.png

### Timeline
Phase 35 implementation currently opens physics paint and applies something, but render/state/apply parity is broken. Treat as regression/debug task, not a new feature phase.

### Reproduction
Manual app reproduction run by user. Do not run dev server. Investigate code and tests, then ask user for manual app checks for visual validation.

## Priority

P0:
- Fix render/state/apply parity and loaded-state apply.
- Fix partial stroke transfer/lost original stroke/state identity.
- Fix faded/transparent appearance on app canvas.

P1:
- Fix paper/background compositing behavior.
- Fix frame/playback apply path.
- Investigate render slowness and identify whether main Tauri rerendering, engine rerender strategy, or batch rendering is the cause.

P2:
- Close physics paint window/modal after successful apply.

## Investigation Requirements

- Trace the full data path from physics paint stroke creation → state serialization → load/restore → render/export → Tauri/app bridge → app layer/frame storage → app render/playback.
- Identify whether the bug is in engine state serialization, app bridge payload shape, source layer identity, canvas export alpha/compositing, or app-side layer/frame rendering.
- Compare live render vs saved/loaded render using the same stroke data.
- Compare exported canvas/image pixels or payload dimensions/alpha before and after app apply.
- Check whether apply is using stale state, delayed state, previous stroke batch, or second-paint state.
- Do not add backward compatibility for old project formats.
- Keep engine integration incremental; avoid batch renderFromStrokes-style approaches that degrade physics quality or become O(n²).

## Validation

Run:
- pnpm --dir app test --run src/lib/physicPaintBridge.test.ts
- pnpm --dir app typecheck
- pnpm --filter @efxlab/efx-physic-paint check
- pnpm --filter @efxlab/efx-physic-paint demo:build

Manual validation:
- Ask the user to run app checks instead of starting the dev server.

## Current Focus

- hypothesis: confirmed: apply/playback exported only the wet display overlay, rendered outputs were not persisted in .mce, and state load replayed asynchronously with force-dry semantics that raced apply and changed wet/dry appearance.
- test: bridge/store/typecheck/package validation passed; manual visual validation still required in the running app.
- expecting: physics paint render/state/apply parity for current project format, with remaining paper compositing choices treated as product/UI follow-up.
- next_action: user manual validation in app
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-09T16:38:00Z
  finding: PhysicsPaintStudio.applyCanvas captured engine.getDisplayCanvas(), which is only the wet overlay canvas; dried/background pixels live on the dry canvas, explaining partial transfer and faded/transparent app output.
- timestamp: 2026-06-09T16:38:00Z
  finding: AnimationPlayer emitted engine.getDisplayCanvas() for apply-play-canvas, so frame/playback export had the same overlay-only defect.
- timestamp: 2026-06-09T16:38:00Z
  finding: physicPaintStore output was in-memory only and projectStore did not serialize/hydrate/reset it, so loaded projects/layers lost applied physics output even though layer source identity was persisted.
- timestamp: 2026-06-09T16:38:00Z
  finding: EfxPaintEngine.load used replayAnimated() with setTimeout-delayed replay and forceDryAll per stroke, causing loaded-state apply to race incomplete restoration and altering live wet-vs-loaded dry appearance.
- timestamp: 2026-06-09T16:39:00Z
  finding: Validation passed: pnpm --dir app test --run src/lib/physicPaintBridge.test.ts; pnpm --dir app typecheck; pnpm --filter @efxlab/efx-physic-paint check; pnpm --filter @efxlab/efx-physic-paint demo:build.

## Eliminated


## Specialist Review

- timestamp: 2026-06-09T18:01:00Z
  specialist_hint: typescript
  result: LOOKS_GOOD: Persisting editable SerializedProject alongside rendered output and feeding it back through launch context is the right fix direction. Pitfall flagged: the current transport embeds editable state in the Tauri launch payload, so very large stroke histories may stress event/IPC payload size; acceptable for now given the project format already inlines rendered PNG frames, but monitor if users create very large states.

## Resolution

- root_cause: The integration exported only the physics engine display overlay instead of the composited dry+wet canvas, did not persist rendered physics output with the project, restored saved editable state asynchronously with force-dry replay semantics, and still treated apply payloads as rendered-output-only so editable strokes were never stored/relaunched for re-edit.
- fix: Added EfxPaintEngine.exportCompositeCanvas(), used it for still and playback apply, persisted/hydrated/reset physic_paint_outputs in .mce with editable_state, made engine load synchronous for immediate apply, restored editableState on physics paint launch, includes engine.save() in still/play apply payloads, and closes the physics paint window after successful apply.
- verification: pnpm --dir app test --run src/lib/physicPaintBridge.test.ts; pnpm --dir app test --run src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts; pnpm --dir app typecheck; pnpm --filter @efxlab/efx-physic-paint check; pnpm --filter @efxlab/efx-physic-paint demo:build.
- files_changed: app/src/components/physic-paint/PhysicsPaintStudio.tsx; app/src/lib/physicPaintBridge.ts; app/src/lib/physicPaintBridge.test.ts; app/src/stores/physicPaintStore.ts; app/src/stores/physicPaintStore.test.ts; app/src/stores/projectStore.ts; app/src/types/physicPaint.ts; app/src/types/project.ts; packages/efx-physic-paint/src/animation/AnimationPlayer.ts; packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
