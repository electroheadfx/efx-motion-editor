# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3.0 — Audio & Polish

**Shipped:** 2026-03-24
**Phases:** 8 | **Plans:** 29 | **Tasks:** 63

### What Was Built
- Audio import with waveform visualization, synced playback, volume/fade controls, and timeline interactions (click, drag, trim, slip, reorder, resize)
- Media in-use tracking with color-coded badges, portal-based usage popovers, and cascade asset removal with composite undo
- Solid/transparent key entries with split add button, inline color picker, and gradient fills (linear/radial/conic)
- GLSL shader system: WebGL2 runtime, 17 Shadertoy-ported effects, ShaderBrowser with animated previews, parameter controls
- GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, timeline/sidebar integration
- Audio export with OfflineAudioContext pre-render, FFmpeg muxing, BPM detection, beat markers, snap-to-beat, auto-arrange
- Sidebar enhancements: collapsible key photos, global solo mode, Tailwind v4 migration across 33 files
- Adaptive 2-panel sidebar replacing 3-panel layout with sequence/layer view switching
- 7 quick-task inline fixes (context menu removal, transport bar, zoom controls relocation, shader button move)
- Project format progressed from v8 through v13 with full backward compatibility chain

### What Worked
- **Inserted phase pattern (15.x):** 5 phases inserted as decimal sub-phases kept features modular without disrupting the main roadmap numbering
- **Signal store architecture continued to scale:** Added audioStore and soloStore (now 11 stores) with zero architectural friction
- **Progressive .mce format migration (v8→v13):** Each phase bumped version independently with serde(default) backward compat — never broke existing projects
- **TDD test scaffolds (Wave 0 pattern):** Phases 15.2 and 15.4 started with failing test scaffolds that guided implementation — caught integration issues early
- **Gap closure plans:** Phases 16 and 17 each had 2-3 gap closure plans that fixed UAT issues (export hang, BPM persistence, snap-to-beat, portal rendering, timeline gradients)
- **WebGL2 reuse:** GLSL runtime built for shader effects (Phase 15.3) was directly reusable for GL transitions (Phase 15.4) — architecture paid off
- **Dual-callback pattern for live preview:** onLiveChange/onCommit prevented undo stack flooding from continuous color picker drags

### What Was Inefficient
- **GLSL/GLT requirements not tracked in REQUIREMENTS.md:** Phases 15.3 and 15.4 were inserted urgently and their requirements never made it into the formal tracking table
- **ASIDE requirements left "Pending" after completion:** Phase 17.1 completed but REQUIREMENTS.md traceability wasn't updated — a tracking gap
- **Phase 15.3 plan count discrepancy:** ROADMAP shows "3/4 plans executed" but only 1 summary exists — single mega-plan covered all work
- **No milestone audit before completion:** Proceeding without `/gsd:audit-milestone` — past milestones caught real issues during audit
- **Phase 16 needed 3 gap closure plans:** BPM persistence (Rust struct mismatch), export hang (async FFmpeg), and snap-to-beat (missing UI) — suggests initial planning underestimated Rust/TS boundary complexity

### Patterns Established
- Web Audio engine pattern: OfflineAudioContext pre-render at 48kHz for export, AudioContext for real-time playback
- Fade scheduling: exponentialRampToValueAtTime targeting 0.001 (not 0) to avoid Web Audio limitation
- Composite undo: capturing multiple store snapshots (sequenceStore + audioStore + imageStore) as single history entry
- Portal rendering for modals to prevent SortableJS drag propagation issues
- Split add button pattern: Camera/Square for photo vs solid entry creation
- Teal/purple color coding: teal for GL transitions, purple for cross-dissolve — visual language on timeline

### Key Lessons
1. **Rust/TypeScript boundary needs explicit type auditing** — Phase 16's BPM persistence bug was serde silently dropping fields missing from the Rust struct
2. **Wave 0 test scaffolds accelerate implementation** — Phases 15.2 and 15.4 both benefited from upfront behavioral contracts
3. **Gap closure plans are a natural part of the process** — 5 gap closure plans across 2 phases is healthy, not a sign of poor planning
4. **WebGL2 architecture investment pays compound returns** — glslRuntime served both shader effects and transitions with minimal additional code
5. **Inserted phases work well for urgent features** — 5 inserted phases (15.1-15.4, 17.1) kept the roadmap flexible without losing structure

### Cost Observations
- Model mix: ~70% opus, ~25% sonnet, ~5% haiku
- Sessions: ~15+ sessions over 5 days
- Notable: 29 plans in 5 days is the fastest milestone yet; gap closure plans averaged <4 min each

---

## Milestone: v0.2.0 — Pipeline Complete

**Shipped:** 2026-03-21
**Phases:** 23 | **Plans:** 66 | **Tasks:** 128

### What Was Built
- Per-layer keyframe animation with polynomial cubic easing, interpolation-aware timeline icons, and 14 decimal sub-phases of UX refinement
- GPU-accelerated WebGL2 blur replacing dual CPU algorithms with constant-cost rendering
- Content overlay layers (static image, image sequence, video) as timeline-level sequences with full compositing
- Fade/cross-dissolve transitions with DaVinci Resolve-style timeline overlays
- PNG sequence + video export (ProRes/H.264/AV1) with FFmpeg auto-provisioning and progress tracking
- Complete sidebar redesign: 3 resizable sub-windows, inline key photos, keyframe navigation, intent-driven add-layer flows
- Full-speed playback mode, fullscreen canvas, sequence isolation, linear timeline layout
- 44 quick-task inline fixes covering drag UX, scroll behavior, keyboard shortcuts, and visual polish

### What Worked
- **Decimal sub-phase pattern:** 14 phases inserted as 12.x after Phase 12 kept UX iteration rapid without disrupting the roadmap structure
- **Quick task system:** 44 inline fixes were handled without formal planning overhead — immediate response to user testing feedback
- **Signal store architecture continued to scale:** Added 3 new stores (keyframe, isolation, export) with zero architectural friction
- **Canvas 2D for timeline rendering:** Withstood 23 phases of feature additions (keyframe diamonds, transitions, linear mode, thumbnails) without performance issues
- **WebGL2 GPU blur decision:** Single quality level eliminated HQ/fast toggle complexity across 6 code paths
- **Intent-driven UI pattern:** AddLayerIntent signal replaced 3 separate popover dialogs with a unified ImportedView flow

### What Was Inefficient
- **Missing VERIFICATION.md on 4 phases:** Phases 10, 12.1, 12.1.1, and 12.4 shipped without formal verification — features work but verification was skipped during rapid iteration
- **REQUIREMENTS.md not created for v0.2.0:** No traceability table existed between v0.1.0 and v0.2.0 archival — requirements were tracked per-phase instead
- **Nyquist validation gaps:** Only 2/23 phases fully Nyquist-compliant — validation was deprioritized during rapid feature delivery
- **2 export edge cases survived to audit:** Content-overlay image preloading and FX generator frame offset issues — would have been caught with export-specific integration tests

### Patterns Established
- `.peek()` in rAF loops and event handlers for zero-overhead signal reads (used in playback, fullscreen, isolation)
- Intent signal pattern for multi-step UI flows (addLayerIntent, pendingNewSequenceId)
- Progressive .mce format migration (v4→v5→v6→v7) with nullish coalescing backward compat
- Pure-function extraction for testability (sequence navigation helpers, panel resize logic, keyframe engine)
- Theme cache at module level with CSS variable resolution for Canvas 2D drawing

### Key Lessons
1. **Decimal sub-phases work well for UX iteration** — kept Phase 12's keyframe feature stable while allowing 14 refinement passes
2. **Quick tasks are the right vehicle for user-testing feedback** — formal planning would slow down responsiveness to real usage
3. **GPU blur should be the default from day one** — dual CPU algorithms created unnecessary complexity that was immediately replaced
4. **Export integration needs dedicated testing** — preview rendering tests don't catch export-specific issues (preloading, frame offsets)
5. **REQUIREMENTS.md should be created at milestone start** — without it, the audit had to infer requirement coverage from phase-level artifacts

### Cost Observations
- Model mix: ~70% opus, ~25% sonnet, ~5% haiku
- Sessions: ~30+ sessions over 18 days
- Notable: Quick tasks averaged <5 min each; formal phases averaged ~3 plans with 2-3 tasks each

---

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
| v0.2.0 | ~30 | 23 | 66 | Decimal sub-phases for UX iteration; quick task system for inline fixes |
| v0.3.0 | ~15 | 8 | 29 | Wave 0 test scaffolds; gap closure plans; 5 inserted phases for urgent features |

### Cumulative Quality

| Milestone | LOC | Files | Tech Debt Items | Integration Issues |
|-----------|-----|-------|-----------------|-------------------|
| v1.0 | 5,055 | 118 | 11 | 3 (2 medium, 1 high) |
| v0.2.0 | 20,428 | 252+ | 28 | 2 (both medium) |
| v0.3.0 | 31,522 | 350+ | 4 (carried) | 0 new |

### Top Lessons (Verified Across Milestones)

1. Risk-first phase ordering catches integration issues early and accelerates later phases
2. Milestone audits find real bugs that execution-time verification misses
3. Signal store architecture scales well — 6→9→11 stores with zero friction
4. `.peek()` pattern is essential for performance-critical paths (rAF, event handlers)
5. Quick tasks are the right vehicle for user-testing feedback — keeps formal phases focused
6. Progressive .mce format migration (v1→v13) with serde(default) is the proven persistence pattern
7. Wave 0 test scaffolds accelerate implementation and catch integration issues early
8. WebGL2 architecture investments pay compound returns across features (blur, shaders, transitions)
