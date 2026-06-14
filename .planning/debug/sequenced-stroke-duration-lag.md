---
status: resolved
trigger: "$gsd-debug regression: sequenced stroke animation in Play canvas does not fit all stroked motion inside the animation duration/range and cuts the end of painting strokes; paint drawing is now laggy and no longer smooth."
created: "2026-06-14"
updated: "2026-06-14"
---

## Symptoms

- expected_behavior: "Play canvas stroke animation should remain sequential stroke-by-stroke and fit the full painted stroke motion inside the selected animation duration/range without cutting off the end of the final strokes. Painting should stay smooth and responsive while drawing."
- actual_behavior: "The sequenced stroke animation no longer fits the duration/range, so the end of painting strokes is cut off. Painting interaction also became slower/laggy and is no longer smooth."
- error_messages: "No runtime error reported."
- timeline: "Reported after the recent fix that restored sequenced Play-canvas stroke animation."
- reproduction: "Paint multiple strokes on Play canvas, render/play a script with a finite duration/range, and observe the end of the stroke sequence being clipped. Paint new strokes and observe input lag/stutter while drawing."

## Current Focus

- hypothesis: "Confirmed: the Play-frame sequencing fix preserved monotonic stroke order, but `AnimationPlayer.distributeStrokes` still allocated each stroke as if at least one frame were available per stroke. When strokeCount exceeded frameCount, overflow strokes were forced onto the last frame instead of being distributed across the whole duration. Separately, Play edit bookkeeping used full `engine.save()` serialization just to count strokes on pointer-down/frame changes."
- test: "Add focused AnimationPlayer regressions for anchored duration fitting and the 20-strokes/16-frames overflow case; remove hot-path full saves from Play edit baseline bookkeeping; run focused Physics Paint tests, app typecheck, package build, and diff whitespace check."
- expecting: "All Play-frame strokes remain sequential while fitting inside the selected frame range, and live Play drawing avoids full project serialization when starting/editing strokes."
- next_action: "complete"
- reasoning_checkpoint: "Follow-up regression from .planning/debug/play-canvas-parallel-strokes.md; preserve sequential recorded-order behavior while fixing duration fitting."
- tdd_checkpoint: ""

## Eliminated

- timestamp: "2026-06-14"
  observation: "`PhysicsPaintCanvasStack` wires Play edit intent through `onPointerDownCapture`, not pointermove, so the lag regression was not caused by a per-sample React callback. The expensive part was full project serialization on stroke start and Play-frame preview changes."

## Evidence

- timestamp: "2026-06-14"
  observation: "`AnimationPlayer.distributeStrokes` computed `frameSpan` from each stroke's weight over the full `usableFrames`, then applied `playFrame` by jumping `startFrame` forward. When a Play-frame anchor landed late in the range, the anchored stroke could consume the whole tail and leave following recorded-order strokes compressed into only the last exported frame."
- timestamp: "2026-06-14"
  observation: "`savePlay` persists frames from `AnimationPlayer.onFrame`; the `renderAllStrokes()` call after completion does not emit an additional persisted frame, so the scheduled final frame must already contain the completed sequence."
- timestamp: "2026-06-14"
  observation: "`capturePendingPlayFrameEdits`, `beginPlayFrameEdit`, and `previewLocalPlayFrame` used `engine.save().strokes.length` only to count strokes. `engine.save()` serializes/clones all strokes and point arrays, adding avoidable work to live Play editing."
- timestamp: "2026-06-14"
  observation: "Follow-up user example showed 20 strokes over 16 frames rendered the first 15 strokes across frames 0-14, then revealed strokes 16-20 together on frame 15. The previous remaining-budget fix still assumed one frame per stroke and only handled strokeCount <= frameCount correctly."
- timestamp: "2026-06-14"
  observation: "Follow-up regression showed Play duration stayed pinned to 4 frames and Play rendering did not publish to efx-motion. `PhysicsPaintStudio` preserved Roto/gap `maxPlayFrameCount` when switching into Play and passed it to the Play duration control, so stale gap limits could clamp every edit. The Play Space/Enter shortcut also always called preview instead of save/apply when the cache was stale or missing."

## Resolution

- root_cause: "Play-frame stroke allocation used whole-duration weights after anchor jumps instead of recomputing from remaining duration, so late anchors could starve later strokes; when strokeCount exceeded frameCount, the allocator also had no proportional overflow path and collapsed all extra strokes onto the final frame. Play edit bookkeeping serialized the full painting only to count strokes. Play UI state also leaked Roto/gap duration limits into Play mode and keyboard Play transport previewed stale scripts instead of saving/applying them."
- fix: "Changed `AnimationPlayer.distributeStrokes` to allocate from remaining frame/weight budgets when frameCount can fit one frame per stroke, and added a proportional tight-duration path for strokeCount > frameCount so shared stroke frames are spread across the whole range. Added `EfxPaintEngine.getStrokeCount()` and switched Play edit baseline code to use it instead of `engine.save().strokes.length`. Added `withoutRotoGapLimit()` and stopped passing gap max props to Play duration; Space/Enter now saves/applies when Play cache is stale or missing."
- verification: "Passed: pnpm --dir app exec vitest --root /Users/lmarques/Dev/efx-motion-editor --config /private/tmp/efx-motion-editor-vitest-package.config.ts --run packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts; pnpm --dir app test --run src/components/physic-paint/PhysicsPaintStudio.test.ts; pnpm --dir app test --run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts; pnpm --filter @efxlab/efx-physic-paint build; pnpm --dir app typecheck; git diff --check. Follow-up passed: AnimationPlayer overflow regression (20 strokes / 16 frames), Studio/Workflow tests including duration unpin and stale keyboard apply, broader Physics Paint app suite, package build, app typecheck, git diff --check."
- files_changed: "packages/efx-physic-paint/src/animation/AnimationPlayer.ts; packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts; packages/efx-physic-paint/src/engine/EfxPaintEngine.ts; app/src/components/physic-paint/PhysicsPaintStudio.tsx; app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
