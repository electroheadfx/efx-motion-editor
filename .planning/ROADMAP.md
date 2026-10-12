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
- ✅ **v1.0.0 EFX Paint Multi-Track Frames and Reveal** — Phases 45-53 (shipped 2026-10-12)
- 🚧 **v1.0.1 Debt Patch Release** — quicks + inserted Phase 53.1, then release (in progress)

## Phases

<details>
<summary>🚧 v1.0.1 Debt Patch Release (quicks + inserted Phase 53.1, then release) — IN PROGRESS</summary>

PATCH milestone per the semver ladder locked 2026-10-12 (PATCH for debt, MINOR for features). Debt quicks are dispatched inside the milestone, plus one urgent inserted phase (53.1 Frame-model fix — release blocker from debug `frame-model-coherence`), then the release. Phase numbering stays untouched: 54 remains the first free slot for v1.1.0.

- [ ] Quick 1: Display-class save token — `|bgT:` + `|photoDisplay:` in `buildEfxPaintLayerChangeTokenValue`, `|photoDisplay:` in `buildEfxPaintSaveFingerprint`; save-twice regression test (SAVE-01..03, Known Gaps PKG-06/BKG-09)
- [ ] Quick 2: Video import joins the disk-reference law — never-copy, `source_path` recorded verbatim; retire `videos/` provisioning (`project_io.rs`), add `video_assets` to `MceProject` (`models/project.rs`) (VID-01..03)
- [ ] Quick 3: Document-sound decode readiness — `audioEngine.ts` / `audioExportMixer.ts` await or refuse a missing buffer, never silently drop (SND-01..02, Known Gap SND-07)
- [ ] Phase 53.1: Frame-model fix (INSERTED) — timeline frame-model coherence; release blocker; see Phase Details
- [ ] Release: version single-source bump to 1.0.1 (REL-01) + signed/notarized DMG via `efx-motion-release`, published as GitHub Latest (REL-02) — runs AFTER 53.1 live UAT

</details>

<details>
<summary>✅ v1.0.0 EFX Paint Multi-Track Frames and Reveal (Phases 45-53) — SHIPPED 2026-10-12</summary>

- [x] Phase 45: New EFX Paint Document and Clean Cutover (8/8 plans) — completed 2026-08-23
- [x] Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches (6/6 plans) — completed 2026-08-27
- [x] Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls (5/5 plans) — completed 2026-08-27
- [x] Phase 48: Internal Compositor and Flattened Parent Result (6/6 plans) — completed 2026-08-30
- [x] Phase 49: Fixed Background Track and Imported Loop Clips (6/6 plans) — completed 2026-09-01
- [x] Phase 50: Photo/Reference Track (6/6 plans) — completed 2026-09-01
- [x] Phase 51: Read-only Audio Preview (delivered via quicks 260902-cfa) — completed 2026-09-02
- [x] Phase 52: Shared Mask Compositor and Reveal (5/5 plans) — completed 2026-09-04
- [x] Phase 52.1: Modern frame runtime + native HD paint (7/7 plans) — completed 2026-09-09 (INSERTED)
- [x] Phase 52.2: Project package format — references only (16/16 plans) — completed 2026-09-18 (INSERTED)
- [x] Phase 52.3: Paint content export — per-frame compositor enumeration (3/3 plans) — completed 2026-09-19 (INSERTED)
- [x] Phase 52.4: Real-paint kill the salt-and-pepper (4/4 plans) — completed 2026-09-29 (INSERTED)
- [x] Phase 52.5: Physic Paint document sound track (3/3 plans) — completed 2026-10-08 (INSERTED)
- [x] Phase 53: Integrated v1.0.0 Acceptance (5/5 plans) — completed 2026-10-11

See: `milestones/v1.0.0-ROADMAP.md` for full details.

</details>

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

## Phase Details

### Phase 53.1: Frame-model fix (INSERTED)

**Goal**: Timeline frame-model coherence — the export writes exactly the frames the law predicts (last frame = paint OVER video, never paint on black); ruler ticks, playhead reach, fade-bar extent and clip ranges are mutually consistent. Four DECIDED target laws from debug `frame-model-coherence` (FRAME-MODEL.md §7) — do not re-open the model.
**Depends on**: Phase 53 (v1.0.0 complete)
**Requirements**: TBD (decided laws per `53.1-CONTEXT.md` / `FRAME-MODEL.md` §7)
**Release blocker**: v1.0.1 release stays blocked until this phase's live UAT passes. No version bump, no release action in this phase.
**Success Criteria** (what must be TRUE):

  1. RED then GREEN: `exportEngine.frameList.test.ts` asserts the TARGET laws (not just pins actual), including video-seek fps legs; all four GREEN legs land under TDD.
  2. Target laws hold: (1) untrimmed content-overlay follows N, resized `out` is authoritative, past SOURCE = HOLD default with explicit per-clip LOOP, never a silent black frame (timeline gap marker + export diagnostic); (2) playhead can sit on tick N (END STATE), export still writes 0..N-1, tick N is the end limit; (3) sequence fps follows project fps, video seek uses project fps.
  3. Guardrails hold: exclusive `outFrame` `[in, out)` unchanged; 260918-o0n span-drag law unchanged; drag mapping unchanged.
  4. Live UAT on the signed build passes (user judges).

**Order** (locked, each step gated):

1. RED — extend `app/src/lib/exportEngine.frameList.test.ts` from "pin actual" to "assert TARGET laws" + add video-seek fps legs
2. GREEN I-4 — sequence.fps follows project fps; video seek uses project fps
3. GREEN I-1/I-2 — tail policy (untrimmed follows N; resized `out` authoritative; gap marker + export diagnostic)
4. GREEN I-5 — past SOURCE = HOLD last frame by default; LOOP explicit per-clip
5. GREEN I-3 — playhead can sit on tick N (END STATE); export still writes 0..N-1; tick N is the end limit
6. Live UAT on the signed build (user judges)

**Plans:** 0/0 plans — not planned yet

Context: `.planning/phases/53.1-frame-model-fix/53.1-CONTEXT.md`
Truth table: `.planning/debug/resolved/FRAME-MODEL.md`

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
| 45-53 (14 phases) | v1.0.0 | 80/80 | Complete | 2026-10-12 |
| quicks + 53.1 | v1.0.1 | 0/5 | In Progress | — |
