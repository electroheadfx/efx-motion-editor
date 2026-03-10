# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline in 10 phases across two milestones. v1.0 (Phases 1-4) shipped the editing foundation: Tauri scaffold, UI shell, image pipeline, project management, timeline, and preview. v2.0 (Phases 5-10) transforms the editor into a production tool: infrastructure fixes and undo/redo first (so every later feature has keyboard access and history from day one), then the layer compositing system (which unblocks FX and export), then cinematic FX effects (the product differentiator), then audio import with waveform visualization, then beat sync (requires audio), and finally PNG export (requires the complete compositor pipeline).

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-03)
- 🚧 **v2.0 Production Tool** — Phases 5-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-03</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2026-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2026-03-03
- [x] Phase 3: Project & Sequence Management (3/3 plans) — completed 2026-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2026-03-03
- [x] Phase 4: Timeline & Preview (3/3 plans) — completed 2026-03-03

See: `milestones/v1.0-ROADMAP.md` for full details.

</details>

### v2.0 Production Tool

- [ ] **Phase 5: Editing Infrastructure** - Fix v1.0 store bugs, implement undo/redo with command pattern, and wire all keyboard shortcuts
- [ ] **Phase 6: Layer System & Properties Panel** - Multi-layer compositing with Canvas 2D renderer, blend modes, transforms, and context-sensitive properties panel
- [ ] **Phase 7: Cinematic FX Effects** - Film grain, vignette, color grade, dirt/scratches, and light leaks as FX layers with normalized parameters
- [ ] **Phase 8: Audio Import & Waveform** - Audio file import, Web Audio API playback synced to preview, waveform rendering on timeline
- [ ] **Phase 9: Beat Sync** - BPM detection, beat markers on timeline, snap modes, and auto-arrange key photos to beats
- [ ] **Phase 10: PNG Export** - Frame-by-frame composited export with resolution options, progress indicator, and audio metadata sidecar

## Phase Details

Phases 1-4 archived to `milestones/v1.0-ROADMAP.md`.

### Phase 5: Editing Infrastructure
**Goal**: Users can undo/redo any editing action, operate the app with keyboard shortcuts, and switch between projects without data corruption
**Depends on**: Phase 4
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06, KEY-07, KEY-08
**Success Criteria** (what must be TRUE):
  1. User can create a new project while editing and all stores reset cleanly — no data from the previous project appears
  2. User can undo any editing action with Cmd+Z and redo with Cmd+Shift+Z, with rapid slider changes coalescing into a single undo entry
  3. User can play/pause with Space, step frames with arrows, scrub with JKL, and save/open/create projects with standard Cmd shortcuts
  4. Keyboard shortcuts do not fire when typing in input fields, and pressing ? shows a shortcuts help overlay
**Plans**: 5 plans
Plans:
  - [ ] 05-01-PLAN.md — Store lifecycle fixes + unsaved-changes guard
  - [ ] 05-02-PLAN.md — Undo/redo command pattern engine
  - [ ] 05-03-PLAN.md — Keyboard shortcuts, JKL shuttle, shortcuts overlay
  - [ ] 05-04-PLAN.md — Fix Cmd+Z/Shift+Z native menu interception + ? keyboard layout fix
  - [ ] 05-05-PLAN.md — Rewrite JKL shuttle to split-responsibility model with auto-loop

### Phase 6: Layer System & Properties Panel
**Goal**: Users can add multiple layer types to sequences, composite them in real-time with blend modes and transforms, and edit all layer properties through a context-sensitive panel
**Depends on**: Phase 5
**Requirements**: LAYER-01, LAYER-02, LAYER-03, LAYER-04, LAYER-05, LAYER-06, LAYER-07, LAYER-08, LAYER-09, LAYER-10, LAYER-11, LAYER-12, LAYER-13, LAYER-14, PROP-01, PROP-02, PROP-03, PROP-04
**Success Criteria** (what must be TRUE):
  1. User can add static image, image sequence, and video layers to a sequence, and the preview canvas renders all visible layers composited with correct blend modes and opacity in real-time
  2. User can reorder layers via drag-and-drop, toggle visibility, and delete layers — the base key photo sequence is always the non-deletable bottom layer
  3. User can set position, scale, rotation, and crop for any layer via the properties panel, with changes reflected immediately in the preview
  4. Properties panel shows context-sensitive controls (blend mode dropdown, opacity slider, visibility toggle, transform controls) for whichever layer is selected
**Plans**: 6 plans
Plans:
  - [x] 06-01-PLAN.md — Layer data model & store
  - [x] 06-02-PLAN.md — Preview compositor (Canvas renderer)
  - [x] 06-03-PLAN.md — Layer management UI
  - [x] 06-04-PLAN.md — Properties panel
  - [ ] 06-05-PLAN.md — Fix NumericInput re-render loop, DnD reorder, and video blend defaults (gap closure)
  - [ ] 06-06-PLAN.md — Static image asset picker and video asset tracking (gap closure)

### Phase 7: Cinematic FX Effects
**Goal**: Users can add cinematic post-processing effects to sequences that render identically in preview and export
**Depends on**: Phase 6
**Requirements**: FX-01, FX-02, FX-03, FX-04, FX-05, FX-06, FX-07, FX-08, FX-09, FX-10
**Success Criteria** (what must be TRUE):
  1. User can add film grain and dirt/scratches effects with adjustable intensity and see them composited on the preview canvas
  2. User can add vignette and light leaks effects with configurable parameters (intensity, size, softness)
  3. User can add a color grade effect and individually adjust brightness, contrast, saturation, hue, and fade
  4. All FX parameters are resolution-independent — preview at 830px and export at 1080p/4K produce visually identical results
**Plans**: TBD

### Phase 8: Audio Import & Waveform
**Goal**: Users can import audio files, see waveforms on the timeline, and hear audio playing in sync with the visual preview
**Depends on**: Phase 5
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06, AUDIO-07
**Success Criteria** (what must be TRUE):
  1. User can import WAV, MP3, AAC, or OGG audio files into a sequence and see the waveform displayed on the timeline below the frame track
  2. Audio plays in perfect sync with preview playback — no audible drift when scrubbing or playing at project frame rate
  3. User can adjust volume, mute/unmute, set audio offset relative to frame 0, and trim audio in/out points
**Plans**: TBD

### Phase 9: Beat Sync
**Goal**: Users can detect BPM from audio, see beat markers on the timeline, and auto-arrange key photos to beat positions
**Depends on**: Phase 8
**Requirements**: BEAT-01, BEAT-02, BEAT-03, BEAT-04, BEAT-05
**Success Criteria** (what must be TRUE):
  1. App detects BPM from imported audio and displays beat markers on the timeline at the detected positions
  2. User can manually set or adjust BPM and offset when auto-detection is inaccurate
  3. User can select a snap mode (every beat, every 2 beats, every bar, every half-beat) and auto-arrange key photos to those positions
**Plans**: TBD

### Phase 10: PNG Export
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
Phases execute in numeric order: 5 > 6 > 7 > 8 > 9 > 10
(Note: Phase 8 depends on Phase 5, not Phase 7 — audio and FX are independent tracks that converge at Phase 10)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Scaffolding | v1.0 | 3/3 | Complete | 2026-03-02 |
| 2. UI Shell & Image Pipeline | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3. Project & Sequence Management | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3.1. Fix Cross-Phase Integration Wiring | v1.0 | 1/1 | Complete | 2026-03-03 |
| 4. Timeline & Preview | v1.0 | 3/3 | Complete | 2026-03-03 |
| 5. Editing Infrastructure | v2.0 | 0/5 | Planned | - |
| 6. Layer System & Properties Panel | v2.0 | 4/6 | In Progress | - |
| 7. Cinematic FX Effects | v2.0 | 0/0 | Not started | - |
| 8. Audio Import & Waveform | v2.0 | 0/0 | Not started | - |
| 9. Beat Sync | v2.0 | 0/0 | Not started | - |
| 10. PNG Export | v2.0 | 0/0 | Not started | - |
