# Requirements: EFX-Motion Editor

**Defined:** 2026-03-21
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.3.0 Requirements

Requirements for milestone v0.3.0 Audio & Polish. Each maps to roadmap phases.

### Audio Import & Playback

- [x] **AUDIO-01**: User can import audio files (WAV, MP3, AAC, FLAC) via file dialog and drag-and-drop
- [x] **AUDIO-02**: User can see waveform visualization on the timeline below content/FX tracks
- [x] **AUDIO-03**: User can hear audio playing in sync with visual preview (play, stop, seek)
- [x] **AUDIO-04**: User can adjust audio volume and mute/unmute
- [x] **AUDIO-05**: User can drag audio track on timeline to offset relative to frame 0
- [x] **AUDIO-06**: User can set fade-in and fade-out duration on audio
- [x] **AUDIO-07**: Audio track persists in project file (.mce v8)

### Media In-Use Indicators & Safe Removal

- [x] **MEDIA-01**: All asset types (image, video, audio) use stable ID-based references for reliable usage tracking
- [x] **MEDIA-02**: User can see usage count for any asset across all sequences and audio tracks
- [x] **MEDIA-03**: Every asset in ImportGrid displays a color-coded badge showing how many times it is used (green=0, yellow=1-2, orange=3-5, red=6+)
- [x] **MEDIA-04**: User can click a badge to see exact usage locations and access remove/delete actions via popover
- [x] **MEDIA-05**: Removing an in-use asset performs cascade removal (key photos become placeholders, layers removed, audio tracks removed) with undo support and detailed warning

### Solid Sequence

- [x] **SOLID-01**: User can add key solid (black) and key transparent entries to any content sequence's key photo array via split add button (Camera/Square)
- [x] **SOLID-02**: User can change a key solid's color via inline color picker popover with live canvas preview
- [x] **SOLID-03**: User can toggle a key solid between solid mode and transparent mode via top-left corner button
- [x] **SOLID-04**: Key solid and transparent entries have hold frames, reorder, and delete — identical to key photos
- [x] **SOLID-05**: Timeline renders key solid ranges as colored rectangles and key transparent ranges as checkerboard pattern
- [x] **SOLID-06**: Canvas preview renders key solids as full-resolution colored rectangles and key transparents as canvas background
- [x] **SOLID-07**: Cross-dissolve between key photo and key solid blends normally via standard alpha interpolation
- [x] **SOLID-08**: Key solid/transparent entries persist in project file (.mce v10) with backward-compatible reading of v9 files

### Audio Export & Beat Sync

- [x] **BEAT-01**: User can export video with audio included (FFmpeg muxing with fades applied)
- [x] **BEAT-02**: User can detect BPM from imported audio and see beat markers on timeline
- [x] **BEAT-03**: User can manually set or adjust BPM and beat offset when detection is inaccurate
- [x] **BEAT-04**: User can snap key photo hold-duration handles to nearest beat marker
- [x] **BEAT-05**: User can auto-arrange key photos to beat positions with strategy selector (every beat, 2 beats, bar)

### Enhancements

- [ ] ~~**ENH-01**: User can scroll through key photos in sidebar Sequences panel when list overflows~~ (dropped per D-01 — subsumed by ENH-02 collapse)
- [ ] **ENH-02**: User can collapse/expand key photo list by clicking sequence header bar a second time
- [ ] **ENH-03**: User can toggle global solo mode to preview and export without overlay layers and FX (revised per D-06 from per-sequence to global)
- [ ] ~~**ENH-04**: User can solo individual layers within a sequence via sidebar toggle~~ (dropped per D-07 — only global solo)
- [ ] **ENH-05**: User can apply gradient fills (linear, radial, conic) with 2-5 draggable color stops to solid key entries and timeline layer solids via extended ColorPickerModal, with gradient data persisting in .mce project file

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
| AUDIO-01 | Phase 15 | Complete |
| AUDIO-02 | Phase 15 | Complete |
| AUDIO-03 | Phase 15 | Complete |
| AUDIO-04 | Phase 15 | Complete |
| AUDIO-05 | Phase 15 | Complete |
| AUDIO-06 | Phase 15 | Complete |
| AUDIO-07 | Phase 15 | Complete |
| MEDIA-01 | Phase 15.1 | Complete |
| MEDIA-02 | Phase 15.1 | Complete |
| MEDIA-03 | Phase 15.1 | Complete |
| MEDIA-04 | Phase 15.1 | Complete |
| MEDIA-05 | Phase 15.1 | Complete |
| SOLID-01 | Phase 15.2 | Complete |
| SOLID-02 | Phase 15.2 | Complete |
| SOLID-03 | Phase 15.2 | Complete |
| SOLID-04 | Phase 15.2 | Complete |
| SOLID-05 | Phase 15.2 | Complete |
| SOLID-06 | Phase 15.2 | Complete |
| SOLID-07 | Phase 15.2 | Complete |
| SOLID-08 | Phase 15.2 | Complete |
| BEAT-01 | Phase 16 | Complete |
| BEAT-02 | Phase 16 | Complete |
| BEAT-03 | Phase 16 | Complete |
| BEAT-04 | Phase 16 | Complete |
| BEAT-05 | Phase 16 | Complete |
| ENH-01 | Phase 17 | Dropped (subsumed by ENH-02 per D-01) |
| ENH-02 | Phase 17 | Pending |
| ENH-03 | Phase 17 | Pending |
| ENH-04 | Phase 17 | Dropped (per D-07, only global solo) |
| ENH-05 | Phase 17 | Pending |
| PATH-01 | Phase 18 | Pending |
| PATH-02 | Phase 18 | Pending |
| PATH-03 | Phase 18 | Pending |

**Coverage:**
- v0.3.0 requirements: 34 total (2 dropped)
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-24 after Phase 17 planning revision (added ENH-05 gradient solids, marked ENH-01/ENH-04 dropped)*
