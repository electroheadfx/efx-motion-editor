---
status: diagnosed
trigger: "Investigate the Phase 36.10 UAT gap: saving current paint or changing frame with auto-save sometimes causes a big UI slowdown/blocky endless-loop-like re-render."
created: 2026-06-27T00:00:00Z
updated: 2026-06-27T18:54:52Z
---

## Current Focus

hypothesis: "Save/auto-save blocks because Roto save recomputes output from stroke data and repeatedly flips background/load state instead of reusing the current visible painted image/cache."
test: "Trace save-current and frame-change auto-save through snapshotCurrentRotoFrame, flushRotoFrame, buildRotoOutputFrame, engine export, store mutation, and project dirty wiring."
expecting: "If true, one save will call engine.save/setBgMode/export/load paths that replay all strokes multiple times and then notify global preview/project auto-save state."
next_action: "Plan fixes from the diagnosed UAT gap."

## Symptoms

expected: "Saving current paint or changing frame with auto-save should persist without visible UI slowdown and should reuse the actual image just painted/cache when available."
actual: "Saving current paint or changing frame with auto-save sometimes causes a big UI slowdown/blocky endless-loop-like re-render; after cache renders once everything is fast."
errors: "No explicit error message reported. Performance/render-loop-like slowdown."
reproduction: "Paint with Physics Paint/Roto, save current paint or change frame triggering auto-save; observe first save/cache slow, subsequent cached renders fast."
started: "Phase 36.10 UAT gap."

## Eliminated

- The steady-state cached preview/playback path is fast once rendered frames exist; the slow path is first save/save-on-leave cache creation.
- The issue is not package dependency setup; it is visible in the user's running app.

## Evidence

- `PhysicsPaintStudio.tsx` `saveRotoFrame` snapshots the current frame, marks it dirty, and calls `flushRotoFrame(..., { force: true })`.
- `requestRotoFrameNavigation` also snapshots and then queues a forced save before navigation when the current frame is dirty.
- `flushRotoFrame` calls `engine.save()`, may `engine.load(editableState)` for non-current frames, resets background, builds both `renderedFrame` and `onionFrame`, sends an apply payload, updates launch-context cache, and notifies pending frame state.
- `buildRotoOutputFrame` and `buildRotoOnionPreviewFrame` both call `exportTransparentStrokeCanvas`.
- `exportTransparentStrokeCanvas` calls `engine.save()`, `engine.setBgMode('transparent')`, `engine.exportCompositeCanvas()`, restores background with `engine.setBgMode(background)`, then `engine.load(state)`.
- `EfxPaintEngine.setBgMode` and `EfxPaintEngine.loadProjectData` both replay strokes via `redrawAll`; `exportCompositeCanvas` also flushes pending strokes and renders the visible wet layer.
- `physicPaintStore.applyCanvas` notifies visual changes; `projectStore.ts` wires physics paint store changes to project dirty/auto-save.

## Resolution

root_cause: "Roto save/frame-change auto-save forces a fresh export render instead of reusing the current painted canvas/cache. saveRotoFrame and requestRotoFrameNavigation call snapshotCurrentRotoFrame, then flushRotoFrame(force: true); flushRotoFrame calls engine.save(), may engine.load() another frame, resets background, calls buildRotoOutputFrame and buildRotoOnionPreviewFrame, and both helpers call exportTransparentStrokeCanvas. exportTransparentStrokeCanvas calls engine.save(), setBgMode('transparent'), exportCompositeCanvas(), setBgMode(previous), and engine.load(state). setBgMode and engine.load both replay all strokes via redrawAll, so a single save can replay strokes multiple times and mutate physicPaintStore, whose version marks the project dirty and triggers preview/auto-save work."
fix: "Capture and reuse the current visible/stroke-only rendered image for Save current and save-on-leave when the edited frame is already active; avoid setBgMode/load round-trips and duplicate output/onion renders during one Roto save."
verification: "Add performance/regression coverage proving one Roto save does not replay strokes more than once and does not trigger repeated visual-change loops."
files_changed: []
