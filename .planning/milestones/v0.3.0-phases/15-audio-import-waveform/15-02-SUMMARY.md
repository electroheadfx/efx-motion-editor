---
phase: 15-audio-import-waveform
plan: 02
subsystem: ui
tags: [audio, waveform, canvas, timeline, preact, tauri-fs, web-audio]

# Dependency graph
requires:
  - phase: 15-01
    provides: audioStore, audioEngine, audioWaveform, audioPeaksCache, AudioTrack/WaveformPeaks types
provides:
  - AddAudioButton component with full import-decode-peaks flow
  - Audio CSS color variables across all 3 themes
  - audioTrackLayouts computed signal for reactive timeline rendering
  - Audio waveform drawing in TimelineRenderer with peaks, center line, fades, selection
affects: [15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "audioPeaksCache imported from lib/ (neutral module) to avoid layering violations"
    - "audioTrackLayouts computed signal follows fxTrackLayouts pattern in frameMap.ts"
    - "drawAudioTrack uses resolution tier selection based on zoom level"

key-files:
  created:
    - Application/src/components/timeline/AddAudioButton.tsx
  modified:
    - Application/src/index.css
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/lib/frameMap.ts
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineCanvas.tsx

key-decisions:
  - "No divider between AddLayerMenu and AddAudioButton -- both are related add actions"
  - "Audio tracks render below content tracks in the scrolled region, sharing the same scroll context"
  - "Edge lines drawn as 2px bars at waveform start/end for visual anchoring"

patterns-established:
  - "Audio CSS variables follow --color-audio-* naming convention"
  - "Audio track height is per-track (track.trackHeight), not a global constant"

requirements-completed: [AUDIO-01, AUDIO-02, AUDIO-06]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 15 Plan 02: Audio Import & Waveform Rendering Summary

**AddAudioButton with native file picker and decode flow, plus canvas waveform rendering with teal peaks, resolution tier selection, fade overlays, and selection accent across all 3 themes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T18:54:02Z
- **Completed:** 2026-03-21T18:59:57Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AddAudioButton renders in timeline controls bar; clicking opens native file picker filtered to audio formats, copies file to project audio/ dir, decodes via Web Audio API, extracts 3-tier peaks, stores in audioPeaksCache, and creates track in audioStore
- Audio waveform renders as teal (#22B8A0) peaks below FX tracks on timeline canvas with resolution tier selection (100/2000/8000 peaks), center line, fade gradient overlays, and 2px accent border on selected tracks
- 6 audio CSS color variables (waveform, waveform-muted, centerline, track-bg, header-bg, fade-overlay) added to all 3 themes (dark, medium, light)
- audioTrackLayouts computed signal in frameMap.ts bridges audioStore tracks to timeline renderer via reactive signal chain

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CSS color variables and create AddAudioButton with import flow** - `7714e71` (feat)
2. **Task 2: Add audioTrackLayouts computed signal and render audio waveforms on timeline canvas** - `9ab1fd0` (feat)

## Files Created/Modified
- `Application/src/components/timeline/AddAudioButton.tsx` - Button with file picker, decode, peaks, track creation
- `Application/src/index.css` - Audio CSS color variables in all 3 themes
- `Application/src/components/layout/TimelinePanel.tsx` - AddAudioButton import and placement
- `Application/src/lib/frameMap.ts` - audioTrackLayouts computed signal
- `Application/src/components/timeline/TimelineRenderer.ts` - drawAudioTrack method, audio theme colors, DrawState extension
- `Application/src/components/timeline/TimelineCanvas.tsx` - Wire audioTracks + selectedAudioTrackId into draw call

## Decisions Made
- No divider between AddLayerMenu and AddAudioButton in the controls bar -- they are related "add" actions and visual separation is unnecessary
- Audio tracks render in the scrolled region below content tracks, sharing scrollY context with FX and content tracks
- Edge lines (2px bars) drawn at waveform start/end for visual anchoring of the audio range

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audio import and waveform rendering complete; ready for Plan 03 (synced audio playback during timeline playback)
- audioPeaksCache populated during import; available for any future peak consumers
- audioTrackCount field on TimelineRenderer available for TimelineInteraction hit-testing in future plans

## Self-Check: PASSED

All 6 files verified present. Both commit hashes (7714e71, 9ab1fd0) found in git log.

---
*Phase: 15-audio-import-waveform*
*Completed: 2026-03-21*
