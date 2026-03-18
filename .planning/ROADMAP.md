# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience: Tauri scaffold, UI shell, image pipeline, project management, timeline, preview, undo/redo, keyboard shortcuts, multi-layer compositing, and cinematic FX effects. v0.2.0 (Phases 8-17) extends the editor with new features and completes the pipeline with audio, beat sync, and PNG export.

## Milestones

- v0.1.0 -- Phases 1-7 (shipped 2026-03-11)
- v0.2.0 -- Phases 8-17 (planned)

## Phases

<details>
<summary>v0.1.0 (Phases 1-7) -- SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) -- completed 2026-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) -- completed 2026-03-03
- [x] Phase 3: Project & Sequence Management (10/10 plans) -- completed 2026-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) -- completed 2026-03-03
- [x] Phase 4: Timeline & Preview (5/5 plans) -- completed 2026-03-03
- [x] Phase 5: Editing Infrastructure (5/5 plans) -- completed 2026-03-06
- [x] Phase 6: Layer System & Properties Panel (8/8 plans) -- completed 2026-03-08
- [x] Phase 7: Cinematic FX Effects (10/10 plans) -- completed 2026-03-10

See: `milestones/v0.1.0-ROADMAP.md` for full details.

</details>

### v0.2.0 (Planned)

- [x] **Phase 8: UI Theme System** - Add theme with 3 gray levels (light, medium, dark) to fix overly dark UI (completed 2026-03-12)
- [x] **Phase 9: Canvas Zoom** - Wire up canvas zoom functionality to existing UI +/- percent controls (completed 2026-03-12)
- [ ] **Phase 10: FX Blur Effect** - Dual-quality blur: Dual Kawase for fast playback preview, Gaussian for high-quality rendering
- [x] **Phase 11: Live Canvas Transform** - Direct transform manipulation on canvas preview (move, scale, rotate) in addition to existing parameter controls (completed 2026-03-14)
- [ ] **Phase 12: Layer Keyframe Animation** - Per-layer keyframe motion (opacity, transform) with interpolation curves (cubic, linear) visible on timeline
- [ ] **Phase 13: Sequence Fade In/Out** - Fade with opacity (PNG+alpha transparency) or fade to solid color (default black)
- [ ] **Phase 14: Cross-Sequence Transitions** - Fade between sequences (seq 1 out -> seq 2 in) with cubic/linear interpolation
- [ ] **Phase 15: Audio Import & Waveform** - Import audio files, waveform on timeline, synchronized playback
- [ ] **Phase 16: Beat Sync** - BPM detection, beat markers, snap modes, auto-arrange key photos
- [ ] **Phase 17: PNG Export** - Composited frame export with resolution options, progress, metadata sidecar

## Phase Details

Phases 1-7 archived to `milestones/v0.1.0-ROADMAP.md`.

### Phase 8: UI Theme System
**Goal**: UI is too dark -- add a theme system with different grays (light gray to dark gray) on 3 levels so users get better visual contrast and readability
**Depends on**: Phase 2
**Requirements**: THEME-01, THEME-02, THEME-03
**Success Criteria** (what must be TRUE):
  1. Editor UI supports 3 gray theme levels: light, medium, and dark
  2. User can switch between theme levels and the change persists across sessions
  3. All UI panels, controls, and text remain readable and visually consistent at each level
**Plans**: 3 plans
Plans:
- [ ] 08-01-PLAN.md -- Theme infrastructure: CSS palettes, themeManager, ThemeSwitcher, keyboard shortcut
- [ ] 08-02-PLAN.md -- Hardcoded color conversion: 9 high-impact component files
- [ ] 08-03-PLAN.md -- Remaining color conversion, TimelineRenderer canvas, visual verification

### Phase 9: Canvas Zoom
**Goal**: Wire up the canvas zoom functionality -- the UI +/- percent controls exist at the top-right of the toolbar but are not yet functional. Add keyboard shortcuts, pinch-to-zoom, and true fit-to-window calculation.
**Depends on**: Phase 4
**Requirements**: ZOOM-01, ZOOM-02, ZOOM-03
**Success Criteria** (what must be TRUE):
  1. Canvas zoom +/- buttons and percent display at top-right actually zoom the preview canvas in and out
  2. Zoom level persists while navigating frames and during playback
  3. User can reset zoom to fit-to-window
**Plans**: 4 plans
Plans:
- [x] 09-01-PLAN.md -- Create canvasStore, refactor CanvasArea (gestures, ResizeObserver, fit-to-window)
- [x] 09-02-PLAN.md -- Wire toolbar +/- buttons, keyboard shortcuts (Cmd+=/Cmd+-/Cmd+0), ShortcutsOverlay
- [x] 09-03-PLAN.md -- [gap closure] Fix zoom/pan math, fitToWindow cap, pan bounds, left-click drag panning
- [x] 09-04-PLAN.md -- [gap closure] Add Tauri View menu to fix Cmd+=/Cmd+-/Cmd+0 native interception

### Phase 10: FX Blur Effect
**Goal**: Add blur as a cross-cutting FX capability at three levels: per-layer blur property, per-generator blur property, and standalone blur FX layer -- with dual-quality rendering (downscale-upscale for fast preview, StackBlur for high-quality export)
**Depends on**: Phase 7
**Requirements**: BLUR-01, BLUR-02, BLUR-03, BLUR-04, BLUR-05, BLUR-06
**Success Criteria** (what must be TRUE):
  1. Blur appears as a new FX effect option in the FX generator alongside existing effects (grain, vignette, etc.)
  2. During playback preview, blur uses fast downscale-upscale algorithm for real-time performance
  3. During rendering/export, blur switches to StackBlur algorithm for higher quality output
  4. User can adjust blur intensity/radius and see the preview update in real-time
**Plans**: 4 plans
Plans:
- [x] 10-01-PLAN.md -- Types, blur algorithms (fast + HQ), blurStore, PreviewRenderer integration at all 3 levels
- [x] 10-02-PLAN.md -- AddFxMenu entry, PropertiesPanel blur sections, Toolbar toggles, keyboard shortcuts
- [x] 10-03-PLAN.md -- [gap closure] Fix panel stacking, blur persistence, fast blur quality, HQ/bypass reactivity
- [ ] 10-04-PLAN.md -- [gap closure] Fix Rust serde persistence for blur/radius, fix tainted canvas for HQ blur

### Phase 11: Live Canvas Transform
**Goal**: Users can manipulate layer transforms directly on the canvas preview window (move, scale, rotate) with handles, in addition to the existing parameter panel controls
**Depends on**: Phase 6, Phase 9
**Requirements**: XFORM-01, XFORM-02, XFORM-03, XFORM-04, XFORM-05, XFORM-06, XFORM-07, XFORM-08, XFORM-09, XFORM-10
**Success Criteria** (what must be TRUE):
  1. Selecting a layer shows transform handles (bounding box, rotation, scale corners) on the canvas preview
  2. User can drag to move, corner-drag to scale, and rotate layers directly on the canvas
  3. Canvas transform changes sync bidirectionally with the parameter panel values in real-time
**Plans**: 4 plans
Plans:
- [x] 11-01-PLAN.md -- Data model: split scale into scaleX/scaleY, .mce v4->v5 migration, update renderer + PropertiesPanel
- [x] 11-02-PLAN.md -- Utility modules: coordinate mapping, bounding box geometry, layer + handle hit testing
- [x] 11-03-PLAN.md -- TransformOverlay component: bounding box, handles, drag state machine, CanvasArea integration
- [x] 11-04-PLAN.md -- Keyboard shortcuts: context arrows, Escape deselect, Alt+click cycle, visual verification

### Phase 12: Layer Keyframe Animation
**Goal**: Add per-layer keyframe animation for properties (opacity, transform, blur) -- user selects a content layer, positions the playhead, adjusts parameters, and explicitly adds a keyframe. Keyframes are visible on the timeline as diamond markers when the layer is selected, with configurable interpolation curves.
**Depends on**: Phase 6, Phase 11
**Requirements**: KF-01, KF-02, KF-03, KF-04, KF-05, KF-06, KF-07, KF-08, KF-09, KF-10, KF-11, KF-12, KF-13
**Success Criteria** (what must be TRUE):
  1. User can select a layer, position the playhead, change property values (opacity, position, scale, rotation), and add a keyframe at that frame
  2. User can choose animation interpolation between keyframes (linear, ease-in, ease-out, ease-in-out)
  3. When a layer is selected, its keyframes are displayed on the timeline as markers that can be selected, moved, and deleted
  4. Preview playback animates properties smoothly between keyframes using the chosen interpolation
**Plans**: 5 plans
Plans:
- [x] 12-01-PLAN.md -- Types, interpolation engine, keyframeStore CRUD, .mce v6 format support
- [x] 12-02-PLAN.md -- Preview renderer interpolation, PropertiesPanel [+ Keyframe] button, I key shortcut
- [x] 12-03-PLAN.md -- Timeline diamond rendering, click/drag/delete interaction, interpolation popover
- [ ] 12-04-PLAN.md -- End-to-end visual verification checkpoint
- [ ] 12-05-PLAN.md -- [gap closure] Fix keyframe diamonds disappearing on timeline interaction

### Phase 12.1: Remove bottom parameters bar and relocate to sidebar panel (INSERTED)

**Goal:** Remove the bottom PropertiesPanel bar entirely. Relocate all layer/FX property controls into the left sidebar with collapsible sections. Extract Imported grid and Settings into full-window views. Add sidebar collapse toggle and uniform Scale input.
**Requirements**: 12.1-INFRA, 12.1-SIDEBAR, 12.1-PROPERTIES, 12.1-FX-PROPS, 12.1-SCALE, 12.1-KEYPHOTO, 12.1-IMPORTED, 12.1-SETTINGS, 12.1-TOOLBAR, 12.1-WIRE, 12.1-REMOVE
**Depends on:** Phase 12
**Success Criteria** (what must be TRUE):
  1. Bottom properties bar is completely removed from the editor layout
  2. All property editing (content layers and FX layers) happens in the left sidebar
  3. Sidebar has collapsible SEQUENCES, LAYERS, and PROPERTIES sections
  4. Imported grid and Settings are accessible as full-window views via toolbar buttons
  5. Toolbar is cleaned up: no FPS toggle or ThemeSwitcher, has Imported and Settings buttons
  6. Sidebar is horizontally collapsible
**Plans**: 4 plans

Plans:
- [ ] 12.1-01-PLAN.md -- Extract shared components (NumericInput, SectionLabel), CollapsibleSection, uiStore signals
- [ ] 12.1-02-PLAN.md -- Rebuild sidebar: collapsible sections, SidebarProperties, SidebarFxProperties, uniform Scale
- [ ] 12.1-03-PLAN.md -- ImportedView, SettingsView full-window views, Toolbar cleanup
- [ ] 12.1-04-PLAN.md -- EditorShell wiring (mode switching, sidebar collapse), remove bottom bar, visual verification

### Phase 12.1.1: Big UI frontend design changes with new sidebar layout (INSERTED)

**Goal:** Restructure the sidebar into 3 resizable sub-windows (SEQUENCES, LAYERS, PROPERTIES) with improved key photos inline placement, keyframe navigation bar, inline interpolation controls, resizable sidebar width, double-line collapse trigger, and pixel-perfect visual polish matching the .pen design specification.
**Requirements**: SIDEBAR-LAYOUT, SIDEBAR-CSS, SIDEBAR-RESIZE, SIDEBAR-COLLAPSE, KEY-PHOTOS-INLINE, LAYER-EYE, KF-NAV, KF-INTERP-INLINE, KF-POPOVER-REMOVE, PERSIST-PANELS, TYPOGRAPHY
**Depends on:** Phase 12.1
**Success Criteria** (what must be TRUE):
  1. Sidebar has 3 independently resizable sub-windows with collapse-to-zero via drag
  2. Key photos appear inline under the selected sequence card with slide animation
  3. Keyframe navigation bar (< + trash >) replaces old + Keyframe button
  4. Selecting a timeline diamond swaps blend+opacity for inline interpolation controls
  5. Sidebar width is resizable and double-line collapse handle replaces old chevron
  6. All sidebar colors use --sidebar-* CSS variables with theme variants
  7. Layer rows have eye icon visibility toggle and grip-vertical drag handle
**Plans**: 5 plans

Plans:
- [ ] 12.1.1-01-PLAN.md -- Infrastructure: CSS variables, lucide-preact, Rust config, uiStore signals, pure logic utilities
- [ ] 12.1.1-02-PLAN.md -- Layout: LeftPanel rewrite, PanelResizer, SidebarResizer, CollapseHandle, EditorShell update
- [ ] 12.1.1-03-PLAN.md -- Components: SequenceItem cards + inline key photos, LayerRow redesign, typography updates
- [ ] 12.1.1-04-PLAN.md -- Keyframe features: KeyframeNavBar, InlineInterpolation, SidebarProperties update, popover removal
- [ ] 12.1.1-05-PLAN.md -- Build verification and visual verification checkpoint

### Phase 12.2: Auto-seek timeline to sequence start on sidebar selection (INSERTED)

**Goal:** When user selects a sequence in the SEQUENCES sidebar panel, automatically move the timeline scrub/playhead position to the start frame of that sequence.
**Requirements**: 12.2-SEEK
**Depends on:** Phase 12.1.1
**Success Criteria** (what must be TRUE):
  1. Selecting a sequence in the sidebar automatically moves the timeline playhead to that sequence's first frame
**Plans:** 1/1 plans complete

Plans:
- [x] 12.2-01-PLAN.md -- Wire handleSelect to auto-seek playhead via trackLayouts + playbackEngine.seekToFrame

### Phase 12.3: Add quick keys for navigation (INSERTED)

**Goal:** Add keyboard shortcuts for timeline navigation: right/left arrows for frame-by-frame scrub, Home/End for go to start/end of timeline, Page Up/Page Down for jump to next/previous in-between sequence.
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Depends on:** Phase 12.2
**Success Criteria** (what must be TRUE):
  1. Home key moves the timeline playhead to frame 0
  2. End key moves the timeline playhead to the last frame
  3. Page Up jumps the playhead to the start of the previous content sequence
  4. Page Down jumps the playhead to the start of the next content sequence
  5. ShortcutsOverlay documents all new navigation shortcuts
**Plans:** 1/1 plans complete

Plans:
- [ ] 12.3-01-PLAN.md -- Navigation helpers, Home/End/PageUp/PageDown bindings, ShortcutsOverlay update

### Phase 12.4: ShortcutsOverlay tabbed/paginated sections per group (INSERTED)

**Goal:** Replace the flat 2-column grid in ShortcutsOverlay with a tabbed interface. Add a "Sections" index tab as table of contents, 7 group tabs (Playback, File, Editing, Navigation, Canvas, Blur, Keyframes), and full keyboard navigation (Arrow Left/Right, Tab, number keys 1-7, Arrow Up/Down in Sections, Enter to jump).
**Requirements**: SC-TABS, SC-SECTIONS, SC-KEYNAV, SC-RESET
**Depends on:** Phase 12.3
**Success Criteria** (what must be TRUE):
  1. Each shortcut group is accessible via its own tab (8 tabs total: Sections + 7 groups)
  2. Sections index tab shows all 7 group names with entry counts, clickable to jump to group
  3. Full keyboard navigation: Arrow Left/Right cycle tabs, Tab advances, number keys 1-7 direct jump, Arrow Up/Down navigate Sections rows, Enter jumps from Sections
  4. Modal height remains stable across tab switches and overlay resets to Sections tab on reopen
**Plans:** 1 plan

Plans:
- [ ] 12.4-01-PLAN.md -- Tab bar, Sections index, group content, keyboard navigation, visual verification

### Phase 12.5: Vertical scroll issues (INSERTED)

**Goal:** Fix timeline canvas vertical scrolling by adding a custom 4px vertical scrollbar (DOM element beside the canvas) and auto vertical scroll during playback to keep the active track visible when tracks overflow the timeline panel.
**Requirements**: VSCROLL-01, VSCROLL-02, VSCROLL-03, VSCROLL-04, VSCROLL-05
**Depends on:** Phase 12.4
**Success Criteria** (what must be TRUE):
  1. A 4px vertical scrollbar is always visible at the right edge of the timeline panel
  2. The scrollbar thumb reflects the current scroll position and content-to-viewport ratio
  3. Dragging the scrollbar thumb scrolls the timeline vertically
  4. Clicking the scrollbar track (not the thumb) jumps scrollY to that relative position
  5. During playback, when the playhead enters a sequence whose track is off-screen, the timeline auto-scrolls vertically to show that track
**Plans:** 2/2 plans complete

Plans:
- [ ] 12.5-01-PLAN.md -- Store infrastructure (viewportHeight, totalContentHeight, maxScrollY, ensureTrackVisible), TimelineScrollbar component, TimelinePanel layout wiring
- [ ] 12.5-02-PLAN.md -- Auto vertical scroll in playbackEngine tick loop, visual verification checkpoint

### Phase 12.6: Layer sequence auto-selection and key photo UX fixes (INSERTED)

**Goal:** Fix sequence/layer auto-selection UX: auto-select new sequences with open key photo section, open importer on creation with multi-select confirm flow, auto-select top-most layer on sequence selection, and improve key photo strip sync with timeline
**Requirements**: 12.6-01, 12.6-02, 12.6-03, 12.6-04, 12.6-05
**Depends on:** Phase 12.5
**Success Criteria** (what must be TRUE):
  1. Clicking + Add creates a new sequence, auto-selects it, opens importer in multi-select mode with Confirm button
  2. Cancelling the importer after + Add deletes the newly created sequence (transactional creation)
  3. Switching sequences auto-selects the top-most layer with visible transform overlay handles
  4. Clicking a key photo seeks the playhead to that photo's frame and selects the top-most layer
  5. Key photo strip auto-scrolls on timeline scrub and playback stop, but not during playback
**Plans:** 3 plans

Plans:
- [x] 12.6-01-PLAN.md -- Layer auto-selection on sequence switch, key photo click enhancements, strip auto-scroll, empty sequence prompt
- [x] 12.6-02-PLAN.md -- New sequence creation transactional flow with multi-select importer
- [ ] 12.6-03-PLAN.md -- [gap closure] Fix key photo click vertical scroll

### Phase 13: Sequence Fade In/Out
**Goal**: Add fade in/out transitions on sequences -- fade with opacity for transparent PNG+alpha export, or fade to/from any solid color (default black)
**Depends on**: Phase 12
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can set fade-in and fade-out duration (in frames) on a sequence
  2. Fade supports two modes: opacity fade (for transparent PNG+alpha export) and solid color fade (configurable color, default black)
  3. Fade is visible in real-time preview playback and correctly rendered in PNG export
**Plans**: TBD

### Phase 14: Cross-Sequence Transitions
**Goal**: Add fade transitions between sequences -- sequence 1 fades out while sequence 2 fades in, with configurable interpolation curves
**Depends on**: Phase 13
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can set a crossfade transition between two adjacent sequences with configurable duration (in frames)
  2. User can choose interpolation curve for the transition (linear, cubic, ease-in, ease-out)
  3. Crossfade is visible in real-time preview and correctly composited in PNG export
**Plans**: TBD

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
v0.2.0: 8 > 9 > 10 > 11 > 12 > 12.1 > 12.1.1 > 12.2 > 12.3 > 12.4 > 12.5 > 12.6 > 13 > 14 > 15 > 16 > 17

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
| 8. UI Theme System | 3/3 | Complete   | 2026-03-12 | - |
| 9. Canvas Zoom | v0.2.0 | 4/4 | Complete | 2026-03-12 |
| 10. FX Blur Effect | 3/4 | In Progress|  | - |
| 11. Live Canvas Transform | 4/4 | Complete    | 2026-03-14 | - |
| 12. Layer Keyframe Animation | 4/5 | In Progress|  | - |
| 12.1. Remove Bottom Parameters Bar | 3/4 | In Progress|  | - |
| 12.1.1. Big UI Frontend Design Changes | 4/5 | In Progress|  | - |
| 12.2. Auto-seek Timeline to Sequence Start | 1/1 | Complete    | 2026-03-17 | - |
| 12.3. Add Quick Keys for Navigation | 1/1 | Complete    | 2026-03-17 | - |
| 12.4. ShortcutsOverlay Tabbed Sections | v0.2.0 | 0/1 | In Progress | - |
| 12.5. Vertical Scroll Issues | 2/2 | Complete    | 2026-03-18 | - |
| 12.6. Layer Sequence Auto-Selection | 2/3 | In Progress | 2026-03-18 | - |
| 13. Sequence Fade In/Out | v0.2.0 | 0/0 | Planned | - |
| 14. Cross-Sequence Transitions | v0.2.0 | 0/0 | Planned | - |
| 15. Audio Import & Waveform | v0.2.0 | 0/0 | Planned | - |
| 16. Beat Sync | v0.2.0 | 0/0 | Planned | - |
| 17. PNG Export | v0.2.0 | 0/0 | Planned | - |
