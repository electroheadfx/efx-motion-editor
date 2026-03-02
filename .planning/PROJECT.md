# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes — Wallace & Gromit style animation. Users import key photographs, arrange them into sequences at 15/24 fps, add FX layers (video, image, procedural effects), sync to audio beats, and export PNG image sequences for final editing in DaVinci Resolve or Premiere Pro. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4.

## Core Value

Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Project management (create, open, save, auto-save, recent projects, .mce format)
- [ ] Global project & storage management (config, global assets, first-launch setup)
- [ ] Image import via drag & drop and file dialog
- [ ] Sequence management (create, duplicate, delete, reorder, nested sequences)
- [ ] Key photo handling (frame duplication at 15/24 fps, duration 1-3s, thumbnail generation)
- [ ] Cinematic rate controls (min/max keys per second, auto-break, auto-merge)
- [ ] Layer system (static image, image sequence, video layers with all blend modes)
- [ ] Layer transforms (position, scale, rotation, crop)
- [ ] Layer repeat/loop modes (none, loop, mirror, ping-pong, stretch, tile)
- [ ] Composition templates (create, apply, nest, unpack, import/export, template library)
- [ ] Built-in FX effects (grain, dirt/scratches, light leaks, particles, flash, vignette, color grade)
- [ ] Blur system (Dual Kawase for preview, Gaussian for export)
- [ ] Preview mode vs render mode toggle (Full FX ON/OFF)
- [ ] Audio management (import, waveform visualization, trimming, positioning, per-sequence & global)
- [ ] Beat sync (auto-detect BPM, beat markers, snap modes, auto-arrange, frame fill calculation)
- [ ] Timeline (frame visualization, playhead, scrubbing, zoom, horizontal scroll, image thumbnails, sequence reordering)
- [ ] Preview canvas (real-time playback via @efxlab/motion-canvas-player, zoom controls)
- [ ] Export as PNG image sequence (resolution options, naming pattern, progress indicator, audio metadata)
- [ ] Keyboard shortcuts (full set per spec)
- [ ] Properties panel (transform, blend, crop, opacity controls)
- [ ] Convert existing React UI prototype (Mockup/react-ui/) to Preact + Preact Signals

### Out of Scope

- AI-powered features (Magic Edit, Smart Beat Sync, etc.) — v2.0
- Cloud & storage features — v2.0
- ProRes/MP4 video export — v2.0
- Real-time collaboration — v2.0
- Keyframe animation for layer properties — v2.0
- Plugin system — v2.0
- Mobile support — v2.0
- Windows/Linux builds — macOS only for v1

## Context

- **Existing assets:** Detailed specification (SPECS.md), Pencil mockup (Mockup/efx-motion-editor.pen), React UI prototype with full layout + panels (Mockup/react-ui/)
- **React → Preact conversion:** The React UI prototype has all major panels built (timeline, layers, properties, preview) but lacks click actions and interactivity. Must be converted to Preact with Preact Signals for state management.
- **Motion Canvas packages:** @efxlab/motion-canvas-core, -2d, -responsive, -player, -ffmpeg, -ui, -vite-plugin — all v4.0.0, published on npm under @efxlab scope
- **Package manager:** pnpm (mandatory)
- **Rendering approach:** Motion Canvas handles WebGL/Canvas rendering for preview and export; Tailwind CSS v4 for UI chrome; custom components (no heavy UI library)
- **Export pipeline:** PNG sequence export via @efxlab/motion-canvas-ffmpeg, with audio metadata text file for downstream video editors
- **File format:** .mce (JSON-based project files)

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
| Preact over React | 3KB bundle, fastest rendering, Signals built-in | — Pending |
| Tailwind v4 + Custom over UI library | No heavy overhead (~500KB saved), full control over editor UI | — Pending |
| pnpm as package manager | User preference, fast installs, strict dependency resolution | — Pending |
| Dual Kawase blur for preview | Real-time 60fps at 1080p, switch to Gaussian for export quality | — Pending |
| PNG sequence export (not video) | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | — Pending |
| Convert React prototype to Preact | Existing UI work preserved, architecture shift to Signals | — Pending |

---
*Last updated: 2026-03-02 after initialization*
