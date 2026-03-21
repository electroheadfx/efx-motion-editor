# Requirements: EFX-Motion Editor

**Defined:** 2026-03-21
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.3.0 Requirements

Requirements for milestone v0.3.0 Audio & Polish. Each maps to roadmap phases.

### Audio Import & Playback

- [ ] **AUDIO-01**: User can import audio files (WAV, MP3, AAC, FLAC) via file dialog and drag-and-drop
- [ ] **AUDIO-02**: User can see waveform visualization on the timeline below content/FX tracks
- [ ] **AUDIO-03**: User can hear audio playing in sync with visual preview (play, stop, seek)
- [ ] **AUDIO-04**: User can adjust audio volume and mute/unmute
- [ ] **AUDIO-05**: User can drag audio track on timeline to offset relative to frame 0
- [ ] **AUDIO-06**: User can set fade-in and fade-out duration on audio
- [ ] **AUDIO-07**: Audio track persists in project file (.mce v8)

### Audio Export & Beat Sync

- [ ] **BEAT-01**: User can export video with audio included (FFmpeg muxing with fades applied)
- [ ] **BEAT-02**: User can detect BPM from imported audio and see beat markers on timeline
- [ ] **BEAT-03**: User can manually set or adjust BPM and beat offset when detection is inaccurate
- [ ] **BEAT-04**: User can snap key photo hold-duration handles to nearest beat marker
- [ ] **BEAT-05**: User can auto-arrange key photos to beat positions with strategy selector (every beat, 2 beats, bar)

### Enhancements

- [ ] **ENH-01**: User can scroll through key photos in sidebar Sequences panel when list overflows
- [ ] **ENH-02**: User can collapse/expand key photo list by clicking sequence header bar a second time
- [ ] **ENH-03**: User can solo a sequence to play without layers and FX
- [ ] **ENH-04**: User can solo individual layers within a sequence via sidebar toggle

### Canvas Motion Path

- [ ] **PATH-01**: User can see After Effects-style motion path on canvas when a layer has 2+ position keyframes
- [ ] **PATH-02**: User can drag keyframe diamonds on the motion path to reposition them directly on canvas
- [ ] **PATH-03**: Motion path dot spacing reflects interpolation speed (close = slow, far = fast)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Audio Advanced

- **AUDX-01**: User can import multiple audio tracks per sequence
- **AUDX-02**: User can record voiceover directly in the editor
- **AUDX-03**: User can time-stretch audio to match timeline duration

### Animation Advanced

- **ANIMX-01**: User can edit Bezier tangent handles on motion path control points
- **ANIMX-02**: User can see motion paths for all layers simultaneously

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-track audio mixing | Transforms audio into DAW; users pre-mix in GarageBand/Logic |
| Audio waveform editing (cut, trim, splice) | Turns product into audio editor; offset + fades cover 90% of needs |
| Real-time beat detection during playback | Offline analysis is identical but more accurate; no benefit over pre-computed |
| Per-frame audio scrubbing | At 15/24 fps, 42-67ms snippets sound like clicks; Dragonframe also skips this |
| Audio pitch-shift / time-stretch | Complex DSP; users adjust hold durations or pre-process audio externally |
| Bezier spatial interpolation on motion path | Requires rework of polynomial cubic easing engine; defer to future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | Phase 15 | Pending |
| AUDIO-02 | Phase 15 | Pending |
| AUDIO-03 | Phase 15 | Pending |
| AUDIO-04 | Phase 15 | Pending |
| AUDIO-05 | Phase 15 | Pending |
| AUDIO-06 | Phase 15 | Pending |
| AUDIO-07 | Phase 15 | Pending |
| BEAT-01 | Phase 16 | Pending |
| BEAT-02 | Phase 16 | Pending |
| BEAT-03 | Phase 16 | Pending |
| BEAT-04 | Phase 16 | Pending |
| BEAT-05 | Phase 16 | Pending |
| ENH-01 | Phase 17 | Pending |
| ENH-02 | Phase 17 | Pending |
| ENH-03 | Phase 17 | Pending |
| ENH-04 | Phase 17 | Pending |
| PATH-01 | Phase 18 | Pending |
| PATH-02 | Phase 18 | Pending |
| PATH-03 | Phase 18 | Pending |

**Coverage:**
- v0.3.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
