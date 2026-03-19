# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos) with blend modes and transforms, apply cinematic FX effects (film grain, vignette, color grade, dirt/scratches, light leaks), preview in real-time on a canvas-based timeline, and manage projects with auto-save. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v0.1.0 delivered the complete editing experience from foundation through FX; v0.2.0 adds audio with beat sync and PNG export.

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
- ✓ Content overlay layers (static image, image sequence, video) as timeline-level sequences with full property controls — Validated in Phase 12.12

### Active

- [ ] Audio import, waveform visualization, trimming, positioning
- [ ] Beat sync (auto-detect BPM, beat markers, snap modes, auto-arrange)
- [ ] Export as PNG image sequence (resolution options, naming pattern, progress indicator, audio metadata)

### Out of Scope

- ProRes/MP4 video export — PNG sequence is the professional workflow; video encoding adds massive complexity
- Live camera tethering — different product category (Dragonframe owns this)
- Keyframe animation for layer properties — now partially in scope (content overlay layers support keyframe animation since Phase 12.12)
- Plugin/extension system — requires stable internal APIs; premature
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users

## Context

Shipped v0.1.0 with 10,159 LOC (8,753 TypeScript + 1,352 Rust + 54 CSS) across 284 commits.
Tech stack: Tauri 2.0, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm.
Architecture: 6 reactive signal stores, Rust image pipeline with thumbnail generation, Canvas 2D PreviewRenderer with multi-layer compositing, FX generator system with seeded PRNG, PlaybackEngine with rAF delta accumulation, command-pattern undo/redo engine, tinykeys keyboard shortcuts.
Project format: .mce v4 with backward compatibility (v1 through v4).

Known technical debt:
- Coalescing API unwired in UI (engine works, no slider consumer calls startCoalescing/stopCoalescing)
- canUndo/canRedo signals exported but no UI consumes them for button disabling
- resetShuttle() not called from closeProject()

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
| .mce v4 format with backward compat | Progressive schema migration (v1→v4) without breaking old files | ✓ Good — seamless loading of older projects |
| PNG sequence export (not video) | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | — Pending (v0.2.0) |

---
*Last updated: 2026-03-19 after Phase 12.13 — Linear-only timeline layout with single-row content rendering, X-based selection, and theme switcher in toolbar*
