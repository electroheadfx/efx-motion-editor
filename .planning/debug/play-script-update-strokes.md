---
status: resolved
trigger: "On branch quick/260614-script-play-update: Physics Paint Play script Update does not change rendered stroke color/size/tool after changing brush settings, and painting a stroke on Play frame 3 appends it to the end instead of assigning it to frame 3. Investigate whether stroke properties are per-stroke, whether Update should rewrite existing strokes or only save future render options, and why playFrame assignment is wrong. Global properties could override local strokes, and if global properties are erased, local strokes could keep their own properies"
created: 2026-06-14
updated: 2026-06-14
---

# Debug Session: play-script-update-strokes

## Symptoms

- expected_behavior: "Physics Paint Play script Update should make the rendered Play stroke use the changed brush settings as intended, and painting a stroke on Play frame 3 should assign that stroke to frame 3 rather than appending it to the end. Need to determine whether stroke properties are per-stroke, whether Update should rewrite existing strokes or only save future render options, and whether global properties should override or be erased so local strokes retain properties."
- actual_behavior: "Update does not change rendered stroke color/size/tool after changing brush settings. Painting a stroke on Play frame 3 appends it to the end instead of assigning it to frame 3."
- error_messages: "No error messages reported."
- timeline: "Unknown from initial report; observed on branch quick/260614-script-play-update."
- reproduction: "In Physics Paint Play script, change brush settings and use Update; observe rendered stroke color/size/tool does not change. Paint a stroke while on Play frame 3; observe it appends at the end instead of being assigned to frame 3."

## Current Focus

- hypothesis: "unknown"
- test: ""
- expecting: ""
- next_action: "gather initial evidence"
- reasoning_checkpoint: ""
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-14T22:59:00Z
  source: code inspection
  finding: "PaintStroke stores per-stroke tool, color, params, playFrame, and physicsMode. Animation playback and engine partial replay consume those per-stroke values rather than global brush settings."
- timestamp: 2026-06-14T22:59:00Z
  source: app/src/stores/physicPaintStore.ts
  finding: "updatePlayScriptRenderOptions only updated Play script metadata/cache status and renderOptions, leaving range.editableState.strokes unchanged. Reopening/rerendering the script therefore kept old per-stroke color/size/tool."
- timestamp: 2026-06-14T22:59:00Z
  source: packages/efx-physic-paint/src/animation/AnimationPlayer.ts
  finding: "The strokes.length > frameCount distribution branch ignored stroke.playFrame, so dense Play scripts placed newly annotated strokes according to append/order distribution instead of the inspected Play frame."
- timestamp: 2026-06-14T23:00:00Z
  source: targeted tests
  finding: "pnpm --filter efx-motion-editor exec vitest run --root /Users/lmarques/Dev/efx-motion-editor packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts app/src/stores/physicPaintStore.test.ts passed. Note: --root matched duplicate tests under .claude/worktrees as well as the intended files."

## Eliminated

- Global engine brush settings are not the source of rerender persistence; saved Play scripts replay from serialized per-stroke properties.
- Serialization is not dropping playFrame; EfxPaintEngine save/load already preserves it when present.

## Resolution

- root_cause: "Play Update saved only global render option metadata while actual Play rerendering uses serialized per-stroke properties, and dense AnimationPlayer distribution ignored playFrame anchors for newly painted Play-frame strokes."
- fix: "Update Play render options now rewrites the selected script editableState strokes/settings with the selected tool/color/size/opacity/background/physics mode, and AnimationPlayer honors explicit playFrame annotations even when strokes outnumber frames."
- verification: "pnpm --filter efx-motion-editor exec vitest run --root /Users/lmarques/Dev/efx-motion-editor packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts app/src/stores/physicPaintStore.test.ts"
- files_changed: "/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.test.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts; /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts"
