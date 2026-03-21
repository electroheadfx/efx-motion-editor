# Milestones

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
