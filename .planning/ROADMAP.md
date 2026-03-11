# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience: Tauri scaffold, UI shell, image pipeline, project management, timeline, preview, undo/redo, keyboard shortcuts, multi-layer compositing, and cinematic FX effects. v0.2.0 (Phases 8-17) extends the editor with new features and completes the pipeline with audio, beat sync, and PNG export.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2026-03-11)
- 📋 **v0.2.0** — Phases 8-17 (planned)

## Phases

<details>
<summary>✅ v0.1.0 (Phases 1-7) — SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2026-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2026-03-03
- [x] Phase 3: Project & Sequence Management (10/10 plans) — completed 2026-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2026-03-03
- [x] Phase 4: Timeline & Preview (5/5 plans) — completed 2026-03-03
- [x] Phase 5: Editing Infrastructure (5/5 plans) — completed 2026-03-06
- [x] Phase 6: Layer System & Properties Panel (8/8 plans) — completed 2026-03-08
- [x] Phase 7: Cinematic FX Effects (10/10 plans) — completed 2026-03-10

See: `milestones/v0.1.0-ROADMAP.md` for full details.

</details>

### v0.2.0 (Planned)

- [ ] **Phase 8: TBD**
- [ ] **Phase 9: TBD**
- [ ] **Phase 10: TBD**
- [ ] **Phase 11: TBD**
- [ ] **Phase 12: TBD**
- [ ] **Phase 13: TBD**
- [ ] **Phase 14: TBD**
- [ ] **Phase 15: Audio Import & Waveform** - Import audio files, waveform on timeline, synchronized playback
- [ ] **Phase 16: Beat Sync** - BPM detection, beat markers, snap modes, auto-arrange key photos
- [ ] **Phase 17: PNG Export** - Composited frame export with resolution options, progress, metadata sidecar

## Phase Details

Phases 1-7 archived to `milestones/v0.1.0-ROADMAP.md`.

### Phase 8: TBD
### Phase 9: TBD
### Phase 10: TBD
### Phase 11: TBD
### Phase 12: TBD
### Phase 13: TBD
### Phase 14: TBD

### Phase 15: Audio Import & Waveform
**Goal**: Users can import audio files, see waveforms on the timeline, and hear audio playing in sync with the visual preview
**Depends on**: Phase 5
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. User can import WAV, MP3, AAC, or OGG audio files into a sequence and see the waveform displayed on the timeline below the frame track
  2. Audio plays in perfect sync with preview playback — no audible drift when scrubbing or playing at project frame rate
  3. User can adjust volume, mute/unmute, set audio offset relative to frame 0, and trim audio in/out points
**Plans**: TBD

### Phase 16: Beat Sync
**Goal**: Users can detect BPM from audio, see beat markers on the timeline, and auto-arrange key photos to beat positions
**Depends on**: Phase 15
**Requirements**: BEAT-01, BEAT-02, BEAT-03, BEAT-04, BEAT-05
**Success Criteria** (what must be TRUE):
  1. App detects BPM from imported audio and displays beat markers on the timeline at the detected positions
  2. User can manually set or adjust BPM and offset when auto-detection is inaccurate
  3. User can select a snap mode (every beat, every 2 beats, every bar, every half-beat) and auto-arrange key photos to those positions
**Plans**: TBD

### Phase 17: PNG Export
**Goal**: Users can export their composited sequences as PNG image sequences ready for downstream editing in DaVinci Resolve or Premiere Pro
**Depends on**: Phase 6, Phase 7
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05, EXPORT-06
**Success Criteria** (what must be TRUE):
  1. User can export a sequence as a PNG image sequence to a chosen directory, with all visible layers and FX composited at the target resolution
  2. User can select export resolution (original, 1080p, 4K, custom) and exported files follow the naming pattern frame_NNNN.png with auto-padded numbering
  3. Export shows a progress indicator (frame X of N) with a working cancel button that remains responsive throughout the export
  4. Export writes an audio metadata sidecar JSON file alongside the PNG sequence for downstream editor handoff
**Plans**: TBD

## Progress

**Execution Order:**
v0.2.0: 8 > 9 > 10 > 11 > 12 > 13 > 14 > 15 > 16 > 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Scaffolding | v0.1.0 | 3/3 | Complete | 2026-03-02 |
| 2. UI Shell & Image Pipeline | v0.1.0 | 3/3 | Complete | 2026-03-03 |
| 3. Project & Sequence Management | v0.1.0 | 10/10 | Complete | 2026-03-03 |
| 3.1. Fix Cross-Phase Integration Wiring | v0.1.0 | 1/1 | Complete | 2026-03-03 |
| 4. Timeline & Preview | v0.1.0 | 5/5 | Complete | 2026-03-03 |
| 5. Editing Infrastructure | v0.1.0 | 5/5 | Complete | 2026-03-06 |
| 6. Layer System & Properties Panel | v0.1.0 | 8/8 | Complete | 2026-03-08 |
| 7. Cinematic FX Effects | v0.1.0 | 10/10 | Complete | 2026-03-10 |
| 8. TBD | v0.2.0 | 0/0 | Planned | - |
| 9. TBD | v0.2.0 | 0/0 | Planned | - |
| 10. TBD | v0.2.0 | 0/0 | Planned | - |
| 11. TBD | v0.2.0 | 0/0 | Planned | - |
| 12. TBD | v0.2.0 | 0/0 | Planned | - |
| 13. TBD | v0.2.0 | 0/0 | Planned | - |
| 14. TBD | v0.2.0 | 0/0 | Planned | - |
| 15. Audio Import & Waveform | v0.2.0 | 0/0 | Planned | - |
| 16. Beat Sync | v0.2.0 | 0/0 | Planned | - |
| 17. PNG Export | v0.2.0 | 0/0 | Planned | - |
