---
status: investigating
trigger: "Investigate Phase 36 UAT gap test 5 in /Users/lmarques/Dev/efx-motion-editor. Context: User reported onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay. Read the UAT file `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-UAT.md`, relevant phase summaries/specs, and source files around PhysicsPaintStudio, PhysicsPaintRightPanel/WorkflowStrip, onion preview generation, and canvas overlay rendering. Do not edit files. Return a concise root-cause diagnosis with: root_cause, artifacts (paths + issue), and missing fix actions."
created: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: onion controls update local Physics Paint workflow state, but that state may not be consumed by the canvas overlay renderer
known_pattern_candidate: State Management / dual source of truth / stale render; knowledge base has no onion-specific match
test: trace producer/consumer paths for PhysicsPaintOnionState, generated preview frames, and overlay DOM/canvas rendering
expecting: confirm whether right-panel state is passed into preview generation and whether generated onion frames are rendered into the central canvas
next_action: read Phase 36 UI spec/summaries and source files for PhysicsPaintStudio, PhysicsPaintRightPanel, WorkflowStrip, workflow state, preview generation, and overlay rendering

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: onion-skin controls should affect the canvas overlay
actual: onion-skin controls UI is present but onion functionality does not work; changing controls does not affect the canvas overlay
errors: none reported
reproduction: Phase 36 UAT gap test 5; use onion-skin controls in Physics Paint UI and observe canvas overlay remains unchanged
started: Phase 36 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-13T00:00:00Z
  checked: Phase 36 UAT and UI spec
  found: UAT test 5 failed because onion controls are visible but do not affect canvas overlay; UI spec requires Roto canvas onion controls and previous/next rendered overlays with live preview suppression.
  implication: The bug is in Physics Paint standalone onion state/preview/rendering, not missing control UI.
- timestamp: 2026-06-13T00:00:00Z
  checked: PhysicsPaintRightPanel onion controls
  found: Right panel updates local PhysicsPaintOnionState via onOnionChange/setOnion; count clamps to 1..3 and controls are disabled only while playing.
  implication: The control event path exists; failure is downstream of state update.
- timestamp: 2026-06-13T00:00:00Z
  checked: PhysicsPaintStudio buildOnionPreviewFrames
  found: Preview frames are built only from physicPaintStore.getFrames(layerId) and latestPlayFrames; current unsaved per-frame editable states in rotoFrameStatesRef are never rendered/exported for onion preview, and saveRotoFrame only sends payload to the parent bridge rather than updating physicPaintStore locally.
  implication: In the standalone window, onionPreviewFrames is commonly empty unless rendered frames have already been pushed into the parent/global store or Save play populated latestPlayFrames.
- timestamp: 2026-06-13T00:00:00Z
  checked: Canvas overlay rendering in PhysicsPaintStudio and CSS
  found: Studio renders a canvas-region onion overlay only when onion.enabled and onionPreviewFrames.length > 0; otherwise no overlay DOM is mounted. The workflow strip also has a duplicate bottom-strip overlay from the same empty preview frames.
  implication: Changing onion enabled/previous/next/count can re-render state, but there are no rendered preview images to show, so the canvas overlay appears unchanged.
- timestamp: 2026-06-13T00:00:00Z
  checked: Main editor OnionSkinOverlay
  found: Existing canvas onion overlay renders from paintStore frames, unrelated to the standalone Physics Paint store/state.
  implication: Phase 36 Physics Paint onion controls are a separate state source and do not drive the established canvas onion overlay path.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Phase 36 wired onion controls to local PhysicsPaintStudio state, but the overlay image source is not connected to the standalone editor's actual per-frame editable content. buildOnionPreviewFrames only reads persisted rendered PNGs from physicPaintStore and latestPlayFrames, while Roto navigation stores unsaved editable states in rotoFrameStatesRef and saveRotoFrame does not seed the local preview source. Therefore onionPreviewFrames is empty in the normal Roto workflow, so the canvas-region overlay never mounts/changes when controls are adjusted.
fix: Diagnosis only; no edits requested.
verification: Static trace against UAT/spec and source files; no server run per project instruction and user requested no edits.
files_changed: []
