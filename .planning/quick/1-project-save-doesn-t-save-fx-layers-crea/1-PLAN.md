---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src-tauri/src/models/project.rs
  - Application/src-tauri/src/services/project_io.rs
autonomous: true
must_haves:
  truths:
    - "FX sequences (kind='fx') survive save/open roundtrip with all parameters intact"
    - "FX sequence temporal range (in_frame/out_frame) persists across save/open"
    - "All generator and adjustment source fields (density, brightness, seed, etc.) persist across save/open"
    - "Existing content-only projects still open without errors (backward compat)"
  artifacts:
    - path: "Application/src-tauri/src/models/project.rs"
      provides: "Rust MceSequence and MceLayerSource with FX fields"
      contains: "kind"
  key_links:
    - from: "Application/src/stores/projectStore.ts (buildMceProject)"
      to: "Application/src-tauri/src/models/project.rs (MceSequence)"
      via: "Tauri IPC JSON serialization"
      pattern: "kind.*fx"
---

<objective>
Fix FX layer persistence: FX layers created in a project are lost on save/reopen because the Rust backend structs silently drop FX-specific JSON fields during serde deserialization.

Purpose: The Rust `MceSequence` struct is missing `kind`, `in_frame`, `out_frame`, and `visible` fields. The `MceLayerSource` struct is missing all generator/adjustment fields (density, brightness, seed, count, etc.). When TypeScript sends the full JSON to Rust for saving, serde silently ignores unknown fields, so the saved .mce file contains no FX data. On reopen, FX sequences appear as empty content sequences or are missing entirely.

Output: Updated Rust models that round-trip all FX data; updated Rust test proving round-trip.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src-tauri/src/models/project.rs
@Application/src-tauri/src/services/project_io.rs
@Application/src/types/project.ts
@Application/src/types/layer.ts
@Application/src/stores/projectStore.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add FX fields to Rust MceSequence and MceLayerSource structs</name>
  <files>Application/src-tauri/src/models/project.rs</files>
  <action>
Update the Rust `MceSequence` struct to include the FX-specific fields that the TypeScript frontend serializes. All new fields must be `Option<T>` with `#[serde(default, skip_serializing_if = "Option::is_none")]` for backward compatibility with older .mce files:

1. Add to `MceSequence`:
   - `kind: Option<String>` -- "content" or "fx" (None defaults to "content" on frontend)
   - `in_frame: Option<u32>` -- FX sequence start frame
   - `out_frame: Option<u32>` -- FX sequence end frame
   - `visible: Option<bool>` -- FX sequence visibility (None = visible)

2. Update `MceLayerSource` to add all FX generator/adjustment fields as `Option` types with `skip_serializing_if`:
   - Generator common: `lock_seed: Option<bool>`, `seed: Option<u32>`
   - Generator-grain: `density: Option<f64>`, `size: Option<f64>`, `intensity: Option<f64>`
   - Generator-particles: `count: Option<u32>`, `speed: Option<f64>`, `size_min: Option<f64>`, `size_max: Option<f64>`
   - Generator-lines: `thickness: Option<f64>`, `length_min: Option<f64>`, `length_max: Option<f64>`
   (count is shared with particles -- already listed)
   - Generator-vignette: `softness: Option<f64>`
   (size and intensity shared with grain -- already listed)
   - Adjustment-color-grade: `brightness: Option<f64>`, `contrast: Option<f64>`, `saturation: Option<f64>`, `hue: Option<f64>`, `fade: Option<f64>`, `tint_color: Option<String>`, `preset: Option<String>`, `fade_blend: Option<String>`

Every new field MUST use:
```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
```

This ensures:
- Old .mce files without these fields deserialize fine (default = None)
- Saved .mce files don't include null values for content layers
- FX data round-trips correctly through Rust serde
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application/src-tauri && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>Rust MceSequence has kind/in_frame/out_frame/visible fields. MceLayerSource has all FX generator and adjustment fields. cargo check passes with no errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add round-trip test proving FX data survives save/open</name>
  <files>Application/src-tauri/src/services/project_io.rs</files>
  <action>
Add a new test `test_fx_sequence_roundtrip` to the existing `mod tests` in `project_io.rs`. The test should:

1. Create an `MceProject` with version 4 containing:
   - One content sequence (kind: Some("content".into())) with a base layer
   - One FX sequence (kind: Some("fx".into())) with:
     - `in_frame: Some(0)`, `out_frame: Some(100)`, `visible: None`
     - A generator-grain layer with source fields: `density: Some(0.3)`, `size: Some(1.0)`, `intensity: Some(0.5)`, `lock_seed: Some(true)`, `seed: Some(42)`
     - blend_mode: "screen"
   - One FX sequence with an adjustment-color-grade layer:
     - `brightness: Some(0.1)`, `contrast: Some(-0.2)`, `preset: Some("cinematic".into())`, `tint_color: Some("#D4A574".into())`

2. Save to a temp .mce file using `save_project()`
3. Open with `open_project()`
4. Assert:
   - Loaded project has 3 sequences
   - Second sequence has `kind == Some("fx")`, `in_frame == Some(0)`, `out_frame == Some(100)`
   - Grain layer source has `density == Some(0.3)`, `lock_seed == Some(true)`, `seed == Some(42)`
   - Color grade layer source has `brightness == Some(0.1)`, `preset == Some("cinematic")`
   - Content sequence has `kind == Some("content")` (or None, both acceptable)

Also add a backward compat test `test_v3_project_without_fx_fields_opens` that:
1. Creates a raw JSON string mimicking a v3 .mce file (no kind, no in_frame/out_frame, no FX source fields)
2. Writes it to a temp file
3. Opens with `open_project()`
4. Asserts it loads successfully with kind=None and all FX fields=None
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application/src-tauri && cargo test --lib -- project_io::tests 2>&1 | tail -15</automated>
  </verify>
  <done>Both new tests pass: FX data round-trips through save/open, and old projects without FX fields still load successfully.</done>
</task>

</tasks>

<verification>
1. `cargo check` passes (no compile errors)
2. `cargo test --lib -- project_io::tests` -- all tests pass including new round-trip tests
3. Existing tests (`test_save_and_open_roundtrip`, `test_atomic_write_creates_no_temp_file`) still pass
</verification>

<success_criteria>
- FX sequences with kind="fx", in_frame, out_frame survive Rust serde round-trip
- All FX layer source fields (generator-grain, generator-particles, generator-lines, generator-dots, generator-vignette, adjustment-color-grade) survive round-trip
- Backward compatibility: v1/v2/v3 .mce files without FX fields still open without errors
- All existing Rust tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/1-project-save-doesn-t-save-fx-layers-crea/1-SUMMARY.md`
</output>
