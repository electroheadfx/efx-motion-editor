---
status: investigating
trigger: "BPM Persistence Lost on Save/Reload - User sets BPM to 93.8 on an audio track, saves project, reopens it - BPM is zero/lost"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Rust MceAudioTrack struct is missing BPM fields, causing serde to silently drop them during save
test: Compared TS MceAudioTrack interface fields with Rust MceAudioTrack struct fields
expecting: Mismatch between TS and Rust type definitions
next_action: Report root cause

## Symptoms

expected: BPM value (93.8), beat offset, beat markers, and show_beat_markers persist across save/load
actual: BPM is zero/lost after save and reopen
errors: No error messages - silent data loss
reproduction: Set BPM to 93.8 on audio track, save project, reopen - BPM is gone
started: New feature, likely never worked for persistence

## Eliminated

## Evidence

- timestamp: 2026-03-23T00:01:00Z
  checked: TypeScript MceAudioTrack interface in Application/src/types/audio.ts
  found: TS interface has bpm?, beat_offset_frames?, beat_markers?, show_beat_markers? (lines 55-58)
  implication: Frontend correctly includes BPM fields in the JSON sent to Rust

- timestamp: 2026-03-23T00:02:00Z
  checked: Rust MceAudioTrack struct in Application/src-tauri/src/models/project.rs (lines 29-52)
  found: Rust struct is MISSING bpm, beat_offset_frames, beat_markers, show_beat_markers, and audio_asset_id fields
  implication: serde silently drops unknown fields during deserialization. When save_project serializes back to JSON, BPM fields are gone.

- timestamp: 2026-03-23T00:03:00Z
  checked: project_io.rs save_project and open_project (lines 23-49)
  found: save_project serializes MceProject -> JSON via serde_json::to_string_pretty, then writes. open_project reads JSON -> deserializes via serde_json::from_str into MceProject. Both go through the Rust structs.
  implication: The full round-trip is: Frontend JSON -> Rust struct (BPM dropped) -> JSON on disk (no BPM) -> Rust struct -> Frontend (BPM defaults to null/0)

- timestamp: 2026-03-23T00:04:00Z
  checked: Frontend buildMceProject serialization (projectStore.ts lines 219-245)
  found: Correctly includes bpm, beat_offset_frames, beat_markers, show_beat_markers via conditional spread
  implication: Frontend serialization is correct - the problem is the Rust intermediary

## Resolution

root_cause: The Rust `MceAudioTrack` struct in `Application/src-tauri/src/models/project.rs` (lines 29-52) is missing all BPM-related fields (`bpm`, `beat_offset_frames`, `beat_markers`, `show_beat_markers`) and `audio_asset_id`. Since save/load goes through Rust via Tauri IPC, serde silently drops these fields during deserialization. The saved .mce JSON file never contains BPM data.
fix:
verification:
files_changed: []
