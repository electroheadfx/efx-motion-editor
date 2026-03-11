# Requirements: EFX-Motion Editor

**Defined:** 2026-03-03
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v0.2.0 Requirements

Requirements for v0.2.0 Production Tool milestone (Phases 5-7). Each maps to roadmap phases.

### Infrastructure & Bug Fixes

- [x] **INFRA-01**: App resets all stores (including timeline, playback, layers, audio) when user creates a new project or closes a project
- [x] **INFRA-02**: App calls stopAutoSave() on project close to prevent orphaned save timers
- [x] **INFRA-03**: User can undo any editing action with Cmd+Z (100+ levels, command pattern)
- [x] **INFRA-04**: User can redo undone actions with Cmd+Shift+Z
- [x] **INFRA-05**: Rapid slider/drag changes coalesce into a single undo entry (mousedown to mouseup)

### Layer System

- [x] **LAYER-01**: User can add a static image layer to a sequence (overlay on all frames)
- [x] **LAYER-02**: User can add an image sequence layer (frame-synced overlay)
- [x] **LAYER-03**: User can add a video layer (plays in sync with sequence playhead)
- [x] **LAYER-04**: User can set blend mode per layer (normal, screen, multiply, overlay, add)
- [x] **LAYER-05**: User can adjust layer opacity from 0% to 100%
- [x] **LAYER-06**: User can toggle layer visibility on/off
- [x] **LAYER-07**: User can reorder layers via drag-and-drop in the layer panel
- [x] **LAYER-08**: User can delete a layer from a sequence
- [x] **LAYER-09**: User can set layer position (x, y offset)
- [x] **LAYER-10**: User can set layer scale
- [x] **LAYER-11**: User can set layer rotation
- [x] **LAYER-12**: User can crop a layer
- [x] **LAYER-13**: Preview canvas renders all visible layers composited with correct blend modes and opacity in real-time
- [x] **LAYER-14**: Base key photo sequence is always the bottom layer (auto-generated, not deletable)

### Properties Panel

- [x] **PROP-01**: Properties panel shows controls for the currently selected layer
- [x] **PROP-02**: Properties panel shows blend mode dropdown, opacity slider, and visibility toggle for any layer
- [x] **PROP-03**: Properties panel shows transform controls (position, scale, rotation, crop) for the selected layer
- [x] **PROP-04**: Properties panel shows effect-specific parameters when an FX layer is selected

### FX Effects

- [x] **FX-01**: User can add a film grain effect to a sequence (grain texture overlay with multiply blend)
- [x] **FX-02**: User can adjust grain intensity
- [x] **FX-03**: User can add a vignette effect (radial gradient with multiply blend)
- [x] **FX-04**: User can adjust vignette intensity, size, and softness
- [x] **FX-05**: User can add a color grade effect (brightness, contrast, saturation, hue, fade)
- [x] **FX-06**: User can adjust color grade parameters individually
- [x] **FX-07**: User can add a dirt/scratches effect (image sequence overlay with screen blend)
- [x] **FX-08**: User can add a light leaks effect (video overlay with screen blend)
- [x] **FX-09**: User can adjust intensity for all FX effects
- [x] **FX-10**: FX parameters are resolution-independent (preview and export look identical)

### Keyboard Shortcuts

- [x] **KEY-01**: Space bar toggles play/pause
- [x] **KEY-02**: Arrow keys step one frame forward/backward
- [x] **KEY-03**: JKL keys provide variable-speed scrubbing (J=reverse, K=stop, L=forward, repeated press accelerates)
- [x] **KEY-04**: Cmd+Z/Cmd+Shift+Z trigger undo/redo
- [x] **KEY-05**: Cmd+S saves project, Cmd+N creates new project, Cmd+O opens project
- [x] **KEY-06**: Delete/Backspace deletes selected item (layer, key photo)
- [x] **KEY-07**: Shortcuts do not fire when user is typing in an input field
- [x] **KEY-08**: ? key shows keyboard shortcuts help overlay

## Deferred to Next Milestone

Requirements moved from v0.2.0 to the next milestone (Phases 8-10). All details preserved.

### Audio

- [ ] **AUDIO-01**: User can import an audio file (WAV, MP3, AAC, OGG) into a sequence
- [ ] **AUDIO-02**: Audio waveform displays on the timeline below the frame track
- [ ] **AUDIO-03**: Audio plays in sync with preview playback
- [ ] **AUDIO-04**: User can adjust audio volume
- [ ] **AUDIO-05**: User can mute/unmute audio
- [ ] **AUDIO-06**: User can set audio offset (slide relative to frame 0)
- [ ] **AUDIO-07**: User can trim audio in/out points

### Beat Sync

- [ ] **BEAT-01**: App detects BPM from imported audio
- [ ] **BEAT-02**: Beat markers display on the timeline at detected beat positions
- [ ] **BEAT-03**: User can manually set/adjust BPM and offset
- [ ] **BEAT-04**: User can select snap mode (every beat, every 2 beats, every bar, every half-beat)
- [ ] **BEAT-05**: User can auto-arrange key photos to beat positions based on selected snap mode

### Export

- [ ] **EXPORT-01**: User can export a sequence as a PNG image sequence to a chosen directory
- [ ] **EXPORT-02**: User can select export resolution (original, 1080p, 4K, custom)
- [ ] **EXPORT-03**: Exported frames include all visible layers composited at target resolution
- [ ] **EXPORT-04**: Export shows progress indicator (frame X of N) with cancel button
- [ ] **EXPORT-05**: Export writes audio metadata sidecar JSON alongside PNG sequence
- [ ] **EXPORT-06**: Exported files follow naming pattern frame_NNNN.png with auto-padded numbering

## Future Requirements

Deferred beyond current milestones. Tracked for future milestones.

### Polish & Workflow

- **POLISH-01**: Cmd+D duplicates selected item
- **POLISH-02**: Cmd+0 fits preview to window
- **POLISH-03**: Home/End navigates to first/last frame
- **POLISH-04**: Up/Down arrow jumps to previous/next key photo boundary

### Advanced FX

- **AFX-01**: Procedural FX (particles, flash, animated grain)
- **AFX-02**: Dual-quality rendering (Dual Kawase vs Gaussian blur toggle)
- **AFX-03**: Composition templates (save/load FX presets)
- **AFX-04**: Layer loop modes (loop, mirror, ping-pong for video/sequence layers)

### Advanced Editing

- **AEDIT-01**: Cinematic rate controls (auto-break/auto-merge)
- **AEDIT-02**: Onion skinning
- **AEDIT-03**: Sequence nesting

## Out of Scope

| Feature | Reason |
|---------|--------|
| ProRes/MP4 video export | PNG sequence is the professional workflow; DaVinci Resolve handles encoding |
| Keyframe animation for layer properties | Transforms product toward After Effects territory; enormous complexity |
| Live camera tethering | Different product category (Dragonframe owns this) |
| Plugin/extension system | Requires stable internal APIs; premature |
| Node-based compositing | Layer-based approach is more intuitive for target users |
| Windows/Linux builds | macOS only for now |
| Real-time collaboration | Desktop app with local files |
| AI-powered features | Proven DSP for beat detection instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Complete |
| INFRA-03 | Phase 5 | Complete |
| INFRA-04 | Phase 5 | Complete |
| INFRA-05 | Phase 5 | Complete |
| KEY-01 | Phase 5 | Complete |
| KEY-02 | Phase 5 | Complete |
| KEY-03 | Phase 5 | Complete |
| KEY-04 | Phase 5 | Complete |
| KEY-05 | Phase 5 | Complete |
| KEY-06 | Phase 5 | Complete |
| KEY-07 | Phase 5 | Complete |
| KEY-08 | Phase 5 | Complete |
| LAYER-01 | Phase 6 | Complete |
| LAYER-02 | Phase 6 | Complete |
| LAYER-03 | Phase 6 | Complete |
| LAYER-04 | Phase 6 | Complete |
| LAYER-05 | Phase 6 | Complete |
| LAYER-06 | Phase 6 | Complete |
| LAYER-07 | Phase 6 | Complete |
| LAYER-08 | Phase 6 | Complete |
| LAYER-09 | Phase 6 | Complete |
| LAYER-10 | Phase 6 | Complete |
| LAYER-11 | Phase 6 | Complete |
| LAYER-12 | Phase 6 | Complete |
| LAYER-13 | Phase 6 | Complete |
| LAYER-14 | Phase 6 | Complete |
| PROP-01 | Phase 6 | Complete |
| PROP-02 | Phase 6 | Complete |
| PROP-03 | Phase 6 | Complete |
| PROP-04 | Phase 6 | Complete |
| FX-01 | Phase 7 | Complete |
| FX-02 | Phase 7 | Complete |
| FX-03 | Phase 7 | Complete |
| FX-04 | Phase 7 | Complete |
| FX-05 | Phase 7 | Complete |
| FX-06 | Phase 7 | Complete |
| FX-07 | Phase 7 | Complete |
| FX-08 | Phase 7 | Complete |
| FX-09 | Phase 7 | Complete |
| FX-10 | Phase 7 | Complete |
| AUDIO-01 | Phase 8 | Deferred |
| AUDIO-02 | Phase 8 | Deferred |
| AUDIO-03 | Phase 8 | Deferred |
| AUDIO-04 | Phase 8 | Deferred |
| AUDIO-05 | Phase 8 | Deferred |
| AUDIO-06 | Phase 8 | Deferred |
| AUDIO-07 | Phase 8 | Deferred |
| BEAT-01 | Phase 9 | Deferred |
| BEAT-02 | Phase 9 | Deferred |
| BEAT-03 | Phase 9 | Deferred |
| BEAT-04 | Phase 9 | Deferred |
| BEAT-05 | Phase 9 | Deferred |
| EXPORT-01 | Phase 10 | Deferred |
| EXPORT-02 | Phase 10 | Deferred |
| EXPORT-03 | Phase 10 | Deferred |
| EXPORT-04 | Phase 10 | Deferred |
| EXPORT-05 | Phase 10 | Deferred |
| EXPORT-06 | Phase 10 | Deferred |

**Coverage:**
- v0.2.0 requirements: 41 total (all complete)
- Deferred to next milestone: 18 (Phases 8-10)
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
