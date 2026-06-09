---
status: resolved
trigger: "Physics Paint play/render-to-canvas does not match the studio output. It renders like a different pencil/simple stroke without the real paint FX. Expected: playback, animation, load state, and canvas render should preserve the same physics paint FX appearance as the studio/standalone engine. Actually We added a async stroke with stroke preview outline, and it render like the real paint, suggestion: maybe use this code for play/render-to-canvas."
created: 2026-06-09T00:00:00Z
updated: 2026-06-09T12:30:00Z
---

## Current Focus

hypothesis: confirmed — renderPartialStrokes/redrawAll caused play-canvas animation and load-state output to look like simple pencil strokes because they bypassed the normal finalized-stroke pipeline and immediately force-dried wet paint instead of preserving/compositing the physics wet layer.
test: Applied minimal refactor in EfxPaintEngine.ts: extracted/reset replay state, extracted finalized stroke application with configurable completion drying, called it from applyFinalizedStroke/renderPartialStrokes/redrawAll, and removed dead replayAnimated duplicate logic.
expecting: renderPartialStrokes and redrawAll no longer have simplified renderPaintStroke + unconditional forceDryAll logic; local-mode paint remains in/composites through wet layer like studio finalization.
next_action: User visual confirmation in real Physics Paint workflow; package typecheck/build already passed.
reasoning_checkpoint:
  hypothesis: "Animation/load render mismatch occurs because renderPartialStrokes and redrawAll replay strokes with a simplified direct renderPaintStroke + forceDryAll path, while the studio path applyFinalizedStroke leaves local-mode paint in the wet physics layer after antiAlias/localFluidPhysicsStep and composites that display layer."
  confirming_evidence:
    - "PhysicsPaintStudio.applyPlayCanvas captures each frame from AnimationPlayer.onFrame, and AnimationPlayer renders each frame exclusively via EfxPaintEngine.renderPartialStrokes before exportCompositeCanvas()."
    - "renderPartialStrokes currently renders strokes then unconditionally forceDryAll(), clearing wet paint before display compositing; applyFinalizedStroke in local mode instead runs prepareWetLayerForStroke, optional featherWetEdges, savedWet/lastStrokeMask accumulation, localFluidPhysicsStep, and does not forceDryAll()."
    - "PreviewRenderer for layer.type === 'physic-paint' draws stored PNG dataUrl frames from physicPaintStore, so app playback/export is consuming whatever pixels the standalone producer generated rather than reconstructing strokes with paintRenderer."
  falsification_test: "If after sharing applyFinalizedStroke's local wet-layer pipeline in renderPartialStrokes/redrawAll the generated play-canvas PNG frames still lack physics FX, then the mismatch is not caused by replay simplification and investigation must move to image capture/loading timing or standalone engine internals."
  fix_rationale: "The fix addresses the root cause by removing the divergent simplified replay path and making animation/load/render-to-canvas reuse the same wet physics rendering mechanics that produce the correct studio appearance."
  blind_spots: "No browser pixel-diff test has been run yet because package tests do not currently include a DOM/canvas harness; verification will rely on typecheck/app tests plus user visual confirmation in the real workflow."
tdd_checkpoint: pending

## Symptoms

expected: Playback, animation, load state, and render-to-canvas preserve the same physics paint FX appearance as the studio/standalone engine.
actual: Play/render-to-canvas renders like a different pencil/simple stroke without the real paint FX.
errors: No explicit error reported; visual output mismatch.
timeline: Regression noticed after adding async stroke with stroke preview outline, which does render like the real paint.
reproduction: Trigger Physics Paint playback/render-to-canvas for a physics paint stroke and compare it against studio/standalone output. The async stroke preview outline path appears to preserve the real paint look.

## Eliminated

- hypothesis: App preview/playback/export reconstructs physics paint strokes with the regular paint/pencil renderer.
  evidence: PreviewRenderer handles layer.type === 'physic-paint' by loading and drawing physicPaintStore PNG dataUrl frames; app bridge/store payload type contains rendered PNG frames and editable state, not stroke reconstruction for preview.
  timestamp: 2026-06-09T12:10:30Z

## Evidence

- timestamp: 2026-06-09T12:01:00Z
  checked: .planning/debug/knowledge-base.md and project skill indexes
  found: Knowledge base contains only keyframe-label-z-index-overlap; no 2+ keyword overlap with physics/paint/render/canvas. Repomix reference skill is available for codebase search, but no special paint-specific skill rules were found.
  implication: No prior resolved pattern applies; proceed with open-ended investigation using code search and common bug pattern categories (wrong data displayed/state/render path mismatch).
- timestamp: 2026-06-09T12:04:30Z
  checked: app/src/stores/physicPaintStore.ts, app/src/types/physicPaint.ts, app/src/lib/physicPaintBridge.ts, app/src/lib/previewRenderer.ts
  found: Physics paint bridge accepts only rendered PNG dataUrl frames plus editableState; store saves frames by layerId/appFrame and bumps physicPaintVersion. PreviewRenderer subscribes to physicPaintVersion and for layer.type === 'physic-paint' draws the stored PNG dataUrl via HTMLImageElement onto the preview canvas.
  implication: App-side preview/playback/export path is designed to display stored rendered pixels, not reconstruct strokes. If playback/render-to-canvas looks like simple pencil, the likely defect is in the producer/capture path that creates those PNG frames, or in first-frame image loading timing, not in basic preview compositing.
- timestamp: 2026-06-09T12:05:45Z
  checked: PhysicsPaintStudio.applyCanvas/applyPlayCanvas, AnimationPlayer.tick, EfxPaintEngine.exportCompositeCanvas/renderPartialStrokes/render loop
  found: applyCanvas captures engine.exportCompositeCanvas(), which combines dryCanvas + displayCanvas. applyPlayCanvas drives AnimationPlayer; every frame is generated by engine.renderPartialStrokes() and then captured with exportCompositeCanvas(). The live studio render loop also draws queued stroke outline previews and cursor, but exportCompositeCanvas itself only composites dry/display canvases. AnimationPlayer explicitly sets animation mode and bypasses normal render loop while it controls frames.
  implication: Still apply-canvas likely preserves current visible paint pixels, but play-canvas/load animation depends entirely on renderPartialStrokes parity with the engine's normal paint finalization/rendering code.
- timestamp: 2026-06-09T12:07:45Z
  checked: EfxPaintEngine.redrawAll/loadProjectData and app physics paint tests
  found: redrawAll renders each serialized stroke with renderPaintStroke, replays diffusionFrames, and force-dries after each stroke. loadProjectData restores paperGrain/emboss/wetPaper and calls redrawAll synchronously. App tests validate payload storage/routing only; no tests cover pixel parity between AnimationPlayer/renderPartialStrokes and final studio rendering. types/physicPaint.test examples omit editableState even though current validator requires it, suggesting tests may be stale unless another compatibility path exists.
  implication: Need a targeted hypothesis test around renderPartialStrokes vs renderAllStrokes/exportCompositeCanvas parity; current tests do not protect against this visual regression.
- timestamp: 2026-06-09T12:08:45Z
  checked: EfxPaintEngine constructor/settings and render-to-canvas searches
  found: Engine defaults to physicsMode 'local', localSpreadStrength 50, antiAlias 0. renderPartialStrokes currently renders direct renderPaintStroke + optional replayDiffusion + unconditional forceDryAll. applyFinalizedStroke has additional behavior: prepareWetLayerForStroke before paint, antiAlias feathering, savedWet/lastStrokeMask accumulation, localFluidPhysicsStep when physicsMode is local, and preserves wet/natural drying in local mode instead of always force-drying. render-to-canvas/applyPlayCanvas captures AnimationPlayer frames from renderPartialStrokes.
  implication: Concrete candidate root cause is missing local physics/antiAlias/savedWet behavior in renderPartialStrokes, which would make animation/play-canvas appear like plain stroke rendering.

- timestamp: 2026-06-09T12:15:00Z
  checked: Full packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, supporting types/drying/paint/compositor/AnimationPlayer files, and project skill directories
  found: No .claude/.agents skill indexes exist in this checkout. EfxPaintEngine has four separate paint-application paths: applyFinalizedStroke uses prepareWetLayerForStroke + renderPaintStroke + featherWetEdges + savedWet/lastStrokeMask accumulation + localFluidPhysicsStep + local-mode wet preservation, but renderPartialStrokes/redrawAll/replayAnimated duplicate only direct renderPaintStroke plus unconditional forceDryAll. AnimationPlayer.stop and frame capture use those replay paths.
  implication: Root cause is confirmed as a render path divergence; minimal fix is to replace replay duplicates with the same finalized-stroke application helper and explicitly composite the wet layer for synchronous captures.

## Resolution

root_cause: EfxPaintEngine replay/export paths (renderPartialStrokes, redrawAll, replayAnimated) duplicate a simplified stroke renderer that calls renderPaintStroke and then forceDryAll, while the actual studio stroke finalization path prepares/preserves the wet layer, applies antiAlias feathering, accumulates savedWet/lastStrokeMask, runs localFluidPhysicsStep, and composites the wet display layer. AnimationPlayer/apply-play-canvas captures frames from renderPartialStrokes, so captured PNG frames lose the local physics wet-layer appearance and look like simple pencil strokes.
fix: Updated EfxPaintEngine so display/export renders the visible wet layer before capture, renderPartialStrokes/redrawAll reset replay state through a shared helper, replay strokes through applyStrokeToEngine, preserve local-mode wet paint instead of force-drying replayed strokes, and removed the uncalled replayAnimated method that still contained the old simplified path.
verification: Passed `pnpm --filter @efxlab/efx-physic-paint check` and `pnpm --filter @efxlab/efx-physic-paint build`. Browser visual verification was not run because project instructions say not to start the server.
files_changed: [packages/efx-physic-paint/src/engine/EfxPaintEngine.ts, .planning/debug/physics-paint-render-mismatch.md]
