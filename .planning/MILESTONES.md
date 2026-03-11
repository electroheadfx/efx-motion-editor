# Milestones

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

## Next Milestone: v0.2.0 (Planned)

**Phases:** 10 (Phases 8-17) | **Requirements:** TBD
**Goal:** Extend the editor with new features and complete the stop-motion-to-cinema pipeline with audio, beat sync, and PNG export.

**Planned phases:**
1. Phase 8-14: TBD (7 new phases)
2. Phase 15: Audio Import & Waveform (Web Audio API, timeline waveform)
3. Phase 16: Beat Sync (BPM detection, beat markers, auto-arrange)
4. Phase 17: PNG Export (composited frame export, progress, metadata)

---
