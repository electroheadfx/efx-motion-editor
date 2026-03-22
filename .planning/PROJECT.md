# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos) with blend modes, transforms, and keyframe animation, apply cinematic FX effects (film grain, vignette, color grade, blur, dirt/scratches, light leaks), add fade/cross-dissolve transitions, preview in real-time on a canvas-based timeline with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1). Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v0.1.0 delivered the editing foundation; v0.2.0 completed the pipeline with keyframe animation, GPU blur, content overlays, transitions, and multi-format export; v0.3.0 adds audio with beat sync, sidebar/solo enhancements, and canvas motion paths.

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

### Active

- [ ] Audio import, waveform visualization, fade in/out, timeline positioning, synced playback
- [ ] Audio in video export, beat sync (auto-detect BPM, beat markers, snap modes, auto-arrange)
- [ ] Sidebar enhancements (scroll in key photos, collapse toggle) and solo mode for sequences/layers
- [ ] Canvas motion path with interpolation preview (After Effects-style keyframe path editing)

## Current Milestone: v0.3.0 Audio & Polish

**Goal:** Add audio with waveforms and beat sync, enhance sidebar UX with solo mode, and introduce After Effects-style motion paths on canvas.

**Target features:**
- Audio import with waveform, synced playback, fade in/out
- Audio in video export + beat sync with auto-arrange
- Sidebar scroll/collapse for key photos, solo mode for sequences and layers
- Canvas motion path visualization with keyframe dragging

### Out of Scope

- Live camera tethering — different product category (Dragonframe owns this)
- Plugin/extension system — requires stable internal APIs; premature
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users

## Context

Shipped v0.2.0 with 20,428 LOC (18,110 TypeScript + 2,020 Rust + 298 CSS) across 847 commits since v0.1.0.
Tech stack: Tauri 2.0, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm.
Architecture: 9 reactive signal stores (project, sequence, layer, keyframe, timeline, canvas, ui, blur, isolation, export), Rust image pipeline with thumbnail generation, Canvas 2D PreviewRenderer with multi-layer compositing, WebGL2 GPU blur (glBlur.ts) with CPU fallback, FX generator system with seeded PRNG, keyframe interpolation engine with polynomial cubic easing, PlaybackEngine with rAF delta accumulation and full-speed mode, command-pattern undo/redo engine, tinykeys keyboard shortcuts, exportRenderer with yielding frame loop and FFmpeg video encoding.
Project format: .mce v10 with backward compatibility (v1 through v10).

Known technical debt:
- 2 medium-severity export edge cases (content-overlay image preload, FX generator frame offset)
- Coalescing API unwired in UI (engine works, no slider consumer calls startCoalescing/stopCoalescing)
- canUndo/canRedo signals exported but no UI consumes them for button disabling

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
*Last updated: 2026-03-22 after Phase 15.1 complete — in-use indicators + safe asset removal with cascade undo*
