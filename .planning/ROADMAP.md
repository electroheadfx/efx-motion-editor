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
- [x] **Phase 15.2: Solid Sequence** - Key solid and key transparent entries in content sequences, color picker, timeline/canvas/export rendering (completed 2026-03-22)
- [x] **Phase 15.3: GLSL Shadertoys** - WebGL2 shader runtime, shader browser, 17 Shadertoy-ported effects, parameter controls, keyframe animation (completed 2026-03-22)
- [ ] **Phase 15.4: GL Transition** - GLSL-powered transitions between sequences, 18 curated gl-transitions.com shaders, dual-texture rendering pipeline, browser/sidebar/timeline integration
- [x] **Phase 16: Audio Export & Beat Sync** - Audio in video export, BPM detection, beat markers, snap-to-beat, auto-arrange (completed 2026-03-23)
- [x] **Phase 17: Enhancements** - Key photo collapse/expand, global solo mode, gradient solids, Tailwind v4 cleanup (completed 2026-03-24)
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

### Phase 15.4: GL Transition (INSERTED)

**Goal:** Add GLSL-powered transition effects between content sequences using the gl-transitions.com convention, with dual-texture WebGL2 rendering, 18 curated transition shaders, ShaderBrowser Transition tab, TransitionProperties sidebar editing, timeline visual indicators, and project persistence (.mce v11)
**Requirements**: GLT-01, GLT-02, GLT-03, GLT-04, GLT-05, GLT-06, GLT-07, GLT-08, GLT-09, GLT-10
**Depends on:** Phase 15.3 (GLSL runtime, shader library, ShaderBrowser)
**Success Criteria** (what must be TRUE):
  1. User can browse 18 GL transition shaders in the ShaderBrowser Transition tab with animated looping previews
  2. User can apply a GL transition to the active sequence pair, replacing cross-dissolve (mutually exclusive)
  3. GL transitions render identically in preview and export via dual-capture WebGL2 pipeline
  4. User can edit GL transition parameters, duration, and easing in TransitionProperties sidebar
  5. Timeline shows teal GL transition overlays distinct from purple cross-dissolve overlays
  6. GL transition data persists across project save/load (.mce v11)
**Plans**: 4 plans

Plans:
- [x] 15.4-00-PLAN.md — Wave 0: test scaffolds for glslRuntime, transitionEngine, sequenceStore, projectStore, exportRenderer
- [x] 15.4-01-PLAN.md — Foundation: GlTransition type, dual-texture GL pipeline, 18 transition shaders
- [x] 15.4-02-PLAN.md — Rendering pipeline + ShaderBrowser Transition tab + Apply flow
- [ ] 15.4-03-PLAN.md — TransitionProperties sidebar, timeline indicator, project persistence (.mce v11)

### Phase 15.3: GLSL Shadertoys (INSERTED)

**Goal:** Add GPU shader effects system with WebGL2 runtime, shader browser window, 17 Shadertoy-ported shaders, sidebar parameter controls, keyframe animation support, and export integration
**Requirements**: GLSL-01 (runtime), GLSL-02 (browser), GLSL-03 (shaders), GLSL-04 (parameters), GLSL-05 (integration)
**Depends on:** Phase 15
**Plans:** 3/4 plans executed

Plans:
- [x] 15.3-01-PLAN.md — GLSL shader library, browser, runtime, 17 shaders, parameter controls, export integration

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
- [x] 15.2-01-PLAN.md — Data model: KeyPhoto type extension, sequenceStore methods, frameMap pipeline, project format v10
- [x] 15.2-02-PLAN.md — UI: split add button, key solid card 4-corner controls, color picker popover, sidebar thumbnail
- [x] 15.2-03-PLAN.md — Rendering: timeline solid/checkerboard, canvas preview solid/transparent, export cross-dissolve, visual verification

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
**Plans**: 6 plans

Plans:
- [x] 16-01-PLAN.md — Foundation: data model, BPM detector, beat marker engine, npm dependency
- [x] 16-02-PLAN.md — Audio export: OfflineAudioContext mixer, Rust FFmpeg muxing, export UI
- [x] 16-03-PLAN.md — Beat markers, BPM UI, snap-to-beat, auto-arrange, project persistence v12
- [x] 16-04-PLAN.md — Gap closure: fix export hang (async FFmpeg, cancel/timeout on audio pre-render)
- [x] 16-05-PLAN.md — Gap closure: fix BPM persistence (add missing fields to Rust MceAudioTrack)
- [ ] 16-06-PLAN.md — Gap closure: snap-to-beat in FramesPopover (key photo hold-duration snap)

### Phase 17: Enhancements
**Goal**: Users get collapsible key photo lists in the sidebar, a global solo mode that strips layers/FX from preview and export, gradient fills for solid entries, and Tailwind v4 syntax cleanup
**Depends on**: Phase 16 (project format v12), Phase 12.15 (isolation infrastructure)
**Requirements**: ENH-01, ENH-02, ENH-03, ENH-04
**Success Criteria** (what must be TRUE):
  1. User can collapse and expand a sequence's key photo list by clicking the sequence header bar a second time (ENH-01 subsumed by ENH-02 per D-01)
  2. User can toggle global solo mode via timeline toolbar button or S key, stripping all overlay layers and FX from preview and export
  3. User can apply gradient fills (linear, radial, conic) with 2-5 color stops to solid key entries via extended ColorPickerModal
  4. Gradient data persists in .mce project file v13 with backward compat for v12
  5. All Tailwind v4 deprecated `[var(--...)]` patterns migrated to parenthetical `(--...)` syntax
**Plans**: 4 plans

Plans:
- [x] 17-01-PLAN.md — Key photo collapse/expand toggle + Tailwind v4 syntax migration
- [x] 17-02-PLAN.md — Global solo mode: soloStore, toolbar button, renderGlobalFrame gating, keyboard shortcut
- [x] 17-03-PLAN.md — Gradient data model (types) + ColorPickerModal gradient mode UI + GradientBar component
- [x] 17-04-PLAN.md — Gradient rendering pipeline + project persistence v13 + gradient UI wiring

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
v0.3.0: 15 > 15.1 > 15.2 > 15.3 > 15.4 > 16 > 17, 18 (17 and 18 are independent, can parallelize)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15. Audio Import & Waveform | v0.3.0 | 4/4 | Complete    | 2019-03-21 |
| 15.1 Media In-Use & Safe Removal | v0.3.0 | 2/2 | Complete    | 2026-03-22 |
| 15.2 Solid Sequence | v0.3.0 | 4/4 | Complete    | 2026-03-22 |
| 15.3 GLSL Shadertoys | v0.3.0 | 1/1 | Complete    | 2026-03-22 |
| 15.4 GL Transition | v0.3.0 | 3/4 | In Progress|  |
| 16. Audio Export & Beat Sync | v0.3.0 | 5/6 | Complete    | 2026-03-23 |
| 17. Enhancements | v0.3.0 | 4/4 | Complete    | 2026-03-24 |
| 18. Canvas Motion Path | v0.3.0 | 0/0 | Not started | - |

## Backlog

### Phase 999.1: Add Paint Layer Rotopaint (BACKLOG)

**Goal:** Add a paint/rotopaint layer type for frame-by-frame drawing and rotoscoping directly on the canvas, with a perfect-freehand brush engine, full tool suite (brush, eraser, eyedropper, fill, shapes), per-frame vector stroke storage, onion skinning, sidecar file persistence, and standard layer compositing
**Depends on:** Any phase with project format (will use next available version number)
**Requirements:** PAINT-01, PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06, PAINT-07, PAINT-08, PAINT-09, PAINT-10, PAINT-11, PAINT-12, PAINT-13
**Success Criteria** (what must be TRUE):
  1. User can add a paint layer via the Layer menu and enter paint mode via toolbar button or P key
  2. User can draw pressure-sensitive brush strokes and erase with per-stroke color/opacity
  3. User can use fill tool and geometric shape tools (line, rect, ellipse)
  4. Paint is per-frame (every timeline frame has its own canvas), supporting true frame-by-frame animation
  5. Onion skinning shows ghosted adjacent frame paint with configurable range and opacity
  6. Paint layers composite normally in the layer stack with blend modes and opacity
  7. Paint renders identically in preview and export
  8. Paint data persists as sidecar JSON files alongside the .mce project
**Plans**: 6 plans

Plans:
- [ ] 999.1-01-PLAN.md — Foundation: paint types, paintStore, paintRenderer, LayerType extension, perfect-freehand install
- [ ] 999.1-02-PLAN.md — Canvas interaction: PaintOverlay, paint mode toggle, TransformOverlay gating
- [ ] 999.1-03-PLAN.md — Rendering pipeline: PreviewRenderer/exportRenderer integration, frameMap color, AddLayerMenu entry
- [ ] 999.1-04-PLAN.md — Paint UI: PaintProperties sidebar, PaintToolbar floating overlay, LeftPanel routing
- [ ] 999.1-05-PLAN.md — Persistence: sidecar file I/O, projectStore save/load wiring, project format version bump, Rust paint dir
- [ ] 999.1-06-PLAN.md — Advanced: flood fill tool, onion skinning overlay, end-to-end visual verification
