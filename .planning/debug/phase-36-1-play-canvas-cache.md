---
status: investigating
trigger: "Phase 36.1 final human visual verification reported Play canvas cache, timeline, render preview, and stroke-width issues."
created: "2026-06-13T22:20:00.000Z"
updated: "2026-06-13T23:37:30.000Z"
---

# Debug Session: Phase 36.1 Play Canvas Cache and Timeline Issues

## Symptoms

### Expected behavior

Phase 36.1 final visual verification should pass:
- Saved Play cache should be used for Play preview after Save play.
- Play canvas timeline should show a vertical current-frame position marker, support navigation between frames, and default to first frame rather than final frame.
- Play canvas timeline should fit the available width even with many frames; start/end animation visuals should remain proportional across the timeline width.
- Timeline should visually distinguish cached/saved Play ranges, likely by line color.
- The Play button should not exist if pressing it performs Save play semantics.
- Moving to an in-between animation frame should show that frame, not only the last frame.
- In Play canvas tab, painting on an existing animation should be allowed only on the last frame to append new strokes.
- Consider adding stroke wiggle/noise controls in the right sidebar for stop-motion hand variation during playback.
- Physics stroke render should match outline preview brush size; currently rendered strokes look bolder than outline preview except with non-physics brush.

### Actual behavior

User reports during final human visual verification checkpoint:
- Cache seems not working: render Save play does not use cache for Play preview.
- Timeline shows a bullet rather than a vertical current-frame position bar.
- User cannot navigate between frames and cannot go to the start of animation; default seems to show final frame instead of first frame.
- Timeline does not fit panel width; start/end animation visuals stay on only part of timeline width.
- Saved/cache state is not visually indicated by a distinct timeline line color.
- Play button appears to perform Save play, so it should not exist.
- Moving timeline to in-between animation shows only the last frame.
- Existing animation painting should only be allowed on last frame for appending strokes.
- User requests feasibility of stroke wiggle controls: noise strength, deform/displace, position displacement for stop-motion hand variation.
- Stroke render appears bolder than outline preview; verify brush size parity, especially physics vs non-physics brush.

### Error messages

No code error reported. Visual/behavioral mismatch reported with screenshot.

### Timeline

Started during Phase 36.1 final human visual verification checkpoint after plan 36.1-06 reached human-verify. The app is being run by the user; Claude must not run the server.

### Reproduction

From the user:
1. Open final Phase 36.1 Play canvas workflow.
2. Use Play canvas tab with saved Play scripts and Save play/render behavior.
3. Observe cache preview, timeline markers/current-frame indicator/navigation/fitting, Play button behavior, in-between preview, append-paint behavior, stroke wiggle request, and stroke-width mismatch.

### Screenshot notes

Attached screenshot shows:
- Roto canvas and Play canvas tabs, with Play canvas active.
- Duration control set to 10.
- Previous/start-like icons, Play triangle, Stop square, Save play button, Save state, Load state.
- Timeline ruler labels 0, 2, 4, 6, 8, 10, 12 compressed into the left part of a wide panel.
- A blue horizontal range bar below the ruler with circular white handles/markers around start, near frame 1, and near frame 10.
- No vertical current-frame bar is visible.

## Current Focus

hypothesis: "Phase 36.1 Play canvas local preview state and timeline UI are wired enough for tests but not for user-expected cached preview, frame navigation, timeline fitting, and append-only editing semantics."
test: "Inspect PhysicsPaintWorkflowStrip, PhysicsPaintStudio, animation player, render/cache paths, and tests to separate implementation bugs from new enhancement requests."
expecting: "Find concrete code paths where preview uses last/live frame instead of cached indexed frames, timeline marker/current frame is rendered as circles and scaled to duration rather than container width, Play button has save-like side effects, and physics render stroke width diverges from outline preview."
next_action: "gather initial evidence"
reasoning_checkpoint: "Distinguish bugs blocking Phase 36.1 completion from enhancement requests such as stroke wiggle controls; do not run the app/server."
tdd_checkpoint: "Existing commits already added tests; new fixes should add focused failing tests first where behavior is bug-fixable."

## Evidence

- timestamp: 2026-06-13T23:29:48.000Z
  observation: Interrupted debug agent left a partial Play canvas patch touching WorkflowStrip, Studio, CSS, and source-contract tests. Focused tests passed, but review found unsafe gaps: Play navigation still used synced editor callbacks, append-only editing used launch currentFrame rather than local preview frame, cached preview attempted a non-existent engine.loadImage API, and CSS still inherited the 1800px lane grid.
- timestamp: 2026-06-13T23:37:15.000Z
  observation: Corrected patch passes `pnpm --dir app test --run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` with 28 tests passing.
- timestamp: 2026-06-13T23:37:20.000Z
  observation: Corrected patch passes `pnpm build`.

## Eliminated

- hypothesis: "The Play canvas cached preview can be fixed by loading PNG frames directly into EfxPaintEngine."
  reason: EfxPaintEngine exposes export/get/load project APIs, not loadImage; cached frame preview must render as an overlay or use a new engine API outside this fix scope.
- hypothesis: "Play transport first/previous buttons can reuse editor synced navigation."
  reason: User explicitly reported main/play frame navigation confusion; Phase 36.1 requires local Play scrub not moving the editor playhead.

## Resolution

root_cause: Play canvas preview UI was test-complete but behavior-incomplete: cached saved frames were not restored on clean Play preview, current position was rendered as a bullet, the Play lane retained fixed-width timeline geometry, Play transport still exposed preview/save-like controls, and append-only editing was based on the launch frame rather than the local Play preview frame.
fix: Added cached Play preview overlay state, clean-cache reload on local preview frame changes, cached line coloring, full-width Play lane layout, a vertical current preview marker, removed the Play preview button, routed Play first/previous controls through local preview navigation, and disabled canvas input unless a saved Play script is previewed at its last append frame.
verification: `pnpm --dir app test --run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`; `pnpm build`.
files_changed: app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/physicsPaintStudio.css
