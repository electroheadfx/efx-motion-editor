# Milestones

## v1.0 MVP (Shipped: 2026-03-03)

**Phases:** 5 (Phases 1-4, 3.1) | **Plans:** 13 | **Tasks:** 25
**Lines of code:** 5,055 (4,316 TypeScript + 739 Rust) | **Files:** 118
**Timeline:** 2 days (2026-03-02 → 2026-03-03)
**Git range:** `feat(01-01)` → `feat(04-03)` | **Tag:** v1.0

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

