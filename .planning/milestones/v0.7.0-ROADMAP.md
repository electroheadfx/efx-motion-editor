# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar. v0.4.0 (Phases 18-19) added After Effects-style canvas motion path editing and frame-by-frame paint/rotopaint layers with onion skinning. v0.5.0 (Phases 20-21) added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export. v0.6.0 (Phases 22-25) added stroke management, bezier path editing, and paint workflow UX improvements. v0.7.0 (Phases 26-33) converts to a pnpm monorepo, enhances the current paint engine (perfect-freehand + p5.brush), and adds small improvements and fixes. v0.8.0 (Phase 34+) will add efx-physic-paint as a standalone window with transport to the editor.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2025-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2025-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2025-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- 🚧 **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (in progress)
- 📋 **v0.8.0 Standalone Physics Paint** — Phase 34+ (planned)

## Phases

<details>
<summary>v0.1.0 (Phases 1-7) — SHIPPED 2019-03-11</summary>

- [x] Phase 1: Foundation & Scaffolding (3/3 plans) — completed 2019-03-02
- [x] Phase 2: UI Shell & Image Pipeline (3/3 plans) — completed 2019-03-03
- [x] Phase 3: Project & Sequence Management (10/10 plans) — completed 2019-03-03
- [x] Phase 3.1: Fix Cross-Phase Integration Wiring (1/1 plan) — completed 2019-03-03
- [x] Phase 4: Timeline & Preview (5/5 plans) — completed 2019-03-03
- [x] Phase 5: Editing Infrastructure (5/5 plans) — completed 2019-03-06
- [x] Phase 6: Layer System & Properties Panel (8/8 plans) — completed 2019-03-08
- [x] Phase 7: Cinematic FX Effects (10/10 plans) — completed 2019-03-10

See: `milestones/v0.1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.2.0 Pipeline Complete (Phases 8-14) — SHIPPED 2019-03-21</summary>

- [x] Phase 8: UI Theme System (3/3 plans) — completed 2019-03-12
- [x] Phase 9: Canvas Zoom (4/4 plans) — completed 2019-03-12
- [x] Phase 10: FX Blur Effect (4/4 plans) — completed 2019-03-13
- [x] Phase 11: Live Canvas Transform (4/4 plans) — completed 2019-03-14
- [x] Phase 12: Layer Keyframe Animation (5/5 plans) — completed 2019-03-15
- [x] Phase 12.1: Remove Bottom Bar → Sidebar (4/4 plans) — completed 2019-03-16
- [x] Phase 12.1.1: Big UI Sidebar Design (5/5 plans) — completed 2019-03-16
- [x] Phase 12.2: Auto-seek Timeline (1/1 plans) — completed 2019-03-17
- [x] Phase 12.3: Quick Keys Navigation (1/1 plans) — completed 2019-03-17
- [x] Phase 12.4: ShortcutsOverlay Tabs (1/1 plans) — completed 2019-03-17
- [x] Phase 12.5: Vertical Scroll (2/2 plans) — completed 2019-03-18
- [x] Phase 12.6: Layer Auto-selection UX (3/3 plans) — completed 2019-03-18
- [x] Phase 12.7: Keyframe Icons (1/1 plans) — completed 2019-03-18
- [x] Phase 12.8: Timeline Thumb Cover (1/1 plans) — completed 2019-03-18
- [x] Phase 12.9: Add-Layer Dialogs (1/1 plans) — completed 2019-03-18
- [x] Phase 12.10: GPU-Accelerated Blur (2/2 plans) — completed 2019-03-18
- [x] Phase 12.11: Full-speed + Fullscreen (2/2 plans) — completed 2019-03-19
- [x] Phase 12.12: Content Overlay Layers (4/4 plans) — completed 2019-03-19
- [x] Phase 12.13: Linear Timeline (2/2 plans) — completed 2019-03-19
- [x] Phase 12.14: Timeline/Canvas Buttons (2/2 plans) — completed 2019-03-19
- [x] Phase 12.15: Sequence Isolation + Loop (4/4 plans) — completed 2019-03-20
- [x] Phase 13: Fade/Cross-Dissolve (5/5 plans) — completed 2019-03-20
- [x] Phase 14: PNG & Video Export (5/5 plans) — completed 2019-03-21

See: `milestones/v0.2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.3.0 Audio & Polish (Phases 15-17) — SHIPPED 2025-03-24</summary>

- [x] Phase 15: Audio Import & Waveform (4/4 plans) — completed 2019-03-21
- [x] Phase 15.1: Media In-Use & Safe Removal (2/2 plans) — completed 2025-03-22
- [x] Phase 15.2: Solid Sequence (4/4 plans) — completed 2025-03-22
- [x] Phase 15.3: GLSL Shadertoys (1/1 plan) — completed 2025-03-22
- [x] Phase 15.4: GL Transition (4/4 plans) — completed 2025-03-23
- [x] Phase 16: Audio Export & Beat Sync (6/6 plans) — completed 2025-03-23
- [x] Phase 17: Enhancements (6/6 plans) — completed 2025-03-24
- [x] Phase 17.1: Adaptive Sidebar (2/2 plans) — completed 2025-03-24

See: `milestones/v0.3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.4.0 Canvas & Paint (Phases 18-19) — SHIPPED 2025-03-25</summary>

- [x] Phase 18: Canvas Motion Path (3/3 plans) — completed 2025-03-24
- [x] Phase 19: Add Paint Layer Rotopaint (6/6 plans) — completed 2025-03-24

See: `milestones/v0.4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.5.0 Motion Blur & Paint Styles (Phases 20-21) — SHIPPED 2025-03-26</summary>

- [x] Phase 20: Paint Brush FX (4/4 plans) — completed 2025-03-26
- [x] Phase 21: Motion Blur (4/4 plans) — completed 2025-03-26

See: `milestones/v0.5.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.6.0 Various Enhancements (Phases 22-25) — SHIPPED 2026-04-03</summary>

- [x] Phase 22: Foundation & Quick Wins (5/5 plans) — completed 2025-03-26
- [x] Phase 23: Stroke Interactions (3/3 plans) — completed 2025-03-27
- [x] Phase 24: Stroke List Panel (3/3 plans) — completed 2025-03-27
- [x] Phase 25: Bezier Path Editing (3/3 plans) — completed 2026-04-03

See: `milestones/v0.6.0-ROADMAP.md` for full details.

</details>

### v0.7.0 Monorepo & Paint Enhancements (In Progress)

**Milestone Goal:** Convert to pnpm monorepo with efx-physic-paint as a workspace package, enhance the current paint engine (perfect-freehand + p5.brush), and add small improvements and fixes.

**Phase Numbering:**
- Integer phases (26, 27, ...): Planned milestone work
- Decimal phases (27.1, 27.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 26: Monorepo Scaffold** - Convert to pnpm workspace with app/ and packages/efx-physic-paint/ (completed 2026-04-03)
- [x] **Phase 27: Engine API Adaptations** - FAILED: batch renderFromStrokes approach produces inferior visual quality (2026-04-04)
- [x] **Phase 28: Adapter & Type Bridge** - FAILED: adapter architecture depends on broken batch rendering strategy (2026-04-04)
- [x] **Phase 29: Input & Tool Reconnection** - FAILED: engine output has no physics/grain, O(n2) re-render perf, forceDryAll kills paint mixing (2026-04-04)
- [x] **Phase 30: UI, Paper & Transparency** - FAILED: depends on adapter approach from phases 27-29 (2026-04-04)
- [x] **Phase 31: Advanced Paint Features** - FAILED: depends on adapter approach from phases 27-29 (2026-04-04)
- [x] **Phase 32: Cleanup & Removal** - FAILED: cannot remove engines that are still in use (2026-04-04)
- [x] **Phase 33: Enhance Current Engine** - Small improvements and fixes to perfect-freehand + p5.brush paint layers (UAT gap closure in progress) (completed 2026-04-05)

## Phase Details

### Phase 26: Monorepo Scaffold
**Goal**: Developer can work on editor and paint engine in a single workspace with shared tooling
**Depends on**: Nothing (first phase of v0.7.0)
**Requirements**: MONO-01, MONO-02, MONO-03, MONO-04, MONO-05, MONO-06
**Success Criteria** (what must be TRUE):
  1. `pnpm dev` from workspace root starts the editor identically to v0.6.0
  2. `pnpm tauri build` from workspace root produces a working .app bundle
  3. `import { EfxPaintEngine } from '@efxlab/efx-physic-paint'` compiles in the editor
  4. `pnpm install --frozen-lockfile` passes from a clean clone
  5. `git log --follow app/src/stores/paintStore.ts` shows full pre-rename history
**Plans:** 3/3 plans complete
Plans:
- [x] 26-01-PLAN.md — Rename Application/ to app/ with git history preservation
- [x] 26-02-PLAN.md — Workspace config, paint package, dependency wiring
- [x] 26-03-PLAN.md — Full verification suite and human checkpoint

### Phase 27: Engine API Adaptations
**Goal**: Paint engine can render strokes headlessly without DOM, pointer events, or render loop
**Depends on**: Phase 26
**Requirements**: ENGN-01, ENGN-02
**Success Criteria** (what must be TRUE):
  1. EfxPaintEngine constructs with offscreen canvases and no DOM container
  2. `renderFromStrokes()` accepts a stroke array and returns a correct HTMLCanvasElement
  3. Engine produces correct alpha output in transparent background mode
**Plans**: TBD

### Phase 28: Adapter & Type Bridge
**Goal**: Editor's compositing pipeline renders paint strokes through the physics engine with full backward compatibility
**Depends on**: Phase 27
**Requirements**: ENGN-03, ENGN-04, ENGN-05, ENGN-06
**Success Criteria** (what must be TRUE):
  1. New paint strokes render through efxPaintAdapter.ts in preview and export
  2. Opening a v0.6.0 project with paint data renders all existing strokes correctly via legacy fallback
  3. Per-frame cache stores engine output and invalidates only on stroke changes
  4. Preview playback at 15/24 fps does not stutter on frames with cached paint
**Plans**: TBD

### Phase 29: Input & Tool Reconnection
**Goal**: User can draw, erase, and apply brush styles through the new physics engine end-to-end
**Depends on**: Phase 28
**Requirements**: PAINT-01, PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06
**Success Criteria** (what must be TRUE):
  1. User can draw freehand strokes with pressure sensitivity producing physics-based output
  2. Eraser tool removes paint via engine's native erase API with correct undo/redo
  3. All 6 brush presets (flat, ink, pencil, marker, charcoal, watercolor) render with visually distinct results
  4. PaintOverlay captures full PenPoint data (x, y, pressure, tilt, twist, speed) for physics input
  5. Onion skinning displays previous/next frames via adapter canvas capture
**Plans**: TBD
**UI hint**: yes

### Phase 30: UI, Paper & Transparency — FAILED
Depended on adapter approach from phases 27-29.

### Phase 31: Advanced Paint Features — FAILED
Depended on adapter approach from phases 27-29.

### Phase 32: Cleanup & Removal — FAILED
Cannot remove engines that are still in use.

### Phase 33: Enhance Current Engine
**Goal**: Current paint engine (perfect-freehand + p5.brush) receives bug fixes, UX improvements, paint mode system, inline color picker, and stroke animation
**Depends on**: Phase 26
**Requirements**: ECUR-01, ECUR-02, ECUR-03, ECUR-04, ECUR-05, ECUR-06, ECUR-07, ECUR-08, ECUR-09, ECUR-10, ECUR-11, ECUR-12, ECUR-13
**Success Criteria** (what must be TRUE):
  1. Cmd+Z after any paint operation immediately re-renders canvas with correct visual state (flat and FX)
  2. FX brush style selection actually applies during drawing
  3. Brush color/size persist across sessions, defaulting to #203769/35px
  4. Circle cursor at brush size scales with zoom
  5. 3-mode paint system (flat/FX/physical-placeholder) with per-frame exclusivity
  6. Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and persistent swatches
  7. Modal color picker: no buttons, no overlay, positioned near mouse
  8. Selected FX strokes show wireframe overlay for easy grab
  9. Stroke draw-reveal animation distributes points across frames by speed
**Plans:** 20/20 plans complete
Plans:
- [x] 33-01-PLAN.md — Bug fixes (undo rendering, FX brush style) and UX quick wins
- [x] 33-02-PLAN.md — Brush preferences persistence and circle cursor
- [x] 33-03-PLAN.md — Modal color picker improvements (no buttons, no overlay, near mouse)
- [x] 33-04-PLAN.md — Paint mode system (flat/FX/physical with conversion dialogs)
- [x] 33-05-PLAN.md — Inline color picker with 4 modes and swatches
- [x] 33-06-PLAN.md — FX stroke selection wireframe overlay
- [x] 33-07-PLAN.md — Stroke draw-reveal animation
- [x] 33-08-PLAN.md — Gap closure: fix color picker re-render loop + blend mode override
- [x] 33-09-PLAN.md — Gap closure: FX cache invalidation, mode persistence, FX white bg
- [x] 33-10-PLAN.md — Gap closure: cursor position, pulsate animation, modal dialog, multi-animate
- [x] 33-11-PLAN.md — Gap closure: move inline color picker to canvas side
- [x] 33-12-PLAN.md — UAT gap closure: per-layer paint mode + brush reset + conversion
- [x] 33-13-PLAN.md — UAT gap closure: exit button pulsate animation (remove scale)
- [x] 33-14-PLAN.md — UAT gap closure: brush preferences persistence (await init)
- [x] 33-15-PLAN.md — UAT gap closure: FX canvas refresh on color change
- [x] 33-16-PLAN.md — UAT gap closure: circle cursor centering
- [x] 33-17-PLAN.md — UAT gap closure: FX white background persistence
- [x] 33-18-PLAN.md — UAT gap closure: inline color picker positioning (remove portal)
- [x] 33-19-PLAN.md — UAT gap closure: TSL/RVB/CMYK gradient sliders
- [x] 33-20-PLAN.md — UAT gap closure: flat stroke wireframe overlay

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 33 (27-32 failed)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2025-03-24 |
| 18-19 (2 phases) | v0.4.0 | 9/9 | Complete | 2025-03-25 |
| 20-21 (2 phases) | v0.5.0 | 8/8 | Complete | 2025-03-26 |
| 22-25 (4 phases) | v0.6.0 | 14/14 | Complete | 2026-04-03 |
| 26. Monorepo Scaffold | v0.7.0 | 3/3 | Complete   | 2026-04-03 |
| 27. Engine API Adaptations | v0.7.0 | - | FAILED   | 2026-04-04 |
| 28. Adapter & Type Bridge | v0.7.0 | - | FAILED   | 2026-04-04 |
| 29. Input & Tool Reconnection | v0.7.0 | - | FAILED   | 2026-04-04 |
| 30. UI, Paper & Transparency | v0.7.0 | - | FAILED   | 2026-04-04 |
| 31. Advanced Paint Features | v0.7.0 | - | FAILED   | 2026-04-04 |
| 32. Cleanup & Removal | v0.7.0 | - | FAILED   | 2026-04-04 |
| 33. Enhance Current Engine | v0.7.0 | 20/20 | Complete   | 2026-04-05 |
