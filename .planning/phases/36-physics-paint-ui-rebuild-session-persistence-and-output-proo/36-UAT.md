---
status: diagnosed
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
source: [36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md, 36-07-SUMMARY.md]
started: 2026-06-13T07:52:27Z
updated: 2026-06-13T08:34:35Z
---

## Current Test

[testing complete]

## Tests

### 1. Five-region Physics Paint layout
expected: Opening the standalone Physics Paint editor shows the rebuilt five-region UI: compact top bar, ordered left tool rail, central canvas, right settings panel, and bottom Roto/Play workflow strip. The old diagnostics/toolbar layout is not the main render path, and the UI looks polished against the Phase 36 spec.
result: pass

### 2. Top bar and right-panel paint controls
expected: Brush size, opacity, background, paper texture, and grain controls are visible and usable. Grain strength offers exactly `None`, `Soft`, `Med`, and `Hard`; the right panel supports color entry/palette controls, blend preview, and erase-only options when Erase is active.
result: pass

### 3. Left tool rail and local shortcuts
expected: The left rail shows the ordered Paint, Paint with physics, Erase, Undo, Clear frame, physics-last, physics-all, and Dry/freeze actions with bundled icons. Keyboard shortcuts only affect the Physics Paint studio when focus is inside that surface and do not trigger while typing in editable inputs.
result: pass

### 4. Roto/Play workflow strip and timeline lanes
expected: The bottom strip exposes `Roto canvas` and `Play canvas` modes, primary actions update for the active mode, Roto frames and Play range lanes are readable, and clicking the Play lane only inspects/positions the range rather than publishing or converting output.
result: issue
reported: "dans les specs on s'était dit que changer de tab entre roto canvas et play canvas faisait une conversion avec un dialog de confirmation, on avait parlé de ca au lieu de mettre des boutons de conversion ici : [screenshot] c'est pas tres UX je prefer les enlever"
severity: major

### 5. Onion preview and explicit conversion flows
expected: Onion-skin controls clamp to the supported range, previous/next frame overlays appear around the active frame, live preview suppresses onion overlays, and Play-to-Roto or clear actions require explicit confirmation before destructive changes happen.
result: issue
reported: "Onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay."
severity: major

### 6. Editable state save/load and frame sync
expected: Save state downloads editable Physics Paint JSON without rendered PNG output; loading valid saved state restores editable engine state, invalid JSON is rejected with the required error copy, and standalone frame navigation syncs the editor timeline to the requested frame without accepting malformed messages.
result: issue
reported: "Save state does not open an OS save dialog to choose where to save the file, while Load state does open the OS dialog."
severity: major

### 7. Preview, Save play, and dev proof export
expected: Play preview remains preview-only until `Save play`; `Save play` publishes the selected range, keeps the standalone window open, and shows a saved range summary. Dev export is gated to valid rendered frames and produces inspectable PNG/manifest proof metadata without using a headless replay path.
result: issue
reported: "Play works, but Save play ends with a yellow box/overlay bug. After closing and reopening EFX Physics, all edits are lost and the studio reopens in the Roto canvas tab instead of the Play canvas tab."
severity: blocker

## Summary

total: 7
passed: 3
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The bottom strip should let users switch between Roto canvas and Play canvas in the agreed UX, with conversion happening via tab switch plus confirmation dialog rather than separate conversion buttons."
  status: failed
  reason: "User reported: dans les specs on s'était dit que changer de tab entre roto canvas et play canvas faisait une conversion avec un dialog de confirmation, on avait parlé de ca au lieu de mettre des boutons de conversion ici : [screenshot] c'est pas tres UX je prefer les enlever"
  severity: major
  test: 4
  root_cause: "Plan 06 implemented conversion as separate bottom-strip action buttons and wired tab clicks to only set workflow mode, while the canonical Phase 36 context/discussion specified conversion through Roto/Play tab switching with destructive confirmation."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx"
      issue: "Renders separate Convert Play to Roto and Convert Roto to Play buttons; Roto/Play tabs call onModeChange directly and bypass conversion confirmation."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "Passes onModeChange={setWorkflowMode}, so tab switching never invokes the existing conversion callbacks or confirmation dialog flow."
    - path: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts"
      issue: "Source-contract tests assert the wrong UX by requiring separate conversion buttons."
  missing:
    - "Remove separate conversion buttons from the workflow strip."
    - "Route Roto/Play tab transitions through guarded confirmation and conversion callbacks when conversion is destructive or required."
    - "Update workflow strip tests to assert tab-driven conversion confirmation and lane-click inspection-only behavior."
  debug_session: ".planning/debug/phase-36-uat-gap-test-4.md"

- truth: "Onion-skin controls should update functional previous/next frame overlays on the canvas when relevant frames exist, and live preview should suppress those overlays."
  status: failed
  reason: "User reported: Onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay."
  severity: major
  test: 5
  root_cause: "Onion controls update local Studio state, but buildOnionPreviewFrames usually has no usable Roto preview source because it reads persisted rendered frames/latest Play frames instead of the standalone editor's per-frame editable Roto states or local rendered snapshots."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "buildOnionPreviewFrames reads physicPaintStore rendered frames and latestPlayFrames, not adjacent rotoFrameStatesRef snapshots; overlay renders only when onionPreviewFrames is non-empty."
    - path: "app/src/components/physic-paint/PhysicsPaintRightPanel.tsx"
      issue: "Controls call onOnionChange correctly, but they are wired to state with no functional preview-frame source in the normal Roto workflow."
    - path: "app/src/lib/physicPaintBridge.ts"
      issue: "Launch context passes only the current layer editable state, not neighboring rendered frames or per-frame editable states needed for previous/next overlays."
  missing:
    - "Provide a real preview-frame source for standalone Roto onion overlays, either via local rendered snapshot cache, neighboring launch context frames, or offscreen render of adjacent editable states."
    - "Update saveRotoFrame and/or frame navigation so adjacent Roto frames become available to the canvas overlay immediately in the standalone window."
    - "Add regression coverage for previous/next/count onion overlays and suppression while preview is playing."
  debug_session: ".planning/debug/phase-36-uat-gap-test-5.md"

- truth: "Save state should open an OS save dialog so the user can choose where to save the editable Physics Paint JSON, matching the explicit OS dialog behavior used by Load state."
  status: failed
  reason: "User reported: Save state does not open an OS save dialog to choose where to save the file, while Load state does open the OS dialog."
  severity: major
  test: 6
  root_cause: "The active rebuilt Studio save-state path uses the browser Blob/anchor download helper with no adapter, while the previous toolbar had a Tauri dialog.save/writeTextFile implementation that is no longer used by the Phase 36 UI path."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "saveEditableState calls downloadPhysicsPaintState(engine.save()) without a native/Tauri save adapter."
    - path: "app/src/components/physic-paint/physicsPaintSessionFile.ts"
      issue: "Default download helper creates a Blob and anchor.download click, which does not open an OS save dialog."
    - path: "app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx"
      issue: "Legacy toolbar contains the missing Tauri dialog.save/writeTextFile pattern, but it is not part of the active rebuilt Studio render path."
  missing:
    - "Add a Tauri-capable editable-state save adapter that calls plugin-dialog.save and plugin-fs.writeTextFile with JSON filters and clean cancel behavior."
    - "Wire PhysicsPaintStudio.saveEditableState to use the native adapter in Tauri while preserving browser fallback."
    - "Add tests for native save, cancel behavior, browser fallback, and continued exclusion of rendered PNG output from editable JSON."
  debug_session: ".planning/debug/phase-36-uat-gap-test-6.md"

- truth: "Save play should publish the selected range without leaving a yellow box/overlay artifact, persist the edited Play canvas output, and reopen the standalone studio in the Play canvas context when that output is reloaded."
  status: failed
  reason: "User reported: Play works, but Save play ends with a yellow box/overlay bug. After closing and reopening EFX Physics, all edits are lost and the studio reopens in the Roto canvas tab instead of the Play canvas tab."
  severity: blocker
  test: 7
  root_cause: "Save play publishes rendered PNG frames plus one generic editableState but does not persist active workflow mode, Play range, latest Play frame/source metadata, or Play-specific editable source context; on relaunch the Studio hardcodes workflowMode to roto. The yellow overlay comes from latestPlayFrames being reused as onion preview frames after Save play."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      issue: "workflowMode initializes to roto unconditionally; savePlay sets latestPlayFrames and buildOnionPreviewFrames can render them as yellow/orange onion overlays after publish."
    - path: "app/src/lib/physicPaintBridge.ts"
      issue: "createPhysicPaintLaunchContext includes editableState only, with no persisted workflow mode or Play range/source metadata."
    - path: "app/src/stores/physicPaintStore.ts"
      issue: "applySequence stores rendered frames and generic editable state but no Play canvas mode/range/source metadata for project serialization or relaunch."
    - path: "app/src/types/physicPaint.ts"
      issue: "PhysicPaintLaunchContext and serialized output types lack workflow mode and Play range metadata fields."
    - path: "app/src-tauri/src/lib.rs"
      issue: "Native PhysicsPaintLaunchContext/URL path omits workflow mode/range fields, so future launch-context parity must be updated there too."
  missing:
    - "Persist Physics Paint Play source metadata: workflow mode, play start frame/count, and editable Play source association alongside frames/editable_state."
    - "Hydrate Play metadata from project data and include it in createPhysicPaintLaunchContext and the Tauri launch context."
    - "Initialize PhysicsPaintStudio workflow mode and frame range from launch context instead of hardcoded roto/defaults."
    - "Suppress or restrict onion overlay rendering after Save play so latestPlayFrames do not leave a yellow overlay artifact."
    - "Add regression tests for Save play persistence, relaunch in Play mode, Play range restoration, and no post-save onion/yellow overlay."
  debug_session: ".planning/debug/phase-36-uat-gap-test-7.md"
