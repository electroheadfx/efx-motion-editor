---
status: resolved
trigger: "You implemented deferred strokes render, it works nice, but sometimes I paint severals strokes and it wait some secondes before to start render, sometimes I just paint one stroke and I wait severals seconde before it render, could you verify the defered engine how it works, it would like nice if it may render along Iam painting outline strokes in realtime ? what is the threshold limit for have good a responsiveness and streamed render without slow paint"
created: 2026-06-09T00:00:00Z
updated: 2026-06-09T00:00:00Z
---

## Current Focus

hypothesis: confirmed — deferred stroke finalization and queued-outline replay must prioritize active input; heavy paint finalization in the between-stroke gap or too many queued outlines per frame blocks new realtime outline strokes.
test: pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint check
expecting: TypeScript check passes after input-priority scheduler and queued-preview cap.
next_action: resolved
reasoning_checkpoint: root cause refined after immediate post-stroke finalization still blocked quick next strokes
tdd_checkpoint: not applicable

## Symptoms

expected: Deferred physics paint rendering should stream live in the background while outline strokes are drawn in realtime, with no multi-second wait before visible paint appears. On an M3 Max it should feel fast; worker-based rendering may be acceptable if needed.
actual: After the deferred renderer changes, painting several strokes sometimes waits seconds before rendering starts; sometimes even a single stroke waits several seconds before rendering.
errors: No visible console errors; reported as a visual/rendering delay.
timeline: Started after deferred stroke rendering changes.
reproduction: In Physics Paint, draw one stroke or several strokes using the deferred outline path and observe that finalized paint sometimes waits multiple seconds before starting to render.

## Eliminated


## Evidence

- timestamp: 2026-06-09T00:00:00Z
  observation: EfxPaintEngine queued completed strokes in pendingStrokeFinalizations and drew outline previews until finalization.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: scheduleStrokeFinalization waited for STROKE_FINALIZATION_QUIET_MS and rescheduled while state.drawing was true or pointer input was not quiet.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: lastPointerInputTime was updated by every pointermove before checking drawing state, so hover/cursor movement after pointerup could indefinitely defer finalized paint rendering.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: Replacing quiet-window gating with a short 16ms deferred timer made queued paint start quickly, but processing while state.drawing was true regressed smooth realtime outline strokes.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: Corrected scheduler uses a 600ms stroke-input grace window, retries every 80ms, drains queued finalized strokes every 16ms once rendering starts, forces progress after 1400ms, and no longer treats hover/cursor movement as input that can postpone finalization.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-09T00:00:00Z
  observation: While actively drawing, queued outline previews are capped to the latest 3 pending strokes so repainting the backlog does not compete with the current realtime outline stroke.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

## Specialist Review

engineering:debug unavailable in this harness; fix reviewed inline as minimal scheduling correction.

## Resolution

root_cause: Deferred finalization used pointer quiet time and drawing state as a gate, so hover movement kept completed strokes queued for seconds before paint rendering began; overly eager follow-up fixes regressed realtime outline drawing by allowing heavy finalization in active or between-stroke input windows, and by redrawing too many queued outlines per frame while drawing.
fix: Prioritize stroke input with a 600ms grace window after real drawing input, retry every 80ms while the user keeps drawing, drain finalized strokes every 16ms once rendering starts, force progress after 1400ms max defer, ignore passive hover movement, and cap active-drawing queued outline previews to the latest 3.
verification: pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint check passed.
files_changed: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
