---
status: resolved
trigger: "$gsd-debug triage Phase 36.1 Physics Paint Play/Motion bugs: move Deform/Move into right sidebar Motion tab, persist motion options/duration into animation script, move Save/Load state into Tool tab, start Play timeline at the host frame, do not reopen a frame-6 script from host frame 0, replace Play canvas timeline with Roto timeline UI semantics, allow painting on existing Play animation frames, and replay cached saved frames smoothly."
created: "2026-06-14"
updated: "2026-06-14"
---

## Symptoms

- expected_behavior: "Physics Paint Play/Motion controls live in the right sidebar, animation script settings persist and reopen only for matching host frame/range, Play timeline uses Roto-like frame cells from the correct start frame, Play canvas supports per-frame paint edits, and cached saved frames are reused for smooth preview playback."
- actual_behavior: "Motion controls are in Play controls, motion options/duration are not stored by the animation script, Save/Load state are not in the Tool tab, Play timeline starts at frame 0 after painting from host frame 6, reopening at host frame 0 can load the frame-6 script, Play timeline scrubbing lands between frames and may expose only three frames for duration 4, painting is unavailable on existing Play frames, and cached saved frames are not replayed during preview."
- error_messages: "No runtime error reported."
- timeline: "Reported during Phase 36.1 debug/UAT on 2026-06-14."
- reproduction: "Create/open Physics Paint from efx-motion at frame 6, paint a stroke, switch to Play canvas with duration 4, render/save/play, then reopen Physics Paint from frame 0 and test playback/scrubbing/painting."

## Current Focus

- hypothesis: "Confirmed: Play script ownership was split between transient studio state, layer-level editable state, and a bespoke range-line timeline. Duration/Motion settings were not part of the persisted script range, Roto-to-Play did not create a range, clean cached playback did not use cached frames, and opening a gap could hydrate the last layer editable state."
- test: "Focused app tests, package animation test, app typecheck, physics package build, and git diff whitespace check."
- expecting: "Play scripts persist duration/Motion/cache state, frame 6 duration 4 renders as frame cells starting at 6, frame 0 opens empty outside the range, cached green scripts preview from cached frames, and edits mark the script stale."
- next_action: "manual UAT in the running app"
- reasoning_checkpoint: "Treat all eight user bullets as symptoms in one Physics Paint Play/Motion workflow cluster."
- tdd_checkpoint: "Prefer focused tests around bridge launch selection, duration/range persistence, timeline frame count, cached playback path, and Play-frame edit invalidation."

## Evidence

- timestamp: "2026-06-14"
  observation: "PhysicPaintPlayScriptRange lacked Motion settings; apply payloads lacked selected script id and Motion settings, so duration changes could overlap the old range instead of replacing it."
- timestamp: "2026-06-14"
  observation: "convertRotoToPlay removed rendered frames and set workflow metadata but did not create a Play script range, leaving the new script without a persisted identity/cache status."
- timestamp: "2026-06-14"
  observation: "createPhysicPaintLaunchContext fell back to the layer-level editable state when no Play range contained the requested frame, allowing a frame-6 script to appear when opening frame 0."
- timestamp: "2026-06-14"
  observation: "Play preview only scrubbed cached frames one at a time; clean cached playback did not run a cached-frame timer loop."
- timestamp: "2026-06-14"
  observation: "Regression follow-up: moving Duration into the right-panel Motion tab was not requested; Duration belongs in the bottom animation panel while Motion contains only Deform/Move."
- timestamp: "2026-06-14"
  observation: "Regression follow-up: frame-annotated Play strokes were scheduled as one-frame complete strokes, making them appear all at once instead of drawing progressively."
- timestamp: "2026-06-14"
  observation: "Regression follow-up: Save state also needed to capture pending Play-frame edits before serializing, otherwise newly painted frame edits could be exported without their selected-frame assignment."

## Eliminated

- hypothesis: "The issue was only a visual label/ruler bug."
  reason: "The store and bridge also lost script identity, cache status, and Motion settings."

## Resolution

- root_cause: "Play script range metadata was incomplete and UI state was split from persisted script state; the Play timeline also used a local 0-based range line instead of script-start frame cells."
- fix: "Persisted Play Motion settings/cache status/script id, allowed selected script duration replacement, created stale ranges on Roto-to-Play, scoped launch editable hydration to selected ranges or existing frames, moved Deform/Move and Save/Load state into right-panel tabs while restoring Duration to the bottom animation panel, replaced the Play range line with Roto-style cells, allowed Play-frame painting to stale cached scripts, scheduled frame-annotated strokes progressively from their selected Play frame, annotated Save state exports, and replayed clean cached frames through a timer preview."
- verification: "Passed: pnpm --dir app test --run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts; pnpm --dir app exec vitest --root /Users/lmarques/Dev/efx-motion-editor --config /private/tmp/efx-motion-editor-vitest-package.config.ts --run; pnpm --dir app typecheck; pnpm --filter @efxlab/efx-physic-paint build; git diff --check."
- files_changed: "app/src/types/physicPaint.ts; app/src/stores/physicPaintStore.ts; app/src/lib/physicPaintBridge.ts; app/src/components/physic-paint/PhysicsPaintStudio.tsx; app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx; app/src/components/physic-paint/PhysicsPaintRightPanel.tsx; app/src/components/physic-paint/physicsPaintStudio.css; packages/efx-physic-paint/src/types.ts; packages/efx-physic-paint/src/engine/EfxPaintEngine.ts; packages/efx-physic-paint/src/animation/AnimationPlayer.ts; focused tests."
