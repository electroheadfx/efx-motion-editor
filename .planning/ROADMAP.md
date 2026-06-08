# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar. v0.4.0 (Phases 18-19) added After Effects-style canvas motion path editing and frame-by-frame paint/rotopaint layers with onion skinning. v0.5.0 (Phases 20-21) added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export. v0.6.0 (Phases 22-25) added stroke management, bezier path editing, and paint workflow UX improvements. v0.7.0 (Phases 26-33) converted to a pnpm monorepo and enhanced the current paint engine with a 3-mode system, inline color picker, wireframe overlay, and stroke animation. v0.8.0 (Phases 34-37) makes `packages/efx-physic-paint` runnable and testable as a standalone interactive physics paint app/window before any EFX Motion Editor integration.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2025-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2025-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2025-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- ✅ **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (shipped 2026-04-05)
- 📋 **v0.8.0 Standalone Physics Paint** — Phases 34-37 (planned)

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
- [x] Phase 12.4: ShortcutsOverlay Tabs (1/1 plan) — completed 2019-03-17
- [x] Phase 12.5: Vertical Scroll (2/2 plans) — completed 2019-03-18
- [x] Phase 12.6: Layer Auto-selection UX (3/3 plans) — completed 2019-03-18
- [x] Phase 12.7: Keyframe Icons (1/1 plan) — completed 2019-03-18
- [x] Phase 12.8: Timeline Thumb Cover (1/1 plan) — completed 2019-03-18
- [x] Phase 12.9: Add-Layer Dialogs (1/1 plan) — completed 2019-03-18
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

<details>
<summary>v0.7.0 Monorepo & Paint Enhancements (Phases 26-33) — SHIPPED 2026-04-05</summary>

- [x] Phase 26: Monorepo Scaffold (3/3 plans) — completed 2026-04-03
- [x] Phase 27-32: Engine Integration — FAILED (adapter approach abandoned)
- [x] Phase 33: Enhance Current Engine (20/20 plans) — completed 2026-04-05

See: `milestones/v0.7.0-ROADMAP.md` for full details.

</details>

### v0.8.0 Standalone Physics Paint (Planned)

- [ ] **Phase 34: Standalone Demo Shell** - Users can launch and iterate on a package-local physics paint demo from repo-root pnpm scripts.
- [ ] **Phase 35: Interactive Physics Paint Controls** - Users can test the real physics paint engine with live canvas input, paint/erase tools, settings, and diagnostics.
- [ ] **Phase 36: Session Persistence and Output Proof** - Users can save, reload, inspect, and export standalone physics paint output for future cached compositing.
- [ ] **Phase 37: Future Integration Contract and Validation** - Developers have type-only transport/cache contracts and validation proof without editor integration scope creep.

## Phase Details

### Phase 34: Standalone Demo Shell

**Goal**: Users can launch and iterate on a standalone physics paint demo without coupling it to the EFX Motion Editor runtime.
**Depends on**: Phase 33
**Requirements**: RUN-01, RUN-02, RUN-03
**Success Criteria** (what must be TRUE):

  1. User can start the standalone physics paint demo from the repository root with a documented pnpm command.
  2. User can edit the package-local Vite/Preact demo and see browser HMR while keeping the library build path separate.
  3. User can follow package README instructions that match the actual root and package scripts.
  4. User can identify that this demo runs `packages/efx-physic-paint` standalone, not as an editor paint-layer integration.

**Plans**: 3 plansPlans:
**Wave 1**

- [x] 34-01-PLAN.md — Define root/package demo command contract and dependencies.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 34-02-PLAN.md — Build package-local Vite/Preact standalone demo shell.

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 34-03-PLAN.md — Update README usage, examples, and workflow boundaries.

**UI hint**: yes

### Phase 35: Interactive Physics Paint Controls

**Goal**: Users can validate efx-physic-paint as a separate live physics paint tool with observable interactive behavior and diagnostics.
**Depends on**: Phase 34
**Requirements**: PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01
**Success Criteria** (what must be TRUE):

  1. User can paint on a live physics canvas using the local `@efxlab/efx-physic-paint` package.
  2. User can switch between paint and erase tools that call the real engine APIs.
  3. User can change core paint settings such as color, brush size, opacity, and available physics controls and see the live canvas respond.
  4. User can see engine readiness, canvas/session state, active settings, and errors while testing.
  5. User can verify efx-physic-paint is an additional physics paint tool and does not replace perfect-freehand basic paint or p5.brush FX paint.

**Plans**: TBD
**UI hint**: yes

### Phase 36: Session Persistence and Output Proof

**Goal**: Users can preserve standalone physics paint sessions and produce inspectable rendered output suitable for later cached editor compositing.
**Depends on**: Phase 35
**Requirements**: SAVE-01, SAVE-02, OUT-01, OUT-02
**Success Criteria** (what must be TRUE):

  1. User can save the current standalone paint session as JSON.
  2. User can reload saved JSON and continue testing the same paint session.
  3. User can export the current rendered physics paint result as a PNG or still image.
  4. User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption.

**Plans**: TBD
**UI hint**: yes

### Phase 37: Future Integration Contract and Validation

**Goal**: Developers can validate the standalone milestone and prepare the future editor seam without implementing editor integration now.
**Depends on**: Phase 36
**Requirements**: SEAM-01, SEAM-02, TEST-01
**Success Criteria** (what must be TRUE):

  1. Developer has typed contracts for future transport/cache messages without Tauri child-window IPC or editor runtime integration.
  2. Developer has architecture notes explaining how later EFX Motion Editor integration will consume rendered standalone outputs as cached frames.
  3. Browser/manual smoke tests prove the standalone demo runs, accepts pointer input, and exports output.
  4. Developer can confirm no headless adapter, editor-driven `renderFromStrokes`, `forceDryAll`, `.mce` persistence, or existing paint-engine replacement was added in this milestone.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 34 → 35 → 36 → 37

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2025-03-24 |
| 18-19 (2 phases) | v0.4.0 | 9/9 | Complete | 2025-03-25 |
| 20-21 (2 phases) | v0.5.0 | 8/8 | Complete | 2025-03-26 |
| 22-25 (4 phases) | v0.6.0 | 14/14 | Complete | 2026-04-03 |
| 26-33 (8 phases) | v0.7.0 | 23/23 | Complete | 2026-04-05 |
| 34. Standalone Demo Shell | v0.8.0 | 2/3 | In Progress|  |
| 35. Interactive Physics Paint Controls | v0.8.0 | 0/TBD | Not started | - |
| 36. Session Persistence and Output Proof | v0.8.0 | 0/TBD | Not started | - |
| 37. Future Integration Contract and Validation | v0.8.0 | 0/TBD | Not started | - |
