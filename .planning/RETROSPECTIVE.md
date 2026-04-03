# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.6.0 — Various Enhancements

**Shipped:** 2026-04-03
**Phases:** 4 | **Plans:** 14 | **Tasks:** 28

### What Was Built
- Paint store stabilization: fixed moveElements* bugs, added _notifyVisualChange helper, snapshot-based undo/redo for all transform gestures
- Alt+drag duplicate for all paint element types and non-uniform edge-handle scale with 4 circular midpoint handles
- StrokeList panel with SortableJS drag reorder, visibility toggles, delete, multi-select (Cmd+click/Shift+click), bidirectional canvas-list sync
- Bezier path editing: fit-curve freehand-to-bezier conversion, bezierPath.ts math module (10 pure functions), interactive pen tool overlay
- Anchor/handle dragging, add/delete control points, segment click-to-add, progressive simplify button
- Paint properties panel reorganized with 2-col grids, auto-flatten on exit, isolation-scoped layer creation
- Motion path sub-frame dot density fix (4x denser dots for short sequences)

### What Worked
- **Snapshot-before/commit-on-release undo pattern:** Single pushAction on pointerup for move/rotate/scale/duplicate — clean, reusable across all transform gestures
- **_notifyVisualChange helper:** DRY pattern for dirty+paintVersion+markProjectDirty triple used across all phases — prevented the bug class that plagued pre-v0.6.0 paint operations
- **fit-curve + bezier-js libraries:** Mature math libraries eliminated need for custom curve fitting — freehand-to-bezier conversion worked well
- **Gap closure plans working as designed:** 3 gap closure plans (22-04, 22-05, 23-03, 24-03) caught and fixed issues that UAT verification surfaced — total of ~10 bug fixes
- **Milestone audit run before completion:** First time running audit proactively — caught 2 documentation issues and confirmed 12/12 requirements satisfied
- **Progressive simplify over auto-simplify:** User feedback led to reverting automatic simplification in favor of explicit button — validated through real usage

### What Was Inefficient
- **Phase 25 had a long gap (2025-03-27 → 2026-04-03):** Context window reset required full re-research; the 25-CONTEXT.md helped but still cost time re-building mental model
- **ROADMAP documentation inconsistencies:** 25-03-PLAN checkbox left unchecked despite completion; traceability table mapped PINT-03/04 to "Phase 26" instead of 25 — caught by audit
- **Nyquist validation not run for any phase:** 4/4 phases missing VALIDATION.md — Nyquist compliance continues to be deprioritized
- **Scope reduction from original v0.6.0 plan:** COMP-01-05 (luma matte, paper textures) canceled — original 6-phase milestone became 4 phases

### Patterns Established
- Snapshot-before/commit-on-release: deep clone on pointerdown, single pushAction on pointerup — universal transform undo pattern
- Edge anchor captured once on pointerdown: prevents floating-point drift from per-frame recomputation during non-uniform scale
- Visibility as optional boolean: undefined = visible, false = hidden — backward compatible without migration
- BezierAnchor type model: in/out handles + smooth flag matching industry standard (Illustrator/Figma anchor model)
- Progressive simplify: user-controlled detail reduction via repeated clicks rather than automatic threshold

### Key Lessons
1. **Run milestone audit before completion** — first proactive audit caught documentation issues and confirmed full coverage; establishes this as standard practice
2. **Long gaps between phases require context restoration** — 25-CONTEXT.md was valuable but context windows should include session continuity data
3. **Scope reduction is healthy** — canceling COMP-01-05 kept the milestone focused on what was achievable and valuable
4. **S key shortcut conflict is a recurring pattern** — global shortcuts need isPaintEditMode() guards; this has been flagged multiple times as tech debt
5. **fit-curve/bezier-js adoption validates "use libraries" lesson** — third consecutive library adoption success (SortableJS, p5.brush, fit-curve)

### Cost Observations
- Model mix: ~75% opus, ~20% sonnet, ~5% haiku
- Sessions: ~8 sessions over 8 days (including long gap for Phase 25)
- Notable: Gap closure plans continue to average <5 min each; Phase 22 had 2 gap plans, Phase 23 had 1, Phase 24 had 1

---

## Milestone: v0.5.0 — Motion Blur & Paint Styles

**Shipped:** 2026-03-26
**Phases:** 2 | **Plans:** 8 | **Tasks:** 15

### What Was Built
- Expressive brush FX rendering via p5.brush with 5 styles (watercolor, ink, charcoal, pencil, marker) and Kubelka-Munk spectral pigment mixing
- Non-destructive paint FX workflow: draw flat strokes, select, apply style, flatten for performance
- Per-frame FX cache for correct spectral mixing across overlapping strokes on shared p5.brush canvas
- Select tool with hit testing for stroke selection and FX application
- Solid paint background with color picker and renderPaintFrameWithBg compositing
- Per-layer GLSL velocity motion blur with WebGL2 directional blur shader and triangle filter kernel
- VelocityCache with seek invalidation for clean playback vs scrub behavior
- Sub-frame accumulation export pipeline (8-128 samples) with Float32 averaging for cinematic quality
- Toolbar motion blur toggle with dropdown popover (shutter angle slider, quality tier selector)
- Keyboard shortcut M for motion blur toggle with paint-mode guard
- Project persistence .mce v15 with full round-trip for brush FX state and motion blur settings
- 27 unit tests for motionBlurStore and motionBlurEngine (including VelocityCache)

### What Worked
- **p5.brush standalone adoption:** Replaced ~2000 lines of broken custom WebGL2 brush renderer with ~200 lines of adapter code — p5.brush's spectral mixing, grain, and flow fields worked out of the box
- **Per-frame caching architecture:** Rendering all FX strokes together on shared p5.brush canvas enabled correct spectral mixing (blue + yellow = green) without per-stroke complexity
- **Wave-based parallel execution:** Phase 21's 4 plans executed with Plans 02/03 in parallel worktrees, cutting wall-clock time significantly
- **Separate WebGL2 context for motion blur:** Isolated glMotionBlur.ts from glBlur.ts and glslRuntime — avoided shared GL state bugs entirely
- **Export parity through delegation:** exportRenderer delegating to PreviewRenderer's renderPaintFrameWithBg ensured paint FX render identically in preview and export
- **VelocityCache seek invalidation pattern:** Simple `Math.abs(currentFrame - lastFrame) > 1` check correctly distinguishes playback from scrubbing

### What Was Inefficient
- **Phase 20 required reimplementation:** Initial custom WebGL2 brush renderer (~2000 LOC) was scrapped and replaced with p5.brush — significant wasted effort in first approach
- **No milestone audit before completion:** Third consecutive milestone without running `/gsd:audit-milestone` — should establish as standard practice
- **ROADMAP plan checkboxes inconsistent:** 20-04 and 21-02/03/04 showed unchecked in ROADMAP despite having SUMMARY.md files — tracking gap in plan completion markup

### Patterns Established
- p5.brush adapter pattern: thin wrapper around standalone p5.brush library for project-specific brush rendering
- Per-frame FX cache: all styled strokes rendered together for correct spectral mixing, cache invalidated on any stroke change
- Non-destructive FX workflow: fxState field (flat/fx-applied/flattened) tracks stroke lifecycle without modifying original stroke data
- VelocityCache with seek detection: frame delta > 1 indicates seek, invalidates cached velocity to prevent artifacts
- Combined GLSL + sub-frame blur: GLSL velocity blur for speed, sub-frame accumulation for quality — user chooses via export settings

### Key Lessons
1. **Adopt mature libraries over custom implementations** — p5.brush delivered spectral mixing, grain, and flow fields that the custom renderer couldn't achieve
2. **Per-frame caching is the right granularity for spectral mixing** — per-stroke caching can't capture cross-stroke color interactions
3. **Separate WebGL2 contexts prevent state pollution** — worth the memory cost for reliability when multiple GPU features coexist
4. **Motion blur requires temporal context (velocity)** — VelocityCache pattern cleanly separates frame-to-frame deltas from rendering
5. **Export parity is easiest when export delegates to preview code** — renderPaintFrameWithBg used by both paths guarantees identical output

### Cost Observations
- Model mix: ~80% opus, ~15% sonnet, ~5% haiku
- Sessions: ~4 sessions over 2 days
- Notable: Phase 20 reimplementation (p5.brush adoption) was the biggest pivot but resulted in dramatically better code quality and fewer lines

---

## Milestone: v0.4.0 — Canvas & Paint

**Shipped:** 2026-03-25
**Phases:** 2 | **Plans:** 9 | **Tasks:** 19

### What Was Built
- After Effects-style canvas motion path with dotted SVG trail, keyframe circle markers, drag-to-reposition interaction, auto-seek, and undo coalescing
- Unified keyframe upsert routing (upsertKeyframeValues/upsertKeyframeTransform) closing the real-time preview gap for sidebar and canvas drag edits on keyframed layers
- Frame-by-frame paint/rotopaint layer with perfect-freehand brush engine, eraser, line, rect, ellipse, eyedropper, and flood fill (7 tools total)
- Onion skinning overlay for rotoscoping workflow with configurable frame range and opacity falloff via offscreen canvas compositing
- Full paint UI: PaintProperties sidebar panel (7 sections), PaintToolbar floating canvas overlay, P key toggle, paint mode conditional overlay swap
- Paint layer rendering integrated into PreviewRenderer and export pipeline with blend modes and opacity
- Sidecar JSON persistence for paint frames (paint/{uuid}/frame-NNN.json) with project format v14
- Tablet pen support with pressure sensitivity, tilt modulation, coalesced pointer events, and backward-compatible stroke defaults
- 1 quick task: tablet pen pressure/tilt support for perfect-freehand

### What Worked
- **Wave-based parallelization:** Phase 19's 6 plans executed in 3 waves (Plans 01 solo → 02/03/04/05 parallel → 06 with human verification) — completed entire paint system in <1 hour of AI execution time
- **Plan 06 as visual verification checkpoint:** Mandatory human verification plan discovered 8 bugs that code analysis alone would have missed (non-reactive Map, missing Tauri FS permission, paint mode gating, etc.)
- **Existing architecture absorbed new layer type cleanly:** Adding 'paint' to LayerType, paintStore as 12th store, and paint rendering case in PreviewRenderer required minimal changes to existing code
- **Sidecar persistence pattern (from audio):** paintPersistence.ts closely followed the audio persistence pattern — proven approach required no architectural decisions
- **Motion path phase was compact and clean:** 3 plans, 5 tasks, 11 min total execution — pattern of counter-scaled SVG overlays was already established by TransformOverlay

### What Was Inefficient
- **No milestone audit before completion:** Proceeding without `/gsd:audit-milestone` for the second consecutive milestone
- **No REQUIREMENTS.md for v0.4.0:** Requirements existed only in PROJECT.md Active section and phase-level PAINT-01 through PAINT-13 — no formal traceability table
- **Merge conflicts between parallel worktrees:** Phase 19 Plan 06 had to resolve conflicts on paintStore.ts and paint.ts between wave 3 worktrees — expected but added human overhead
- **3 pre-existing audioWaveform test failures carried:** Not caused by v0.4.0 but not fixed either — accumulating unrelated test debt

### Patterns Established
- paintVersion counter signal: bump a plain counter signal to make non-reactive data structures (Map) trigger Preact re-renders
- Offscreen canvas compositing: render to temp canvas first, then drawImage to main canvas for correct alpha/composite behavior
- Paint sidecar persistence: paint/{uuid}/frame-NNN.json files written BEFORE .mce file for consistency
- Conditional overlay swap: PaintOverlay replaces TransformOverlay entirely rather than overlapping (cleaner DOM, fewer event conflicts)
- Shared module-level signal for cross-component communication (motionPathCircles between MotionPath.tsx and TransformOverlay.tsx)

### Key Lessons
1. **Visual verification plans are essential for paint/drawing features** — 8/8 bugs found in Plan 06 were invisible to static analysis and TypeScript compilation
2. **Perfect-freehand is an excellent library choice** — zero-config quality for brush strokes; only needed tablet pen extensions as a quick task
3. **Counter signal pattern is the cleanest way to bridge imperative data (Map/Set) with reactive rendering** — avoid making all storage reactive
4. **Pre-save data write order matters** — writing sidecar files before the main .mce prevents sync issues if save is interrupted

### Cost Observations
- Model mix: ~80% opus, ~15% sonnet, ~5% haiku
- Sessions: ~3 sessions over 2 days
- Notable: Phase 19 (6 plans, 14 tasks) completed in <1 hour AI time via wave parallelization — fastest feature-per-time ratio yet

---

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
| v0.4.0 | ~3 | 2 | 9 | Wave parallelization for paint; visual verification checkpoint plan |
| v0.5.0 | ~4 | 2 | 8 | p5.brush adoption pivot; separate WebGL2 contexts per GPU feature |
| v0.6.0 | ~8 | 4 | 14 | First proactive milestone audit; scope reduction (COMP-01-05 canceled); long gap context restoration |

### Cumulative Quality

| Milestone | LOC | Files | Tech Debt Items | Integration Issues |
|-----------|-----|-------|-----------------|-------------------|
| v1.0 | 5,055 | 118 | 11 | 3 (2 medium, 1 high) |
| v0.2.0 | 20,428 | 252+ | 28 | 2 (both medium) |
| v0.3.0 | 31,522 | 350+ | 4 (carried) | 0 new |
| v0.4.0 | 34,067 | 430+ | 4 (carried) | 0 new |
| v0.5.0 | 40,066 | 560+ | 4 (carried) | 0 new |
| v0.6.0 | 40,688 | 660+ | 5 (1 new + 4 carried) | 0 new |

### Top Lessons (Verified Across Milestones)

1. Risk-first phase ordering catches integration issues early and accelerates later phases
2. Milestone audits find real bugs that execution-time verification misses
3. Signal store architecture scales well — 6→9→11→12 stores with zero friction
4. `.peek()` pattern is essential for performance-critical paths (rAF, event handlers)
5. Quick tasks are the right vehicle for user-testing feedback — keeps formal phases focused
6. Progressive .mce format migration (v1→v14) with serde(default) is the proven persistence pattern
7. Wave 0 test scaffolds accelerate implementation and catch integration issues early
8. WebGL2 architecture investments pay compound returns across features (blur, shaders, transitions)
9. Visual verification plans are essential for drawing/paint features — static analysis misses runtime rendering bugs
10. Counter signal pattern bridges imperative data structures (Map/Set) with reactive rendering cleanly
11. Adopt mature libraries over custom implementations when the problem domain is well-understood (p5.brush vs custom WebGL2 renderer)
12. Separate WebGL2 contexts per GPU feature prevents state pollution and simplifies lifecycle management
13. Run milestone audit proactively before completion — catches documentation inconsistencies and confirms requirement coverage
14. Scope reduction is healthy — canceling features keeps milestones focused on achievable, validated work
