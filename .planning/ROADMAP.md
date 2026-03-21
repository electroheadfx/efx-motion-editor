# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-16) adds audio import with waveforms and beat sync.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2026-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2026-03-21)
- 📋 **v0.3.0 Audio** — Phases 15-16 (planned)

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

<details>
<summary>✅ v0.2.0 Pipeline Complete (Phases 8-14) — SHIPPED 2026-03-21</summary>

- [x] Phase 8: UI Theme System (3/3 plans) — completed 2026-03-12
- [x] Phase 9: Canvas Zoom (4/4 plans) — completed 2026-03-12
- [x] Phase 10: FX Blur Effect (4/4 plans) — completed 2026-03-13
- [x] Phase 11: Live Canvas Transform (4/4 plans) — completed 2026-03-14
- [x] Phase 12: Layer Keyframe Animation (5/5 plans) — completed 2026-03-15
- [x] Phase 12.1: Remove Bottom Bar → Sidebar (4/4 plans) — completed 2026-03-16
- [x] Phase 12.1.1: Big UI Sidebar Design (5/5 plans) — completed 2026-03-16
- [x] Phase 12.2: Auto-seek Timeline (1/1 plans) — completed 2026-03-17
- [x] Phase 12.3: Quick Keys Navigation (1/1 plans) — completed 2026-03-17
- [x] Phase 12.4: ShortcutsOverlay Tabs (1/1 plans) — completed 2026-03-17
- [x] Phase 12.5: Vertical Scroll (2/2 plans) — completed 2026-03-18
- [x] Phase 12.6: Layer Auto-selection UX (3/3 plans) — completed 2026-03-18
- [x] Phase 12.7: Keyframe Icons (1/1 plans) — completed 2026-03-18
- [x] Phase 12.8: Timeline Thumb Cover (1/1 plans) — completed 2026-03-18
- [x] Phase 12.9: Add-Layer Dialogs (1/1 plans) — completed 2026-03-18
- [x] Phase 12.10: GPU-Accelerated Blur (2/2 plans) — completed 2026-03-18
- [x] Phase 12.11: Full-speed + Fullscreen (2/2 plans) — completed 2026-03-19
- [x] Phase 12.12: Content Overlay Layers (4/4 plans) — completed 2026-03-19
- [x] Phase 12.13: Linear Timeline (2/2 plans) — completed 2026-03-19
- [x] Phase 12.14: Timeline/Canvas Buttons (2/2 plans) — completed 2026-03-19
- [x] Phase 12.15: Sequence Isolation + Loop (4/4 plans) — completed 2026-03-20
- [x] Phase 13: Fade/Cross-Dissolve (5/5 plans) — completed 2026-03-20
- [x] Phase 14: PNG & Video Export (5/5 plans) — completed 2026-03-21

See: `milestones/v0.2.0-ROADMAP.md` for full details.

</details>

### 📋 v0.3.0 Audio (Planned)

- [ ] **Phase 15: Audio Import & Waveform** - Import audio files, waveform on timeline, synchronized playback
- [ ] **Phase 16: Beat Sync** - BPM detection, beat markers, snap modes, auto-arrange key photos

## Phase Details

Phases 1-7 archived to `milestones/v0.1.0-ROADMAP.md`.
Phases 8-14 archived to `milestones/v0.2.0-ROADMAP.md`.

### Phase 15: Audio Import & Waveform
**Goal**: Users can import audio files, see waveforms on the timeline, and hear audio playing in sync with the visual preview
**Depends on**: Phase 5
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. User can import WAV, MP3, AAC, or OGG audio files into a sequence and see the waveform displayed on the timeline below the frame track
  2. Audio plays in perfect sync with preview playback -- no audible drift when scrubbing or playing at project frame rate
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

## Progress

**Execution Order:**
v0.3.0: 15 > 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2026-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2026-03-21 |
| 15. Audio Import & Waveform | v0.3.0 | 0/0 | Planned | - |
| 16. Beat Sync | v0.3.0 | 0/0 | Planned | - |
