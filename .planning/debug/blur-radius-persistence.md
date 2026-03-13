---
status: diagnosed
trigger: "Blur adjustment layer radius not persisting correctly - user sets 1.0, saves, reopens, gets 0.3"
created: 2026-03-13T15:00:00Z
updated: 2026-03-13T15:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Rust MceLayerSource struct is missing `radius` field, and Rust MceLayer struct is missing `blur` field
test: Inspected Rust struct definitions in src-tauri/src/models/project.rs
expecting: Missing fields cause serde to silently drop the values during save roundtrip
next_action: Return diagnosis

## Symptoms

expected: User sets blur adjustment layer radius to 1.0, saves project, closes and reopens - radius should be 1.0
actual: Blur layer radius resets to 0.3 after save/reopen
errors: None
reproduction: Set blur adjustment layer radius to 1.0, save, close, reopen project
started: Discovered during UAT retest

## Eliminated

## Evidence

- timestamp: 2026-03-13T15:01:00Z
  checked: TypeScript serialization path (buildMceProject lines 126-128)
  found: Correctly writes `radius: layer.source.radius` for adjustment-blur layers
  implication: Frontend serialization is correct

- timestamp: 2026-03-13T15:01:30Z
  checked: TypeScript deserialization path (hydrateFromMce line 202)
  found: Uses `ml.source.radius ?? 0.3` -- fallback to 0.3 when radius is undefined
  implication: 0.3 is exactly the value user reports seeing; fallback is being triggered

- timestamp: 2026-03-13T15:02:00Z
  checked: Rust MceLayerSource struct (src-tauri/src/models/project.rs lines 82-141)
  found: NO `radius` field exists in the struct. Has all other source fields (density, size, intensity, count, speed, etc.) but radius was never added.
  implication: When serde deserializes the frontend JSON into this struct, the `radius` field is silently dropped

- timestamp: 2026-03-13T15:02:30Z
  checked: Rust MceLayer struct (src-tauri/src/models/project.rs lines 53-66)
  found: NO `blur` field exists in the struct (for per-layer blur)
  implication: Per-layer blur (UAT test 3) also fails for the same reason

- timestamp: 2026-03-13T15:03:00Z
  checked: serde configuration for deny_unknown_fields
  found: No deny_unknown_fields attribute anywhere -- serde silently ignores unknown fields by default
  implication: Save succeeds without error but silently drops radius and blur values

- timestamp: 2026-03-13T15:03:30Z
  checked: Save/Open roundtrip flow
  found: Frontend JSON -> Tauri IPC -> Rust deserializes into MceProject (drops radius/blur) -> Rust serializes to JSON (without radius/blur) -> writes to .mce file -> On open, reads .mce file (no radius/blur) -> Frontend deserializes with fallback `?? 0.3`
  implication: Data loss happens at the Rust serialization boundary during save

## Resolution

root_cause: The Rust `MceLayerSource` struct in `Application/src-tauri/src/models/project.rs` is missing a `radius: Option<f64>` field (with appropriate serde attributes). When the frontend sends JSON with `"radius": 1.0` for adjustment-blur layers, Rust's serde silently drops the unknown field during deserialization. The re-serialized JSON written to the .mce file has no radius field. On project open, the frontend's `hydrateFromMce` sees `undefined` for radius and applies the fallback default of 0.3. Same issue affects the per-layer `blur` field: `MceLayer` struct is also missing `blur: Option<f64>`.
fix:
verification:
files_changed: []
