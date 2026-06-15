---
status: resolved
trigger: |
  --discuss Phase 36.1 consolidation
  Paint stroke insertion inside play script doesn't work like expectes:
    - it insert a stroke yes, but this stroke is just inserted like a simple frame and not played animated like others strokes
    - when I want paint on frames, seem there is a feature which hide the paint preview wireframe

  Note: “insert stroke at frame 3” should mean the stroke starts animating from frame 3, not appear as a completed still frame. The missing paint-preview wireframe also sounds like a second related Play-canvas state bug.
created: 2026-06-15
updated: 2026-06-15
---

# Debug Session: phase-36-1-consolidation-pain

## Symptoms

- expected_behavior: |
    In a Play script, “insert stroke at frame 3” should insert a paint stroke whose animation starts at frame 3, matching how other strokes animate rather than appearing immediately as a completed still frame.
- actual_behavior: |
    The Play script inserts a stroke, but the stroke behaves like a simple still frame instead of playing as an animated stroke.
- error_messages: |
    No explicit error message reported.
- timeline: |
    Reported during Phase 36.1 consolidation.
- reproduction: |
    Use the Play script stroke insertion flow, e.g. request “insert stroke at frame 3”, then inspect playback/paint-on-frame behavior. Also attempt to paint on frames and observe that the paint preview wireframe appears hidden.

## Current Focus

- hypothesis: Play frame edits were stored but preview/playback paths either hid the live wireframe under cached preview imagery or rendered annotated strokes as one-frame completed strokes in dense scripts.
- test: targeted app Vitest run and app typecheck
- expecting: dirty Play edits are annotated before preview/render, cached preview is removed on edit intent, and annotated strokes remain progressive even when scripts have more strokes than frames.
- next_action: complete
- reasoning_checkpoint: root cause found and fixed
- tdd_checkpoint: 

## Evidence

- timestamp: 2026-06-15T12:55:00Z
  observation: AnimationPlayer had a dense-script branch for strokes.length > usableFrames that forced every stroke, including playFrame-annotated strokes, into a single-frame span with pointsPerFrame equal to all points.
  source: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts
- timestamp: 2026-06-15T12:55:00Z
  observation: Play preview called playerRef.current.play directly without first materializing pending selected-frame edit assignments into the engine state.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
- timestamp: 2026-06-15T12:55:00Z
  observation: beginPlayFrameEdit always cleared cached preview state on pointer-down capture, causing a state update during stroke start; when a cached preview image was present it visually covered the canvas overlay until removed.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx

## Eliminated

- The stroke metadata hook itself was not missing: EfxPaintEngine reads getStrokeMetadata().playFrame on pointer-up and persists playFrame on the stroke.
- Save Play already annotated pending assignments before generating/publishing frames; the missing path was local dirty preview plus dense playback scheduling.

## Resolution

- root_cause: Dense Play scripts forced playFrame-annotated strokes into single-frame completed renders, while dirty local previews did not load pending selected-frame annotations before playback and cached preview imagery could remain over the canvas at edit start.
- fix: Removed the one-frame dense scheduling branch so annotated strokes use progressive spans, materialized pending Play frame edit annotations before live preview playback, and only clears cached preview imagery on edit intent when it is actually present.
- verification: `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app test --run -- AnimationPlayer PhysicsPaintStudio` passed; `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed. Package check is blocked by pre-existing missing vitest dependency in @efxlab/efx-physic-paint.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts, /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts, /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx, /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
