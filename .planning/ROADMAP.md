# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline in 8 phases. The build order is dependency-driven: foundation and scaffolding first (validating the riskiest integrations), then the UI shell and image pipeline, then project/sequence data management, then the timeline and preview workspace, then the layer system that makes this product unique, then cinematic FX effects on top of layers, then audio and beat sync, and finally export with undo/redo and keyboard workflow polish. Each phase delivers a coherent, testable capability -- by Phase 4 you can preview a stop-motion sequence; by Phase 6 it looks cinematic; by Phase 8 it exports production-ready PNG sequences.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-03)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-03</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2026-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2026-03-03
- [x] Phase 3: Project & Sequence Management (3/3 plans) — completed 2026-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2026-03-03
- [x] Phase 4: Timeline & Preview (3/3 plans) — completed 2026-03-03

See: `milestones/v1.0-ROADMAP.md` for full details.

</details>

### Unplanned Phases (Pending Next Milestone)

- [ ] **Phase 5: Layer System & Transforms** - Multi-layer compositing with blend modes, transforms, and properties panel
- [ ] **Phase 6: Built-in FX Effects** - Cinematic effects (grain, dirt, light leaks, vignette, color grade) via Motion Canvas
- [ ] **Phase 7: Audio & Beat Sync** - Audio import, waveform visualization, BPM detection, and beat-synced arrangement
- [ ] **Phase 8: Export, Undo & Keyboard Workflow** - PNG sequence export, full undo/redo, and keyboard shortcuts

## Phase Details

Phases 1-4 archived to `milestones/v1.0-ROADMAP.md`.

### Phase 5: Layer System & Transforms
**Goal**: Users can add multiple layers (static image, image sequence, video) to sequences, control blend modes and opacity, transform layers (position, scale, rotation, crop), and edit all properties through the properties panel
**Depends on**: Phase 4
**Requirements**: LAYR-01, LAYR-02, LAYR-03, LAYR-04, LAYR-05, LAYR-06, LAYR-07, LAYR-08, TRAN-01, TRAN-02, TRAN-03, TRAN-04, PROP-01, PROP-02, PROP-03, PROP-04
**Success Criteria** (what must be TRUE):
  1. User can add static image, image sequence, and video layers to a sequence and see them composited in the preview canvas
  2. User can set blend mode (screen, multiply, overlay, add, etc.) and opacity per layer with immediate visual feedback in preview
  3. User can reorder layers in the stack via drag, toggle visibility, and delete layers
  4. User can set position, scale, rotation, and crop for any layer and see the transform applied in the preview
  5. Properties panel shows context-sensitive controls for the selected item and edits update the preview in real-time
**Plans**: TBD

### Phase 6: Built-in FX Effects
**Goal**: Users can add cinematic FX effects (grain, dirt/scratches, light leaks, vignette, color grade) that render in real-time on the preview canvas through Motion Canvas
**Depends on**: Phase 5
**Requirements**: EFXS-01, EFXS-02, EFXS-03, EFXS-04, EFXS-05, EFXS-06
**Success Criteria** (what must be TRUE):
  1. User can add film grain and dirt/scratches effects with configurable intensity and see them on the preview canvas
  2. User can add light leak and vignette effects with configurable parameters
  3. User can add a color grade effect adjusting exposure, contrast, saturation, and temperature
  4. All FX effects render in real-time at playback frame rate without dropping frames on the preview canvas
**Plans**: TBD

### Phase 7: Audio & Beat Sync
**Goal**: Users can import audio, see waveforms on the timeline, hear audio in sync with visual playback, and auto-arrange key photos to detected beats
**Depends on**: Phase 4
**Requirements**: AUDI-01, AUDI-02, AUDI-03, AUDI-04, AUDI-05, BEAT-01, BEAT-02, BEAT-03, BEAT-04
**Success Criteria** (what must be TRUE):
  1. User can import WAV, MP3, and AAC audio files and see the waveform displayed on the timeline
  2. User can trim, position, and assign audio tracks per-sequence and globally
  3. Audio plays in sync with visual playback using AudioContext as the master clock (no drift)
  4. App auto-detects BPM from audio and displays beat markers on the timeline
  5. User can snap frame boundaries to beats and auto-arrange key photos to fill beats with calculated hold durations
**Plans**: TBD

### Phase 8: Export, Undo & Keyboard Workflow
**Goal**: Users can export their complete project as a PNG image sequence, undo/redo any operation across the entire app, and operate efficiently with keyboard shortcuts
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: EXPT-01, EXPT-02, EXPT-03, EXPT-04, EXPT-05, UNDO-01, UNDO-02, UNDO-03, KEYS-01, KEYS-02, KEYS-03, KEYS-04, KEYS-05
**Success Criteria** (what must be TRUE):
  1. User can export a PNG image sequence with configurable resolution and naming pattern, with all layers and FX flattened per frame
  2. Export shows a progress indicator with frame count and a working cancel option
  3. Export generates an audio metadata sidecar file for downstream editors (DaVinci Resolve, Premiere Pro)
  4. User can undo any state change with Cmd+Z (100+ levels) and redo with Cmd+Shift+Z, covering timeline edits, layer changes, properties, and sequence operations
  5. Keyboard shortcuts work throughout the app: space for play/pause, arrows for frame stepping, JKL for playback control, Cmd+S/N/O/Z for standard editing, with a discoverable help overlay
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 3.1 > 4 > 5 > 6 > 7 > 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Scaffolding | v1.0 | 3/3 | Complete | 2026-03-02 |
| 2. UI Shell & Image Pipeline | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3. Project & Sequence Management | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3.1. Fix Cross-Phase Integration Wiring | v1.0 | 1/1 | Complete | 2026-03-03 |
| 4. Timeline & Preview | v1.0 | 3/3 | Complete | 2026-03-03 |
| 5. Layer System & Transforms | - | 0/0 | Not started | - |
| 6. Built-in FX Effects | - | 0/0 | Not started | - |
| 7. Audio & Beat Sync | - | 0/0 | Not started | - |
| 8. Export, Undo & Keyboard Workflow | - | 0/0 | Not started | - |
