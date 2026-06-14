---
status: resolved
trigger: |-
  --discuss for phase 36.1
  the play canvas script doesn't store which paint tool stroke use, I have 2 paint tools: paint normal and paint with physic, when I paint with normal paint, script doesn't store it play with physic paint by default same it was done with simple paint. There is the eraser tools too to add.
created: 2026-06-14
updated: 2026-06-14
---

# Debug Session: paint-tool-playback-mode

## Symptoms

- expected_behavior: Play canvas script stores which paint tool each stroke uses, distinguishing Normal paint, Physics paint, and eraser strokes, then replays each stroke with the correct tool.
- actual_behavior: Play canvas script does not store which paint tool was used; strokes painted with Normal paint replay as Physics paint by default, like the older simple paint behavior.
- error_messages: No specific error messages reported.
- timeline: Reported during phase 36.1 discussion/debug.
- reproduction: Paint using Normal paint, then use the play canvas script; playback uses Physics paint by default instead of preserving the original tool. Eraser tool handling is also missing.

## Current Focus

- hypothesis: Play canvas replay used global engine physicsMode instead of recording per-stroke mode.
- test: packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts preserves Normal, Physics, and eraser stroke modes during playback.
- expecting: Normal strokes replay with physicsMode null, Physics strokes replay with physicsMode local, eraser strokes replay as erase with physicsMode null.
- next_action: verify fix
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-14T19:55:00Z
  observation: AnimationPlayer replays saved strokes through EfxPaintEngine.renderPartialStrokes, but the serialized PaintStroke schema only preserved tool, points, params, diffusionFrames, and playFrame; it did not persist the per-stroke physics mode.
  source: packages/efx-physic-paint/src/types.ts, packages/efx-physic-paint/src/animation/AnimationPlayer.ts, packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-14T19:55:30Z
  observation: EfxPaintEngine.applyStrokeToEngine applies local fluid physics whenever current engine state physicsMode is 'local'. During Play replay this state is global, so normal paint strokes saved without any per-stroke physics mode are replayed with whichever physics mode is currently selected, defaulting to local/Physics.
  source: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-14T19:56:00Z
  observation: Eraser tool is already preserved as stroke.tool === 'erase' and renderPartialStrokes forwards a.tool, but adding an explicit per-stroke physicsMode=null for eraser strokes prevents the global Physics mode from leaking while eraser replay runs.
  source: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

## Eliminated

## Resolution

- root_cause: Play canvas editable state did not serialize per-stroke paint physics mode, so replay applied the engine's current/default physics mode to every paint stroke; normal strokes therefore replayed as Physics while eraser support depended only on the tool field.
- fix: Added per-stroke `physicsMode` to the physics paint stroke schema, recorded `local` vs `null` when strokes are created, serialized/deserialized it, and made replay temporarily apply each stroke's saved mode while preserving eraser tool replay.
- verification: `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint exec ../../app/node_modules/.bin/vitest run "src/animation/AnimationPlayer.test.ts"` passed (12 tests).
- files_changed:
  - /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/types.ts
  - /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts

## Specialist Review

- typescript: LOOKS_GOOD — the fix keeps the serialized field narrow (`'local' | null`), validates it at the bridge boundary, and avoids changing public AnimationConfig. The replay implementation should be careful to restore engine state after each stroke; this was done via a `finally` block.
