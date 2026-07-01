---
status: investigating
trigger: "Diagnose the Phase 36.12 UAT blocker in this worktree. Do not edit files. We need root causes and concrete artifacts for the UAT gap, not a fix."
created: 2026-06-30T00:00:00Z
updated: 2026-06-30T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: initial diagnosis only; likely state-management/data-contract gaps across interpolation session, UI settings, persistence, and playback/export source lists
test: read relevant implementation and tests, trace functions and line numbers without modifying source
expecting: identify exact functions/lines where generated-frame keys, real-key preservation, settings, serialization, and preview/export paths diverge
next_action: read phase UAT/spec and relevant physics paint source files completely enough to trace blocker symptoms

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: generated interpolation preserves real key layout, disabling restores original layout, mode selection is visible and functional, settings persist across layer reopen, generated frames appear in EFX Motion preview/play/export and EFX Paint playback
actual: interpolation placement expands/moves real keys incorrectly; disable does not restore original key layout; mode selection is not visible/functional; settings are lost when reopening layer; generated frames missing from EFX Motion preview/play/export after closing EFX Paint; EFX Paint playback skips generated frames
errors: none reported
reproduction: Phase 36.12 UAT Setup A and B in existing UAT file
started: Phase 36.12 generated interpolation implementation

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-30T00:00:00Z
  checked: physicsPaintWorkflowState real-key expansion and span generation
  found: getExpandedRotoRealKeyFrames maps real source keys to shifted display frames using inBetweenCount plus preserved source gaps; getRotoInterpolationSpanFrames generates connector frames from shifted display keys while carrying original sourceFrom/sourceTo.
  implication: UI/store have a dual-coordinate model (source frame vs expanded display frame) that can move real keys if cache regeneration writes expanded frames back to storage.
- timestamp: 2026-06-30T00:00:00Z
  checked: physicPaintStore interpolation regeneration
  found: _regenerateGeneratedRotoCache deletes/moves real-key frames from sourceFrame to expanded display frame, stores reverse mapping only by expanded frame, and always renders blended frames; disabling collapses through _collapseInterpolatedRealKeySpacing.
  implication: interpolation is implemented as destructive cache/keyframe remapping rather than non-destructive display/materialized generated frames, explaining moved keys and unreliable restoration.
- timestamp: 2026-06-30T00:00:00Z
  checked: mode selection UI and normalization
  found: WorkflowStrip renders only checkbox and count; Studio and store normalization force mode:'blend'; renderer always calls renderBlendedRotoInterpolationFrame.
  implication: duplicate/hold mode is not selectable/functional despite type support.
- timestamp: 2026-06-30T00:00:00Z
  checked: persistence and launch hydration paths
  found: toMceOutputs serializes roto_interpolation_settings and metadata; loadFromMceOutputs reloads settings without regenerating generated cache; createPhysicPaintLaunchContext includes settings; Studio hydration only regenerates when context.rotoInterpolationSettings exists but depends on persisted generated frames/real key metadata.
  implication: persistence has partial schema support but no robust reopen-time regeneration contract from original real keys.
- timestamp: 2026-06-30T00:00:00Z
  checked: playback/preview/export source lists
  found: RotoSession playbackFrameNumbers and Studio getRotoCachedPlaybackFrames use only real keys; parent preview/export use physicPaintStore.getRotoFrame for exact timeline frame, but close/save path only sends apply-canvas real-key payload, not interpolation settings/cache publication payload.
  implication: EFX Paint playback skips generated frames; parent preview/export only sees generated frames if already materialized in store, not reliably after close/reopen.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Phase 36.12 implemented generated interpolation by mutating stored real-key cache coordinates and partial local/store state, while UI/settings/persistence/playback/export still use real-key-only or mode-forced paths. The system lacks a non-destructive source-key + generated-render cache contract shared by EFX Paint, .mce serialization, launch hydration, playback, preview, and export.
fix: diagnosis-only; no fix applied
verification: source trace only; no files modified
files_changed: []
