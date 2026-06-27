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
- [x] **Phase 36.3: Physics Paint Roto Durable Core Recovery** - MVP/TDD recovery phase to prove one painted Roto frame can be cached into EFX Motion, appear in preview, survive project save/load, and reopen as a cached visual reference. (planned recovery) (completed 2026-06-19)
- [x] **Phase 36.5: Physics Paint Roto Cell Semantics** - Roto timeline cells clearly distinguish empty, cached, editable/current, generated/render-only, background-only, dirty, and saving states while staying MVP-only. (completed 2026-06-20)
- [x] **Phase 36.6: Physics Paint Roto Save On Leave** - Users can leave dirty Roto frames with source-frame save feedback and without manually pressing Save current for each frame. (completed 2026-06-20)
- [x] **Phase 36.7: Physics Paint Roto Key Utilities** - Stop-motion animators can duplicate, insert, delete, copy, and paste real Roto keys efficiently with clean cache/cell/canvas state. (completed 2026-06-22)
- [x] **Phase 36.8: Physics Paint Roto State Refactor** - PhysicsPaintStudio consumes a compact Roto session/key state boundary while preserving Phase 36.7 visible behavior. (completed 2026-06-25)
- [ ] **Phase 36.9: Physics Paint Roto Cached Playback Auto-Play** - Animators can optionally preview cached Roto frames with Play/Stop automation if manual stepping is not enough. (planned; final UAT confirmation pending)
- [ ] **Phase 36.10: Physics Paint Roto Missing Background Preview Export** - Missing Roto frames render consistently as transparent or background-only in preview and export. (planned)
- [ ] **Phase 36.11: Physics Paint Roto Repaint Cached Real Key** - Existing cached real Roto keys reopen with their alpha paint as an additive base layer for repainting without restoring old stroke scripts. (planned)
- [ ] **Phase 36.12: Physics Paint Roto Generated Interpolation** - Animators can generate render-only in-between Roto frames between real keys without making generated frames editable. (planned)
- [ ] **Phase 36.13: Physics Paint Roto Timeline UI From Pencil** - Roto timeline controls match the corrected Pencil design after behavior is stable. (planned)
- [ ] **Phase 36.14: Physics Paint Roto State Machine Readiness** - Maintenance phase to evaluate XState/state-machine ownership after remaining user-facing 36.x Roto features are integrated. (deferred)
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

### Phase 36.9: Physics Paint Roto Cached Playback Auto-Play

Use `SPECS/36.x-phases/phase-36.9-cached-autoplay/spec-36.9-cached-autoplay.md` as the source of truth for this phase.

**Goal:** As a stop-motion animator, I want to press Play to automatically advance through cached Roto frames inside Physics Paint, so that I can preview timing without manually pressing previous and next.
**Mode:** mvp
**Requirements**: 36.9-CACHED-PLAYBACK, 36.9-UAT
**Depends on:** Phase 36.8
**Plans:** 3/3 plans executed; final UAT confirmation pending

Planning notes:

- Run the phase necessity check first: if manual previous/next cached-frame navigation is accepted as enough, skip or defer this phase.
- Keep this as a small Play/Stop automation slice over the existing cached-frame display path.
- Playback is preview-only and must not rewrite, regenerate, or mutate cached frames.
- Include minimal visible controls and state feedback required for real UAT.
- Final Pencil layout polish is separate.

Plans:

**Wave 1**

- [x] 36.9-01-PLAN.md — Confirm whether timed cached Roto playback is necessary before app-code changes.

**Wave 2** *(blocked on Wave 1 timed-preview approval)*

- [x] 36.9-02-PLAN.md — Use TDD to harden cached Roto playback controller behavior and no-mutation contracts.

**Wave 3** *(blocked on Wave 2 controller contracts)*

- [x] 36.9-03-PLAN.md — Expose visible Play/Stop controls from the timeline references and run live UAT. (final confirmation pending after real-key-only playback fix)

### Phase 36.10: Physics Paint Roto Missing Background Preview Export

Use `SPECS/36.x-phases/phase-36.10-missing-background/spec-36.10-missing-background.md` as the source of truth for this phase.

**Goal:** As a stop-motion animator, I want to render missing Roto frames as transparent or paper-background-only frames, so that gaps between painted keys and trailing frames preview/export consistently without accidental paint content.
**Mode:** mvp
**Requirements**: 36.10-MISSING-TRANSPARENT, 36.10-MISSING-BACKGROUND, 36.10-PREVIEW-EXPORT-PARITY
**Depends on:** Phase 36.9
**Plans:** 2/5 plans executed

Planning notes:

- Define the visual result of missing Roto frames only: transparent or background-only.
- Preview and export must use the same rule for the same frame/settings.
- Existing cached frames must continue to render normally beside missing frames.
- Include minimal visible controls and state feedback required for real UAT.
- Final Pencil layout polish is separate.

Plans:

**Wave 1**

- [x] 36.10-01-PLAN.md — Define and test the shared missing-frame resolver and preview/export delegation contract.

**Wave 2** *(blocked on Wave 1 resolver contract)*

- [x] 36.10-02-PLAN.md — Implement bounded interior background-only support, exact replacement, and alpha-cache separation.

**Wave 3** *(blocked on Wave 2 store/type support)*

- [ ] 36.10-03-PLAN.md — Surface background-only/transparent missing-frame state through existing Roto workflow strip and session boundaries.

**Wave 4** *(blocked on Wave 3 UI/session wiring)*

- [ ] 36.10-04-PLAN.md — Prove preview/export parity, real-key adjacency, and alpha-separation regressions.

**Wave 5** *(blocked on Wave 4 automated gates)*

- [ ] 36.10-05-PLAN.md — Record automated validation and run user-owned live preview/export UAT.

### Phase 36.11: Physics Paint Roto Repaint Cached Real Key

Use `SPECS/36.x-phases/phase-36.11-repaint-cached-real-key/spec-36.11-repaint-cached-real-key.md` as the source of truth for this phase.

**Goal:** As a stop-motion animator, I want reopening an existing cached Roto key to keep its current painted alpha result as a base layer, so that I can add more paint without losing previous work or baking the paper background into the key.
**Requirements**: 36.11-REPAINT-CACHED-REAL-KEY, 36.11-ALPHA-ONLY-MERGE, 36.11-NO-STROKE-RESTORE
**Depends on:** Phase 36.10
**Plans:** 0 plans

Planning notes:

- Plan only additive raster repaint over existing cached real Roto keys.
- Existing cached alpha paint is a base layer; old flattened stroke scripts are not restored or editable.
- Saving must replace the real-key cache with previous cached alpha plus newly rendered live paint alpha.
- Paper/background must stay separate from the alpha-only paint cache.
- Existing key utilities, dirty save-before-action, and missing/background frame behavior must remain intact.

Plans:

- [ ] TBD (run /gsd-plan-phase 36.11 to break down)

### Phase 36.12: Physics Paint Roto Generated Interpolation

Use `SPECS/36.x-phases/phase-36.12-generated-interpolation/spec-36.12-generated-interpolation.md` as the source of truth for this phase.

**Goal:** As a stop-motion animator, I want generated in-between Roto frames between real keys, so that I can preview smoother motion without making generated frames editable.
**Requirements**: 36.12-GENERATED-FRAMES, 36.12-REAL-KEY-AUTHORITY, 36.12-STALE-REGENERATION
**Depends on:** Phase 36.11
**Plans:** 0 plans

Planning notes:

- Plan only generated render-only in-betweens between real keys.
- Generated frames are previewable/renderable but not editable real keys.
- Real keys remain the authoritative editable frames.
- Changing a source real key must invalidate or refresh dependent generated frames.
- Include minimal visible controls and state feedback required for real UAT.
- Final Pencil layout polish is separate.

Plans:

- [ ] TBD (run /gsd-plan-phase 36.12 to break down)

### Phase 36.13: Physics Paint Roto Timeline UI From Pencil

Use `SPECS/36.x-phases/phase-36.13-timeline-ui/spec-36.13-timeline-ui.md` and the referenced Pencil/timeline files as the source of truth for this phase.

**Goal:** As a stop-motion animator, I want the Roto timeline controls to match the corrected Pencil design, so that the timeline is discoverable without cluttering the top bar.
**Requirements**: 36.13-PENCIL-LAYOUT, 36.13-CONTROL-GROUPING, 36.13-VISUAL-STATES, 36.13-REGRESSION
**Depends on:** Phase 36.12
**Plans:** 0 plans

Planning notes:

- Apply the corrected Pencil design only after core timeline behavior is stable.
- Reorganize and polish controls that already exist from earlier behavior phases.
- Do not make this the first point where a core behavior becomes testable.
- Preserve existing timeline behavior while matching layout, grouping, hierarchy, spacing, labels, and state styling.

Plans:

- [ ] TBD (run /gsd-plan-phase 36.13 to break down)

### Phase 36.14: Physics Paint Roto State Machine Readiness

Deferred maintenance phase after the remaining user-facing 36.x Roto features are integrated. Phase 36.8 is the current state-boundary foundation; do not evaluate XState/state-machine ownership before cached playback, missing-frame rules, repaint cached real keys, generated interpolation, and the Pencil timeline UI pass have stabilized the user-facing workflow.

Context:
Phase 36.8 extracted a compact Preact-native Signals/controller state boundary for Roto key/session/cache coherence. That boundary is the foundation for the remaining user-facing Roto phases and should be extended incrementally before deciding whether XState/state-machine ownership is justified.

Goal:
Evaluate whether XState is the right state-machine layer for Physics Paint Roto and introduce it only if the stabilized 36.x transition model is clearer than a Signals/controller alone.

Scope:

- Build on Phase 36.8's Roto state boundary after Phases 36.9-36.13 are integrated.
- Identify the final Roto workflow states and guarded transitions across cached playback, missing-frame preview/export, repaint cached real keys, generated interpolation, real-key utilities, dirty save-before-action, save failures, deletion, paste, blank keys, and navigation blocking/resume.
- Decide whether XState is warranted based on concrete transition complexity and test readability.
- If adopted, wrap or replace the controller internals without changing PhysicsPaintStudio UI props/placement/labels.
- Keep Signals where they remain useful for Preact rendering and derived UI state.
- Do not rewrite the whole PhysicsPaintStudio component.
- Do not change user-visible UI.
- Do not add new controls or feature scope.

Architecture constraints:

- Phase 36.8 is the state boundary foundation; later phases may extend it with state-machine-shaped actions/transactions without committing to XState yet.
- XState, if introduced, must own transitions/rules; Signals may mirror selected derived state for Preact rendering.
- Avoid prop drilling by exposing a compact session boundary to PhysicsPaintStudio and PhysicsPaintWorkflowStrip.
- No broad useEffect orchestration for Roto key/cache coherence.

TDD requirements:

- Tests must cover the stabilized state transition graph and guarded actions before UI rewiring.
- Existing Phase 36.7-36.13 Roto regression tests must continue to pass.
- Add source-contract tests that PhysicsPaintStudio consumes the compact boundary instead of regaining scattered useState/useEffect orchestration.

Success criteria:

- Clear decision recorded: stay with Signals/controller or adopt XState.
- If XState is adopted, transition rules are explicit, tested, and isolated from rendering.
- PhysicsPaintStudio remains an adapter for UI wiring, persistence bridge, and canvas engine calls.
- No user-visible UI changes.
- No new feature scope. (DEFERRED)

**Goal:** Evaluate XState/state-machine ownership for the stabilized Roto workflow only after remaining user-facing 36.x Roto features are integrated.
**Requirements**: 36.14-DECISION, 36.14-TRANSITION-GRAPH, 36.14-BOUNDARY-CONTRACT
**Depends on:** Phase 36.13
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 36.14 to break down)

### Phase 36.8: Physics Paint Roto State Refactor

Create a new MVP/TDD phase for a narrow maintainability and correctness refactor after Phase 36.7.

Problem:
Phase 36.7 was completed, but implementation was difficult and produced repeated regressions around Insert/Delete/Paste, blank keys, deleted keys reappearing, yellow/translucent cached canvas state, and inconsistent timeline/cache/canvas behavior. The root cause appears to be that PhysicsPaintStudio has grown too large and coordinates Roto state through many local useState, useRef, launchContext mutations, canvas engine mutations, cache updates, and broad useEffect synchronization branches.

Goal:
Extract a small Preact-native Roto session/key state boundary so PhysicsPaintStudio stops owning all Roto key/cache coherence directly. Prefer @preact/signals for reactive state that moves outside PhysicsPaintStudio. Keep PhysicsPaintStudio as an adapter for UI wiring, bridge/store persistence, and canvas engine calls.

MVP scope:

- Focus only on Roto key/session state needed by the existing 36.7 utilities and Roto cache coherence.
- Preserve all existing UI and behavior.
- Do not add new controls, shortcuts, modals, toasts, interpolation UI, cached playback UI, or Play/Roto conversion UI.
- Do not rewrite the whole PhysicsPaintStudio component.
- Do not refactor unrelated paint modes or physics engine internals.
- Do not replace hooks with Signals mechanically.
- Use Signals only where they create a clearer external state boundary or derived state model.

Desired state boundary:

- Real Roto key ownership
- Current/selected Roto frame
- Dirty frame status
- Copied key clipboard state
- Generated/render-only frame markers
- Blank inserted key state
- Deleted-frame cleanup state
- Restore intent for canvas/background/reference overlays
- Derived action availability for Insert, Duplicate, Copy, Paste, Delete
- Compact status/action feedback state if currently owned by scattered local state

Architecture constraints:

- PhysicsPaintStudio should consume derived state/actions from the new boundary instead of coordinating Roto utility coherence through additional useEffect branches.
- New broad useEffect branches inside PhysicsPaintStudio should be forbidden unless they synchronize with a true external system.
- Effects should be boundary effects only: bridge events, canvas engine lifecycle, parent persistence, or external window communication.
- If state moves outside PhysicsPaintStudio, use @preact/signals or justify why a pure/stateless controller is safer.
- Expose a compact Roto session object with explicit actions/transactions so PhysicsPaintStudio and PhysicsPaintWorkflowStrip avoid large prop lists.
- Keep the boundary state-machine-shaped enough that Phase 36.9 can wrap or replace internals with XState without UI rewiring.
- Keep the refactor incremental and regression-first.

TDD requirements:
Start with failing regression/source-contract tests proving:

1. Inserted blank keys remain clean when navigating away/back and when painting.
2. Deleted keys do not reappear from stale cache/canvas/background state.
3. Paste onto empty/generated targets creates clean real keys and clears generated/render-only state.
4. Duplicate behavior remains unchanged.
5. Dirty save-before-action still preserves visible edits and cancels safely on save failure.
6. UI labels and placement remain unchanged.
7. PhysicsPaintStudio does not gain new broad useEffect orchestration for Roto key/cache coherence.

Success criteria:

- Existing Phase 36.7 UAT still passes.
- Roto key/cache/canvas state derives from one coherent boundary.
- PhysicsPaintStudio has less ownership of Roto utility state and fewer scattered state/ref mutation responsibilities.
- No user-visible UI changes.
- No new feature scope. (INSERTED)

**Goal:** Extract a compact Preact-native Roto session/key state boundary so PhysicsPaintStudio stops owning all Roto key/cache coherence directly while preserving Phase 36.7 visible behavior.
**Requirements**: 36.8-REG-01, 36.8-REG-02, 36.8-REG-03, 36.8-REG-04, 36.8-REG-05, 36.8-REG-06, 36.8-REG-07, 36.8-REG-08, 36.8-REG-09, 36.8-REG-10
**Depends on:** Phase 36
**Plans:** 5/5 plans complete

Plans:

- [x] 36.8-01-PLAN.md
- [x] 36.8-02-PLAN.md
- [x] 36.8-03-PLAN.md
- [x] 36.8-04-PLAN.md
- [x] 36.8-05-PLAN.md

### Phase 36.7: Physics Paint Roto Key Utilities

Use SPECS/36.x-phases/phase-36.7-key-utilities/spec-36.7-key-utilities.md as the source of truth for this phase. (INSERTED)

**Goal:** As a stop-motion animator, I want to duplicate, insert, delete, copy, and paste real Roto keys, so that I can build frame-by-frame animation efficiently.
**Mode:** mvp
**Requirements**: 36.7-DUP, 36.7-INS, 36.7-DEL, 36.7-COPY-PASTE, 36.7-STUDIO, 36.7-UI
**Depends on:** Phase 36
**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 36.7-01-PLAN.md — Define and test real Roto key utility transforms and eligibility.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36.7-02-PLAN.md — Wire Studio save-before-action orchestration and cache mutation.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 36.7-03-PLAN.md — Render and style the contextual Roto key utility pill.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 36.7-04-PLAN.md — Run final focused checks and user-owned live UAT.

**Wave 5** *(gap closure blocked on failed Wave 4 live UAT)*

- [x] 36.7-05-PLAN.md — Repair Insert/Delete/Paste state-cache coherence with a regression-first Roto key controller extraction.

### Phase 36.6: Physics Paint Roto Save On Leave

Use SPECS/36.x-phases/phase-36.6-save-on-leave/spec-36.6-save-on-leave.md as the source of truth for this phase. (INSERTED)

**Goal:** As a stop-motion animator, I want to move between Roto frames without manually pressing Save current every time, so that I can paint multiple frames without manually saving each one.
**Mode:** mvp
**Requirements**: 36.6-AC-01, 36.6-AC-02, 36.6-AC-03, 36.6-AC-04, 36.6-AC-05, 36.6-AC-06, 36.6-FB-01
**Depends on:** Phase 36
**Plans:** 3/3 plans complete

Plans:

- [x] 36.6-03-PLAN.md

**Wave 1**

- [x] 36.6-01-PLAN.md — Implement the tested Roto save-on-leave navigation coordinator.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36.6-02-PLAN.md — Add source-frame pending feedback and disabled-action wiring.

### Phase 36.5: Physics Paint Roto Cell Semantics

This phase (in SPECS/36.x-phases/phase-36.5-cell-semantics/spec-36.5-cell-semantics.md) is not another close-behavior phase. Phase 36.4 already covered explicit close choices. Phase 36.5 should focus on Roto timeline cell semantics: making frame states visible and trustworthy in the UI, using SPECS/36.x-phases/timeline-ui/* as visual reference while keeping the MVP narrow. (INSERTED)

**Goal:** As a stop-motion animator, I want Roto timeline cells to clearly distinguish empty, cached, editable, current, generated, and background-only states, so that I can trust what each frame represents.
**Requirements**: 36.5-STATE-01, 36.5-STATE-02, 36.5-STATE-03, 36.5-STATE-04, 36.5-STATE-05, 36.5-STATE-06, 36.5-SCOPE-01
**Depends on:** Phase 36
**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 36.5-01-PLAN.md — Define and test normalized Roto cell base meanings and overlays.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36.5-02-PLAN.md — Wire semantic Roto cells, legend, status copy, and scope guards into the workflow strip.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 36.5-03-PLAN.md — Apply semantic CSS treatments and run user-owned visual verification.

### Phase 36.4: Physics Paint Roto Explicit Close Behavior

Use SPECS/36.x-phases/phase-36.4-explicit-close/spec-36.4-explicit-close.md as the source of truth for this phase. (INSERTED)

**Goal:** As a stop-motion animator, I want to close Physics Paint with an unsaved Roto frame by choosing close without saving, cancel, or close saving, so that I can choose between speed and preserving the current frame.
**Mode:** mvp
**Requirements**: PH36.4-CLEAN-CLOSE, PH36.4-DIRTY-CHOICES, PH36.4-DISCARD, PH36.4-CANCEL, PH36.4-SAVE-CLOSE
**Depends on:** Phase 36
**Plans:** 2/2 plans complete

Plans:

**Wave 1**

- [x] 36.4-01-PLAN.md — Implement explicit dirty Roto close choices, save-close completion, clean close, and non-stuck recovery.

**Wave 2**

- [x] 36.4-02-PLAN.md — Close the clean Physics Paint close permission blocker with narrow Tauri capability coverage.

### Phase 36.2: Roto paint enhancements: All details are here @SPECS/phase-36.2-physics-paint-roto-cache.md (FAILED/SUPERSEDED)

**Goal:** Users can work with Physics Paint Roto as a cache-first animation workflow with gray/green/pink cache cells, cached-reference navigation, save-on-leave/save-on-close, cached playback/export, and render-only interpolation/key utilities.
**Outcome:** Failed/superseded. Do not execute or resume Phase 36.2 gap-closure plans; use the failure as recovery input for new MVP/TDD phases.
**Requirements**: PH36.2-CACHE, PH36.2-MISSING, PH36.2-PLAYBACK, PH36.2-INTERP
**Depends on:** Phase 36
**Plans:** 13 plan records closed; final outcome failed/superseded, not completed implementation

Plans:
**Wave 1**

- [x] 36.2-01-PLAN.md — Define cache-first Roto contracts, real/generated metadata, and invalidating store helpers.

**Wave 2** *(blocked on Wave 1 cache metadata)*

- [x] 36.2-02-PLAN.md — Render gray/green/pink Roto cells, outline-only current frame, and Save pending/current UX.

**Wave 3** *(blocked on cache/store and cell semantics)*

- [x] 36.2-03-PLAN.md — Add cached reference navigation plus dirty save-on-leave/save-on-close behavior.
- [x] 36.2-04-PLAN.md — Hydrate cached Roto launch summaries and verify cached preview/export missing-frame behavior.

**Wave 4** *(blocked on cache navigation and playback/export paths)*

- [x] 36.2-05-PLAN.md — Add cached Roto Play/Stop preview without all-frame rendering.

**Wave 5** *(tail plan blocked on cache-first foundation)*

- [x] 36.2-06-PLAN.md — Add global Roto interpolation connectors and real-key duplicate/insert/delete/copy/paste utilities.

**Gap Closure Wave 1** *(UAT gap closure)*

- [x] 36.2-07-PLAN.md — Fix Roto close flush ordering, editable cell classification, and cached-reference strength.

**Gap Closure Wave 2** *(blocked on 36.2-07)*

- [x] 36.2-08-PLAN.md — Add visible Roto interpolation controls and regeneration wiring.

**Gap Closure Wave 3** *(blocked on 36.2-08)*

- [x] 36.2-09-PLAN.md — Add visible real-key Duplicate/Insert/Delete/Copy/Paste controls.

**Gap Closure Wave 4** *(blocked on 36.2-07 and 36.2-08)*

- [x] 36.2-10-PLAN.md — Fix missing Roto paper/background preview, export, and playback behavior.

**Gap Closure Wave 5** *(requirement traceability and runtime gap fixes)*

- [x] 36.2-11-PLAN.md — REJECTED/SUPERSEDED administrative closure; do not resume. Requirement traceability moves to new recovery phases.

**Gap Closure Wave 6** *(blocked on interpolation UI and missing-background work)*

- [x] 36.2-12-PLAN.md — REJECTED/SUPERSEDED administrative closure; do not resume. Interpolation/playback gaps move to later MVP recovery phases.

**Gap Closure Wave 7** *(blocked on runtime gap fixes)*

- [x] 36.2-13-PLAN.md — REJECTED/SUPERSEDED administrative closure; do not resume. Final proof moves to smaller MVP recovery UAT checkpoints.

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

### Phase 36.3: Physics Paint Roto Durable Core Recovery

**Goal:** As a stop-motion animator, I want to cache one painted Roto frame back into EFX Motion and preserve it through project save/load, so that Physics Paint Roto has a trustworthy durable core before adding timeline tools.
**Mode:** mvp
**Depends on**: Phase 36.2 failed/superseded closure
**Requirements**: PH36.3-DURABLE-CORE, PH36.3-UAT
**Success Criteria** (what must be TRUE):

  1. User can open Physics Paint in Roto mode for a physics-paint layer.
  2. User can paint one Roto frame and explicitly save the current frame.
  3. Parent EFX Motion receives a rendered PNG for the correct layer and frame.
  4. EFX Motion preview draws that cached PNG.
  5. Project save/load preserves that cached PNG.
  6. Reopening Physics Paint shows the cached PNG as a visual reference.
  7. Closing without saving does not block the module or corrupt existing saved cache.

**Exclusions:** interpolation, generated frames, key utilities, save-on-leave, cached Roto playback, missing background rules, Play/Roto conversion, final Pencil timeline UI, and Tauri asset protocol hardening.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 36.3-01-PLAN.md — Add the one vertical RED test, implement the durable Save current cache path, and gate the minimal Roto UI.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36.3-02-PLAN.md — Run user-owned manual UAT for the full durable core and discard behavior.

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
| 36.2. Roto paint enhancements | v0.8.0 | 13/13 records closed | Failed/superseded | 2026-06-19 |
| 36.3. Physics Paint Roto Durable Core Recovery | v0.8.0 | 2/2 | Complete    | 2026-06-19 |
| 36.8. Physics Paint Roto State Refactor | v0.8.0 | 5/5 | Complete | 2026-06-25 |
| 36.9. Physics Paint Roto Cached Playback Auto-Play | v0.8.0 | 3/3 | UAT pending |  |
| 36.10. Physics Paint Roto Missing Background Preview Export | v0.8.0 | 2/5 | In Progress|  |
| 36.11. Physics Paint Roto Repaint Cached Real Key | v0.8.0 | 0/TBD | Not started | - |
| 36.12. Physics Paint Roto Generated Interpolation | v0.8.0 | 0/TBD | Not started | - |
| 36.13. Physics Paint Roto Timeline UI From Pencil | v0.8.0 | 0/TBD | Not started | - |
| 36.14. Physics Paint Roto State Machine Readiness | v0.8.0 | 0/TBD | Deferred maintenance | - |
| 37. Future Integration Contract and Validation | v0.8.0 | 0/TBD | Not started | - |
