# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes, transforms, and keyframe animation, apply cinematic FX effects (film grain, vignette, color grade, blur, dirt/scratches, light leaks) and GLSL shader effects (17 Shadertoy + 18 GL transitions), add fade/cross-dissolve/GL transitions, import audio with waveform visualization and beat-synced editing, draw frame-by-frame with pressure-sensitive brush/shape/fill tools and onion skinning with expressive brush FX (watercolor, ink, charcoal, pencil, marker) via p5.brush with spectral pigment mixing, edit keyframe positions directly on canvas via motion path, apply per-layer GLSL velocity motion blur with shutter angle controls, preview in real-time on a canvas-based timeline with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1) with audio and motion blur sub-frame accumulation. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v0.1.0 delivered the editing foundation; v0.2.0 completed the pipeline with keyframe animation, GPU blur, content overlays, transitions, and multi-format export; v0.3.0 added audio with beat sync, GLSL shader effects/transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar; v0.4.0 added canvas motion path editing and frame-by-frame paint/rotopaint layers; v0.5.0 added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export.

## Core Value

Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## Requirements

### Validated

- ✓ Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold with IPC bridge and asset protocol — v0.1.0
- ✓ Motion Canvas player embedding with signal store architecture (6 stores) — v0.1.0
- ✓ React UI prototype converted to Preact with dark theme and all panels — v0.1.0
- ✓ Image import via drag-and-drop and file dialog with Rust thumbnail generation — v0.1.0
- ✓ Image pool with LRU eviction for memory safety — v0.1.0
- ✓ Project management (create, save, open, auto-save, recent projects, .mce format v4) — v0.1.0
- ✓ Global app config persists between sessions — v0.1.0
- ✓ Sequence management (create, duplicate, delete, reorder, key photos with hold duration) — v0.1.0
- ✓ Per-sequence frame rate and resolution settings — v0.1.0
- ✓ Canvas-based timeline with virtualized frame rendering, playhead, scrubbing, zoom — v0.1.0
- ✓ Real-time preview playback at project fps with step forward/backward — v0.1.0
- ✓ Preview zoom/pan and sequence reorder on timeline — v0.1.0
- ✓ Audio-sync-ready clock architecture (performance.now() delta accumulation) — v0.1.0
- ✓ Store lifecycle fixes (clean reset on project switch, no data bleed) — v0.1.0
- ✓ Undo/redo command pattern engine (100+ levels) — v0.1.0
- ✓ Keyboard shortcuts (Space, arrows, JKL shuttle, Cmd+Z/S/N/O, ?, Delete) — v0.1.0
- ✓ Multi-layer compositing with static image, image sequence, and video layers — v0.1.0
- ✓ Blend modes (normal, screen, multiply, overlay, add) and opacity per layer — v0.1.0
- ✓ Layer transforms (position, scale, rotation, crop) — v0.1.0
- ✓ Context-sensitive properties panel — v0.1.0
- ✓ Cinematic FX effects (film grain, vignette, color grade, dirt/scratches, light leaks) — v0.1.0
- ✓ FX as timeline-level sequences with draggable range bars — v0.1.0
- ✓ Resolution-independent FX parameters — v0.1.0
- ✓ 3-level UI theme system (dark/medium/light) with CSS variable architecture — v0.2.0
- ✓ Canvas zoom/pan with keyboard shortcuts, pinch gestures, and fit-to-window — v0.2.0
- ✓ GPU-accelerated WebGL2 blur with CPU StackBlur fallback — v0.2.0
- ✓ Live canvas transform manipulation (move, scale, rotate) with handles — v0.2.0
- ✓ Per-layer keyframe animation with interpolation curves (linear, ease-in, ease-out, ease-in-out) — v0.2.0
- ✓ Content overlay layers (static image, image sequence, video) as timeline-level sequences — v0.2.0
- ✓ Redesigned sidebar with 3 resizable sub-windows, inline key photos, keyframe navigation — v0.2.0
- ✓ Fade/cross-dissolve transitions with opacity and solid color modes — v0.2.0
- ✓ Export as PNG image sequence with resolution multipliers, progress, metadata sidecars — v0.2.0
- ✓ Video export (ProRes/H.264/AV1) via FFmpeg auto-provisioning — v0.2.0
- ✓ Full-speed playback mode and fullscreen canvas with letterboxed preview — v0.2.0
- ✓ Sequence isolation (solo) and global loop playback toggle — v0.2.0
- ✓ Linear timeline layout mode with togglable stacked/linear views — v0.2.0
- ✓ Lucide-preact SVG icon buttons with keyboard shortcut tooltips — v0.2.0
- ✓ Tabbed shortcuts overlay with 7 groups and full keyboard navigation — v0.2.0
- ✓ Timeline vertical scrollbar with playback auto-scroll — v0.2.0
- ✓ Solid color and transparent key entries with full data pipeline, UI controls, and rendering — v0.3.0
- ✓ Audio import with waveform visualization, synced playback, volume/fade controls, timeline interactions — v0.3.0
- ✓ Media in-use tracking with color-coded badges, usage popovers, and cascade removal with undo — v0.3.0
- ✓ GLSL shader effects: WebGL2 runtime, 17 Shadertoy-ported effects, ShaderBrowser, parameter controls — v0.3.0
- ✓ GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, timeline/sidebar integration — v0.3.0
- ✓ Audio export with BPM detection, beat markers, snap-to-beat, auto-arrange strategies — v0.3.0
- ✓ Collapsible key photo lists, global solo mode (S key), gradient fills (linear/radial/conic) — v0.3.0
- ✓ Adaptive 2-panel sidebar with sequence/layer view switching, Layers icon with count badge — v0.3.0
- ✓ Tailwind v4 syntax migration across 33 component files — v0.3.0
- ✓ Project format .mce v8→v13 progressive migration with full backward compatibility — v0.3.0
- ✓ Canvas motion path with After Effects-style dotted trail, keyframe circle markers, and drag-to-reposition interaction — v0.4.0
- ✓ Paint/rotopaint layer with perfect-freehand brush engine, 7 drawing tools, onion skinning, flood fill, and sidecar persistence — v0.4.0
- ✓ Tablet pen support with pressure sensitivity, tilt modulation, and coalesced pointer events — v0.4.0
- ✓ Project format .mce v14 with paint layer sidecar persistence — v0.4.0
- ✓ Paint brush styles (watercolor, ink, charcoal, pencil, marker) via p5.brush standalone rendering — v0.5.0
- ✓ Spectral pigment mixing (Kubelka-Munk) for physically-based color blending — v0.5.0
- ✓ Watercolor bleed, paper texture, and flow field distortion for organic rendering — v0.5.0
- ✓ Grain/texture post-effects and edge darkening per brush style — v0.5.0
- ✓ Brush style UI selector with SVG thumbnails in PaintProperties panel — v0.5.0
- ✓ Non-destructive FX workflow: draw flat, select, apply style, flatten for performance — v0.5.0
- ✓ Per-frame FX cache with spectral mixing across overlapping strokes — v0.5.0
- ✓ GLSL per-layer velocity motion blur for real-time preview — v0.5.0
- ✓ Sub-frame accumulation buffer for high-quality export (Float32 averaging, 8-128 samples) — v0.5.0
- ✓ Combined GLSL + sub-frame motion blur pipeline for export — v0.5.0
- ✓ Motion blur shutter angle UI control and preview toolbar toggle — v0.5.0
- ✓ Motion blur export settings (sample count, shutter angle override) — v0.5.0
- ✓ Project-level motion blur settings with .mce v15 persistence — v0.5.0
- ✓ Export selected sequence only option — v0.5.0

### Active

- [ ] Compositing FX paint via luma matte extraction (paint over photos without alpha)
- [ ] Paper/canvas texture on paint layer (shader or tiled textures from Krita)
- [ ] Duplicate stroke with Alt+move on same frame in roto paint edit mode
- [ ] Non-uniform scale for paint layer's strokes
- [ ] Reorder/clean Paint properties panel (space optimization, better buttons)
- [ ] Sequence-scoped layer creation (add layer only on isolated sequence if selected)
- [ ] Denser motion path interpolation visual (more dots for short sequences)
- [ ] Bezier/spline stroke path editing in roto paint
- [ ] Stroke list panel in roto paint edit mode (drag-and-drop, delete, selection, hide)

## Current Milestone: v0.6.0 Various Enhancements

**Goal:** Improve paint compositing, add paper textures, stroke management, bezier path editing, and several UX refinements across paint and motion editing workflows.

**Target features:**
- Compositing FX paint via luma matte extraction
- Paper/canvas texture on paint layer
- Duplicate stroke with Alt+move in roto paint edit mode
- Non-uniform scale for paint layer's strokes
- Reorder/clean Paint properties panel
- Sequence-scoped layer creation
- Denser motion path interpolation visual
- Bezier/spline stroke path editing in roto paint
- Stroke list panel in roto paint edit mode

## Latest Milestone: v0.5.0 Motion Blur & Paint Styles (Shipped 2026-03-26)

2 phases, 8 plans over 2 days. See `.planning/MILESTONES.md` for details.

### Out of Scope

- Live camera tethering — different product category (Dragonframe owns this)
- Plugin/extension system — requires stable internal APIs; premature
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users

## Context

Shipped v0.5.0 with 40,066 LOC (37,810 TypeScript + 2,256 Rust) across ~116 commits since v0.4.0.
Tech stack: Tauri 2.0, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm, p5.brush (standalone).
Architecture: 13 reactive signal stores (project, sequence, layer, keyframe, timeline, canvas, ui, blur, isolation, export, audio, solo, paint, motionBlur), Rust image pipeline with thumbnail generation, Canvas 2D PreviewRenderer with multi-layer compositing (including paint layers with per-frame FX cache), WebGL2 GPU blur (glBlur.ts) with CPU fallback, WebGL2 GLSL runtime (glslRuntime) for shader effects and GL transitions, WebGL2 GLSL motion blur (glMotionBlur.ts) with VelocityCache and triangle filter kernel, p5.brush adapter (brushP5Adapter.ts) for spectral pigment mixing and brush FX rendering, FX generator system with seeded PRNG, keyframe interpolation engine with polynomial cubic easing and unified upsert routing, PlaybackEngine with rAF delta accumulation and full-speed mode, Web Audio engine with fade scheduling and waveform peak extraction, BPM detector with onset autocorrelation, OfflineAudioContext pre-render for export, perfect-freehand brush engine with pressure/tilt support, paint sidecar JSON persistence via Tauri FS, sub-frame accumulation export pipeline for motion blur, command-pattern undo/redo engine, tinykeys keyboard shortcuts, exportRenderer with yielding frame loop and FFmpeg video/audio encoding.
Project format: .mce v15 with backward compatibility (v1 through v15).

Known technical debt:
- 2 medium-severity export edge cases (content-overlay image preload, FX generator frame offset) — carried from v0.2.0
- Coalescing API partially resolved (motion path drag uses startCoalescing/stopCoalescing) — most UI interactions still unwired (carried from v0.1.0)
- canUndo/canRedo signals exported but no UI consumes them for button disabling — carried from v0.1.0
- 3 pre-existing audioWaveform test failures (unrelated to v0.5.0 work)

## Constraints

- **Platform:** macOS only — native title bar, file dialogs, macOS conventions
- **Framework:** Tauri 2.0 (Rust backend) + Preact (not React) + Preact Signals (not Redux/MobX)
- **Package manager:** pnpm
- **Rendering:** Canvas 2D PreviewRenderer for compositing; WebGL2 GPU blur (glBlur.ts) with CPU StackBlur fallback; @efxlab/motion-canvas-* v4.0.0 for player embedding
- **Styling:** Tailwind CSS v4 + custom components — no heavy UI libraries
- **Performance:** Preview must play smoothly at 15/24 fps
- **Min resolution:** 1280x720 window minimum

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preact over React | 3KB bundle, fastest rendering, Signals built-in | ✓ Good — reactive stores clean, zero perf issues |
| Tailwind v4 + Custom over UI library | No heavy overhead (~500KB saved), full control over editor UI | ✓ Good — dark theme with 28+ CSS variables |
| pnpm as package manager | User preference, fast installs, strict dependency resolution | ✓ Good — overrides fixed Motion Canvas workspace:* bug |
| Canvas 2D PreviewRenderer over Motion Canvas generators | Direct compositing control, simpler layer model | ✓ Good — clean multi-layer rendering with blend modes |
| Custom command-pattern undo over external library | Operation-level granularity, snapshot/restore with structuredClone | ✓ Good — works across all store mutations |
| tinykeys over hotkeys-js | 650B, TypeScript-native, layout-aware | ✓ Good — all shortcuts working, ? overlay included |
| FX as timeline-level sequences | FX apply globally with temporal range, not per-layer | ✓ Good — clean separation, draggable range bars on timeline |
| SortableJS with forceFallback:true | CSS transforms bypass Tauri native HTML5 DnD interception | ✓ Good — reliable drag reorder in sidebar |
| Canvas 2D for timeline | Full control over rendering, virtualization, pointer events | ✓ Good — smooth at 100+ frames |
| .mce progressive format migration | v1→v7 without breaking old files | ✓ Good — seamless loading of any version |
| PNG sequence + video export | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | ✓ Good — FFmpeg auto-provisioned, ProRes/H.264/AV1 |
| WebGL2 GPU blur over dual CPU | Constant-cost regardless of radius/layer count | ✓ Good — replaced HQ/fast toggle with always-HQ |
| Content overlays as sequence kind | Reuses FX track pipeline with content compositing | ✓ Good — interleaves cleanly with FX on timeline |
| Polynomial cubic easing over bezier curves | Simpler math, 21 unit tests, sufficient for stop-motion | ✓ Good — smooth interpolation, no overshooting |
| Intent-driven add-layer flows | Eliminates popover dialogs, reuses ImportedView | ✓ Good — consistent UX for all layer types |
| audioStore follows sequenceStore pattern | Signals, snapshot/restore, pushAction undo — proven architecture | ✓ Good — zero friction adding 11th store |
| Onset autocorrelation for BPM detection | Accurate, fast, no external DSP dependency needed | ✓ Good — reliable detection without heavy libraries |
| GlTransition as separate type (not overloading Transition) | Clean mutual exclusion between cross-dissolve and GL transitions | ✓ Good — D-02 mutual exclusion simple to enforce |
| Dual-texture WebGL2 pipeline for GL transitions | gl-transitions.com convention with dual capture from exportRenderer | ✓ Good — identical preview and export rendering |
| Optional fields on KeyPhoto for solid/transparent | Minimal structural change across 15+ callsites vs discriminated union | ✓ Good — pragmatic, avoided massive refactor |
| soloStore as session-only state | Solo mode is ephemeral preview behavior, not project data | ✓ Good — no persistence overhead |
| 2-panel adaptive sidebar over 3 panels | Layers merged into Sequences panel with icon toggle | ✓ Good — simpler UX, one fewer resizer |
| Progressive .mce format v8→v13 | Each phase bumps version with serde(default) backward compat | ✓ Good — seamless loading of any version |
| spawn_blocking for FFmpeg encoding | Keeps blocking I/O isolated from Tauri main thread | ✓ Good — fixed UAT export hang |
| Shared signal (motionPathCircles) for cross-component coordinate exchange | Simpler than prop drilling; matches signal-based architecture | ✓ Good — MotionPath→TransformOverlay communication clean |
| Unified keyframe upsert path (upsertKeyframeValues/Transform) | Eliminates dead-end transientOverrides routing | ✓ Good — sidebar and canvas drag edits both flow through keyframes |
| Map<string, Map<number, PaintFrame>> for paint storage | Efficient sparse frame data; per-layer per-frame isolation | ✓ Good — clean API, dirty tracking via Set<string> keys |
| paintVersion counter signal for reactivity | Non-reactive Map storage + explicit signal bump = controlled re-renders | ✓ Good — solved disappearing strokes without making all Maps reactive |
| Offscreen canvas compositing for eraser and onion skin | Isolates destination-out and global alpha operations | ✓ Good — correct rendering without side effects |
| Paint sidecar JSON files (paint/{uuid}/frame-NNN.json) | Keeps .mce file lean; paint data can be large | ✓ Good — pre-save write order prevents sync issues |
| p5.brush standalone over custom WebGL2 brush renderer | Replaced ~2000 lines of broken custom code with ~200 lines of adapter | ✓ Good — spectral mixing, 5 brush styles, mature library |
| Per-frame FX cache (not per-stroke) | Spectral mixing requires all strokes rendered on shared p5.brush canvas | ✓ Good — correct Kubelka-Munk mixing, clean invalidation |
| Non-destructive FX workflow (flat → select → apply) | Users draw without FX overhead; styles applied post-hoc | ✓ Good — clean separation, rollback to flat supported |
| Separate WebGL2 context for glMotionBlur.ts | Isolation from glBlur.ts and glslRuntime avoids state conflicts | ✓ Good — independent lifecycle, no shared GL state bugs |
| Triangle filter blur kernel in GLSL | Smooth directional blur falloff vs box filter | ✓ Good — natural motion blur appearance |
| VelocityCache with seek invalidation | Math.abs(currentFrame - lastFrame) > 1 detects seek vs playback | ✓ Good — clean velocity on playback, no artifacts on seek |
| Sub-frame accumulation with Float32 averaging | Higher quality export blur via temporal super-sampling | ✓ Good — combined with GLSL velocity blur for best quality |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after v0.6.0 milestone start*
