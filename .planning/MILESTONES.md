# Milestones

## v0.2.0 Production Tool (In Progress)

**Phases:** 3 (Phases 5-7) | **Requirements:** 41
**Goal:** Add production editing core to EFX-Motion: infrastructure fixes, layer compositing system, and cinematic FX effects.

**Planned phases:**
1. Phase 5: Editing Infrastructure (undo/redo, shortcuts, store bug fixes)
2. Phase 6: Layer System & Properties Panel (compositing foundation)
3. Phase 7: Cinematic FX Effects (grain, vignette, color grade, dirt, light leaks)

---

## Next Milestone (Planned)

**Phases:** 3 (Phases 8-10) | **Requirements:** 18
**Goal:** Complete the stop-motion-to-cinema pipeline with audio, beat sync, and PNG export.

**Planned phases:**
1. Phase 8: Audio Import & Waveform (Web Audio API, timeline waveform)
2. Phase 9: Beat Sync (BPM detection, beat markers, auto-arrange)
3. Phase 10: PNG Export (composited frame export, progress, metadata)

---

## v0.1.0 MVP (Shipped: 2026-03-03)

**Phases:** 5 (Phases 1-4, 3.1) | **Plans:** 13 | **Tasks:** 25
**Lines of code:** 5,055 (4,316 TypeScript + 739 Rust) | **Files:** 118
**Timeline:** 2 days (2026-03-02 → 2026-03-03)
**Git range:** `feat(01-01)` → `feat(04-03)` | **Tag:** v0.1.0

**Delivered:** Complete stop-motion editor foundation — from Tauri scaffold through timeline playback with real-time preview.

**Key accomplishments:**
1. Tauri 2.0 + Preact + Motion Canvas foundation with validated integrations and 6 reactive signal stores
2. Full editor UI shell converted from React prototype with dark theme and all panels
3. Rust image import pipeline with drag-and-drop, thumbnails, and LRU memory management
4. Project persistence (.mce format) with auto-save, recent projects, and app configuration
5. Sequence management with key photos, drag-reorder, and per-sequence settings
6. Canvas-based timeline with virtualized rendering, playhead scrubbing, zoom, and real-time preview playback

**Known Gaps (from audit):**
- INT-01 (High): Data bleed on "New Project" from Toolbar while editing — stores not reset
- INT-02 (Medium): timelineStore/playbackEngine not reset on project close
- INT-03 (Medium): stopAutoSave() exported but never called
- 11 tech debt items (orphaned test artifacts, deferred features)

**Archives:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-MILESTONE-AUDIT.md`

---
