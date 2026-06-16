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

- [x] **Phase 34: Standalone Demo Shell** - Users can launch and iterate on a package-local physics paint demo from repo-root pnpm scripts. (completed 2026-06-08)
- [x] **Phase 35: Interactive Physics Paint Controls** - Users can test the real physics paint engine with live canvas input, paint/erase tools, settings, and diagnostics. (completed 2026-06-10)
- [x] **Phase 36: Session Persistence and Output Proof** - Users can save, reload, inspect, and export standalone physics paint output for future cached compositing. (completed 2026-06-13)
- [x] **Phase 36.1: Physics Paint Play-Script Timeline Markers and Sequential Playback** - Users can see saved Play script ranges, reopen/scrub them correctly, and render sequential Play animation. (completed 2026-06-16)
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

- [x] 34-03-PLAN.md — Update README usage, examples, and workflow boundaries.

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

**Plans**: 5 plans
Plans:
**Wave 1**

- [x] 35-01-PLAN.md — Define physic-paint layer contracts and rendered-output store.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 35-02-PLAN.md — Add editor physic-paint layer entry point and open-canvas button.
- [x] 35-03-PLAN.md — Upgrade standalone controls, diagnostics, and apply actions.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 35-04-PLAN.md — Wire rendered apply-back into editor state and preview.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 35-05-PLAN.md — Polish feedback copy and run live UAT checkpoint.

**UI hint**: yes

### Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof

**Goal**: Users can work in a rebuilt, production-grade physics paint package UI that preserves standalone sessions and produces inspectable rendered output suitable for later cached editor compositing.
**Depends on**: Phase 35
**Requirements**: UI-REBUILD-01, UI-REBUILD-02, SAVE-01, SAVE-02, OUT-01, OUT-02
**Success Criteria** (what must be TRUE):

  1. User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states for painting, erasing, tool/settings changes, save/load, and export actions.
  2. User can save the current standalone paint session as JSON from the rebuilt UI.
  3. User can reload saved JSON and continue testing the same paint session without losing editable physics paint state.
  4. User can export the current rendered physics paint result as a PNG or still image from the rebuilt UI.
  5. User can produce a frame-sequence or cache-manifest proof from the live engine for future editor consumption.
  6. The rebuilt package UI remains standalone-package-first and does not add editor integration scope beyond rendered-output proof artifacts.

**Plans**: 7 plans
Plans:
**Wave 1**

- [x] 36-01-PLAN.md — Define tested workflow-state predicates for Roto/Play modes, destructive confirmations, onion count, and dev export gating.
- [x] 36-02-PLAN.md — Extract tested editable JSON Save state / Load state helpers.
- [x] 36-03-PLAN.md — Add tested rendered still and PNG+manifest debug export proof helpers.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36-04-PLAN.md — Refactor Physics Paint Studio behavior callbacks, project FPS launch context, and no-close Save play handling.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 36-05-PLAN.md — Build top bar, SVG tool rail, right panel, and EFX-style visual regions.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 36-06-PLAN.md — Build bottom Roto/Play workflow strip, two timeline lanes, onion controls, and confirmation prompts.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 36-07-PLAN.md — Wire the five-region UI into PhysicsPaintStudio, add contextual shortcuts, and run human visual verification.

**UI hint**: yes

### Phase 36.2: Roto paint enhancements: All details are here @SPECS/phase-36.2-physics-paint-roto-cache.md (INSERTED)

**Goal:** Users can work with Physics Paint Roto as a cache-first animation workflow with gray/green/pink cache cells, cached-reference navigation, save-on-leave/save-on-close, cached playback/export, and render-only interpolation/key utilities.
**Requirements**: PH36.2-CACHE, PH36.2-MISSING, PH36.2-PLAYBACK, PH36.2-INTERP
**Depends on:** Phase 36
**Plans:** 6 plans

Plans:
**Wave 1**

- [ ] 36.2-01-PLAN.md — Define cache-first Roto contracts, real/generated metadata, and invalidating store helpers.

**Wave 2** *(blocked on Wave 1 cache metadata)*

- [ ] 36.2-02-PLAN.md — Render gray/green/pink Roto cells, outline-only current frame, and Save pending/current UX.

**Wave 3** *(blocked on cache/store and cell semantics)*

- [ ] 36.2-03-PLAN.md — Add cached reference navigation plus dirty save-on-leave/save-on-close behavior.
- [ ] 36.2-04-PLAN.md — Hydrate cached Roto launch summaries and verify cached preview/export missing-frame behavior.

**Wave 4** *(blocked on cache navigation and playback/export paths)*

- [ ] 36.2-05-PLAN.md — Add cached Roto Play/Stop preview without all-frame rendering.

**Wave 5** *(tail plan blocked on cache-first foundation)*

- [ ] 36.2-06-PLAN.md — Add global Roto interpolation connectors and real-key duplicate/insert/delete/copy/paste utilities.

### Phase 36.1: Physics Paint Play-Script Timeline Markers and Sequential Playback

**Goal**: Users can see multiple saved Physics Paint Play script animation ranges as nested markers inside one Physic Paint timeline layer, reopen the correct script from the editor scrubber, preview Play interpolation locally in the standalone window, and render Play scripts sequentially like one artist hand.
**Depends on**: Phase 36
**Requirements**: PH36.1-TL, PH36.1-STORE, PH36.1-BRIDGE, PH36.1-PLAY-SCRUB, PH36.1-SEQUENTIAL
**Success Criteria** (what must be TRUE):

  1. User can see several non-overlapping saved Play script ranges as polished nested markers inside the existing Physic Paint layer bar.
  2. Marker positions and widths follow the main timeline frame scale, zoom, and horizontal scroll, with the scrubber-contained script highlighted.
  3. Clicking `[open fx paint canvas]` while the editor scrubber is inside a saved Play range opens that exact script in the standalone Play canvas at the relative preview frame.
  4. Clicking `[open fx paint canvas]` while the editor scrubber is in a gap opens Roto at the current frame and constrains any new Play script duration to the available no-overlap gap.
  5. Local Play canvas scrubbing previews in-between frames without moving the main editor playhead and without publishing until `Save play`.
  6. Existing saved scripts preview cached rendered frames until the user remakes them; `Save play` replaces old cached range frames.
  7. Play animation renders recorded strokes sequentially with length-weighted allocation, completing the drawing within the chosen duration.

**Plans**: 9 plans
Plans:
**Wave 1**

- [x] 36.1-01-PLAN.md — Define validated multi-range saved Play script contracts, store helpers, persistence, and no-overlap behavior.
- [x] 36.1-05-PLAN.md — Replace Play animation timestamp-ratio playback with tested one-hand sequential stroke allocation.

**Wave 2** *(blocked on Wave 1 contract/store completion for Plans 02-03)*

- [x] 36.1-02-PLAN.md — Resolve scrubber-contained Play launches and gap/Roto max-duration launch contexts.
- [x] 36.1-03-PLAN.md — Draw polished nested Play script markers inside Physic Paint timeline bars.

**Wave 3** *(blocked on bridge/store completion)*

- [x] 36.1-04-PLAN.md — Add standalone Play local scrub preview, max-duration messaging, and cached/live preview switching.

**Wave 4** *(blocked on Waves 2-3 and sequential playback)*

- [x] 36.1-06-PLAN.md — Thread marker data into live timeline layout, finalize validation, and run user visual verification.

**Wave 5** *(gap closure; blocked on Plan 06 live marker/frameMap validation)*

- [x] 36.1-07-PLAN.md — Replace editor opening with explicit Roto paint and Play paint launch modes plus gap-constrained Play creation.

**Wave 6** *(gap closure; blocked on Plan 07 explicit launch modes)*

- [x] 36.1-08-PLAN.md — Remove standalone Roto/Play tabs, lock opened mode, and replace icon-only render controls with text Render actions.

**Wave 7** *(gap closure; blocked on Plan 08 mode/render UX)*

- [x] 36.1-09-PLAN.md — Fix cached saved-script reopen, standalone clear/remake editor updates, and EFX Motion saved-script deletion.

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
| 34. Standalone Demo Shell | v0.8.0 | 3/3 | Complete    | 2026-06-08 |
| 35. Interactive Physics Paint Controls | v0.8.0 | 7/7 | Complete    | 2026-06-10 |
| 36. Session Persistence and Output Proof | v0.8.0 | 11/11 | Complete   | 2026-06-13 |
| 36.1. Physics Paint Play-Script Timeline Markers and Sequential Playback | v0.8.0 | 9/9 | Complete | 2026-06-16 |
| 37. Future Integration Contract and Validation | v0.8.0 | 0/TBD | Not started | - |
