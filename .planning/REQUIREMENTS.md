# Requirements: EFX-Motion Editor

**Defined:** 2026-03-02
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUN-01**: Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold builds and runs on macOS
- [ ] **FOUN-02**: Rust backend IPC bridge with type-safe invoke wrappers
- [ ] **FOUN-03**: Asset protocol configured for image loading (no binary IPC)
- [ ] **FOUN-04**: Motion Canvas player embeds in Preact app and renders a test scene
- [ ] **FOUN-05**: Signal stores established (project, sequences, layers, timeline, ui, history)
- [ ] **FOUN-06**: TypeScript types mirror Rust data models

### Project Management

- [ ] **PROJ-01**: User can create a new project with name and frame rate (15/24 fps)
- [ ] **PROJ-02**: User can save project to .mce file (JSON-based)
- [ ] **PROJ-03**: User can open existing .mce project files
- [ ] **PROJ-04**: Project auto-saves on interval and significant actions
- [ ] **PROJ-05**: User can access recent projects list on launch
- [ ] **PROJ-06**: Global app config persists between sessions (window size, last project, preferences)

### Image Import

- [ ] **IMPT-01**: User can import images via drag-and-drop onto the app
- [ ] **IMPT-02**: User can import images via file dialog (JPEG, PNG, TIFF, HEIC)
- [ ] **IMPT-03**: Imported images are copied to project directory with thumbnails generated in Rust
- [ ] **IMPT-04**: Image pool with LRU eviction prevents WebKit memory leaks (max 50 full-res)

### Sequences

- [ ] **SEQN-01**: User can create named sequences
- [ ] **SEQN-02**: User can duplicate, delete, and reorder sequences
- [ ] **SEQN-03**: User can add key photos to a sequence with configurable hold duration
- [ ] **SEQN-04**: User can reorder key photos within a sequence via drag
- [ ] **SEQN-05**: User can set per-sequence frame rate and resolution

### Timeline

- [ ] **TIME-01**: Canvas-based timeline displays frame thumbnails with virtualized rendering
- [ ] **TIME-02**: Playhead shows current position with click-to-seek
- [ ] **TIME-03**: User can scrub through timeline by dragging playhead
- [ ] **TIME-04**: User can zoom timeline in/out with scroll/pinch
- [ ] **TIME-05**: Timeline shows layer tracks for each sequence
- [ ] **TIME-06**: User can reorder sequences on the timeline

### Preview and Playback

- [ ] **PREV-01**: Preview canvas renders composited frame via Motion Canvas player
- [ ] **PREV-02**: User can play/pause at project frame rate (15 or 24 fps)
- [ ] **PREV-03**: User can step forward/backward one frame at a time
- [ ] **PREV-04**: User can zoom and pan the preview canvas
- [ ] **PREV-05**: Playback engine uses correct clock architecture for audio sync readiness

### Layer System

- [ ] **LAYR-01**: User can add static image layers to a sequence
- [ ] **LAYR-02**: User can add image sequence layers to a sequence
- [ ] **LAYR-03**: User can add video layers to a sequence (files in public/ folder)
- [ ] **LAYR-04**: User can set blend mode per layer (screen, multiply, overlay, add, etc.)
- [ ] **LAYR-05**: User can set layer opacity (0-100%)
- [ ] **LAYR-06**: User can reorder layers in the stack via drag
- [ ] **LAYR-07**: User can toggle layer visibility
- [ ] **LAYR-08**: User can delete layers

### Layer Transforms

- [ ] **TRAN-01**: User can set layer position (x, y)
- [ ] **TRAN-02**: User can set layer scale
- [ ] **TRAN-03**: User can set layer rotation
- [ ] **TRAN-04**: User can crop layers

### Built-in FX Effects

- [ ] **EFXS-01**: User can add film grain effect with configurable intensity
- [ ] **EFXS-02**: User can add dirt/scratches overlay effect
- [ ] **EFXS-03**: User can add light leak effect
- [ ] **EFXS-04**: User can add vignette effect with configurable parameters
- [ ] **EFXS-05**: User can add color grade effect (exposure, contrast, saturation, temperature)
- [ ] **EFXS-06**: FX effects render in real-time on the preview canvas via Motion Canvas

### Audio

- [ ] **AUDI-01**: User can import audio files (WAV, MP3, AAC)
- [ ] **AUDI-02**: Audio waveform displays on the timeline
- [ ] **AUDI-03**: User can trim and position audio on the timeline
- [ ] **AUDI-04**: User can set per-sequence and global audio tracks
- [ ] **AUDI-05**: Audio plays in sync with visual playback (AudioContext master clock)

### Beat Sync

- [ ] **BEAT-01**: App auto-detects BPM from imported audio (Rust-side detection)
- [ ] **BEAT-02**: Beat markers display on the timeline
- [ ] **BEAT-03**: User can snap frame boundaries to beats (snap modes: every beat, every 2, every 4)
- [ ] **BEAT-04**: User can auto-arrange key photos to fill beats with calculated hold durations

### Export

- [ ] **EXPT-01**: User can export as PNG image sequence with configurable resolution
- [ ] **EXPT-02**: Export flattens all layers and FX for each frame
- [ ] **EXPT-03**: Export shows progress indicator with frame count and cancel option
- [ ] **EXPT-04**: Export generates audio metadata sidecar file for downstream editors
- [ ] **EXPT-05**: User can configure naming pattern (e.g., frame_0001.png)

### Properties Panel

- [ ] **PROP-01**: Properties panel shows context-sensitive controls for selected item
- [ ] **PROP-02**: User can edit transform values (position, scale, rotation) via properties panel
- [ ] **PROP-03**: User can edit blend mode and opacity via properties panel
- [ ] **PROP-04**: User can edit crop values via properties panel

### Keyboard Shortcuts

- [ ] **KEYS-01**: Space bar toggles play/pause
- [ ] **KEYS-02**: Arrow keys step forward/backward one frame
- [ ] **KEYS-03**: JKL keys control playback speed/direction
- [ ] **KEYS-04**: Standard editing shortcuts (Cmd+Z undo, Cmd+S save, Cmd+N new, Cmd+O open)
- [ ] **KEYS-05**: Shortcuts discoverable via help overlay or menu

### Undo/Redo

- [ ] **UNDO-01**: User can undo any state change with Cmd+Z (100+ levels)
- [ ] **UNDO-02**: User can redo with Cmd+Shift+Z
- [ ] **UNDO-03**: Undo covers timeline edits, layer changes, property modifications, and sequence operations

### UI Conversion

- [ ] **UICV-01**: React UI prototype (Mockup/react-ui/) converted to Preact + Preact Signals
- [ ] **UICV-02**: All panels functional (timeline, layers, properties, preview, toolbar)
- [ ] **UICV-03**: Dark theme matching mockup design

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cinematic Rate Controls

- **RATE-01**: User can change project fps with auto-break/auto-merge of frame holds
- **RATE-02**: Min/max keys-per-second constraints preserve artistic intent

### Composition Templates

- **TMPL-01**: User can save layer stack as named template
- **TMPL-02**: User can apply template to any sequence
- **TMPL-03**: User can import/export templates between projects
- **TMPL-04**: Built-in template library (Super 8, 16mm, VHS presets)

### Layer Loop Modes

- **LOOP-01**: User can set layer repeat mode (none, loop, mirror, ping-pong, stretch, tile)

### Sequence Nesting

- **NEST-01**: User can use a sequence as a clip within another sequence

### Onion Skinning

- **OION-01**: User can toggle transparent overlay of previous/next frames on preview canvas
- **OION-02**: User can configure overlay opacity and frame count

### Procedural FX

- **PFXS-01**: User can add particle effect layer
- **PFXS-02**: User can add flash/strobe effect layer
- **PFXS-03**: User can add animated grain (procedural, not overlay-based)

### Dual-Quality Rendering

- **DQAL-01**: Preview uses Dual Kawase blur for real-time performance
- **DQAL-02**: Export uses Gaussian blur for quality
- **DQAL-03**: User can toggle Full FX ON/OFF for preview performance

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ProRes/MP4 video export | PNG sequence is the professional workflow; video encoding adds massive complexity (FFmpeg bundling, codecs, muxing) |
| Live camera tethering | Different product category — Dragonframe owns this. EFX starts from imported photos. |
| Keyframe animation for layer properties | Transforms product toward motion graphics/After Effects territory; layers are FX overlays, not animated elements |
| Plugin/extension system | Requires stable internal APIs; premature for v1 |
| AI-powered features | Distraction from core value; proven DSP algorithms for beat detection instead |
| Real-time collaboration | Desktop app with local files; stop-motion is typically solo/small-team |
| Windows/Linux builds | macOS only for v1; native title bar, file dialogs, macOS conventions |
| Node-based compositing | Layer-based approach is more intuitive for target users (photographers, not VFX artists) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 64 total
- Mapped to phases: 0
- Unmapped: 64

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
