---
phase: 14-png-export
plan: 04
subsystem: export
tags: [ffmpeg, video-encoding, prores, h264, av1, reqwest, tokio, ipc]

# Dependency graph
requires:
  - phase: 14-01
    provides: PNG export pipeline, export commands, IPC wrappers
  - phase: 14-03
    provides: Export sidecar generation (JSON, FCPXML), export types
provides:
  - FFmpeg binary management (check, download, cache in ~/.config/efx-motion/bin/)
  - Video encoding from PNG sequence (ProRes, H.264, AV1)
  - Auto-download FFmpeg on first use with quarantine removal
  - Frontend IPC wrappers for FFmpeg operations
  - Video encoding wired into export engine after PNG sequence
affects: [14-05, export-ui]

# Tech tracking
tech-stack:
  added: [reqwest 0.12 (rustls-tls), tokio 1 (fs)]
  patterns: [async FFmpeg download with atomic write, child process encoding]

key-files:
  created:
    - Application/src-tauri/src/services/ffmpeg.rs
  modified:
    - Application/src-tauri/Cargo.toml
    - Application/src-tauri/src/services/mod.rs
    - Application/src-tauri/src/commands/export.rs
    - Application/src-tauri/src/lib.rs
    - Application/src/lib/ipc.ts
    - Application/src/lib/exportEngine.ts

key-decisions:
  - "FFmpeg cached at ~/.config/efx-motion/bin/ matching config_path pattern"
  - "reqwest with rustls-tls to avoid native OpenSSL dependency"
  - "Atomic download via temp file + rename pattern"

patterns-established:
  - "Async Rust IPC command pattern for long-running operations (download_ffmpeg)"
  - "Child process encoding with codec-specific argument building"

requirements-completed: [EXPORT-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 14 Plan 04: FFmpeg Integration Summary

**FFmpeg auto-download binary management and video encoding pipeline for ProRes/H.264/AV1 from PNG sequences with sensible quality defaults**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T11:09:07Z
- **Completed:** 2026-03-21T11:12:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- FFmpeg binary detection, download, and caching in ~/.config/efx-motion/bin/
- Video encoding for ProRes (prores_ks), H.264 (libx264), AV1 (libsvtav1) with quality defaults (CRF 18, CRF 23, HQ profile)
- macOS quarantine removal and execute permission handling
- Auto-download triggers on first video export without user intervention
- FCPXML sidecar generated for ProRes exports only
- Video output naming follows D-19 pattern: ProjectName_ResolutionP_codec.ext

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ffmpeg.rs service and Rust IPC commands** - `7f45c65` (feat)
2. **Task 2: Wire video encoding into exportEngine.ts** - `7e786f1` (feat)

## Files Created/Modified
- `Application/src-tauri/src/services/ffmpeg.rs` - FFmpeg binary management: check, download, encode_video functions
- `Application/src-tauri/Cargo.toml` - Added reqwest (rustls-tls) and tokio (fs) dependencies
- `Application/src-tauri/src/services/mod.rs` - Added ffmpeg module declaration
- `Application/src-tauri/src/commands/export.rs` - IPC commands: export_check_ffmpeg, export_download_ffmpeg, export_encode_video
- `Application/src-tauri/src/lib.rs` - Registered new FFmpeg IPC commands in generate_handler
- `Application/src/lib/ipc.ts` - Frontend wrappers: exportCheckFfmpeg, exportDownloadFfmpeg, exportEncodeVideo
- `Application/src/lib/exportEngine.ts` - Video encoding step after PNG sequence with FFmpeg auto-download
- `Application/src-tauri/Cargo.lock` - Updated lockfile with new dependencies

## Decisions Made
- FFmpeg cached at ~/.config/efx-motion/bin/ for consistency with existing config_path pattern (not app_data_dir)
- reqwest with rustls-tls feature to avoid native OpenSSL dependency on macOS
- Atomic download via temp file + rename to prevent partial binary on interruption
- ProRes uses yuva444p10le pixel format for RGBA support

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functions are fully implemented with real logic.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FFmpeg integration complete, ready for Plan 05 (export UI / format selection)
- Video encoding automatically runs after PNG sequence for non-PNG formats
- All three codecs (ProRes, H.264, AV1) supported with sensible defaults

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (7f45c65, 7e786f1) verified in git log.

---
*Phase: 14-png-export*
*Completed: 2026-03-21*
