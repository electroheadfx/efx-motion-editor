# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-03
**Phases:** 5 | **Plans:** 13 | **Sessions:** ~5

### What Was Built
- Tauri 2.0 + Preact + Motion Canvas foundation with 6 reactive signal stores
- Full editor UI shell with dark theme (28+ CSS variables), all panels from React prototype
- Rust image import pipeline with drag-and-drop, file dialog, thumbnail generation, LRU memory pool
- Project persistence (.mce JSON format) with auto-save, recent projects, app configuration
- Sequence management with full CRUD, key photos, SortableJS drag-reorder, per-sequence settings
- Canvas-based timeline with virtualized frame rendering, playhead scrubbing, zoom, sequence reorder
- Real-time preview playback at project fps with zoom/pan and audio-sync-ready clock

### What Worked
- **Risk-first phase ordering:** Validating Motion Canvas + Preact + Tauri integration in Phase 1 eliminated the biggest unknowns early
- **Signal store architecture:** 6 stores with computed cross-store values (frameMap) scaled cleanly across 4 phases
- **markDirty callback pattern:** Solved circular import issues between stores; reused twice (sequenceStore, imageStore)
- **Milestone audit process:** Caught real integration gaps (thumbnail dir mismatch, auto-save wiring) that Phase 3.1 fixed before shipping
- **Accelerating velocity:** Plans went from 20min avg (Phase 1) to 2.3min avg (Phase 4) as patterns stabilized

### What Was Inefficient
- **Phase 1 took 60min** (46% of total) — significant time spent debugging pnpm workspace:* override, Rust edition2024, and Motion Canvas custom element mount
- **02-03 took 45min** (vs 4-6min for other Phase 2 plans) — macOS asset protocol issues (symlinks, canonical paths, scope wildcards) required multiple debugging iterations
- **Orphaned code accumulated** across all phases — test components, unused IPC wrappers, and placeholder values weren't cleaned up during execution
- **Audit discovered integration bugs** that should have been caught by cross-store testing during Phase 3

### Patterns Established
- Asset loading: `resolveResource(relative)` → `assetUrl(absolutePath)` → `https://asset.localhost/` URL
- IPC types: snake_case TypeScript matches Rust serde default — zero manual mapping
- Drag-and-drop: SortableJS for lists, canvas hit-testing for timeline track headers
- State reactivity: `.peek()` in rAF loops to avoid signal subscription tracking outside effects
- Auto-save: effect subscription + isDirty flag — effect triggers scheduleSave, isDirty passes the guard
- Zoom: cursor-anchored zoom pattern works for both timeline and preview canvas

### Key Lessons
1. **Canonical paths are mandatory on macOS** — Tauri asset protocol scope checks fail against symlinked paths (e.g., `/private/var` vs `/var`)
2. **Temp directories should use appDataDir**, not `/tmp` — avoids macOS sandbox and symlink issues
3. **Cross-store reset is easy to miss** — when one store's lifecycle method (createProject, closeProject) should reset other stores, the coupling is invisible until audit
4. **Motion Canvas custom elements need programmatic mount** — JSX ref timing conflicts with Preact's lifecycle; `document.createElement` + `appendChild` is the stable pattern
5. **Milestone audits pay for themselves** — the 3 integration bugs found by audit would have caused user-facing data corruption

### Cost Observations
- Model mix: ~80% opus, ~15% sonnet, ~5% haiku
- Sessions: ~5 sessions over 2 days
- Notable: Phase 4 plans averaged 2.3min each — pattern stability from earlier phases dramatically reduced execution time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0 | ~5 | 5 | 13 | First milestone; established GSD workflow |

### Cumulative Quality

| Milestone | LOC | Files | Tech Debt Items | Integration Issues |
|-----------|-----|-------|-----------------|-------------------|
| v1.0 | 5,055 | 118 | 11 | 3 (2 medium, 1 high) |

### Top Lessons (Verified Across Milestones)

1. Risk-first phase ordering catches integration issues early and accelerates later phases
2. Milestone audits find real bugs that execution-time verification misses
