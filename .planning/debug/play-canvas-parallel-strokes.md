---
status: resolved
trigger: "$gsd-debug big regression, the play canvas animation was broken, it play strokes in parralles instead in sequences stoke by stroke, please review the specs in phase 36 and 36.1 how it was implemented, you broken it !"
created: "2026-06-14"
updated: "2026-06-14"
---

## Symptoms

- expected_behavior: "Phase 36.1 D-19 through D-23: Play script rendering distributes strokes sequentially in recorded order, like one artist hand, with no public sequential/parallel toggle."
- actual_behavior: "Frame-annotated Play strokes could animate in parallel because the previous regression fix scheduled each playFrame stroke independently from its selected frame through the end of the duration."
- error_messages: "No runtime error reported."
- timeline: "Reported after the Phase 36.1 Play-frame edit regression fix on 2026-06-14."
- reproduction: "Paint/add multiple strokes on Play canvas frames, render/play the script, and observe multiple strokes/letters drawing at the same time instead of one after another."

## Current Focus

- hypothesis: "Confirmed: `AnimationPlayer.distributeStrokes` treated `playFrame` as an independent start/end override instead of a sequential start anchor, bypassing the recorded-order cursor."
- test: "Focused AnimationPlayer regression test plus Phase 36.1 app tests, typecheck, package build, and diff whitespace check."
- expecting: "A playFrame stroke may not start before its selected frame, but it also may not overlap a previous stroke except under unavoidable tight-duration final-frame compression."
- next_action: "manual UAT in running app"
- reasoning_checkpoint: "Phase 36.1 D-19/D-23 remains authoritative over frame-edit scheduling."
- tdd_checkpoint: "Regression test asserts two strokes painted on the same Play frame do not become active in parallel."

## Evidence

- timestamp: "2026-06-14"
  observation: "Phase 36.1 context states Play animation should feel like painting C, then h, then l, then o, then e, not painting multiple letters at the same time."
- timestamp: "2026-06-14"
  observation: "`AnimationPlayer.ts` had a `playFrame` branch that returned a range from the selected frame to the end, allowing later frame-annotated strokes to share active frames."

## Eliminated

- hypothesis: "Cached preview playback caused the parallel stroke rendering."
  reason: "The failing behavior is explained by frame allocation before rendered frames are captured; cached playback reuses already captured output."

## Resolution

- root_cause: "The playFrame edit fix bypassed the sequential allocation cursor and made frame-annotated strokes independent active ranges."
- fix: "Changed `playFrame` to a minimum start anchor inside the existing recorded-order weighted allocation. The allocation cursor remains monotone, so multiple strokes assigned to the same Play frame draw sequentially rather than in parallel."
- verification: "Passed: pnpm --dir app exec vitest --root /Users/lmarques/Dev/efx-motion-editor --config /private/tmp/efx-motion-editor-vitest-package.config.ts --run; pnpm --dir app test --run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts; pnpm --dir app typecheck; pnpm --filter @efxlab/efx-physic-paint build."
- files_changed: "packages/efx-physic-paint/src/animation/AnimationPlayer.ts; packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts"
