# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2026-03-24)

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

### v0.4.0 (Planned)

- [x] Phase 18: Canvas Motion Path — After Effects-style keyframe path editing on canvas (completed 2026-03-24)
  **Goal:** Visualize spatial trajectory of animated layers as a dotted trail with interactive keyframe markers; users can drag keyframe positions directly on the canvas
  **Plans:** 3 plans
  Plans:
  - [x] 18-01-PLAN.md — Motion path rendering (dotted trail, keyframe circles, current-frame highlight, tests)
  - [x] 18-02-PLAN.md — Keyframe circle drag interaction (drag to reposition, auto-seek, undo coalescing)
  - [x] 18-03-PLAN.md — Gap closure: real-time canvas updates for keyframe property edits

- [ ] Phase 19: Add Paint Layer Rotopaint — Frame-by-frame drawing and rotoscoping with perfect-freehand brush engine, onion skinning, and sidecar persistence (6 plans)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2026-03-24 |
| 18. Canvas Motion Path | v0.4.0 | 3/3 | Complete   | 2026-03-24 |
| 19. Paint Layer Rotopaint | v0.4.0 | 0/6 | Planned | - |
