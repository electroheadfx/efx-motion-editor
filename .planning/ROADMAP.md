# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-18) adds audio import with waveforms and beat sync, sidebar/solo enhancements, and After Effects-style canvas motion paths.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- 🚧 **v0.3.0 Audio & Polish** — Phases 15-18 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 (Phases 1-7) — SHIPPED 2019-03-11</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2019-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2019-03-03
- [x] Phase 3: Project & Sequence Management (10/10 plans) — completed 2019-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2019-03-03
- [x] Phase 4: Timeline & Preview (5/5 plans) — completed 2019-03-03
- [x] Phase 5: Editing Infrastructure (5/5 plans) — completed 2019-03-06
- [x] Phase 6: Layer System & Properties Panel (8/8 plans) — completed 2019-03-08
- [x] Phase 7: Cinematic FX Effects (10/10 plans) — completed 2019-03-10

See: `milestones/v0.1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.2.0 Pipeline Complete (Phases 8-14) — SHIPPED 2019-03-21</summary>

- [x] Phase 8: UI Theme System (3/3 plans) — completed 2019-03-12
- [x] Phase 9: Canvas Zoom (4/4 plans) — completed 2019-03-12
- [x] Phase 10: FX Blur Effect (4/4 plans) — completed 2019-03-13
- [x] Phase 11: Live Canvas Transform (4/4 plans) — completed 2019-03-14
- [x] Phase 12: Layer Keyframe Animation (5/5 plans) — completed 2019-03-15
- [x] Phase 12.1: Remove Bottom Bar → Sidebar (4/4 plans) — completed 2019-03-16
- [x] Phase 12.1.1: Big UI Sidebar Design (5/5 plans) — completed 2019-03-16
- [x] Phase 12.2: Auto-seek Timeline (1/1 plans) — completed 2019-03-17
- [x] Phase 12.3: Quick Keys Navigation (1/1 plans) — completed 2019-03-17
- [x] Phase 12.4: ShortcutsOverlay Tabs (1/1 plans) — completed 2019-03-17
- [x] Phase 12.5: Vertical Scroll (2/2 plans) — completed 2019-03-18
- [x] Phase 12.6: Layer Auto-selection UX (3/3 plans) — completed 2019-03-18
- [x] Phase 12.7: Keyframe Icons (1/1 plans) — completed 2019-03-18
- [x] Phase 12.8: Timeline Thumb Cover (1/1 plans) — completed 2019-03-18
- [x] Phase 12.9: Add-Layer Dialogs (1/1 plans) — completed 2019-03-18
- [x] Phase 12.10: GPU-Accelerated Blur (2/2 plans) — completed 2019-03-18
- [x] Phase 12.11: Full-speed + Fullscreen (2/2 plans) — completed 2019-03-19
- [x] Phase 12.12: Content Overlay Layers (4/4 plans) — completed 2019-03-19
- [x] Phase 12.13: Linear Timeline (2/2 plans) — completed 2019-03-19
- [x] Phase 12.14: Timeline/Canvas Buttons (2/2 plans) — completed 2019-03-19
- [x] Phase 12.15: Sequence Isolation + Loop (4/4 plans) — completed 2019-03-20
- [x] Phase 13: Fade/Cross-Dissolve (5/5 plans) — completed 2019-03-20
- [x] Phase 14: PNG & Video Export (5/5 plans) — completed 2019-03-21

See: `milestones/v0.2.0-ROADMAP.md` for full details.

</details>

### 🚧 v0.3.0 Audio & Polish (In Progress)

**Milestone Goal:** Add audio import with waveforms and beat sync, enhance sidebar UX with solo mode, and introduce After Effects-style motion paths on canvas.

- [x] **Phase 15: Audio Import & Waveform** - Import audio, waveform visualization, synced playback, volume, offset, fades, project persistence (completed 2019-03-21)
- [x] **Phase 15.1: Media In-Use Indicators & Safe Removal** - Check timeline usage before removal, warn user, visual badge on used assets in ImportGrid (completed 2026-03-22)
- [ ] **Phase 15.2: Solid Sequence** - Key solid and key transparent entries in content sequences, color picker, timeline/canvas/export rendering
- [ ] **Phase 16: Audio Export & Beat Sync** - Audio in video export, BPM detection, beat markers, snap-to-beat, auto-arrange
- [ ] **Phase 17: Enhancements** - Sidebar key photo scroll/collapse, sequence solo, layer solo
- [ ] **Phase 18: Canvas Motion Path** - Position keyframe path on canvas, draggable diamonds, speed-indicating dot spacing

## Phase Details

Phases 1-7 archived to `milestones/v0.1.0-ROADMAP.md`.
Phases 8-14 archived to `milestones/v0.2.0-ROADMAP.md`.

### Phase 15: Audio Import & Waveform
**Goal**: Users can import audio, see its waveform on the timeline, and hear it playing in sync with the visual preview
**Depends on**: Phase 14 (export pipeline, project format)
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. User can import WAV, MP3, AAC, or FLAC audio files via file dialog or drag-and-drop, and the audio appears as a waveform track below content/FX tracks on the timeline
  2. Audio plays in sync with visual preview during playback, and stays in sync after seeking to any frame
  3. User can adjust volume, mute/unmute, drag the audio track to offset its start position relative to frame 0, and set fade-in and fade-out durations
  4. Audio track persists across project save/reopen cycles (project format upgraded to .mce v8)
**Plans**: 4 plans

Plans:
- [x] 15-01-PLAN.md — Foundation: audio types, audioStore, audioEngine, waveform peaks
- [x] 15-02-PLAN.md — Import flow (AddAudioButton), CSS variables, waveform rendering on timeline
- [x] 15-03-PLAN.md — Timeline interaction (click, drag, resize, reorder, slip) + playback sync
- [x] 15-04-PLAN.md — AudioProperties panel, project persistence (v8 format), end-to-end verification

### Phase 15.2: Solid Sequence (INSERTED)

**Goal:** Users can add key solid (colored) and key transparent entries to any content sequence, with color picker, reorder, hold frames, and rendering across timeline, canvas preview, and export
**Requirements**: SOLID-01, SOLID-02, SOLID-03, SOLID-04, SOLID-05, SOLID-06, SOLID-07, SOLID-08
**Depends on:** Phase 15.1
**Success Criteria** (what must be TRUE):
  1. User can add key solid (default black) and key transparent entries via split add button, and they have hold frames, reorder, and delete identical to key photos
  2. User can change a key solid's color via inline color picker popover with live canvas preview, and toggle between solid and transparent mode
  3. Timeline renders solid ranges as colored rectangles and transparent ranges as checkerboard pattern
  4. Canvas preview renders solid entries as full-resolution colored fills and transparent entries as canvas background
  5. Cross-dissolve between key photos and key solids blends normally, and key solid entries persist in project format v10
**Plans**: 4 plans

Plans:
- [x] 15.2-00-PLAN.md — Wave 0: test scaffolds for sequenceStore, frameMap, exportRenderer solid/transparent behavior
- [ ] 15.2-01-PLAN.md — Data model: KeyPhoto type extension, sequenceStore methods, frameMap pipeline, project format v10
- [ ] 15.2-02-PLAN.md — UI: split add button, key solid card 4-corner controls, color picker popover, sidebar thumbnail
- [ ] 15.2-03-PLAN.md — Rendering: timeline solid/checkerboard, canvas preview solid/transparent, export cross-dissolve, visual verification

### Phase 15.1: Media In-Use Indicators & Safe Removal
**Goal:** Users can see which imported assets are in use across the project, with color-coded badges showing usage counts, and safely remove assets with cascade removal that handles key photo placeholders, layer removal, and audio track removal with undo support
**Depends on:** Phase 15
**Requirements**: MEDIA-01, MEDIA-02, MEDIA-03, MEDIA-04, MEDIA-05
**Success Criteria** (what must be TRUE):
  1. All asset types (image, video, audio) use stable ID-based references, and usage counts are computed across all sequences
  2. Every asset in ImportGrid displays a color-coded badge (green/yellow/orange/red) with its usage count
  3. Clicking a badge opens a popover listing exact usage locations with "Remove Reference" and "Delete File" actions
  4. Removing an in-use asset performs cascade removal with detailed warning, and the operation is undoable with Ctrl+Z
**Plans**: 2 plans

Plans:
- [x] 15.1-01-PLAN.md — Asset reference refactor (videoAssetId, audioAssetId), project format v9, unified usage scanner, CSS variables
- [x] 15.1-02-PLAN.md — UsageBadge + UsagePopover components, cascade removal module, ImportGrid integration, visual verification

### Phase 16: Audio Export & Beat Sync
**Goal**: Users can export video with audio included, detect beats from the audio track, and auto-arrange key photos to beat positions
**Depends on**: Phase 15 (requires loaded AudioBuffer and audioStore)
**Requirements**: BEAT-01, BEAT-02, BEAT-03, BEAT-04, BEAT-05
**Success Criteria** (what must be TRUE):
  1. User can export video (ProRes/H.264/AV1) with the audio track muxed in, including fade in/out applied to the audio
  2. User can detect BPM from imported audio and see beat markers rendered as vertical lines on the timeline
  3. User can manually set or adjust BPM and beat offset when auto-detection is inaccurate, with x2 and /2 correction available
  4. User can snap key photo hold-duration handles to nearest beat marker, and auto-arrange all key photos to beat positions using a strategy selector (every beat, every 2 beats, every bar)
**Plans**: TBD

### Phase 17: Enhancements
**Goal**: Users get improved sidebar UX with scrollable and collapsible key photo lists, plus granular solo controls for sequences and layers
**Depends on**: Phase 12.15 (existing isolation infrastructure)
**Requirements**: ENH-01, ENH-02, ENH-03, ENH-04
**Success Criteria** (what must be TRUE):
  1. User can scroll through key photos in the sidebar Sequences panel when the list overflows the visible area
  2. User can collapse and expand a sequence's key photo list by clicking the sequence header bar a second time
  3. User can solo a sequence to play it without its layers and FX, and solo individual layers within a sequence via a sidebar toggle
**Plans**: TBD

### Phase 18: Canvas Motion Path
**Goal**: Users can see and edit position keyframe trajectories directly on the canvas as After Effects-style motion paths
**Depends on**: Phase 12 (keyframe animation engine)
**Requirements**: PATH-01, PATH-02, PATH-03
**Success Criteria** (what must be TRUE):
  1. When a layer has 2+ position keyframes, an After Effects-style motion path appears on the canvas showing the trajectory
  2. User can drag keyframe diamond handles on the motion path to reposition keyframes directly on the canvas
  3. Motion path dot spacing reflects interpolation speed -- dots are closer together where motion is slow and farther apart where motion is fast
**Plans**: TBD

## Progress

**Execution Order:**
v0.3.0: 15 > 15.1 > 15.2 > 16 > 17, 18 (17 and 18 are independent, can parallelize)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15. Audio Import & Waveform | v0.3.0 | 4/4 | Complete    | 2019-03-21 |
| 15.1 Media In-Use & Safe Removal | v0.3.0 | 2/2 | Complete    | 2026-03-22 |
| 15.2 Solid Sequence | v0.3.0 | 1/4 | In Progress|  |
| 16. Audio Export & Beat Sync | v0.3.0 | 0/0 | Not started | - |
| 17. Enhancements | v0.3.0 | 0/0 | Not started | - |
| 18. Canvas Motion Path | v0.3.0 | 0/0 | Not started | - |
