# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar. v0.4.0 (Phases 18-19) added After Effects-style canvas motion path editing and frame-by-frame paint/rotopaint layers with onion skinning. v0.5.0 (Phases 20-21) adds expressive brush rendering with spectral pigment mixing, watercolor bleed, and flow field distortion, plus per-layer GLSL velocity motion blur with sub-frame accumulation for export.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2026-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2026-03-25)
- 🚧 **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 (Phases 1-7) — SHIPPED 2019-03-11</summary>

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
<summary>✅ v0.2.0 Pipeline Complete (Phases 8-14) — SHIPPED 2019-03-21</summary>

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
<summary>✅ v0.3.0 Audio & Polish (Phases 15-17) — SHIPPED 2026-03-24</summary>

- [x] Phase 15: Audio Import & Waveform (4/4 plans) — completed 2019-03-21
- [x] Phase 15.1: Media In-Use & Safe Removal (2/2 plans) — completed 2026-03-22
- [x] Phase 15.2: Solid Sequence (4/4 plans) — completed 2026-03-22
- [x] Phase 15.3: GLSL Shadertoys (1/1 plan) — completed 2026-03-22
- [x] Phase 15.4: GL Transition (4/4 plans) — completed 2026-03-23
- [x] Phase 16: Audio Export & Beat Sync (6/6 plans) — completed 2026-03-23
- [x] Phase 17: Enhancements (6/6 plans) — completed 2026-03-24
- [x] Phase 17.1: Adaptive Sidebar (2/2 plans) — completed 2026-03-24

See: `milestones/v0.3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.4.0 Canvas & Paint (Phases 18-19) — SHIPPED 2026-03-25</summary>

- [x] Phase 18: Canvas Motion Path (3/3 plans) — completed 2026-03-24
- [x] Phase 19: Add Paint Layer Rotopaint (6/6 plans) — completed 2026-03-24

See: `milestones/v0.4.0-ROADMAP.md` for full details.

</details>

### 🚧 v0.5.0 Motion Blur & Paint Styles (In Progress)

**Milestone Goal:** Add expressive brush rendering (watercolor, ink, charcoal, pencil, marker) to paint layers via WebGL2 with spectral pigment mixing, and per-layer GLSL velocity motion blur with sub-frame accumulation for export.

- [ ] **Phase 20: Paint Brush FX** - Post-process FX workflow: draw flat, select strokes, apply styles via p5.brush, per-stroke raster caching, solid paint background, export parity
- [ ] **Phase 21: Motion Blur** - Per-layer GLSL velocity blur for preview, sub-frame accumulation for export, shutter angle controls, and project persistence

## Phase Details

### Phase 20: Paint Brush FX
**Goal**: Users draw flat strokes, then select and apply expressive FX styles (watercolor, ink, charcoal, pencil, marker) via p5.brush standalone rendering with per-stroke caching, solid background, and non-destructive workflow
**Depends on**: Phase 19 (paint layer foundation)
**Requirements**: PAINT-01, PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06, PAINT-07, PAINT-08, PAINT-09, PAINT-10, PAINT-11, PAINT-12, PAINT-13
**Success Criteria** (what must be TRUE):
  1. User can draw flat strokes, select them, and apply any FX style that renders via p5.brush with distinct visual character
  2. User can overlap strokes of different colors and see physically-correct pigment mixing (blue + yellow produces green, not gray)
  3. User can apply watercolor style and see edge bleed, paper texture, and flow field distortion producing organic effects
  4. User can export a project containing styled brush strokes and the exported frames render identically to the canvas preview
  5. User can open a previously saved project and all brush styles and FX parameters are preserved exactly as applied
**Plans**: 4 plans

Plans:
- [x] 20-01-PLAN.md — Types, store extensions, and per-stroke p5.brush adapter refactor
- [x] 20-02-PLAN.md — Solid paint background, renderer update, and UI background controls
- [x] 20-03-PLAN.md — Select tool, FX application workflow, style swap, and preview wiring
- [ ] 20-04-PLAN.md — Flatten, export parity, persistence, and visual verification

### Phase 21: Motion Blur
**Goal**: Users can see per-layer directional motion blur during preview playback and export with cinematographic shutter angle controls
**Depends on**: Phase 20 (shared WebGL2 infrastructure established in Phase 20)
**Requirements**: MBLR-01, MBLR-02, MBLR-03, MBLR-04, MBLR-05, MBLR-06, MBLR-07, MBLR-08, MBLR-09
**Success Criteria** (what must be TRUE):
  1. User can toggle motion blur on/off and see moving layers blur directionally while stationary layers remain sharp
  2. User can adjust shutter angle (0-360 degrees) and see the blur intensity change proportionally in both preview and export
  3. User can export with motion blur enabled and the output uses combined GLSL velocity blur + sub-frame accumulation for higher quality than preview
  4. User can save and reopen a project with motion blur settings fully preserved in the .mce file
  5. Preview playback with motion blur enabled maintains smooth playback at the target frame rate
**Plans**: 4 plans

Plans:
- [x] 21-01-PLAN.md — Types, store, WebGL2 GLSL shader, and velocity computation engine
- [ ] 21-02-PLAN.md — Preview renderer integration and toolbar UI controls
- [x] 21-03-PLAN.md — Export sub-frame accumulation, export dialog, and project persistence
- [ ] 21-04-PLAN.md — Keyboard shortcut, final tests, and visual verification

## Progress

**Execution Order:**
Phases execute in numeric order: 20 → 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2026-03-24 |
| 18-19 (2 phases) | v0.4.0 | 9/9 | Complete | 2026-03-25 |
| 20. Paint Brush FX | v0.5.0 | 3/4 | In Progress|  |
| 21. Motion Blur | v0.5.0 | 2/4 | In Progress|  |
