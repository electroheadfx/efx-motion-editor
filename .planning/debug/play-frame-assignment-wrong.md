---
status: resolved
trigger: "--discuss phase 36.1 consolidation\n- what I want: add a brush on a frame in play canvas, it add the frame after the stroke from frame 3, this action clear the cache then the render will output the new interpolation with the new stroke added after the stroke render in frame 3.\n- But actually painting a stroke on Play frame 3 appends it to the end instead of assigning it to frame 3. Investigate why playFrame assignment is wrong\n\nplease warming with worktree when before files was not commited, GSD block"
created: 2026-06-15T00:00:00Z
updated: 2026-06-15T00:00:00Z
---

## Current Focus
hypothesis: Play frame metadata was inferred after stroke creation by React wrapper timing instead of being stamped by the physics engine when the stroke action is created.
test: build physics package and run targeted physics paint tests
expecting: strokes created while previewing Play frame 3 serialize with playFrame 3 and Play render scheduling inserts them at that frame
next_action: complete

## Symptoms
expected: Painting a brush stroke on Play frame 3 in the Play canvas assigns the new stroke to frame 3, clears the cache, and render output includes the new interpolation with the stroke inserted after the frame 3 stroke render.
actual: Painting a stroke on Play frame 3 appends it to the end instead of assigning it to frame 3.
errors: None reported.
started: Reported during Phase 36.1 consolidation on 2026-06-15.
reproduction: In Play canvas, select/scrub to frame 3, paint a brush stroke, then inspect/render the play script output; the new stroke is appended at the end instead of being associated with playFrame 3.

## Eliminated

## Evidence
- timestamp: 2026-06-15T00:00:00Z
  observation: PhysicsPaintStudio tracked Play frame edits with playFrameEditBaselineRef/playFrameEditAssignmentsRef and annotated strokes later by stroke index at save time.
  source: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- timestamp: 2026-06-15T00:00:00Z
  observation: EfxPaintEngine appended stroke actions in onPointerUp without any hook to stamp host metadata like playFrame at creation time.
  source: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
- timestamp: 2026-06-15T00:00:00Z
  observation: AnimationPlayer already honors serialized stroke.playFrame anchors, so the scheduling bug is upstream in assignment/persistence, not animation playback.
  source: packages/efx-physic-paint/src/animation/AnimationPlayer.ts
- timestamp: 2026-06-15T00:00:00Z
  observation: Targeted verification passed: pnpm --filter @efxlab/efx-physic-paint build && pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts.
  source: command output

## Resolution
root_cause: "Play frame assignment depended on React-side deferred stroke-index inference, while the engine created/appended strokes without stamping the current Play preview frame. When timing drifted, new Play-frame strokes serialized without playFrame and AnimationPlayer scheduled them as unanchored strokes at the end."
fix: "Added an optional getStrokeMetadata engine config/Preact prop and wired PhysicsPaintStudio to provide the current local Play preview frame, so EfxPaintEngine stamps playFrame on each stroke action when it is created."
verification: "pnpm --filter @efxlab/efx-physic-paint build && pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts"
files_changed: ["app/src/components/physic-paint/PhysicsPaintStudio.tsx", "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts", "packages/efx-physic-paint/src/preact.tsx", "packages/efx-physic-paint/src/types.ts"]
