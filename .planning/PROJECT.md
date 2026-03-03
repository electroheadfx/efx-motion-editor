# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, preview in real-time on a canvas-based timeline, and manage projects with auto-save. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v1.0 delivered the editing foundation; v2.0 adds compositing layers, FX effects, audio with beat sync, export, and full editing workflow (undo/redo, shortcuts).

## Current Milestone: v2.0 Production Tool

**Goal:** Transform EFX-Motion from an editing foundation into a complete production tool with compositing, audio-to-motion pipeline, and export.

**Target features:**
- Layer system with compositing (blend modes, opacity, transforms)
- Built-in cinematic FX (grain, scratches, light leaks, vignette, color grade)
- Audio import with waveform visualization and beat sync
- PNG image sequence export
- Undo/redo and keyboard shortcuts
- Fix v1.0 integration bugs (data bleed, store reset, auto-save cleanup)

## Core Value

Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## Requirements

### Validated

- ✓ Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold with IPC bridge and asset protocol — v1.0
- ✓ Motion Canvas player embedding with signal store architecture (6 stores) — v1.0
- ✓ React UI prototype converted to Preact with dark theme and all panels — v1.0
- ✓ Image import via drag-and-drop and file dialog with Rust thumbnail generation — v1.0
- ✓ Image pool with LRU eviction for memory safety — v1.0
- ✓ Project management (create, save, open, auto-save, recent projects, .mce format) — v1.0
- ✓ Global app config persists between sessions — v1.0
- ✓ Sequence management (create, duplicate, delete, reorder, key photos with hold duration) — v1.0
- ✓ Per-sequence frame rate and resolution settings — v1.0
- ✓ Canvas-based timeline with virtualized frame rendering, playhead, scrubbing, zoom — v1.0
- ✓ Real-time preview playback at project fps with step forward/backward — v1.0
- ✓ Preview zoom/pan and sequence reorder on timeline — v1.0
- ✓ Audio-sync-ready clock architecture (performance.now() delta accumulation) — v1.0

### Active

- [ ] Layer system (static image, image sequence, video layers with blend modes, opacity, visibility)
- [ ] Layer transforms (position, scale, rotation, crop)
- [ ] Properties panel (context-sensitive controls for selected item)
- [ ] Built-in FX effects (grain, dirt/scratches, light leaks, vignette, color grade via Motion Canvas)
- [ ] Audio import, waveform visualization, trimming, positioning
- [ ] Beat sync (auto-detect BPM, beat markers, snap modes, auto-arrange)
- [ ] Export as PNG image sequence (resolution options, naming pattern, progress indicator, audio metadata)
- [ ] Undo/redo (100+ levels, covering all state changes)
- [ ] Keyboard shortcuts (space, arrows, JKL, Cmd+Z/S/N/O, help overlay)

### Out of Scope

- ProRes/MP4 video export — PNG sequence is the professional workflow; video encoding adds massive complexity
- Live camera tethering — different product category (Dragonframe owns this)
- Keyframe animation for layer properties — transforms product toward motion graphics/After Effects territory
- Plugin/extension system — requires stable internal APIs; premature for v1
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only for v1; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users
- Cinematic rate controls (auto-break/auto-merge) — v2 feature
- Composition templates — v2 feature
- Layer loop modes — v2 feature
- Sequence nesting — v2 feature
- Onion skinning — v2 feature
- Procedural FX (particles, flash, animated grain) — v2 feature
- Dual-quality rendering (Dual Kawase vs Gaussian blur toggle) — v2 feature

## Context

Shipped v1.0 with 5,055 LOC (4,316 TypeScript + 739 Rust) across 118 files.
Tech stack: Tauri 2.0, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm.
Architecture: 6 reactive signal stores, Rust image pipeline with thumbnail generation, canvas-based timeline renderer, PlaybackEngine with rAF delta accumulation.

Known integration issues from v1.0 audit:
- Data bleed on "New Project" while editing (stores not reset)
- timelineStore/playbackEngine not reset on project close
- stopAutoSave() never called

## Constraints

- **Platform:** macOS only — native title bar, file dialogs, macOS conventions
- **Framework:** Tauri 2.0 (Rust backend) + Preact (not React) + Preact Signals (not Redux/MobX)
- **Package manager:** pnpm
- **Rendering:** @efxlab/motion-canvas-* v4.0.0 packages (npm)
- **Styling:** Tailwind CSS v4 + custom components — no heavy UI libraries
- **Performance:** Preview must play smoothly at 15/24 fps; blur effects at 60fps via Dual Kawase at 1080p
- **Video access:** Video files must be in `public/` folder for Motion Canvas runtime access
- **Min resolution:** 1280x720 window minimum

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preact over React | 3KB bundle, fastest rendering, Signals built-in | ✓ Good — reactive stores clean, zero perf issues |
| Tailwind v4 + Custom over UI library | No heavy overhead (~500KB saved), full control over editor UI | ✓ Good — dark theme with 28+ CSS variables |
| pnpm as package manager | User preference, fast installs, strict dependency resolution | ✓ Good — overrides fixed Motion Canvas workspace:* bug |
| PNG sequence export (not video) | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | — Pending (Phase 8) |
| Convert React prototype to Preact | Existing UI work preserved, architecture shift to Signals | ✓ Good — all panels converted, mockup layout preserved |
| Motion Canvas for compositing | WebGL rendering for preview and export, plugin ecosystem | ⚠️ Revisit — using img overlay in v1.0, Motion Canvas Img node deferred to Phase 5 |
| Programmatic DOM mount for MC player | Preact/custom-element lifecycle conflicts with JSX ref | ✓ Good — stable pattern, no timing issues |
| Asset protocol for images | No binary IPC overhead, native file:// equivalent | ✓ Good — requires canonical paths on macOS |
| Signal stores (6 stores) | Per-concern state with reactive computed values | ✓ Good — cross-store computed (frameMap) works well |
| snake_case TypeScript types | Match Rust serde default serialization across IPC | ✓ Good — zero manual mapping needed |
| markDirty callback pattern | Avoid circular imports between stores | ✓ Good — used by sequenceStore and imageStore |
| SortableJS for drag-and-drop | Proven library, minimal bundle, works with Preact | ✓ Good — sequences and key photos both use it |
| Canvas 2D for timeline | Full control over rendering, virtualization, pointer events | ✓ Good — smooth at 100+ frames |
| performance.now() PlaybackEngine | Delta accumulation ready for AudioContext master clock | ✓ Good — PREV-05 audio sync readiness proven |
| Cursor-anchored zoom | Frame under cursor stays stable during zoom operations | ✓ Good — works for both timeline and preview |

---
*Last updated: 2026-03-03 after v2.0 milestone start*
