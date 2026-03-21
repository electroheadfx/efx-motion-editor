---
phase: 15-audio-import-waveform
plan: 01
subsystem: audio
tags: [web-audio-api, preact-signals, waveform, gain-node, audio-buffer, vitest]

requires: []
provides:
  - AudioTrack type contract (21 fields) with MceAudioTrack serialization format
  - WaveformPeaks interface for 3-tier peak data (100/2000/8000 peaks)
  - FadeCurve type (linear/exponential/logarithmic)
  - audioStore signal store with CRUD, undo/redo, and markDirty callback
  - audioEngine Web Audio API wrapper (decode, play, stop, volume, fade automation)
  - computeWaveformPeaks peak extraction with stereo-to-mono mix
  - audioPeaksCache neutral module for waveform peak caching
  - AudioTrackLayout in timeline types
  - MceProject.audio_tracks for v8 persistence
  - Wave 0 test stubs for AUDIO-01 through AUDIO-07
affects: [15-02, 15-03, 15-04]

tech-stack:
  added: []
  patterns: [audio-store-signal-pattern, one-shot-source-pattern, gain-automation-fades, 3-tier-waveform-peaks]

key-files:
  created:
    - Application/src/types/audio.ts
    - Application/src/stores/audioStore.ts
    - Application/src/lib/audioEngine.ts
    - Application/src/lib/audioWaveform.ts
    - Application/src/lib/audioPeaksCache.ts
    - Application/src/stores/audioStore.test.ts
    - Application/src/lib/audioWaveform.test.ts
    - Application/src/lib/audioEngine.test.ts
    - Application/src/lib/playbackEngine.test.ts
    - Application/src/stores/projectStore.test.ts
  modified:
    - Application/src/types/project.ts
    - Application/src/types/timeline.ts

key-decisions:
  - "audioStore follows exact sequenceStore pattern: signals, snapshot/restore, pushAction undo"
  - "audioPeaksCache as neutral lib module avoids circular imports between components and stores"
  - "audioEngine uses class singleton with lazy AudioContext creation for user gesture compliance"
  - "Fade-out targets 0.001 not 0 due to exponentialRamp limitation"
  - "setTrackHeight has no undo (continuous resize like drag operations)"

patterns-established:
  - "Audio store pattern: snapshot/restore undo with _setAudioMarkDirtyCallback for project dirty notification"
  - "One-shot source pattern: new AudioBufferSourceNode per play() call, auto-cleanup on ended"
  - "3-tier waveform peaks: 100 (zoom-out), 2000 (standard), 8000 (zoom-in) interleaved min/max"

requirements-completed: [AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06]

duration: 6min
completed: 2026-03-21
---

# Phase 15 Plan 01: Audio Foundation Summary

**AudioTrack types, signal-based audioStore with undo, Web Audio engine with fade scheduling, and 3-tier waveform peak extraction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T18:43:41Z
- **Completed:** 2026-03-21T18:50:09Z
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments
- AudioTrack type contract with 21 fields, MceAudioTrack snake_case serialization, WaveformPeaks 3-tier interface, FadeCurve type
- audioStore with 14 methods (addTrack, removeTrack, updateTrack, selectTrack, setVolume, setMuted, setOffset, setInOut, setFades, reorderTracks, setTrackHeight, setSlipOffset, reset, getTrack) and full snapshot/restore undo
- audioEngine Web Audio API wrapper with lazy context, decode, play, stop, volume, fade automation (exponential/linear ramps)
- computeWaveformPeaks with stereo-to-mono mix producing 3 resolution tiers
- 5 test stub files (Wave 0) covering AUDIO-01 through AUDIO-07, plus 22 real tests passing

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs and audioPeaksCache module** - `e831b0b` (chore)
2. **Task 1: Create audio type definitions and extend project/timeline types** - `1ccee40` (feat)
3. **Task 2: Create audioStore with signal-based CRUD and undo support** - `844b873` (feat)
4. **Task 3: Create audioEngine and audioWaveform modules** - `4015536` (feat)

## Files Created/Modified
- `Application/src/types/audio.ts` - AudioTrack, MceAudioTrack, WaveformPeaks, FadeCurve type definitions
- `Application/src/stores/audioStore.ts` - Signal store with CRUD, undo/redo, markDirty callback
- `Application/src/lib/audioEngine.ts` - Web Audio API wrapper for decode, play, stop, volume, fades
- `Application/src/lib/audioWaveform.ts` - 3-tier peak extraction from AudioBuffer
- `Application/src/lib/audioPeaksCache.ts` - Neutral Map cache for waveform peaks
- `Application/src/types/project.ts` - Added audio_tracks? field to MceProject
- `Application/src/types/timeline.ts` - Added AudioTrackLayout interface
- `Application/src/stores/audioStore.test.ts` - 14 real tests + 3 todos for audioStore
- `Application/src/lib/audioWaveform.test.ts` - 6 real tests for peak computation
- `Application/src/lib/audioEngine.test.ts` - 2 structural tests + 14 todos for Web Audio mocks
- `Application/src/lib/playbackEngine.test.ts` - 7 todo stubs for audio sync
- `Application/src/stores/projectStore.test.ts` - 6 todo stubs for audio persistence

## Decisions Made
- audioStore follows exact sequenceStore pattern (signals, snapshot/restore, pushAction) for consistency across the codebase
- audioPeaksCache placed in lib/ as neutral module to avoid circular imports between UI components and stores
- audioEngine uses class singleton (not plain object) for private state encapsulation
- Fade-out targets 0.001 instead of 0 because Web Audio exponentialRamp cannot target exactly zero
- setTrackHeight omits undo since it's a continuous drag operation (same reasoning as timeline resize)
- Logarithmic fade curve falls back to linearRamp for simplicity (true log curve would need setValueCurveAtTime)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `expect` imports from test stubs**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** Test stub files imported `expect` from vitest but only used `it.todo()` which doesn't need expect. TypeScript strict mode flagged TS6133 (declared but never read).
- **Fix:** Changed `import {describe, it, expect}` to `import {describe, it}` in all 5 test stub files
- **Files modified:** audioStore.test.ts, audioWaveform.test.ts, audioEngine.test.ts, playbackEngine.test.ts, projectStore.test.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 1ccee40 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor import cleanup for clean TypeScript compilation. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all modules are fully implemented as specified. Test todos are Wave 0 stubs that define behavioral contracts for future test implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All foundational types, stores, and engines ready for Plan 02 (UI components)
- audioStore can be wired to projectStore via _setAudioMarkDirtyCallback
- audioEngine can decode files and play with fades once UI wires file import
- computeWaveformPeaks ready for waveform rendering components
- audioPeaksCache ready for caching decoded peak data

## Self-Check: PASSED

All 10 created files verified on disk. All 4 task commit hashes (e831b0b, 1ccee40, 844b873, 4015536) verified in git log.

---
*Phase: 15-audio-import-waveform*
*Completed: 2026-03-21*
