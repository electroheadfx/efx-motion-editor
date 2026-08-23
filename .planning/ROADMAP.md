# Roadmap: EFX-Motion Editor

## Overview

EFX-Motion Editor goes from zero to a complete stop-motion-to-cinema pipeline. v0.1.0 (Phases 1-7) shipped the complete editing experience. v0.2.0 (Phases 8-14) extended the editor with keyframe animation, GPU blur, content overlays, transitions, and multi-format export. v0.3.0 (Phases 15-17) added audio import with waveforms and beat sync, GLSL shader effects and transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar. v0.4.0 (Phases 18-19) added After Effects-style canvas motion path editing and frame-by-frame paint/rotopaint layers with onion skinning. v0.5.0 (Phases 20-21) added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export. v0.6.0 (Phases 22-25) added stroke management, bezier path editing, and paint workflow UX improvements. v0.7.0 (Phases 26-33) converted to a pnpm monorepo and enhanced the current paint engine with a 3-mode system, inline color picker, wireframe overlay, and stroke animation. v0.8.0 (Phases 34-38.1) proved `packages/efx-physic-paint` as a standalone interactive physics paint app/window with a deterministic physical-frame Roto timeline, multi-select group operations, Roto Script Play fusion, and render-path performance. v0.9.0 (Phases 39-44) restored automatic Scripts hydration, shipped a legible macOS identity with explicit desktop build hygiene, added read-only frame-synchronized audio preview inside EFX Paint, and delivered PlayScript static/hold application modes with color override, linked Hold Loop Clips authored through an EFX-local Integrated Loop Rail and contextual Scripts inspector, Intentional Gap Insert with local interpolation breaks, Motion/Static Group stabilization and Action lifecycle, Group and Key Rail drag, the Timeline Toolbox with directional Push tools, multi-rail selection with batch operations, and a signed/notarized release published as GitHub Latest. v1.0.0 (Phases 45-53) turns one parent Paint layer into a complete multi-track frame animation document: a versioned EFX Paint document with stable internal track IDs, track-local Paint/Roto/PlayScript state and caches, an internal multi-track timeline with filmstrip capsules, a deterministic internal compositor producing one flattened parent raster per frame, a fixed Background track with imported Loop Clips, a photo/reference track, read-only audio preview, a shared mask compositor with Reveal, and a clean-break v1.0 format with explicit pre-v1.0 rejection.

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2019-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2019-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2025-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2025-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2025-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- ✅ **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (shipped 2026-04-05)
- ✅ **v0.8.0 Standalone Physics Paint** — Phases 34-38.1 (shipped 2026-08-01)
- ✅ **v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity** — Phases 39-44 (shipped 2026-08-21)
- 🚧 **v1.0.0 EFX Paint Multi-Track Frames and Reveal** — Phases 45-53 (in progress)

## Phases

<details>
<summary>v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Phases 39-44) — SHIPPED 2026-08-21</summary>

- [x] Phase 39: Scripts Auto-Hydration Fix — saved-project scripts auto-load without manual Refresh (satisfied via quick 260804-f2q; closed by verification 2026-08-04)
- [x] Phase 40: macOS Icon Regeneration + Build Hygiene (3/3 plans) — completed 2026-08-04
- [x] Phase 41: EFX Paint Audio Preview + Monitoring Toggle (5/5 plans) — completed 2026-08-05
- [x] Phase 42: PlayScript Application Modes + Color Override (6/6 plans) — completed 2026-08-06
- [x] Phase 43: Hold Loop Clips + Integrated Loop Rail (15/15 plans) — completed 2026-08-08
- [x] Phase 43.1: Intentional Gap Insert + Local Interpolation Breaks (12/12 plans) — completed 2026-08-10 (INSERTED)
- [x] Phase 43.2: Motion/Static Group Stabilization + Action Lifecycle (25/25 plans) — completed 2026-08-13 (INSERTED)
- [x] Phase 43.3: Motion/Static Group Drag Within Free Space (4/4 plans) — completed 2026-08-13 (INSERTED)
- [x] Phase 43.4: Derived Key Groups + Scissor Breaks (8/8 plans) — completed 2026-08-16 (INSERTED)
- [x] Phase 43.5: Timeline Toolbox + Directional Push Tools (6/6 plans) — completed 2026-08-18 (INSERTED)
- [x] Phase 43.6: Multi-Rail Selection + Batch Operations (13/13 plans) — completed 2026-08-19 (INSERTED)
- [x] Phase 44: Integrated UAT + Signed Release (3/3 plans) — completed 2026-08-21

See: `milestones/v0.9.0-ROADMAP.md` for full details.

</details>

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
- [x] Phase 9: Canvas Zoom (4/4 plans) — completed 2019-03-13
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

<details>
<summary>v0.7.0 Monorepo & Paint Enhancements (Phases 26-33) — SHIPPED 2026-04-05</summary>

- [x] Phase 26: Monorepo Scaffold (3/3 plans) — completed 2026-04-03
- [x] Phase 27-32: Engine Integration — FAILED (adapter approach abandoned)
- [x] Phase 33: Enhance Current Engine (20/20 plans) — completed 2026-04-05

See: `milestones/v0.7.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.8.0 Standalone Physics Paint (Phases 34-38.1) — SHIPPED 2026-08-01</summary>

- [x] Phase 34: Standalone Demo Shell (3/3 plans) — completed 2026-06-08
- [x] Phase 35: Interactive Physics Paint Controls (7/7 plans) — completed 2026-06-10
- [x] Phase 36: Session Persistence and Output Proof (11/11 plans) — completed 2026-06-13
- [x] Phase 36.1: Play-Script Timeline Markers and Sequential Playback (9/9 plans) — completed 2026-06-16
- [x] Phase 36.2: Roto Paint Enhancements (13 plan records closed) — FAILED/SUPERSEDED 2026-06-19
- [x] Phase 36.3: Roto Durable Core Recovery (2/2 plans) — completed 2026-06-19
- [x] Phase 36.4: Roto Explicit Close Behavior (2/2 plans) — completed 2026-06-20
- [x] Phase 36.5: Roto Cell Semantics (3/3 plans) — completed 2026-06-20
- [x] Phase 36.6: Roto Save On Leave (3/3 plans) — completed 2026-06-20; superseded by automatic live pixel caching (quick 260714-ail)
- [x] Phase 36.7: Roto Key Utilities (5/5 plans) — completed 2026-06-22
- [x] Phase 36.8: Roto State Refactor (5/5 plans) — completed 2026-06-25
- [x] Phase 36.9: Roto Cached Playback Auto-Play (3/3 plans) — completed 2026-06-26
- [x] Phase 36.10: Roto Missing Background Preview Export (5/5 plans) — completed 2026-06-27
- [x] Phase 36.11: Roto Repaint Cached Real Key (3/3 plans) — completed 2026-06-29
- [x] Phase 36.12: Roto Generated Interpolation (11/11 plans) — completed 2026-07-02
- [x] Phase 36.13: Roto Dynamic Interpolation Spacing (6/6 plans) — completed 2026-07-13
- [x] Phase 36.14: Deterministic Physical-Frame Roto Timeline Cutover (24/30 plans; 6 historical non-executable) — completed 2026-07-25
- [x] Phase 36.15: Roto Timeline Final UI Integration (13/13 plans) — completed 2026-07-26
- [x] Phase 37: Multi-Select Physical Roto Keys (6/6 plans) — completed 2026-07-27
- [x] Phase 38: Multi-Copy/Paste and Tooltip Polish (11/11 plans) — completed 2026-07-29
- [x] Phase 38.1: Studio Render-Path Performance (18/18 plans) — completed 2026-07-29

See: `milestones/v0.8.0-ROADMAP.md` for full details.

</details>

### 🚧 v1.0.0 EFX Paint Multi-Track Frames and Reveal (In Progress)

**Milestone Goal:** Allow one parent Paint layer to contain a complete multi-track frame animation document inside EFX Paint — multiple internal Paint frame tracks composited into one flattened parent-layer result. Clean format break; pre-v1.0 Paint data rejected explicitly. Source spec: `SPECS/milestone-v1.0.0-plan.md` (locked).

- [ ] **Phase 45: New EFX Paint Document and Clean Cutover** - Versioned v1.0 document owned by one parent layer, clean-break creation, explicit pre-v1.0 rejection
- [ ] **Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches** - Track-local addressing, revisions, dirty state, and async authority
- [ ] **Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls** - Multi-row Paint timeline with track CRUD, active selection, hide/solo, opacity/blend
- [ ] **Phase 48: Internal Compositor and Flattened Parent Result** - One deterministic per-frame flattened parent raster
- [ ] **Phase 49: Fixed Background Track and Imported Loop Clips** - Background clips with finite/infinite repeat, gaps, and fallback
- [ ] **Phase 50: Photo/Reference Track** - Reference-only / reveal-source / masked-transform-source modes
- [ ] **Phase 51: Read-only Audio Preview** - Synchronized main-editor audio monitoring across internal tracks
- [ ] **Phase 52: Shared Mask Compositor and Reveal** - Photo source revealed through Paint/PlayScript coverage
- [ ] **Phase 53: Integrated v1.0.0 Acceptance** - Automated gates, native UAT, signed/notarized release

## Phase Details

### Phase 45: New EFX Paint Document and Clean Cutover

**Goal**: Introduce the new parent-owned EFX Paint document as the only supported Paint runtime and persistence format, with explicit pre-v1.0 rejection.
**Depends on**: Nothing (first phase of v1.0.0)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):

  1. Creating a new v1.0 parent Paint layer produces exactly one EFX Paint document with one default Paint track and one fixed Background track with the configured fallback.
  2. Opening a pre-v1.0 Paint project fails explicitly as unsupported with no partial mutation or fallback rendering.
  3. No legacy one-track schema reader, converter, renderer, cache path, or compatibility branch remains reachable.
  4. Save/reopen preserves new document, track, Loop Clip, source asset, and cache identity.
  5. Main-editor sequence timing and outer layer composition remain unchanged.

**Plans**: 1/8 plans executed

Plans:
**Wave 1**

- [x] 45-01-PLAN.md — v1.0 document model: types, factory, fail-closed parsers, deterministic revisions (TDD)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 45-02-PLAN.md — Rust+TS serde co-change (efx_paint_documents), v1.0 cache dir + native cache service re-point
- [ ] 45-03-PLAN.md — Clean-break rejection gate predicate + fixture truth table (TDD)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 45-04-PLAN.md — efxPaintStore + efxPaintPersistence: staging/commit save, runtime↔default-track projection, path safety

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 45-05-PLAN.md — Open/save funnel cutover: gate + blocking dialog, save-path switch, version 16, AddFxMenu registration
- [ ] 45-06-PLAN.md — v1.0 session-file format, bridge launch-context swap, standalone engine re-wire (D-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 45-07-PLAN.md — Legacy hard deletion + DOC-04 grep contract audit + full gates

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 45-08-PLAN.md — D-10 four-part native UAT (blocking checkpoint)

### Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches

**Goal**: Move editable and generated state from parent-layer/frame addressing to parent-document/internal-track/frame addressing.
**Depends on**: Phase 45
**Requirements**: TRK-01, TRK-02, TRK-03, TRK-04, TRK-05, TRK-06, TRK-07, TRK-08
**Success Criteria** (what must be TRUE):

  1. Editing one internal track never changes another track's real keys or caches.
  2. Stale async PlayScript/Reveal work cannot commit to another selected track (fail-closed on parent/document/track revision mismatch).
  3. Track deletion cannot orphan accepted assets silently (acknowledged/fail-closed deletion).
  4. Copy/cut/paste/duplicate/clear/undo/redo operations target the exact internal track.
  5. Editing one Hold source frame updates every linked occurrence without duplicating assets.

**Plans**: TBD

### Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls

**Goal**: Provide a vertically scrollable multi-row Paint timeline inside EFX Paint Studio with track CRUD, active selection, hide/solo, opacity/blend, and filmstrip capsules.
**Depends on**: Phase 46
**Requirements**: TML-01, TML-02, TML-03, TML-04, TML-05, TML-06, TML-07, TML-08
**Success Criteria** (what must be TRUE):

  1. User can add, rename, duplicate, delete, and reorder internal Paint tracks in a vertically scrollable multi-row timeline; track CRUD survives save/reopen.
  2. The active Paint track is always visually unambiguous; Paint/Roto/PlayScript/Cut/Copy/Paste/drag route to the active track.
  3. User can hide/solo Paint tracks and set internal track opacity and blend mode; hide/solo is immediately reflected in the Studio composite.
  4. Hold and Background Loop Clips show as adaptive filmstrip capsules (source cycle, linked repetition band, ×N/∞, requested/effective duration, partial-cycle interruption).
  5. Reorder changes compositor order but not track identity; timeline interactions never mutate another row accidentally.

**Plans**: TBD
**UI hint**: yes

### Phase 48: Internal Compositor and Flattened Parent Result

**Goal**: Resolve all internal Paint tracks into one deterministic per-frame raster consumed by the unchanged main-editor parent-layer compositor.
**Depends on**: Phase 47
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06
**Success Criteria** (what must be TRUE):

  1. All internal Paint tracks resolve through one shared composition path into one deterministic flattened parent raster per frame, identical in Studio preview, main preview, and export.
  2. The hide/solo truth table is applied (no solo → all visible; solo → visible+soloed only; hide wins over solo).
  3. Internal track opacity and blend mode are applied once inside EFX Paint; parent opacity/blend is applied once by the main editor (never double-applied).
  4. Track cache key includes track revision and composition dependencies; parent cache invalidates when any participating track/clip/source/fallback changes.
  5. The pixel acceptance matrix passes (opaque/semi-transparent/multiply/screen/overlay/add, hidden/soloed, empty upper frame, Background loops, gaps, parent opacity/blend).

**Plans**: TBD

### Phase 49: Fixed Background Track and Imported Loop Clips

**Goal**: Add one fixed Background row beneath all internal Paint tracks with imported still/sequence Loop Clips, finite/infinite repeat, gaps, and fallback.
**Depends on**: Phase 48
**Requirements**: BKG-01, BKG-02, BKG-03, BKG-04, BKG-05, BKG-06, BKG-07, BKG-08, BKG-09
**Success Criteria** (what must be TRUE):

  1. User can import one still image or an ordered image sequence as a Background clip on the single fixed Background track beneath all Paint tracks.
  2. A five-image cycle repeated three times resolves 15 frames while storing only five linked source images; a ten-image cycle repeated twice starting at 15 resolves frames 15-34 ending at exclusive frame 35.
  3. Finite and infinite loops stop cleanly at the next clip or parent end; a next clip can shorten a loop to a partial cycle without overlap or asset duplication, and moving/removing it recalculates the previous loop deterministically.
  4. Gaps reveal the document fallback (solid color or transparency) identically in Studio, flattened parent output, main preview, and export.
  5. Imported clips, source order, IDs, repeats, gaps, fallback, and effective rendering survive save/reopen.

**Plans**: TBD

### Phase 50: Photo/Reference Track

**Goal**: Add one durable source track used for painting reference, Reveal source, and accepted masked-transform workflows without turning it into a main-editor content track.
**Depends on**: Phase 49
**Requirements**: REF-01, REF-02, REF-03, REF-04, REF-05
**Success Criteria** (what must be TRUE):

  1. User can add one photo/reference track with stable source identity and revision.
  2. User can switch the photo/reference track between reference-only, reveal-source, and masked-transform-source modes.
  3. Toggling reference-only visibility never alters ordinary flattened Paint output.
  4. Missing source is visible and recoverable; source revision invalidates dependent Reveal/transformation results.
  5. Save/reopen preserves source identity and mode.

**Plans**: TBD

### Phase 51: Read-only Audio Preview

**Goal**: Preserve synchronized listening to main-editor audio while playing the EFX Paint multi-track frame document.
**Depends on**: Phase 47 (shared application-frame cursor)
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04
**Success Criteria** (what must be TRUE):

  1. Main-editor audio remains authoritative and read-only during EFX Paint playback.
  2. All internal Paint tracks share one application-frame playback cursor; audio monitoring follows it.
  3. Local monitoring On/Off does not mutate source audio; closing Studio releases audio resources.
  4. Multi-track Paint playback remains synchronized with main-editor audio across seek, loop, pause, resume, and stop.

**Plans**: TBD

### Phase 52: Shared Mask Compositor and Reveal

**Goal**: Reveal the photo/reference source through animated coverage from one or more internal Paint tracks.
**Depends on**: Phase 50
**Requirements**: RVL-01, RVL-02, RVL-03, RVL-04, RVL-05, RVL-06
**Success Criteria** (what must be TRUE):

  1. One offscreen source-plus-mask compositor shared by Studio and flattened output reveals the photo source through internal Paint/PlayScript coverage.
  2. Empty mask reveals nothing; full mask reveals the entire source; partial alpha produces soft edges; eraser removes coverage.
  3. Progressive PlayScript reveals progressively; static/hold PlayScript preserves the completed reveal.
  4. Reveal result is written to or represented by an internal Paint/result track and included in flattened output; photo reference visibility alone never leaks into output.
  5. Undo/redo by reference (not raster-byte snapshots); save/reopen and export preserve the result.

**Plans**: TBD

### Phase 53: Integrated v1.0.0 Acceptance

**Goal**: The enforcement backstop for all stop conditions — automated gates, native UAT, and signed/notarized release.
**Depends on**: Phase 52
**Requirements**: ACC-01, ACC-02, ACC-03
**Success Criteria** (what must be TRUE):

  1. All automated gates pass (vitest, typecheck, build, cargo test, release script preflight).
  2. Native UAT validates the full 17-step surface (document init, legacy rejection, track CRUD, Background loops, fallback, Reveal, save/reopen, main-editor parity).
  3. Release stop conditions are all not active; signed/notarized downloaded-artifact verification passes before publication.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v0.1.0 | 45/45 | Complete | 2019-03-11 |
| 8-14 (23 phases) | v0.2.0 | 66/66 | Complete | 2019-03-21 |
| 15-17 (8 phases) | v0.3.0 | 29/29 | Complete | 2025-03-24 |
| 18-19 (2 phases) | v0.4.0 | 9/9 | Complete | 2025-03-25 |
| 20-21 (2 phases) | v0.5.0 | 8/8 | Complete | 2025-03-26 |
| 22-25 (4 phases) | v0.6.0 | 14/14 | Complete | 2026-04-03 |
| 26-33 (8 phases) | v0.7.0 | 23/23 | Complete | 2026-04-05 |
| 34-38.1 (21 phases) | v0.8.0 | 170/170 | Complete | 2026-08-01 |
| 39-44 (12 phases) | v0.9.0 | 100/100 | Complete | 2026-08-21 |
| 45. New EFX Paint Document and Clean Cutover | v1.0.0 | 1/8 | In Progress|  |
| 46. Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches | v1.0.0 | 0/TBD | Not started | - |
| 47. Internal Multi-track Timeline, Filmstrip Capsules, and Controls | v1.0.0 | 0/TBD | Not started | - |
| 48. Internal Compositor and Flattened Parent Result | v1.0.0 | 0/TBD | Not started | - |
| 49. Fixed Background Track and Imported Loop Clips | v1.0.0 | 0/TBD | Not started | - |
| 50. Photo/Reference Track | v1.0.0 | 0/TBD | Not started | - |
| 51. Read-only Audio Preview | v1.0.0 | 0/TBD | Not started | - |
| 52. Shared Mask Compositor and Reveal | v1.0.0 | 0/TBD | Not started | - |
| 53. Integrated v1.0.0 Acceptance | v1.0.0 | 0/TBD | Not started | - |
