---
status: resolved
trigger: "--discuss Phase 36.1\nThe motion wiggles/jitter no work like expected, I think you dont understand what I want.\n  - the deform option deform nothing\n  - the move option no work like I want, its real jitter not a smooth motion, do you understand what is stop motion drawing look ?\n  strokes are random it move all time on frames, tell me for understand"
created: "2026-06-14"
updated: "2026-06-14"
---

## Symptoms

- expected_behavior: "Motion should feel like intentional stop-motion drawing: stable frame-to-frame poses with controlled changes, not random continuous wiggle. Deform should visibly deform the drawn stroke/shape. Move should shift the drawing smoothly/consistently according to the intended animation style, not make strokes randomly move all the time across frames."
- actual_behavior: "Motion wiggle/jitter does not behave as expected. Deform option appears to deform nothing. Move option produces real jitter/random stroke movement frame-to-frame instead of a smooth or stop-motion-like drawing motion."
- error_messages: "No runtime error reported. User reports visual/behavioral mismatch."
- timeline: "Reported during Phase 36.1 debug/UAT on 2026-06-14 after prior Play/Motion fixes."
- reproduction: "In Phase 36.1 Physics Paint Play/Motion workflow, paint strokes, enable/test Deform and Move motion options, render/play across frames, and observe whether strokes deform or move with intentional stop-motion behavior versus random jitter on every frame."

## Current Focus

- hypothesis: "Unknown: the implementation may be treating Motion as per-frame random jitter/noise instead of deterministic stop-motion pose offsets, and Deform may not be wired into the stroke rendering path or may have an amplitude too small/incorrect target."
- test: "Inspect Motion option data flow from UI state through persisted animation script and package playback/rendering, then compare current algorithm against intended stop-motion behavior."
- expecting: "Evidence should show whether Deform is ignored, whether Move generates random offsets every frame, whether randomness is deterministic/stable per frame/script, and what behavior the UI labels imply versus actual rendering."
- next_action: "gather initial evidence"
- reasoning_checkpoint: "Treat the user's main complaint as a product-behavior mismatch: stop-motion drawing should preserve authored drawings with controlled per-frame pose changes, not random permanent jitter."
- tdd_checkpoint: "Add/adjust focused tests only after root cause is identified, ideally covering deterministic frame poses and non-noop Deform/Move behavior."

## Evidence

- timestamp: "2026-06-14T00:00:00Z"
  observation: "AnimationPlayer.applyWiggle used sine/cosine phase = frameIndex * 0.48, changing offsets every rendered frame. This made Move behave as continuous jitter rather than held stop-motion poses. Deform amplitude was only 3px at 100%, making it visually too subtle on many strokes."
  files: ["/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts"]
- timestamp: "2026-06-14T00:00:01Z"
  observation: "Motion sliders are wired through PhysicsPaintRightPanel -> PhysicsPaintStudio playWiggle -> AnimationPlayer.play wiggle config, so root cause is playback algorithm semantics rather than UI wiring."
  files: ["/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintRightPanel.tsx", "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx"]
- timestamp: "2026-06-14T00:00:02Z"
  observation: "Fix changed playback motion to deterministic quantized stop-motion poses held for two frames. Move now applies one uniform whole-stroke offset per held pose; Deform now applies per-point deterministic offsets with stronger visible amplitude."
  files: ["/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts", "/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts"]
- timestamp: "2026-06-14T00:00:03Z"
  observation: "Verification: pnpm --filter @efxlab/efx-physic-paint build succeeds. Focused vitest and package typecheck cannot run because vitest is not installed/declared for @efxlab/efx-physic-paint; existing test file already imports vitest."
  files: ["/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/package.json"]

## Eliminated

## Specialist Review

- specialist_hint: "typescript"
- result: "LOOKS_GOOD — deterministic quantized poses match the requested stop-motion drawing behavior; keeping Move as uniform translation avoids accidental deformation, while Deform now visibly changes per-point geometry."

## Resolution

- root_cause: "Motion playback was implemented as per-frame sine/cosine wiggle, so offsets changed continuously every frame; Move looked like random jitter, and Deform used a small 3px max amplitude that could appear to do nothing."
- fix: "Changed AnimationPlayer wiggle to deterministic stop-motion poses held for two frames, with Move as whole-stroke held translation and Deform as stronger per-point held shape offsets; updated tests to assert held poses and move-only spacing preservation."
- verification: "pnpm --filter @efxlab/efx-physic-paint build passes. Focused vitest/typecheck are blocked because vitest is not installed in @efxlab/efx-physic-paint."
- files_changed: "/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts"
