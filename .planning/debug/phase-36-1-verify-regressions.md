---
status: resolved
trigger: |-
  verify phase 36.1
  its crazy anti-ux and buggy [Image #3]
  - roto/play paint are not persistant in project, when I save, close and re-open no markers on physic paint layer in efx-motion app
  - The buttons are crazy it show Roto paint where Iam on a Play paint, the roto paint should not show ! a minimun intelligence in ui is needed, why show all these buttons, I need context buttons, and the buttons show are wrong because under a play paint I should to delete the play !!
created: 2026-06-14
updated: 2026-06-14T00:00:00Z
---

# Debug Session: phase-36-1-verify-regressions

## Symptoms

### Expected behavior
- Roto/Play paint script markers must persist in the saved project; after save, close, and reopen, physics paint layer markers should still appear in the EFX Motion timeline.
- Physics Paint layer properties should show context-aware actions based on the active frame/sublayer.
- When the current frame is inside a Play Paint range, the UI should not show a primary Roto Paint action.
- When the current frame is inside a Play Paint range, the relevant destructive action should be Delete Play.
- The layer properties should avoid showing all Roto/Play actions at once when only one context is relevant.

### Actual behavior
- After saving, closing, and reopening the project, Roto/Play paint markers are missing on the Physics Paint layer in EFX Motion.
- Screenshot shows both Roto paint and Play paint buttons visible while current frame is on a Play Paint range.
- Screenshot shows Delete Roto and Delete Play both visible, with Delete Play disabled even though the current context is expected to be Play Paint.

### Error messages
None reported.

### Timeline
Reported during verify phase 36.1 on 2026-06-14 after prior triage fixes.

### Reproduction
1. Create or save Roto/Play paint content on a Physics Paint layer.
2. Save the project.
3. Close and reopen the project.
4. Observe missing Roto/Play markers on the Physics Paint layer.
5. Move the playhead to a Play Paint range and inspect Physics Paint layer properties.
6. Observe all actions shown instead of context-aware actions, and Delete Play disabled/wrong for the context.

### Screenshot evidence
- /Users/lmarques/.claude/image-cache/6eeebe24-0d72-4a02-9178-15ae5aababd7/3.png

## Current Focus

hypothesis: Confirmed root causes are (1) backend/TS project schemas omit serialized Play metadata, dropping play_script_ranges/workflow fields on project save, and (2) PhysicPaintProperties unconditionally renders both Roto/Play action sets instead of contextual actions.
test: Apply minimal schema + UI fixes, then run focused tests proving Play metadata round-trips through Rust project I/O, frontend project types include the metadata, store/timeline hydration still works, and properties source contract requires contextual actions.
expecting: After the fix, serialized project output retains play_script_ranges/workflow metadata, hydrated fxTrackLayouts regain markers, and properties UI source no longer contains unconditional two-button Roto/Play and Delete rows.
next_action: Edit Rust/TS project schemas and tests to preserve Play metadata, then edit PhysicPaintProperties to render one contextual primary action and one contextual delete action.
reasoning_checkpoint:
  hypothesis: "Roto/Play marker loss after save/reopen happens because project_save deserializes the frontend payload into backend McePhysicPaintOutput, whose Rust struct omits play_script_ranges/workflow metadata; Serde drops those unknown fields before writing the .mce. The wrong button set happens because PhysicPaintProperties renders both Roto and Play primary buttons plus both delete buttons unconditionally, only disabling some based on activePlayRange."
  confirming_evidence:
    - "physicPaintStore.toMceOutputs writes play_script_ranges and workflow metadata, and projectStore.buildMceProject passes that to physic_paint_outputs."
    - "Rust app/src-tauri/src/models/project.rs McePhysicPaintOutput only has layer_id, frames, editable_state; project_save accepts MceProject and save_project serializes this typed struct, so omitted fields cannot be written."
    - "frameMap.fxTrackLayouts derives Timeline playScriptMarkers only from physicPaintStore.getPlayScriptRanges(); without hydrated play_script_ranges, TimelineRenderer has no marker data to draw."
    - "PhysicPaintProperties.tsx always renders grid rows containing both Roto paint/Play paint and Delete Roto/Delete Play labels regardless of active context."
  falsification_test: "If adding play_script_ranges/workflow fields to Rust/TS schemas and round-tripping through project_io still drops them, or if PhysicPaintProperties already conditionally omits irrelevant labels after edit, this hypothesis is wrong."
  fix_rationale: "Extending schemas preserves the existing frontend serialized metadata through Tauri save/open, restoring hydrated play ranges and timeline markers; conditional rendering removes irrelevant actions instead of displaying disabled/wrong Roto controls in Play context."
  blind_spots: "The screenshot could not be directly read due permission, so visual verification relies on textual report and source/test evidence; full app save/open must still be human-verified in the user's running Tauri environment."
tdd_checkpoint: 

## Evidence

- timestamp: 2026-06-14T00:00:01Z
  checked: .planning/debug/knowledge-base.md
  found: Only resolved entry is keyframe-label-z-index-overlap with patterns around z-index, pointer events, keyframe labels, and timeline hit-testing; no 2+ keyword overlap with Roto/Play/Physics Paint marker persistence or context action symptoms.
  implication: No known-pattern candidate to test first; proceed with fresh investigation.
- timestamp: 2026-06-14T00:00:02Z
  checked: /Users/lmarques/.claude/image-cache/6eeebe24-0d72-4a02-9178-15ae5aababd7/3.png
  found: Read tool requested permission that is not currently granted, so the screenshot contents are not directly observable from this session.
  implication: Continue from textual symptom evidence and code inspection; do not rely on unverified screenshot details beyond the debug file notes.
- timestamp: 2026-06-14T00:00:03Z
  checked: Grep for Physics/Roto/Play Paint identifiers
  found: app/src/components/sidebar/PhysicPaintProperties.tsx contains Roto paint, Play paint, Delete Roto, and Delete Play button labels; app/src/stores/physicPaintStore.ts and app/src/types/physicPaint.ts appear to own physics paint data; app/src/stores/projectStore.ts references physics paint and likely participates in persistence.
  implication: These files are the primary code paths to inspect for context-aware action rendering and save/load marker persistence.
- timestamp: 2026-06-14T00:00:04Z
  checked: app/src/components/sidebar/PhysicPaintProperties.tsx
  found: The properties panel always renders a two-column primary row with both Roto paint and Play paint buttons and a two-column delete row with both Delete Roto and Delete Play. On a Play range it disables Roto and enables Delete Play only if activePlayRange is found, but it never hides the irrelevant actions.
  implication: The UI symptom about anti-UX/all buttons shown is directly explained by unconditional rendering; context-aware UI needs conditional rendering rather than disabled irrelevant buttons.
- timestamp: 2026-06-14T00:00:05Z
  checked: app/src/stores/physicPaintStore.ts and app/src/stores/projectStore.ts
  found: physicPaintStore.toMceOutputs serializes layer_id, frames, editable_state, play_script_ranges, and workflow metadata; projectStore.buildMceProject writes physic_paint_outputs from toMceOutputs(); projectStore.hydrateFromMce calls physicPaintStore.loadFromMceOutputs(project.physic_paint_outputs).
  implication: The frontend store/projectStore path intends to persist markers/ranges; marker loss may be in schema/IPC or timeline rendering rather than this top-level build/hydrate wiring.
- timestamp: 2026-06-14T00:00:06Z
  checked: app/src/types/project.ts
  found: MceProject includes optional physic_paint_outputs, but McePhysicPaintOutput only types layer_id, frames, and editable_state; it omits play_script_ranges, workflow_mode, play_start_frame, play_frame_count, editable_source, and play_motion that the store serializes.
  implication: TypeScript schema is stale/incomplete and could hide contract drift; if backend schema matches this narrow type, marker/script metadata will be dropped on save.
- timestamp: 2026-06-14T00:00:07Z
  checked: TimelineRenderer and tests
  found: TimelineRenderer draws playScriptMarkers supplied by FxTrackLayout; TimelineRenderer.test proves saved Play ranges flow through fxTrackLayouts and renderer when store contains play ranges.
  implication: Timeline marker rendering works when store has play_script_ranges; the save/reopen missing-marker symptom points upstream to data not surviving persistence/hydration.
- timestamp: 2026-06-14T00:00:08Z
  checked: Grep for backend physic_paint_outputs/McePhysicPaintOutput
  found: Rust backend has app/src-tauri/src/models/project.rs defining McePhysicPaintOutput and project_io tests asserting only layer_id, frames, and editable_state; no backend references to play_script_ranges.
  implication: Strong evidence for schema truncation in the Tauri save/open path; read backend model to confirm exact fields.
- timestamp: 2026-06-14T00:00:09Z
  checked: app/src-tauri/src/models/project.rs and app/src-tauri/src/services/project_io.rs
  found: Rust McePhysicPaintOutput contains only layer_id, frames, and editable_state. project_save receives MceProject, so Serde deserializes the JS payload into this narrow struct; serde_json::to_string_pretty then writes only those fields. project_io roundtrip tests only assert frames/editable_state and do not include play_script_ranges/workflow metadata.
  implication: Confirmed mechanism for Play script/range metadata loss on save. Fields serialized by the frontend are dropped before the .mce is written, so loadFromMceOutputs receives no play_script_ranges and timeline markers/context cannot recover them.
- timestamp: 2026-06-14T00:00:10Z
  checked: app/src/lib/frameMap.ts and app/src/types/timeline.ts
  found: fxTrackLayouts subscribes to physicPaintVersion and maps primary physic-paint layer source.layerId through physicPaintStore.getPlayScriptRanges() into playScriptMarkers; TimelineRenderer draws only these supplied playScriptMarkers for physic-paint FX bars.
  implication: Missing play_script_ranges after save/reopen is sufficient to make markers disappear; there is no independent marker source to recover the saved Play ranges.

## Eliminated

## Resolution

root_cause: Backend and frontend project schemas for physic_paint_outputs were narrower than physicPaintStore.toMceOutputs(): they omitted play_script_ranges and workflow metadata. Because Tauri project_save deserializes the JS payload into the Rust MceProject/McePhysicPaintOutput struct before writing JSON, Serde dropped those unknown fields, so reopening hydrated no Play ranges and timeline/context UI had no marker data. Separately, PhysicPaintProperties rendered both Roto and Play action sets unconditionally, only disabling irrelevant controls, so Play context still showed Roto actions and both delete actions.
fix: Added Play script/workflow metadata fields to the Rust and TypeScript project schemas so Tauri save/open preserves play_script_ranges, workflow_mode, play_start_frame, play_frame_count, editable_source, and play_motion. Updated project I/O roundtrip coverage for Play metadata. Changed PhysicPaintProperties to render contextual actions: Play range shows only Play paint + Delete Play, Roto frame shows only Roto paint + Delete Roto, empty frame shows creation choices only.
verification: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" test --run src/components/sidebar/PhysicPaintProperties.test.ts src/lib/physicPaintBridge.test.ts src/stores/physicPaintStore.test.ts src/components/timeline/TimelineRenderer.test.ts` passed (61 tests). `cargo test --manifest-path "/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml" project_io --lib` passed (6 tests).
files_changed: app/src-tauri/src/models/project.rs; app/src-tauri/src/services/project_io.rs; app/src/types/project.ts; app/src/components/sidebar/PhysicPaintProperties.tsx; app/src/components/sidebar/PhysicPaintProperties.test.ts; .planning/debug/phase-36-1-verify-regressions.md
