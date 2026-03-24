---
status: diagnosed
phase: 16-audio-export-beat-sync
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md
started: 2026-03-23T14:10:00Z
updated: 2026-03-23T14:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. BPM Auto-Detection on Audio Import
expected: Import an audio file. After import, the AudioProperties sidebar panel should display the auto-detected BPM value for that track.
result: pass

### 2. Beat Markers Toggle in Timeline Toolbar
expected: With an audio track loaded, the timeline toolbar should show a Music note toggle button. Clicking it should toggle beat marker visibility on/off.
result: pass

### 3. Snap-to-Beat Toggle in Timeline Toolbar
expected: With an audio track loaded, the timeline toolbar should show a Magnet toggle button. Clicking it should toggle snap-to-beat mode on/off.
result: pass

### 4. Beat Marker Rendering on Timeline
expected: With beat markers toggled ON, amber vertical lines should appear on the timeline at beat positions. Downbeats (first beat of each bar) should appear brighter/thicker than regular beats.
result: pass

### 5. AudioProperties BPM Editing
expected: In the AudioProperties sidebar, you should be able to: manually edit the BPM value, use x2/÷2 buttons to double or halve BPM, adjust beat offset, and click Re-detect to re-run BPM detection. Changing BPM should update beat marker positions on the timeline.
result: pass

### 6. Auto-Arrange Key Photos to Beats
expected: In AudioProperties, there should be an auto-arrange section with a strategy selector (every beat / every 2 beats / every bar) and an Apply button. Clicking Apply should redistribute key photos to align with beat positions. This should be undoable (Cmd+Z reverts all photos back).
result: pass

### 7. Snap-to-Beat During Playhead Scrubbing
expected: With snap-to-beat (Magnet) enabled, scrubbing the playhead along the timeline should magnetically snap to nearby beat positions rather than moving freely frame-by-frame.
result: pass

### 8. Include Audio Checkbox in Export
expected: Open the export dialog. When audio tracks exist, an "Include Audio" checkbox should appear in the format settings. It should be checked by default.
result: pass

### 9. Audio Export with Video
expected: Export a video (H.264 or ProRes) with Include Audio checked and audio tracks loaded. The resulting video file should contain the mixed audio track (playable with sound in a video player).
result: issue
reported: "I selected audio, it doesn't work, I have infinite export, the video/audio is not exported I forced quit the app"
severity: blocker

### 10. PNG Export with WAV Sidecar
expected: Export as PNG sequence with Include Audio checked. The output folder should contain the PNG frames plus an audio_mix.wav file alongside them for NLE import.
result: issue
reported: "No work too and I can't cancel"
severity: blocker

### 11. BPM Persistence Across Save/Load
expected: Set BPM data on an audio track (either auto-detected or manually edited). Save the project. Close and reopen it. The BPM value, beat offset, and beat marker visibility state should be preserved.
result: issue
reported: "I create a BPM to 93,8, when I save and re-open the project the BPM is lost, init to zero"
severity: major

## Summary

total: 11
passed: 8
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Export a video with Include Audio checked produces a video file with mixed audio"
  status: failed
  reason: "User reported: I selected audio, it doesn't work, I have infinite export, the video/audio is not exported I forced quit the app"
  severity: blocker
  test: 9
  root_cause: "export_encode_video in export.rs is a synchronous Tauri command (pub fn) that blocks the main thread when calling FFmpeg via std::process::Command::output(). WebView cannot process IPC responses while main thread is blocked, causing infinite hang."
  artifacts:
    - path: "Application/src-tauri/src/commands/export.rs"
      issue: "export_encode_video is sync (pub fn) instead of async, blocks main thread"
    - path: "Application/src-tauri/src/services/ffmpeg.rs"
      issue: "encode_video uses blocking Command::new().output()"
    - path: "Application/src/lib/exportEngine.ts"
      issue: "No cancel checks during audio pre-render phase"
    - path: "Application/src/lib/audioExportMixer.ts"
      issue: "renderMixedAudio has no timeout or abort mechanism"
  missing:
    - "Make export_encode_video async with tokio::task::spawn_blocking"
    - "Add cancel checks before audio pre-render in exportEngine"
    - "Add timeout/abort wrapper around renderMixedAudio"
  debug_session: ".planning/debug/audio-export-infinite-hang.md"

- truth: "PNG export with Include Audio produces PNG frames plus audio_mix.wav sidecar"
  status: failed
  reason: "User reported: No work too and I can't cancel"
  severity: blocker
  test: 10
  root_cause: "Same root cause as Test 9 — shared renderMixedAudio() call in exportEngine.ts:190 hangs due to OfflineAudioContext with no cancel/timeout. Cancel mechanism only checked inside frame loop, not during audio pre-render phase."
  artifacts:
    - path: "Application/src/lib/exportEngine.ts"
      issue: "Cancel check missing after frame loop, before audio pre-render"
    - path: "Application/src/lib/audioExportMixer.ts"
      issue: "renderMixedAudio is monolithic non-cancellable promise"
  missing:
    - "Add cancel check before audio pre-render block"
    - "Wrap renderMixedAudio in Promise.race with timeout"
  debug_session: ".planning/debug/png-export-audio-hang.md"

- truth: "BPM value persists across save and reload of project"
  status: failed
  reason: "User reported: I create a BPM to 93,8, when I save and re-open the project the BPM is lost, init to zero"
  severity: major
  test: 11
  root_cause: "Rust MceAudioTrack struct in project.rs is missing all BPM fields (bpm, beat_offset_frames, beat_markers, show_beat_markers) and audio_asset_id. TypeScript types define them but serde silently drops unknown fields during Tauri IPC round-trip."
  artifacts:
    - path: "Application/src-tauri/src/models/project.rs"
      issue: "MceAudioTrack struct missing 5 fields: audio_asset_id, bpm, beat_offset_frames, beat_markers, show_beat_markers"
  missing:
    - "Add bpm, beat_offset_frames, beat_markers, show_beat_markers, audio_asset_id to Rust MceAudioTrack with serde defaults"
  debug_session: ".planning/debug/bpm-persistence-lost.md"
