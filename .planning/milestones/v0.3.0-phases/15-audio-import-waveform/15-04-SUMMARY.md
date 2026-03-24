---
phase: 15-audio-import-waveform
plan: 04
subsystem: ui, persistence
tags: [preact, audio, properties-panel, project-format, serde, rust]

# Dependency graph
requires:
  - phase: 15-01
    provides: AudioTrack type, audioStore, audioPeaksCache, audioEngine, audioWaveform
  - phase: 15-02
    provides: Waveform rendering and timeline audio row layout
  - phase: 15-03
    provides: Timeline interaction (select, drag, trim, resize audio tracks)
provides:
  - AudioProperties sidebar panel for editing audio track settings
  - Project format v8 with audio_tracks serialization (TypeScript + Rust)
  - Audio track persistence across save/reopen with async re-decode
  - Backward compatibility for v7 projects (empty audio_tracks default)
affects: [16-audio-export-beat-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: [audio-properties-panel, project-v8-format, async-audio-hydration]

key-files:
  created:
    - Application/src/components/sidebar/AudioProperties.tsx
  modified:
    - Application/src/components/layout/LeftPanel.tsx
    - Application/src/stores/projectStore.ts
    - Application/src/stores/projectStore.test.ts
    - Application/src-tauri/src/models/project.rs
    - Application/src-tauri/src/commands/project.rs
    - Application/src-tauri/src/services/project_io.rs

key-decisions:
  - "AudioProperties priority in LeftPanel: transition > audio > fx > content > fallback"
  - "Audio file replace reuses same trackId, preserving undo history and peaks cache key"
  - "Async audio decode on hydration is fire-and-forget with per-track error handling"
  - "audioPeaksCache imported from lib/audioPeaksCache to avoid store->component dependency inversion"

patterns-established:
  - "Audio properties panel follows SidebarProperties pattern: SectionLabel + NumericInput vertical layout"
  - "Project version bump pattern: increment version, add new field with serde(default), handle ?? in hydration"

requirements-completed: [AUDIO-04, AUDIO-06, AUDIO-07]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 15 Plan 04: Audio Properties and Persistence Summary

**AudioProperties panel with 5 editable sections (name, file, volume, fades, position) and project format v8 with audio_tracks serialization in TypeScript and Rust**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T19:14:42Z
- **Completed:** 2026-03-21T19:22:03Z
- **Tasks:** 2 of 2 auto tasks complete (Task 3 is human-verify checkpoint)
- **Files modified:** 7

## Accomplishments
- AudioProperties panel renders when audio track is selected with Track Name, File, Volume/Mute, Fades (with curve selectors), and Position sections
- Project format bumped to v8 with audio_tracks array in both TypeScript (buildMceProject) and Rust (MceAudioTrack struct)
- Hydration restores audio tracks from saved project and triggers async re-decode for playback/waveform
- 7 passing unit tests covering serialization mapping, version bump, hydration, v7 backward compat, and order sorting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AudioProperties panel and wire into LeftPanel** - `4df970d` (feat)
2. **Task 2: Add project persistence v8 format with audio_tracks serialization** - `0843f40` (feat)

## Files Created/Modified
- `Application/src/components/sidebar/AudioProperties.tsx` - Properties panel for selected audio track with 5 sections
- `Application/src/components/layout/LeftPanel.tsx` - Added AudioProperties rendering when audio track selected
- `Application/src/stores/projectStore.ts` - v8 format, audio_tracks serialization/hydration, audio cleanup in closeProject
- `Application/src/stores/projectStore.test.ts` - 7 tests for audio persistence (was todo stubs)
- `Application/src-tauri/src/models/project.rs` - MceAudioTrack struct, audio_tracks field on MceProject
- `Application/src-tauri/src/commands/project.rs` - Added audio_tracks to MceProject constructor
- `Application/src-tauri/src/services/project_io.rs` - Added audio_tracks to test MceProject constructors

## Decisions Made
- AudioProperties priority in LeftPanel: transition > audio > fx layer > content layer > fallback
- Replace button reuses same track ID to preserve undo history and peaks cache key
- Async audio decode on hydration is fire-and-forget with per-track error handling (console.error)
- audioPeaksCache imported from lib/audioPeaksCache (neutral module) to avoid circular imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added audio_tracks to all Rust MceProject constructors**
- **Found during:** Task 2
- **Issue:** Rust cargo check failed: new audio_tracks field missing from 4 MceProject literal constructors in project.rs, project_io.rs, and commands/project.rs
- **Fix:** Added `audio_tracks: vec![]` to all 4 constructor sites
- **Files modified:** src-tauri/src/commands/project.rs, src-tauri/src/services/project_io.rs
- **Verification:** cargo check succeeds
- **Committed in:** 0843f40 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix to add new field to existing constructors. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all controls wired to audioStore methods, all persistence fields mapped.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 AUDIO requirements satisfied end-to-end (pending human verification at Task 3 checkpoint)
- Ready for Phase 16 (audio export + beat sync) after verification passes

## Self-Check: PASSED

- All 7 files verified present on disk
- Commits 4df970d and 0843f40 verified in git log
- TypeScript compiles clean (npx tsc --noEmit)
- Rust compiles clean (cargo check)
- 7/7 projectStore tests pass
- 2/2 audioEngine tests pass

---
*Phase: 15-audio-import-waveform*
*Completed: 2026-03-21*
