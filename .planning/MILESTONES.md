# Milestones

## v0.7.0 Monorepo & Paint Enhancements (Shipped: 2026-04-05)

**Phases:** 2 completed (26, 33) + 6 failed/abandoned (27-32) | **Plans:** 23 | **Tasks:** 40
**Lines of code:** 40,014 TypeScript (+40,609 / -1,950 net, 459 files changed)
**Timeline:** 3 days (2026-04-03 → 2026-04-05) | **Commits:** 138
**Git range:** `docs: start milestone v0.7.0` → `feat: v0.7.0 Monorepo & Paint Enhancements` | **Tag:** v0.7.0

**Delivered:** Converted to pnpm monorepo with app/ + packages/efx-physic-paint/, and overhauled the paint engine with a 3-mode system (flat/FX/physical-placeholder), inline 4-mode color picker with swatches, FX stroke wireframe overlay, stroke draw-reveal animation, circle cursor overlay, and brush persistence. Phases 27-32 (engine adapter approach) were abandoned — efx-physic-paint deferred to v0.8.0 as a standalone window.

**Key accomplishments:**

1. pnpm monorepo scaffold: Application/ → app/ with git history preserved, workspace root lockfile, efx-physic-paint as `packages/efx-physic-paint/` workspace package
2. Paint undo/redo overhaul: _notifyVisualChange + FX cache invalidation fixes all rendering bugs; immediate FX brush drawing without pointer movement required
3. 3-mode paint system (flat/FX/physical-placeholder) with per-frame mode exclusivity, conversion dialogs, and transparent flat background
4. Inline 4-mode color picker (Box/TSL/RVB/CMYK) with HEX input, recent colors, and favorite swatches persisted via LazyStore; canvas-adjacent 260px panel
5. FX stroke wireframe overlay: dashed path + bounding box for selected strokes with bbox-only hit testing
6. Stroke draw-reveal animation: speed-based point distribution across frame range with inverse distance weighting and atomic single-Cmd+Z undo

**Known Gaps (requirements not completed):**

- MONO-05: `pnpm tauri build` not verified post-monorepo (dev server confirmed working)
- ENGN-01 through ENGN-06: Engine headless API — deferred to v0.8.0
- ECUR-01, 05, 06, 08, 11, 12: Minor UX improvements — deferred to v0.8.0
- PAINT-01 through PAINT-12: Physics paint tools — deferred to v0.8.0
- NCAP-01 through NCAP-03: New paint capabilities — deferred to v0.8.0
- PERS-01 through PERS-03: Persistence/compatibility for new engine — deferred to v0.8.0

**Technical debt carried forward:**

- S key shortcut lacks isPaintEditMode() guard (low severity, flagged since v0.6.0)
- Coalescing API still partially wired (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (carried from v0.2.0)

**Archives:** `milestones/v0.7.0-ROADMAP.md`, `milestones/v0.7.0-REQUIREMENTS.md`

---

## v0.6.0 Various Enhancements (Shipped: 2026-04-03)

**Phases:** 4 (Phases 22-25) | **Plans:** 14 | **Tasks:** 28
**Lines of code:** 40,688 TypeScript (+15,167 / -827 net)
**Timeline:** 8 days (2026-03-26 → 2026-04-03) | **Commits:** 107
**Git range:** `feat(22-01)` → `feat(25-03)` | **Tag:** v0.6.0

**Delivered:** Stroke management with drag-reorder, visibility toggles, and multi-select; bezier path editing with fit-curve conversion and interactive anchor/handle manipulation; Alt+drag duplicate and non-uniform scale transforms; paint panel reorganization and UX polish across paint and motion workflows.

**Key accomplishments:**

1. Paint store stabilization: fixed moveElements* bugs, added _notifyVisualChange helper, snapshot-based undo/redo for all transform gestures (move, rotate, scale)
2. Alt+drag duplicate for all paint element types and non-uniform edge-handle scale with 4 circular midpoint handles — both with single-entry undo/redo
3. StrokeList panel with SortableJS drag reorder, visibility toggles, delete, multi-select (Cmd+click/Shift+click), and bidirectional canvas-list selection sync
4. Bezier path editing: fit-curve freehand-to-bezier conversion, interactive anchor/handle dragging, add/delete control points, pen tool overlay with progressive simplification
5. Paint properties panel reorganized with 2-col grid layouts, auto-flatten on exit paint mode, and isolation-scoped layer creation
6. Motion path sub-frame dot density fix (4x denser dots for short sequences)

**Technical debt carried forward:**

- S key shortcut lacks isPaintEditMode() guard (low severity)
- Coalescing API still partially wired (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (carried from v0.2.0)

**Archives:** `milestones/v0.6.0-ROADMAP.md`, `milestones/v0.6.0-REQUIREMENTS.md`, `milestones/v0.6.0-MILESTONE-AUDIT.md`

---

## v0.5.0 Motion Blur & Paint Styles (Shipped: 2026-03-26)

**Phases completed:** 2 phases, 8 plans, 15 tasks

**Key accomplishments:**

- Extended PaintStroke with fxState field, added per-frame FX cache to paintStore, and renderFrameFx() to brushP5Adapter for Kubelka-Munk spectral batch rendering
- renderPaintFrameWithBg() with solid background fill, frame-level FX cache compositing via drawImage, and PAINT BACKGROUND color picker in PaintProperties
- Select tool with hit testing, per-frame FX application via renderFrameFx for spectral mixing, sequence overlay toggle, and previewRenderer wired to renderPaintFrameWithBg
- flattenFrame/unflattenFrame methods with per-frame cache rendering via renderFrameFx, persistence fxState round-trip with cache regeneration on load, and Flatten Frame button in select mode
- MotionBlurSettings type, reactive store with peek() accessors, WebGL2 GLSL directional blur shader, and velocity computation engine with 17 unit tests
- Per-layer GLSL motion blur wired into PreviewRenderer with VelocityCache seek invalidation, plus toolbar toggle button with shutter angle slider and quality tier popover
- Combined GLSL velocity blur + sub-frame accumulation export pipeline with Motion Blur dialog section and .mce v15 persistence
- Keyboard shortcut 'M' toggles motion blur with paint-mode guard; 27 unit tests pass covering store signals, shutter angle clamping, VelocityCache seek invalidation, and isStationary boundary cases

---

## v0.4.0 Canvas & Paint (Shipped: 2026-03-25)

**Phases:** 2 (Phases 18-19) | **Plans:** 9 | **Tasks:** 19
**Lines of code:** 34,067 (31,814 TypeScript + 2,253 Rust)
**Timeline:** 2 days (2026-03-24 → 2026-03-25) | **Commits:** 75
**Quick tasks:** 1 inline fix (tablet pen support)

**Delivered:** After Effects-style canvas motion path with interactive keyframe markers, and a complete frame-by-frame paint/rotopaint layer with perfect-freehand brush engine, 7 drawing tools, onion skinning, flood fill, and sidecar JSON persistence.

**Key accomplishments:**

1. After Effects-style canvas motion path with dotted trail, keyframe circle markers, drag-to-reposition interaction, auto-seek, and undo-coalesced position editing
2. Unified keyframe upsert routing for sidebar and canvas drag edits, closing the real-time preview gap for keyframed layers
3. Frame-by-frame paint/rotopaint layer with perfect-freehand brush engine, eraser, line, rect, ellipse, eyedropper, and flood fill tools
4. Paint layer rendering integrated into PreviewRenderer compositing loop with blend modes, opacity, and export pipeline passthrough
5. Onion skinning overlay for rotoscoping workflow with configurable frame range and opacity falloff via offscreen canvas compositing
6. Sidecar JSON persistence for paint frames with project format v14, Tauri FS read/write, and Rust paint/ directory creation
7. Tablet pen support with pressure sensitivity, tilt modulation, coalesced pointer events, and backward-compatible stroke defaults

**Technical debt carried forward:**

- Coalescing API partially resolved (motion path drag uses it) but still unwired in most UI (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset) (carried from v0.2.0)
- 3 pre-existing audioWaveform test failures (unrelated to v0.4.0 work)

**Archives:** `milestones/v0.4.0-ROADMAP.md`

---

## v0.3.0 Audio & Polish (Shipped: 2026-03-24)

**Phases:** 8 (Phases 15-17, 15.1-15.4, 17.1) | **Plans:** 29 | **Tasks:** 63
**Lines of code:** 31,522 (29,037 TypeScript + 2,157 Rust + 328 CSS)
**Timeline:** 5 days (2026-03-20 → 2026-03-24) | **Commits:** ~327
**Quick tasks:** 7 inline fixes

**Delivered:** Audio import with waveform visualization and synced playback, media in-use tracking with cascade removal, solid/transparent key entries with gradient fills, GLSL shader effects (17 Shadertoy + 18 GL transitions), audio export with BPM beat sync, and a streamlined 2-panel adaptive sidebar.

**Key accomplishments:**

1. Audio import with waveform visualization, synced playback, volume/fade controls, timeline interactions (click, drag, trim, slip, reorder, resize), and .mce v8-v9 persistence
2. Media in-use tracking with color-coded badges, portal-based usage popovers, and cascade asset removal with composite undo across sequenceStore/audioStore/imageStore
3. Solid/transparent key entries with split add button, inline color picker, timeline/canvas/export rendering, cross-dissolve blending, and .mce v10 persistence
4. GLSL shader system: WebGL2 runtime with 17 Shadertoy-ported effects, ShaderBrowser with animated previews, parameter controls, and keyframe animation support
5. GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, TransitionProperties sidebar, teal timeline overlays, and .mce v11 persistence
6. Audio export with OfflineAudioContext pre-render, FFmpeg muxing, BPM detection via onset autocorrelation, beat markers, snap-to-beat, auto-arrange strategies, and .mce v12 persistence
7. Sidebar enhancements: collapsible key photos, global solo mode (S key), gradient fills (linear/radial/conic) with draggable stops, and .mce v13 persistence
8. Adaptive 2-panel sidebar with sequence/layer view switching, Layers icon with green count badge, back navigation, and 3-to-2 panel flex migration

**Technical debt carried forward:**

- Coalescing API still unwired in UI (carried from v0.1.0)
- canUndo/canRedo signals unused for button state (carried from v0.1.0)
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset) (carried from v0.2.0)
- GLSL/GLT requirements not formally tracked in REQUIREMENTS.md (phases inserted urgently)

**Archives:** `milestones/v0.3.0-ROADMAP.md`, `milestones/v0.3.0-REQUIREMENTS.md`

---

## v0.2.0 Pipeline Complete (Shipped: 2026-03-21)

**Phases:** 23 (Phases 8-14, 12.1-12.15) | **Plans:** 66 | **Tasks:** 128
**Lines of code:** 20,428 (18,110 TypeScript + 2,020 Rust + 298 CSS)
**Timeline:** 18 days (2026-03-03 → 2026-03-21) | **Commits:** 847
**Quick tasks:** 44 inline fixes

**Delivered:** Complete stop-motion-to-cinema pipeline with keyframe animation, GPU blur, content overlay layers, fade/cross-dissolve transitions, PNG sequence + video export (ProRes/H.264/AV1), and a full sidebar redesign with 14 UX refinement sub-phases.

**Key accomplishments:**

1. Per-layer keyframe animation with polynomial cubic easing, timeline diamond markers, interpolation-aware icons, and 14 decimal sub-phases of UX refinement (sidebar redesign, auto-seek, quick keys, shortcuts overlay, vertical scroll, auto-selection, GPU blur, fullscreen, content overlays, linear timeline, buttons, sequence isolation)
2. PNG sequence + video export (ProRes/H.264/AV1) with FFmpeg auto-provisioning, resolution multipliers, progress tracking, metadata sidecars, and native notifications
3. GPU-accelerated WebGL2 two-pass separable Gaussian blur replacing dual CPU algorithms with constant-cost rendering
4. Content overlay layers (static image, image sequence, video) as timeline-level sequences with full property controls and keyframe support
5. Fade/cross-dissolve transitions with opacity/solid-color modes, DaVinci Resolve-style timeline overlays, and configurable interpolation
6. Complete sidebar redesign: 3 resizable sub-windows, inline key photos, keyframe navigation bar, inline interpolation controls, and 21 CSS variables across 3 theme variants
7. 3-level UI theme system (dark/medium/light) with CSS variable architecture and persistent preference
8. Full-speed playback mode (Shift+Space) and fullscreen canvas (Cmd+Shift+F) with letterboxed preview

**Technical debt carried forward:**

- 4 phases missing VERIFICATION.md (10, 12.1, 12.1.1, 12.4) — all features functional
- 2 medium-severity export edge cases (content-overlay preload, FX generator frame offset)
- 5 phases missing Nyquist VALIDATION.md (8, 12, 12.8, 12.14, 13)
- Coalescing API still unwired in UI (carried from v0.1.0)

**Archives:** `milestones/v0.2.0-ROADMAP.md`, `milestones/v0.2.0-MILESTONE-AUDIT.md`
**Phases:** `milestones/v0.2.0-phases/` (Phases 8-14, 12.1-12.15)

---

## v0.1.0 (Shipped: 2026-03-11)

**Phases:** 8 (Phases 1-4, 3.1, 5-7) | **Plans:** 36 | **Requirements:** 76
**Lines of code:** 10,159 (8,753 TypeScript + 1,352 Rust + 54 CSS)
**Timeline:** 10 days (2026-03-02 → 2026-03-11) | **Commits:** 284
**Git range:** `feat(01-01)` → `feat(quick-11)` | **Tag:** v0.1.0

**Delivered:** Complete stop-motion editor with multi-layer compositing, cinematic FX effects, undo/redo, keyboard shortcuts, and project management — from Tauri scaffold through production-ready editing.

**Key accomplishments:**

1. Tauri 2.0 + Preact + Motion Canvas + Tailwind CSS v4 foundation with 6 reactive signal stores and dark theme editor UI
2. Rust image pipeline with drag-and-drop import, thumbnail generation, and LRU memory management
3. Project management (.mce format v4) with auto-save, recent projects, unsaved-changes guard
4. Canvas-based timeline with virtualized rendering, playhead scrubbing, zoom, and real-time preview playback
5. Undo/redo command pattern engine (100+ levels) with keyboard shortcuts (JKL shuttle, Space, Cmd+Z/S/N/O)
6. Multi-layer compositing: static image, image sequence, and video layers with blend modes, opacity, transforms, drag-reorder
7. Cinematic FX effects: film grain, vignette, color grade, dirt/scratches, light leaks as FX sequences with timeline range bars
8. 11 quick-task bug fixes and UI polish iterations

**Technical debt carried forward:**

- Coalescing API (startCoalescing/stopCoalescing) unwired in UI
- canUndo/canRedo signals unused for button state
- 07-11 (Add FX button to timeline) listed but never needed

**Archives:** `milestones/v0.1.0-ROADMAP.md`, `milestones/v0.1.0-REQUIREMENTS.md`, `milestones/v0.1.0-MILESTONE-AUDIT.md`
**Phases:** `milestones/v0.1.0-phases/` (Phases 1-4, 3.1, 5-7)

---
