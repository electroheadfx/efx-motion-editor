---
status: diagnosed
trigger: "Per-layer blur on content layers not persisting after save/reopen"
created: 2026-03-13T15:00:00Z
updated: 2026-03-13T15:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Rust MceLayer struct missing `blur` field causes serde to silently drop it during save
test: Inspected Rust struct definition in src-tauri/src/models/project.rs
expecting: n/a - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: User selects content layer, sets blur via BLUR section in PropertiesPanel, saves project, reopens - blur setting preserved
actual: Blur works in-session but is not saved - after save/close/reopen the blur setting is gone
errors: None reported
reproduction: Select content layer, set blur, save, close, reopen - blur not preserved
started: Discovered during UAT retest (Phase 10)

## Eliminated

- hypothesis: Frontend store not persisting blur on Layer objects
  evidence: PropertiesPanel calls layerStore.updateLayer(id, { blur: val }) which routes to sequenceStore.updateLayer, which does {...l, ...updates} spread merge and calls markDirty(). Frontend path is correct.
  timestamp: 2026-03-13T15:02:00Z

- hypothesis: TypeScript serialization/deserialization logic wrong
  evidence: buildMceProject line 132 correctly serializes blur, hydrateFromMce line 207 correctly deserializes it. TS types (MceLayer and Layer) both have blur field. Frontend logic is correct.
  timestamp: 2026-03-13T15:03:00Z

## Evidence

- timestamp: 2026-03-13T15:00:00Z
  checked: buildMceProject() serialization of blur
  found: Line 132 serializes blur correctly - `...(layer.blur != null && layer.blur > 0 ? { blur: layer.blur } : {})`
  implication: Serialization logic looks correct IF layer.blur is set on the Layer object

- timestamp: 2026-03-13T15:00:00Z
  checked: hydrateFromMce() deserialization of blur
  found: Line 207 deserializes blur correctly - `...(ml.blur != null ? { blur: ml.blur } : {})`
  implication: Deserialization logic looks correct IF blur is in the MceLayer

- timestamp: 2026-03-13T15:00:00Z
  checked: MceLayer type definition (TypeScript)
  found: MceLayer has `blur?: number` field (project.ts line 49)
  implication: Frontend file format supports blur

- timestamp: 2026-03-13T15:00:00Z
  checked: Layer interface (TypeScript)
  found: Layer has `blur?: number` field (layer.ts line 38)
  implication: Frontend type supports blur

- timestamp: 2026-03-13T15:03:00Z
  checked: PropertiesPanel blur onChange handler
  found: Content layer blur at line 648 calls layerStore.updateLayer(selectedLayer.id, { blur: val }), which routes to sequenceStore.updateLayer (spread merge + markDirty)
  implication: Frontend update chain is correct

- timestamp: 2026-03-13T15:04:00Z
  checked: Rust MceLayer struct (src-tauri/src/models/project.rs lines 54-66)
  found: Rust MceLayer struct has NO `blur` field. Only has: id, name, layer_type, visible, opacity, blend_mode, transform, source, is_base, order
  implication: CRITICAL - serde silently drops the `blur` field when deserializing the JSON from frontend. When re-serializing to write the .mce file, blur is gone.

- timestamp: 2026-03-13T15:04:30Z
  checked: Rust MceLayerSource struct for `radius` field
  found: Rust MceLayerSource also has NO `radius` field (grep returned no matches)
  implication: This also explains UAT Test 2 (adjustment-blur radius not persisting) - same root cause pattern

- timestamp: 2026-03-13T15:04:45Z
  checked: serde deny_unknown_fields attribute
  found: NOT set on MceLayer - serde default behavior is to silently ignore unknown fields during deserialization
  implication: Confirms the silent-drop mechanism

## Resolution

root_cause: The Rust `MceLayer` struct in `Application/src-tauri/src/models/project.rs` is missing the `blur?: number` field that was added to the TypeScript `MceLayer` interface. When the frontend sends the project JSON to Rust for saving (via `project_save` IPC), serde deserializes it into the Rust struct and silently drops the `blur` field (since the struct has no corresponding field). The Rust backend then re-serializes the struct to JSON and writes it to the `.mce` file -- without the `blur` field. On reopen, `hydrateFromMce` reads the file and finds no `blur` value, so layers lose their blur settings.
fix:
verification:
files_changed: []
