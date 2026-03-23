---
phase: 16-audio-export-beat-sync
plan: 01
subsystem: audio
tags: [bpm, beat-detection, autocorrelation, onset-detection, beat-markers, snap-to-beat, auto-arrange]

# Dependency graph
requires:
  - phase: 15-audio-import-waveform
    provides: AudioTrack interface, audioStore, audioEngine, audio import pipeline
provides:
  - BPM detection from PCM Float32Array data (detectBPM)
  - Beat marker frame computation (computeBeatMarkers, computeDownbeatFrames)
  - Snap-to-beat logic for magnetic timeline snapping (snapToBeat)
  - Auto-arrange key photos to beat positions (autoArrangeHoldFrames)
  - AudioTrack BPM fields (bpm, beatOffsetFrames, beatMarkers, showBeatMarkers)
  - MceAudioTrack BPM persistence fields
  - ExportSettings includeAudio field
  - audiobuffer-to-wav dependency for WAV export mixing
affects: [16-02, 16-03, audioStore, projectStore, exportStore, TimelineRenderer, TimelineInteraction]

# Tech tracking
tech-stack:
  added: [audiobuffer-to-wav]
  patterns: [onset-autocorrelation BPM detection, frame-based beat marker computation]

key-files:
  created:
    - Application/src/lib/bpmDetector.ts
    - Application/src/lib/bpmDetector.test.ts
    - Application/src/lib/beatMarkerEngine.ts
    - Application/src/lib/beatMarkerEngine.test.ts
    - Application/src/types/audiobuffer-to-wav.d.ts
  modified:
    - Application/src/types/audio.ts
    - Application/src/types/export.ts
    - Application/src/stores/exportStore.ts
    - Application/src/stores/projectStore.ts
    - Application/src/components/views/ImportedView.tsx
    - Application/src/stores/audioStore.test.ts
    - Application/src/stores/projectStore.test.ts
    - Application/package.json
    - Application/pnpm-lock.yaml

key-decisions:
  - "Onset autocorrelation with 10ms energy windows and half-wave rectified derivative for BPM detection"
  - "Octave correction heuristic: double if <80, halve if >160, prefer value closest to 120"
  - "Auto-arrange uses stride-based beat filtering (1/2/4) for every-beat/2-beats/bar strategies"
  - "BPM fields added as required on AudioTrack with defaults at all construction sites"
  - "includeAudio signal added to exportStore with default true"

patterns-established:
  - "BPM detection: onset detection + autocorrelation on Float32Array PCM data"
  - "Beat marker computation: frame-accurate positions from BPM, offset, fps"
  - "Snap-to-beat: linear scan with threshold for magnetic snapping"

requirements-completed: [BEAT-01, BEAT-02, BEAT-03, BEAT-04, BEAT-05]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 16 Plan 01: Foundation Summary

**BPM detection via onset autocorrelation, beat marker computation with snap/auto-arrange, type extensions for AudioTrack BPM fields and ExportSettings includeAudio**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T13:39:02Z
- **Completed:** 2026-03-23T13:45:30Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Extended AudioTrack with bpm, beatOffsetFrames, beatMarkers, showBeatMarkers fields and MceAudioTrack with snake_case equivalents for project persistence
- Built BPM detector using onset detection + autocorrelation with octave correction, accurate within 2 BPM for 90/120/150 BPM test signals
- Built beat marker engine with computeBeatMarkers, computeDownbeatFrames, snapToBeat, and autoArrangeHoldFrames covering all three arrange strategies
- Added includeAudio field to ExportSettings and signal to exportStore
- Installed audiobuffer-to-wav with type declaration for future WAV export mixing
- 25 unit tests all green across both modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend data model types and install audiobuffer-to-wav** - `8da3013` (feat)
2. **Task 2: BPM detector module with tests** - `28c09f0` (feat)
3. **Task 3: Beat marker engine with snap and auto-arrange logic** - `e88f579` (feat)

## Files Created/Modified
- `Application/src/lib/bpmDetector.ts` - BPM detection from PCM data with onset autocorrelation and octave correction
- `Application/src/lib/bpmDetector.test.ts` - 6 tests for BPM detection accuracy and options
- `Application/src/lib/beatMarkerEngine.ts` - Beat marker computation, downbeat identification, snap-to-beat, auto-arrange
- `Application/src/lib/beatMarkerEngine.test.ts` - 19 tests for all beat marker engine functions
- `Application/src/types/audiobuffer-to-wav.d.ts` - Type declaration for audiobuffer-to-wav module
- `Application/src/types/audio.ts` - Extended AudioTrack and MceAudioTrack with BPM fields
- `Application/src/types/export.ts` - Added includeAudio to ExportSettings
- `Application/src/stores/exportStore.ts` - Added includeAudio signal and setter
- `Application/src/stores/projectStore.ts` - BPM field serialization/deserialization in buildMceProject/hydrateFromMce
- `Application/src/components/views/ImportedView.tsx` - BPM field defaults on audio track creation
- `Application/src/stores/audioStore.test.ts` - Updated makeTrack helper with BPM fields
- `Application/src/stores/projectStore.test.ts` - Updated makeTrack helper with BPM fields
- `Application/package.json` - Added audiobuffer-to-wav dependency
- `Application/pnpm-lock.yaml` - Lock file update

## Decisions Made
- Used onset detection + autocorrelation algorithm (10ms energy windows, half-wave rectified derivative) for BPM detection -- accurate, fast (~200ms), no external DSP library needed
- Octave correction heuristic prefers values closest to 120 BPM (musical center) when doubling/halving
- Auto-arrange uses stride-based filtering of beat markers (stride 1/2/4 for every-beat/2-beats/bar) with even photo distribution and last-photo-holds-remainder semantics
- BPM fields added as required on AudioTrack (not optional) with explicit defaults at all 3 construction sites to ensure type safety
- Conditional spread for BPM fields in buildMceProject serialization to keep .mce files clean when no BPM data exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated all AudioTrack construction sites with BPM defaults**
- **Found during:** Task 1 (type extension)
- **Issue:** Adding required fields to AudioTrack interface would break compilation at ImportedView, projectStore hydration, and test helpers
- **Fix:** Added bpm: null, beatOffsetFrames: 0, beatMarkers: [], showBeatMarkers: false defaults at all 3 construction sites plus 2 test helpers
- **Files modified:** ImportedView.tsx, projectStore.ts, audioStore.test.ts, projectStore.test.ts
- **Verification:** npx tsc --noEmit passes with only pre-existing glslRuntime warning
- **Committed in:** 8da3013 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added includeAudio signal and setter to exportStore**
- **Found during:** Task 1 (type extension)
- **Issue:** Adding includeAudio to ExportSettings interface requires the computed settings signal to include it
- **Fix:** Added includeAudio signal (default true), included in computed settings, added setIncludeAudio setter to exportStore public API
- **Files modified:** exportStore.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 8da3013 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for type safety and compilation. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all implementations are complete and tested.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All pure-logic modules ready for Plan 02 (store integration, timeline rendering, audio export mixing)
- bpmDetector.ts ready to be called from audioStore after audio import
- beatMarkerEngine.ts ready for TimelineRenderer beat marker rendering
- snapToBeat ready for TimelineInteraction magnetic snap
- autoArrangeHoldFrames ready for AudioProperties auto-arrange UI
- ExportSettings.includeAudio ready for export UI checkbox

---
*Phase: 16-audio-export-beat-sync*
*Completed: 2026-03-23*
