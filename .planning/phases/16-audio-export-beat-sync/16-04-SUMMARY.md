---
phase: 16-audio-export-beat-sync
plan: 04
subsystem: export
tags: [async-export, spawn-blocking, abort-signal, cancel, ffmpeg, audio-render, timeout]

# Dependency graph
requires:
  - phase: 16-audio-export-beat-sync
    provides: Audio export mixer (renderMixedAudio), FFmpeg audio muxing, exportEngine audio pre-render block
provides:
  - Non-blocking FFmpeg encoding via tokio::task::spawn_blocking
  - Cancellable audio pre-render with AbortSignal and 60s timeout safety net
  - Cancel check gate before audio pre-render block
affects: [16-05, exportEngine, audioExportMixer]

# Tech tracking
tech-stack:
  added: []
  patterns: [spawn_blocking for blocking FFmpeg I/O in async Tauri commands, AbortSignal + Promise.race for cancellable OfflineAudioContext render]

key-files:
  created: []
  modified:
    - Application/src-tauri/src/commands/export.rs
    - Application/src/lib/exportEngine.ts
    - Application/src/lib/audioExportMixer.ts

key-decisions:
  - "spawn_blocking wraps the entire ffmpeg::encode_video call rather than making encode_video itself async, keeping blocking I/O properly isolated"
  - "200ms polling interval for cancel-to-abort bridge balances responsiveness vs overhead"
  - "60s timeout safety net on OfflineAudioContext.startRendering prevents indefinite hangs from unknown rendering issues"
  - "Cancel check before audio pre-render is a separate gate from the frame-rendering cancel check, preventing audio hang after user cancels during frame export"

patterns-established:
  - "Async Tauri commands: use spawn_blocking for any synchronous subprocess (FFmpeg) to keep IPC responsive"
  - "Cancellable Web Audio render: AbortSignal + Promise.race with timeout for OfflineAudioContext operations"

requirements-completed: [BEAT-01]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 16 Plan 04: Export Hang Fix Summary

**Async FFmpeg encoding via spawn_blocking and cancellable audio pre-render with AbortSignal + 60s timeout to fix UAT Tests 9/10 infinite hang**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T19:53:48Z
- **Completed:** 2026-03-23T19:57:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Made export_encode_video async with tokio::task::spawn_blocking so FFmpeg runs on a background thread without blocking the Tauri main thread
- Added cancel check gate before audio pre-render block in exportEngine to prevent starting audio render after user cancels
- Added AbortSignal parameter to renderMixedAudio with Promise.race against both abort and 60s timeout safety net

## Task Commits

Each task was committed atomically:

1. **Task 1: Make Rust FFmpeg encoding async with spawn_blocking** - `16c90e8` (feat)
2. **Task 2: Add cancel check and timeout to audio pre-render** - `a1f315d` (fix)

## Files Created/Modified
- `Application/src-tauri/src/commands/export.rs` - Changed export_encode_video from sync to async with spawn_blocking wrapper
- `Application/src/lib/exportEngine.ts` - Added cancel check before audio pre-render, wired AbortController with 200ms polling
- `Application/src/lib/audioExportMixer.ts` - Added optional AbortSignal param, Promise.race with 60s timeout safety net

## Decisions Made
- Kept ffmpeg::encode_video synchronous (correct for spawn_blocking context) -- only the Tauri command wrapper changed to async
- 200ms cancel polling interval chosen to balance responsiveness vs CPU overhead
- 60s timeout as safety net (not primary cancel mechanism) for unknown OfflineAudioContext hang scenarios
- No changes needed to TypeScript IPC layer -- safeInvoke already awaits Tauri invoke promise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both tasks compiled and verified on first attempt.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all code paths are fully wired.

## Next Phase Readiness
- Export hang fix complete, ready for UAT re-verification
- Plan 05 (BPM persistence) can proceed independently

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 16-audio-export-beat-sync*
*Completed: 2026-03-23*
