---
phase: 16-audio-export-beat-sync
plan: 02
subsystem: audio
tags: [audio-export, offline-audio-context, ffmpeg, wav-muxing, export-ui]

# Dependency graph
requires:
  - phase: 16-audio-export-beat-sync
    provides: AudioTrack BPM fields, ExportSettings includeAudio, audiobuffer-to-wav dependency
  - phase: 15-audio-import-waveform
    provides: AudioTrack interface, audioStore, audioEngine with fade scheduling
provides:
  - OfflineAudioContext pre-render of mixed audio to WAV (renderMixedAudio)
  - FFmpeg audio muxing with codec-appropriate audio streams (pcm_s16le/AAC)
  - Audio WAV path IPC pipeline through Rust encode_video command
  - Include Audio checkbox in export FormatSelector
  - PNG export with WAV sidecar for NLE workflows
affects: [16-03, exportEngine, FormatSelector, exportStore]

# Tech tracking
tech-stack:
  added: []
  patterns: [OfflineAudioContext pre-render for export, FFmpeg audio muxing with container-dependent codecs]

key-files:
  created:
    - Application/src/lib/audioExportMixer.ts
  modified:
    - Application/src-tauri/src/services/ffmpeg.rs
    - Application/src-tauri/src/commands/export.rs
    - Application/src/lib/ipc.ts
    - Application/src/lib/exportEngine.ts
    - Application/src/components/export/FormatSelector.tsx

key-decisions:
  - "48kHz sample rate for OfflineAudioContext pre-render (professional video standard, no FFmpeg resampling)"
  - "0.5s padding on total samples to prevent cut-off at end of timeline"
  - "Audio pre-render failure is non-fatal: export continues without audio rather than aborting"
  - "WAV cleanup only for video exports; PNG export keeps audio_mix.wav alongside sequence"

patterns-established:
  - "Audio export: OfflineAudioContext renders all tracks to single stereo WAV, passed to FFmpeg via file path"
  - "Container-aware audio codec: ProRes uses pcm_s16le, H.264/AV1 use AAC at 192k"

requirements-completed: [BEAT-01]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 16 Plan 02: Audio Export Pipeline Summary

**OfflineAudioContext pre-render to WAV, FFmpeg audio muxing with container-specific codecs, Include Audio checkbox in export UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T13:48:40Z
- **Completed:** 2026-03-23T13:54:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built audioExportMixer.ts with OfflineAudioContext pre-rendering at 48kHz stereo, reusing audioEngine fade schedule logic
- Extended Rust FFmpeg encode_video with audio_path parameter: ProRes gets pcm_s16le, H.264/AV1 get AAC at 192k
- Integrated audio pre-render step into exportEngine between frame rendering and FFmpeg encoding
- Added Include Audio checkbox to FormatSelector that only appears when audio tracks exist
- Handles PNG export: WAV file stays alongside PNG sequence for NLE import workflows
- WAV temp file cleaned up after video encoding completes (Pitfall 8)

## Task Commits

Each task was committed atomically:

1. **Task 1: audioExportMixer module + Rust FFmpeg audio muxing extension** - `2f3ed7f` (feat)
2. **Task 2: Export engine integration + Include Audio UI checkbox** - `fd2cfe6` (feat)

## Files Created/Modified
- `Application/src/lib/audioExportMixer.ts` - OfflineAudioContext pre-render with fade scheduling mirroring audioEngine
- `Application/src-tauri/src/services/ffmpeg.rs` - encode_video extended with audio_path and container-aware audio codec selection
- `Application/src-tauri/src/commands/export.rs` - export_encode_video Tauri command extended with audio_path parameter
- `Application/src/lib/ipc.ts` - exportEncodeVideo IPC function extended with optional audioPath parameter
- `Application/src/lib/exportEngine.ts` - Audio pre-render step before FFmpeg, audioWavPath passed to encode, WAV cleanup
- `Application/src/components/export/FormatSelector.tsx` - Include Audio checkbox with PNG WAV hint

## Decisions Made
- Used 48kHz sample rate for OfflineAudioContext (professional video standard, avoids FFmpeg resampling artifacts)
- Added 0.5s padding to total samples to prevent audio cut-off at timeline end
- Audio pre-render failure is non-fatal: logs error but continues video export without audio
- WAV cleanup only for video exports; PNG export keeps audio_mix.wav alongside the sequence for DaVinci Resolve/Premiere Pro import

## Deviations from Plan

None - plan executed exactly as written. The exportStore includeAudio signal and setter were already added by Plan 01, so Task 2 only needed integration into exportEngine and FormatSelector.

## Issues Encountered
None

## Known Stubs
None - all implementations are complete and functional.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audio export pipeline complete: renderMixedAudio + FFmpeg muxing + UI checkbox
- Plan 03 (timeline beat markers, snap-to-beat, auto-arrange UI) can proceed independently
- All audio export functions ready for end-to-end testing with real audio files

## Self-Check: PASSED

- All 6 files verified present on disk
- Both task commits (2f3ed7f, fd2cfe6) verified in git log
- All 18 acceptance criteria content patterns verified

---
*Phase: 16-audio-export-beat-sync*
*Completed: 2026-03-23*
