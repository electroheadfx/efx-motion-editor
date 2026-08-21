# EFX-Motion Editor

## What This Is

A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes, transforms, and keyframe animation, apply cinematic FX effects (film grain, vignette, color grade, blur, dirt/scratches, light leaks) and GLSL shader effects (17 Shadertoy + 18 GL transitions), add fade/cross-dissolve/GL transitions, import audio with waveform visualization and beat-synced editing, draw frame-by-frame with pressure-sensitive brush/shape/fill tools and onion skinning with expressive brush FX (watercolor, ink, charcoal, pencil, marker) via p5.brush with spectral pigment mixing, manage strokes with drag-reorder, visibility toggles, and multi-select, edit stroke paths as bezier curves with interactive anchor/handle manipulation, edit keyframe positions directly on canvas via motion path, apply per-layer GLSL velocity motion blur with shutter angle controls, preview in real-time on a canvas-based timeline with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1) with audio and motion blur sub-frame accumulation. Built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4. v0.1.0 delivered the editing foundation; v0.2.0 completed the pipeline with keyframe animation, GPU blur, content overlays, transitions, and multi-format export; v0.3.0 added audio with beat sync, GLSL shader effects/transitions, solid sequences with gradients, and a streamlined 2-panel adaptive sidebar; v0.4.0 added canvas motion path editing and frame-by-frame paint/rotopaint layers; v0.5.0 added expressive brush rendering with spectral pigment mixing and per-layer GLSL velocity motion blur with sub-frame accumulation for export; v0.6.0 added stroke management, bezier path editing, and paint workflow UX improvements; v0.7.0 migrated to a pnpm monorepo (app/ + packages/efx-physic-paint/) with a 3-mode paint system and color picker polish; v0.8.0 proved efx-physic-paint as a standalone interactive physics paint app/window with a deterministic physical-frame Roto timeline (durable cache, generated interpolation, multi-select group operations, Roto Script Play fusion, durable script library) and render-path performance via a structural/frame-split signal graph.

## Core Value

Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## Requirements

### Validated

- ✓ Tauri 2.0 + Preact + Vite + Tailwind v4 scaffold with IPC bridge and asset protocol — v0.1.0
- ✓ Motion Canvas player embedding with signal store architecture (6 stores) — v0.1.0
- ✓ React UI prototype converted to Preact with dark theme and all panels — v0.1.0
- ✓ Image import via drag-and-drop and file dialog with Rust thumbnail generation — v0.1.0
- ✓ Image pool with LRU eviction for memory safety — v0.1.0
- ✓ Project management (create, save, open, auto-save, recent projects, .mce format v4) — v0.1.0
- ✓ Global app config persists between sessions — v0.1.0
- ✓ Sequence management (create, duplicate, delete, reorder, key photos with hold duration) — v0.1.0
- ✓ Per-sequence frame rate and resolution settings — v0.1.0
- ✓ Canvas-based timeline with virtualized frame rendering, playhead, scrubbing, zoom — v0.1.0
- ✓ Real-time preview playback at project fps with step forward/backward — v0.1.0
- ✓ Preview zoom/pan and sequence reorder on timeline — v0.1.0
- ✓ Audio-sync-ready clock architecture (performance.now() delta accumulation) — v0.1.0
- ✓ Store lifecycle fixes (clean reset on project switch, no data bleed) — v0.1.0
- ✓ Undo/redo command pattern engine (100+ levels) — v0.1.0
- ✓ Keyboard shortcuts (Space, arrows, JKL shuttle, Cmd+Z/S/N/O, ?, Delete) — v0.1.0
- ✓ Multi-layer compositing with static image, image sequence, and video layers — v0.1.0
- ✓ Blend modes (normal, screen, multiply, overlay, add) and opacity per layer — v0.1.0
- ✓ Layer transforms (position, scale, rotation, crop) — v0.1.0
- ✓ Context-sensitive properties panel — v0.1.0
- ✓ Cinematic FX effects (film grain, vignette, color grade, dirt/scratches, light leaks) — v0.1.0
- ✓ FX as timeline-level sequences with draggable range bars — v0.1.0
- ✓ Resolution-independent FX parameters — v0.1.0
- ✓ 3-level UI theme system (dark/medium/light) with CSS variable architecture — v0.2.0
- ✓ Canvas zoom/pan with keyboard shortcuts, pinch gestures, and fit-to-window — v0.2.0
- ✓ GPU-accelerated WebGL2 blur with CPU StackBlur fallback — v0.2.0
- ✓ Live canvas transform manipulation (move, scale, rotate) with handles — v0.2.0
- ✓ Per-layer keyframe animation with interpolation curves (linear, ease-in, ease-out, ease-in-out) — v0.2.0
- ✓ Content overlay layers (static image, image sequence, video) as timeline-level sequences — v0.2.0
- ✓ Redesigned sidebar with 3 resizable sub-windows, inline key photos, keyframe navigation — v0.2.0
- ✓ Fade/cross-dissolve transitions with opacity and solid color modes — v0.2.0
- ✓ Export as PNG image sequence with resolution multipliers, progress, metadata sidecars — v0.2.0
- ✓ Video export (ProRes/H.264/AV1) via FFmpeg auto-provisioning — v0.2.0
- ✓ Full-speed playback mode and fullscreen canvas with letterboxed preview — v0.2.0
- ✓ Sequence isolation (solo) and global loop playback toggle — v0.2.0
- ✓ Linear timeline layout mode with togglable stacked/linear views — v0.2.0
- ✓ Lucide-preact SVG icon buttons with keyboard shortcut tooltips — v0.2.0
- ✓ Tabbed shortcuts overlay with 7 groups and full keyboard navigation — v0.2.0
- ✓ Timeline vertical scrollbar with playback auto-scroll — v0.2.0
- ✓ Solid color and transparent key entries with full data pipeline, UI controls, and rendering — v0.3.0
- ✓ Audio import with waveform visualization, synced playback, volume/fade controls, timeline interactions — v0.3.0
- ✓ Media in-use tracking with color-coded badges, usage popovers, and cascade removal with undo — v0.3.0
- ✓ GLSL shader effects: WebGL2 runtime, 17 Shadertoy-ported effects, ShaderBrowser, parameter controls — v0.3.0
- ✓ GL transitions: 18 curated gl-transitions.com shaders, dual-texture WebGL2 pipeline, timeline/sidebar integration — v0.3.0
- ✓ Audio export with BPM detection, beat markers, snap-to-beat, auto-arrange strategies — v0.3.0
- ✓ Collapsible key photo lists, global solo mode (S key), gradient fills (linear/radial/conic) — v0.3.0
- ✓ Adaptive 2-panel sidebar with sequence/layer view switching, Layers icon with count badge — v0.3.0
- ✓ Tailwind v4 syntax migration across 33 component files — v0.3.0
- ✓ Project format .mce v8→v13 progressive migration with full backward compatibility — v0.3.0
- ✓ Canvas motion path with After Effects-style dotted trail, keyframe circle markers, and drag-to-reposition interaction — v0.4.0
- ✓ Paint/rotopaint layer with perfect-freehand brush engine, 7 drawing tools, onion skinning, flood fill, and sidecar persistence — v0.4.0
- ✓ Tablet pen support with pressure sensitivity, tilt modulation, and coalesced pointer events — v0.4.0
- ✓ Project format .mce v14 with paint layer sidecar persistence — v0.4.0
- ✓ Paint brush styles (watercolor, ink, charcoal, pencil, marker) via p5.brush standalone rendering — v0.5.0
- ✓ Spectral pigment mixing (Kubelka-Munk) for physically-based color blending — v0.5.0
- ✓ Watercolor bleed, paper texture, and flow field distortion for organic rendering — v0.5.0
- ✓ Grain/texture post-effects and edge darkening per brush style — v0.5.0
- ✓ Brush style UI selector with SVG thumbnails in PaintProperties panel — v0.5.0
- ✓ Non-destructive FX workflow: draw flat, select, apply style, flatten for performance — v0.5.0
- ✓ Per-frame FX cache with spectral mixing across overlapping strokes — v0.5.0
- ✓ GLSL per-layer velocity motion blur for real-time preview — v0.5.0
- ✓ Sub-frame accumulation buffer for high-quality export (Float32 averaging, 8-128 samples) — v0.5.0
- ✓ Combined GLSL + sub-frame motion blur pipeline for export — v0.5.0
- ✓ Motion blur shutter angle UI control and preview toolbar toggle — v0.5.0
- ✓ Motion blur export settings (sample count, shutter angle override) — v0.5.0
- ✓ Project-level motion blur settings with .mce v15 persistence — v0.5.0
- ✓ Export selected sequence only option — v0.5.0
- ✓ Alt+drag duplicate stroke in roto paint edit mode — v0.6.0
- ✓ Non-uniform scale for paint layer strokes — v0.6.0
- ✓ Stroke interactions (move, rotate, scale, undo/redo) with correct hit-testing — v0.6.0
- ✓ Paint properties panel reorganized with space optimization and cleaner buttons — v0.6.0
- ✓ Isolation-scoped layer creation (add layer only on isolated sequence) — v0.6.0
- ✓ Denser motion path interpolation dots for short sequences — v0.6.0
- ✓ Bezier/spline stroke path editing with anchor/handle manipulation — v0.6.0
- ✓ Add, move, and delete bezier control points on existing strokes — v0.6.0
- ✓ Stroke list panel with drag-reorder, delete, selection sync, and visibility toggle — v0.6.0
- ✓ Paint undo/redo FX cache invalidation and visual refresh for all operations — v0.7.0 Phase 33
- ✓ Brush preferences persistence (color, size) with session restore — v0.7.0 Phase 33
- ✓ Circle cursor overlay at brush size with zoom scaling — v0.7.0 Phase 33
- ✓ 3-mode paint system (flat/FX/physical-placeholder) with per-frame mode exclusivity — v0.7.0 Phase 33
- ✓ Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and swatches — v0.7.0 Phase 33
- ✓ Modal color picker: no buttons, no overlay, positioned near mouse — v0.7.0 Phase 33
- ✓ FX stroke wireframe overlay for selection visibility — v0.7.0 Phase 33
- ✓ Stroke draw-reveal animation with speed-based distribution — v0.7.0 Phase 33
- ✓ Inline color picker positioned adjacent to canvas (left panel, 260px) — v0.7.0 Phase 33
- ✓ efx-physic-paint is runnable and testable as a standalone interactive physics paint app/window before editor integration — v0.8.0 Phase 35
- ✓ One Physics Paint Roto frame can be cached into EFX Motion, drawn in preview, preserved through project save/load, and reopened as a cached visual reference — v0.8.0 Phase 36.3
- ✓ Physics Paint Roto timeline cells distinguish empty, cached, editable/current, generated/render-only, background-only, dirty, and saving states with semantic labels, non-color visual cues, and compact legend/status copy — v0.8.0 Phase 36.5
- ✓ Physics Paint dirty Roto frames save automatically on leave with source-frame feedback, latest-destination queuing, and failure retention — v0.8.0 Phase 36.6 (superseded by automatic live pixel caching, quick 260714-ail)
- ✓ Automatic live pixel caching for Physics Paint Roto with durable reopen and projected/distant key behavior — v0.8.0 quick 260714-ail
- ✓ Stop-motion animators can duplicate, insert, delete, copy, and paste real Physics Paint Roto keys with clean cache/cell/canvas state — v0.8.0 Phase 36.7
- ✓ Physics Paint Roto timeline ships the approved final UI: fixed-geometry strip with grouped controls, guarded icon actions with styled tooltips, elastic status capsule, real-key diamonds on the EFX Motion layer, + Key empty-paint promotion, resizable sidebar sections, and Scripts panel script actions — v0.8.0 Phase 36.15
- ✓ Multiple real Physics Paint Roto keys can be selected (including Select All) and group-dragged, deleted, and Force-Spaced as one atomic transaction over the canonical physical-frame model, with full downstream parity and regression-locked behavior — v0.8.0 Phase 37
- ✓ Selected real Roto keys support reusable group Copy/Paste with stable physical offsets, fresh identities, atomic rejection, one Undo/Redo action, and single-key parity; the capsule and viewport tooltips use the approved current-cell and flat multiline presentation — v0.8.0 Phase 38
- ✓ Physics Paint Studio navigation preserves the canvas-first timing architecture while localizing static UI, Workflow cells, CanvasMount/Efx ownership, and deterministic render/lifecycle instrumentation — v0.8.0 Phase 38.1
- ✓ efx-physic-paint standalone demo shell runs via pnpm/Vite with live interactive canvas — v0.8.0 Phase 34
- ✓ Physics Paint UI rebuild with session persistence and output proof (inspect/save/export) — v0.8.0 Phase 36
- ✓ Physics Paint explicit Roto close behavior (discard / cancel / save-close) — v0.8.0 Phase 36.4
- ✓ Signals-backed Roto session/key state boundary replacing the Studio god-component — v0.8.0 Phase 36.8
- ✓ Cached Roto timed Play/Stop preview with auto-play — v0.8.0 Phase 36.9
- ✓ Span-aware missing Roto frame resolution for preview with export parity — v0.8.0 Phase 36.10
- ✓ Cached real-key repaint merging prior cached alpha with new live alpha — v0.8.0 Phase 36.11
- ✓ Integer-gap Roto interpolation deriving strict interior frames between adjacent real keys — v0.8.0 Phase 36.12
- ✓ Dynamic interpolation spacing for Roto keys — v0.8.0 Phase 36.13
- ✓ Deterministic physical-frame Roto timeline cutover: stable keyId, direct appFrame, atomic acknowledged transactions (Insert/Delete/Drag/Force Spacing/Undo/Redo) — v0.8.0 Phase 36.14
- ✓ Tauri-native frame sync between editor timeline and standalone Physics Paint window (physic-paint:seek-frame, EDIT-02) — v0.8.0 quick 260801-azb
- ✓ EFX Paint Scripts auto-hydration: saved-project scripts and Save Script appear without manual Refresh — v0.9.0 Phase 39 (quick 260804-f2q)
- ✓ Legible macOS app icon regenerated from SPECS/efxmotioneditor-icon-2.png via the Tauri pipeline; tracked generated icons remain release authority, packaged-icon metadata proven on a fresh unsigned build — v0.9.0 Phase 40
- ✓ Desktop build hygiene: chunkSizeWarningLimit 1100 documented and test-pinned; 4 triage-approved mixed-import corrections with non-return assertions — v0.9.0 Phase 40
- ✓ EFX Paint audio preview monitoring: read-only main-editor audio in the child window, frame-synchronized (anchor model, silent scrub, loop-wrap re-seek, 40ms drift correction), revisioned launch payload + push updates, doubled-audio ownership guard with auto-resume, session-local toggle, engine release on close, D-04-proven single-token CSP grant; native packaged UAT approved — v0.9.0 Phase 41
- ✓ PlayScript application modes + color override: progressive vs static/hold modes generating one source cycle of real keys, application-time color-only override fed live from the brush color (read-only, snapshot at Generate, erase strokes excluded), application-time Motion, Hold Loop repeat/infinity as Phase 43 loop intent (Requested/Effective readout only — never materialized), two-line success-only Scripts panel summary, compact dark draggable modal (approved playscript-proposal direction); native UAT approved — v0.9.0 Phase 42
- ✓ Linked Hold Loop Clips (cycle × repeat 1..∞) with filmstrip timeline visualization, no duplicated source assets — v0.9.0 Phase 43 (Validated in Phase 43: Hold Loop Clips + Integrated Loop Rail)
- ✓ Timeline toolbox + directional Push tool: ToolCase popover relocating Interpolation + Key Spacing (zero behavior change), and a mode-toggle Push tool (anchor resolved from the rail under the pointer, moved set = anchor + everything at/after its start, one rigid atomic transaction with one Undo/Redo, nearest-boundary/capacity clamp, straddle guard, persistent 43.1 gap breaks, full drag preview); native UAT approved — v0.9.0 Phase 43.5 (Validated in Phase 43.5: Timeline Toolbox + Directional Push Tools)
- ✓ Multi-rail selection + batch operations: explicit session-only rail-set selection (plain/toggle/range/union gestures across Key/Motion/Static rails, canonical ordering, fail-closed reconcile), batch Move Rails (rigid clamped translation), direct no-modal Delete Rails, Key Spacing on set with per-rail fixed anchors, and Solo playback presentation filter — every batch op is one atomic history command with exact pre-op selection restore on Undo/Redo (G-43.6-2 undo/recovery-lease defects closed); native UAT approved — v0.9.0 Phase 43.6 (Validated in Phase 43.6: Multi-Rail Selection and Batch Operations)

### Active

- [ ] Future physics-paint integration contract must define typed transport/cache messages without implementing editor runtime integration — v0.8.0 follow-up (was earmarked for a Phase 37 that became multi-select Roto keys)
- [ ] The failed headless adapter approach remains excluded; physics paint must preserve interactive incremental simulation behavior — v0.8.0

## Latest Milestone: v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Shipped 2026-08-21)

12 phases (39-44, incl. inserted 43.1-43.6), 100 plans, 962 commits over 17 days. Audit verdict `passed`: 38/38 requirements satisfied, 12/12 phases verified, integration + E2E flows wired (43→44 signed-artifact boundary not dropped), Nyquist fully compliant. Shipped as a signed/notarized/stapled macOS release published as GitHub **Latest** on 2026-08-21 (ahead of the 2026-08-31 target) with all six REL-01 gates green, the 17-step packaged-app UAT approved, downloaded-artifact verification passed, and all 15 stop conditions recorded not active. See `.planning/MILESTONES.md`, `milestones/v0.9.0-MILESTONE-AUDIT.md`, and `milestones/v0.9.0-ROADMAP.md`.

## Next Milestone: v1.0 (multi-track — in planning)

**Direction:** expand the EFX Paint workflow beyond the single parent Paint layer toward multi-track timeline work, per the v1.0/v1.1 roadmap (v1.0 multi-track; v1.1 Codex+MMX AI). New requirements land under `### Active` below and are sharpened via `/gsd-new-milestone`.

**Target features:**
- Blocking prerequisite: Scripts auto-hydration fix — saved-project scripts and Save Script appear without manual Refresh (no delays/polling hacks)
- macOS release identity: new icon from `SPECS/efxmotioneditor-icon-2.png` (794×794 alpha source, tracked generated icons stay release authority)
- Desktop build hygiene: `chunkSizeWarningLimit: 1100` documented budget + safe mixed-import corrections only
- Read-only audio preview inside EFX Paint synchronized to the Paint cursor, with session-local monitoring toggle
- PlayScript application controls: progressive vs static/hold modes, application-time color override, Hold Loop controls (cycle × repeat 1..∞)
- Deterministic static/hold rendering with linked Loop Clips (no duplicated source assets, next-clip interruption, filmstrip timeline visualization)

**Source spec:** `SPECS/milestone-v0.9.0-plan.md` (user-approved, locked ownership boundaries: main editor owns sequences/layers/audio; EFX Paint edits one parent Paint layer)

## Previous Milestone: v0.8.0 Standalone Physics Paint (Shipped 2026-08-01)

21 phases (34, 35, 36, 36.1–36.15, 37, 38, 38.1), 170 plans, 1,347 commits over 54 days. Audit verdict `tech_debt`: 56/56 requirements satisfied, all integration and E2E flows wired, zero blockers; deferred items recorded in STATE.md and the milestone audit. Phase 36.2 intentionally failed/superseded. See `.planning/MILESTONES.md` and `.planning/reports/MILESTONE_SUMMARY-v0.8.0.md` for details.

## Previous Milestone: v0.7.0 Monorepo & Paint Enhancements (Shipped 2026-04-05)

2 completed phases (26, 33), 23 plans, 112 commits. Phases 27-32 failed (adapter approach abandoned — efx-physic-paint deferred to v0.8.0 as standalone window). See `.planning/MILESTONES.md` for details.

## Previous Milestone: v0.6.0 Various Enhancements (Shipped 2026-04-03)

4 phases, 14 plans over 8 days. See `.planning/MILESTONES.md` for details.

### Out of Scope

- Live camera tethering — different product category (Dragonframe owns this)
- Plugin/extension system — requires stable internal APIs; premature
- AI-powered features — distraction from core value; proven DSP for beat detection instead
- Real-time collaboration — desktop app with local files; stop-motion is typically solo/small-team
- Windows/Linux builds — macOS only; native title bar, file dialogs, macOS conventions
- Node-based compositing — layer-based approach is more intuitive for target users
- Multi-frame stroke operations — single-frame scope sufficient for current workflows
- Stroke grouping/nesting — flat list sufficient; hierarchy adds complexity without clear benefit
- Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path — excluded after v0.7.0 failure post-mortem; physics paint preserves interactive incremental simulation

## Context

Shipped v0.9.0 with 962 commits over 17 days (cumulative repo spans 2,094+ files). pnpm monorepo with app/ + packages/efx-physic-paint/ (a proven standalone interactive physics paint app/window with Tauri-native frame sync). Current codebase runs ~100k+ LOC TS/TSX across app/src and packages/.
Tech stack: Tauri 2.0, Preact + Preact Signals, Motion Canvas (@efxlab v4.0.0), Vite 5, Tailwind CSS v4, pnpm workspaces, p5.brush (standalone), perfect-freehand, fit-curve, bezier-js.
Architecture: 13 reactive signal stores, Rust image pipeline, Canvas 2D PreviewRenderer with multi-layer compositing, WebGL2 GPU blur/GLSL runtime/motion blur, 3-mode paint system, efx-physic-paint standalone window with deterministic physical-frame Roto timeline (canonical keyId/appFrame model, atomic transactions, generated interpolation, multi-select group operations via finalizeProposal single authority, Roto Script Play fusion, durable script library), signals-backed Roto session boundary, structural/frame-split render-path signal graph with canvas-first navigation paint, plus v0.9.0: Loop Clip Hold rails (one compact derived interval record, linked preview/export parity, one-Undo/Redo), stable-key incoming-break ownership for intentional gaps, Motion/Static Group stabilization + retained-Action lifecycle (leased parent-authoritative transactions, durable Rust Action recovery), Group/Key Rail drag, Timeline Toolbox + directional Push, and session-only multi-rail selection with batch operations.
Project format: .mce v15 with backward compatibility (v1 through v15).

Known technical debt:
- S key shortcut lacks isPaintEditMode() guard (low severity) — from v0.6.0
- 2 medium-severity export edge cases (content-overlay image preload, FX generator frame offset) — carried from v0.2.0
- Coalescing API partially resolved (motion path drag uses startCoalescing/stopCoalescing) — most UI interactions still unwired (carried from v0.1.0)
- canUndo/canRedo signals exported but no UI consumes them for button disabling — carried from v0.1.0
- 3 pre-existing audioWaveform test failures (unrelated to v0.6.0 work)
- Roto cache footprint measurement/compression deferred (PNG alpha encoding exists) — v0.8.0
- Deterministic physical-resolver regression coverage authorized as follow-up test plan — v0.8.0 Phase 36.14
- Code-review follow-ups CR-01/CR-02, WR-01..04 routed to follow-up quick — v0.8.0 Phase 36.14
- Legacy source/display model still feeds useRotoTimelineActions.getModel (inert dual-model seam); legacy optional fallbacks in rotoOnionPreview/applyCanvas/deleteRotoFrame — v0.8.0
- Dead playScriptMarkers field (no producer) and misleading physicPaintPlayScriptBridge.test.ts filename — v0.8.0 integration check I-01/I-02
- macOS Developer ID credentialed signed release intentionally deferred post-close (prep complete, docs/macos-signed-release.md) — v0.8.0
- Phase 43.1 DF-01..04 deferred (non-blocking persistence/security hardening; NEW_SCOPE_FROM_VERIFIER) — cross-resource save transaction, directory sync on cache publication, provenance-only Loop Clip no-op, postMessage origin authentication — v0.9.0
- Release-script warnings (frozen, pre-existing): `codesign --entitlements :-` deprecation and ~21 GB worktree preflight walk — v0.9.0 Phase 44 (WR-01/WR-02)
- Spec-vs-implementation divergences recorded (judged against shipped): truncation label French-spec vs English shipped; chunk budget spec-1100 vs shipped-1120 — v0.9.0 Phase 44 (D-09)
- State bookkeeping: `init.milestone-op` `completed_phases` 11 vs all-phases-complete — reconciled at v0.9.0 close

## Constraints

- **Platform:** macOS only — native title bar, file dialogs, macOS conventions
- **Framework:** Tauri 2.0 (Rust backend) + Preact (not React) + Preact Signals (not Redux/MobX)
- **Package manager:** pnpm
- **Rendering:** Canvas 2D PreviewRenderer for compositing; WebGL2 GPU blur (glBlur.ts) with CPU StackBlur fallback; @efxlab/motion-canvas-* v4.0.0 for player embedding
- **Styling:** Tailwind CSS v4 + custom components — no heavy UI libraries
- **Performance:** Preview must play smoothly at 15/24 fps
- **Min resolution:** 1280x720 window minimum

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preact over React | 3KB bundle, fastest rendering, Signals built-in | ✓ Good — reactive stores clean, zero perf issues |
| Tailwind v4 + Custom over UI library | No heavy overhead (~500KB saved), full control over editor UI | ✓ Good — dark theme with 28+ CSS variables |
| pnpm as package manager | User preference, fast installs, strict dependency resolution | ✓ Good — overrides fixed Motion Canvas workspace:* bug |
| Canvas 2D PreviewRenderer over Motion Canvas generators | Direct compositing control, simpler layer model | ✓ Good — clean multi-layer rendering with blend modes |
| Custom command-pattern undo over external library | Operation-level granularity, snapshot/restore with structuredClone | ✓ Good — works across all store mutations |
| tinykeys over hotkeys-js | 650B, TypeScript-native, layout-aware | ✓ Good — all shortcuts working, ? overlay included |
| FX as timeline-level sequences | FX apply globally with temporal range, not per-layer | ✓ Good — clean separation, draggable range bars on timeline |
| SortableJS with forceFallback:true | CSS transforms bypass Tauri native HTML5 DnD interception | ✓ Good — reliable drag reorder in sidebar |
| Canvas 2D for timeline | Full control over rendering, virtualization, pointer events | ✓ Good — smooth at 100+ frames |
| .mce progressive format migration | v1→v7 without breaking old files | ✓ Good — seamless loading of any version |
| PNG sequence + video export | Downstream editing in DaVinci Resolve/Premiere Pro is the workflow | ✓ Good — FFmpeg auto-provisioned, ProRes/H.264/AV1 |
| WebGL2 GPU blur over dual CPU | Constant-cost regardless of radius/layer count | ✓ Good — replaced HQ/fast toggle with always-HQ |
| Content overlays as sequence kind | Reuses FX track pipeline with content compositing | ✓ Good — interleaves cleanly with FX on timeline |
| Polynomial cubic easing over bezier curves | Simpler math, 21 unit tests, sufficient for stop-motion | ✓ Good — smooth interpolation, no overshooting |
| Intent-driven add-layer flows | Eliminates popover dialogs, reuses ImportedView | ✓ Good — consistent UX for all layer types |
| audioStore follows sequenceStore pattern | Signals, snapshot/restore, pushAction undo — proven architecture | ✓ Good — zero friction adding 11th store |
| Onset autocorrelation for BPM detection | Accurate, fast, no external DSP dependency needed | ✓ Good — reliable detection without heavy libraries |
| GlTransition as separate type (not overloading Transition) | Clean mutual exclusion between cross-dissolve and GL transitions | ✓ Good — D-02 mutual exclusion simple to enforce |
| Dual-texture WebGL2 pipeline for GL transitions | gl-transitions.com convention with dual capture from exportRenderer | ✓ Good — identical preview and export rendering |
| Optional fields on KeyPhoto for solid/transparent | Minimal structural change across 15+ callsites vs discriminated union | ✓ Good — pragmatic, avoided massive refactor |
| soloStore as session-only state | Solo mode is ephemeral preview behavior, not project data | ✓ Good — no persistence overhead |
| 2-panel adaptive sidebar over 3 panels | Layers merged into Sequences panel with icon toggle | ✓ Good — simpler UX, one fewer resizer |
| Progressive .mce format v8→v13 | Each phase bumps version with serde(default) backward compat | ✓ Good — seamless loading of any version |
| spawn_blocking for FFmpeg encoding | Keeps blocking I/O isolated from Tauri main thread | ✓ Good — fixed UAT export hang |
| Shared signal (motionPathCircles) for cross-component coordinate exchange | Simpler than prop drilling; matches signal-based architecture | ✓ Good — MotionPath→TransformOverlay communication clean |
| Snapshot-before/commit-on-release undo for transform gestures | Deep clone on pointerdown, single pushAction on pointerup | ✓ Good — clean undo for move, rotate, scale, duplicate |
| Edge anchor captured once on pointerdown for non-uniform scale | Prevents floating-point drift from per-frame recomputation | ✓ Good — stable scaling with no cumulative error |
| Visibility as optional boolean (undefined=visible, false=hidden) | Backward compatible; no migration needed for existing paint data | ✓ Good — existing strokes render correctly without field |
| S key remapped to select tool in paint mode (Alt+S for solo) | S key more useful for tool switching; solo toggle less frequent | ✓ Good — matches other tool shortcut patterns |
| fit-curve + bezier-js for freehand-to-bezier conversion | Mature libraries; fit-curve gives Douglas-Peucker fitting, bezier-js provides cubic math | ✓ Good — accurate path fitting with minimal code |
| BezierAnchor type with in/out handles and smooth flag | Mirrors industry-standard anchor model (Illustrator, Figma) | ✓ Good — intuitive handle manipulation, corner/smooth toggle |
| Progressive simplify button over automatic simplification | User controls detail level explicitly; auto-simplify removed too much | ✓ Good — reverted auto-simplify after user feedback |
| Unified keyframe upsert path (upsertKeyframeValues/Transform) | Eliminates dead-end transientOverrides routing | ✓ Good — sidebar and canvas drag edits both flow through keyframes |
| Map<string, Map<number, PaintFrame>> for paint storage | Efficient sparse frame data; per-layer per-frame isolation | ✓ Good — clean API, dirty tracking via Set<string> keys |
| paintVersion counter signal for reactivity | Non-reactive Map storage + explicit signal bump = controlled re-renders | ✓ Good — solved disappearing strokes without making all Maps reactive |
| Offscreen canvas compositing for eraser and onion skin | Isolates destination-out and global alpha operations | ✓ Good — correct rendering without side effects |
| Paint sidecar JSON files (paint/{uuid}/frame-NNN.json) | Keeps .mce file lean; paint data can be large | ✓ Good — pre-save write order prevents sync issues |
| p5.brush standalone over custom WebGL2 brush renderer | Replaced ~2000 lines of broken custom code with ~200 lines of adapter | ✓ Good — spectral mixing, 5 brush styles, mature library |
| Per-frame FX cache (not per-stroke) | Spectral mixing requires all strokes rendered on shared p5.brush canvas | ✓ Good — correct Kubelka-Munk mixing, clean invalidation |
| Non-destructive FX workflow (flat → select → apply) | Users draw without FX overhead; styles applied post-hoc | ✓ Good — clean separation, rollback to flat supported |
| Separate WebGL2 context for glMotionBlur.ts | Isolation from glBlur.ts and glslRuntime avoids state conflicts | ✓ Good — independent lifecycle, no shared GL state bugs |
| Triangle filter blur kernel in GLSL | Smooth directional blur falloff vs box filter | ✓ Good — natural motion blur appearance |
| VelocityCache with seek invalidation | Math.abs(currentFrame - lastFrame) > 1 detects seek vs playback | ✓ Good — clean velocity on playback, no artifacts on seek |
| Sub-frame accumulation with Float32 averaging | Higher quality export blur via temporal super-sampling | ✓ Good — combined with GLSL velocity blur for best quality |
| Cached Roto PNG as durable truth | Phase 36.3 recovered the smallest trustworthy Roto path after Phase 36.2 failed: explicit `Save current` writes one frame into EFX Motion and reopen uses the saved PNG as reference, not editable stroke restore | ✓ Good — UAT passed for save, preview, save/load, cached-reference reopen, and navigation preservation |
| Phase 36.5 Roto cell semantics stay MVP-only | User needed trustworthy existing strip state communication without reopening interpolation, cached playback, key utilities, save-on-leave, close behavior, or full timeline redesign scope | ✓ Good — semantic view models, compact legend/status, non-color CSS cues, generated-cell guard, and cached-reference navigation fix were validated |
| Phase 36.6 save-on-leave uses source-frame save truth | Dirty Roto navigation must save the source frame before opening a queued destination, not save/open based on destination state | ⚠️ Superseded — automatic live pixel caching (quick 260714-ail) replaced save-on-leave as the final architecture |
| Phase 36.7 Roto key utilities use controller-backed real-key transactions | Duplicate, Insert, Delete, Copy, and Paste need deterministic cache/cell/canvas updates without broad UI expansion or editor integration scope creep | ✓ Good — UAT passed for live key utility flow, generated/empty guards, dirty save-before-action, regression tests, typecheck, and user-story coverage |
| Phase 38 uses production → native UAT → post-UAT regression | Visible Copy/Paste, capsule, and tooltip behavior must be approved before tests are rewritten around it | ✓ Good — all 33 native steps passed before Plans 38-07/08; the final 967-test/typecheck/build gate is green |
| Phase 36.8 Signals/controllers as the Roto state boundary (no XState) | PhysicsPaintStudio god-component with scattered useState/useRef/useEffect was the regression root cause | ✓ Good — compact signals boundary owns Roto coherence; planned state-machine phase removed as obsolete |
| Phase 36.14 canonical physical-frame model (stable keyId, direct appFrame) | Source/display timeline ambiguity caused recurring Roto timing bugs | ✓ Good — atomic acknowledged transactions with ripple semantics locked; enabled-only interpolation persistence |
| Phase 36.14 finalizeProposal as single authority for timeline mutations | All key operations (including later group ops) resolve through one validator/guard path | ✓ Good — Phase 37 group drag/delete/Force Spacing admitted with zero bridge edits |
| Roto Script Play fusion (quick 260717-m9k) | Separate Play workflow duplicated script replay; one algorithm belongs in Roto SCRIPTS | ✓ Good — Play Script commits parent-authoritative real-key batches; separate Play workflow retired |
| Durable Roto script library (quick 260716-dby) | Scripts must survive sessions as autonomous JSON presets with WebP thumbnails | ✓ Good — project scripts folder with explicit load-to-clipboard |
| Phase 37 group operations as atomic transactions over canonical model | Multi-select group drag/delete/Force Spacing must not ripple unselected keys | ✓ Good — rigid group translation with zero unselected ripple, native UAT approved |
| Phase 38.1 canvas-first navigation paint before Preact propagation | Child windows must never present provisional state as accepted | ✓ Good — navigation paints engine canvas in the same synchronous tick; structural/frame-split signal graph makes frame writes O(find) |
| Tauri listen branch for physic-paint:seek-frame (G-01, quick 260801-azb) | Standalone window must track editor timeline seeks natively, not only via browser fallback | ✓ Good — regression-locked RED/GREEN coverage; native Tauri UAT approved |
| Bounded recovery track D-30: bounded-static fixes → read-only review → user-owned native UAT gate | Exact native approval is the only oracle for Roto/Studio behavior | ✓ Good — carried the 36.14 cutover and Phase 38/38.1 to green |
| Phase 41 D-04 one-way asset-transport boundary (single-token efxasset CSP grant, contract-tested) | Audio asset transport from main editor to EFX Paint must stay read-only and provenance-locked | ✓ Good — connect-src grant pinned by contract test; native packaged UAT (8 steps) approved |
| Phase 42 static/hold + color override as one renderer entry point, additive to progressive | Static/hold must not fork or regress the progressive module | ✓ Good — progressive byte-untouched; one source cycle per Apply |
| Phase 43 Loop Clip persistence joins the single canonical revision fingerprint + Undo/Redo snapshot | Loop-only edits must be revision-visible and undoable; v0.8.1 documents must load unchanged | ✓ Good — four-allowlist gauntlet passed; loop-only edits are revision-visible and undoable |
| Phase 43 one compact derived interval record per Loop Clip, lazy per-frame query | No virtual occurrence is ever materialized; consumers guard the typed union exhaustively | ✓ Good — resolution, preview, playback, and export share one store authority |
| Phase 43.1 stable-key incoming-break ownership as a complete persisted collection | Interpolation breaks are canonical facts owned by stable real-key identity, never a mask | ✓ Good — malformed/stale proposals fail closed; empty-segment insert is one atomic transaction |
| Phase 43.2 Group lifecycle + Action retention as leased, parent-authoritative transactions | Exact frame COW, no optimistic publication, durable Rust Action transactions | ✓ Good — canonical lease ownership; committed-only settlement ledgers |
| Phase 43.5 Timeline Toolbox + Push as one rigid atomic multi-object translation | Push is the exclusive multi-object movement owner; Group drag stays local | ✓ Good — persistent 43.1 gap breaks; one Undo/Redo; native UAT approved |
| Phase 43.6 rail-set selection as a session-only explicit selection scope | Cross-type batch ops need one shared selection with fail-closed reconcile | ✓ Good — pure reducer, batch Move/Delete/Key Spacing/Solo, exact selection restore on Undo |
| Phase 44 five-surface version single-source (REL-01) + credentialed signed release | Version must never drift across surfaces; publication is one-way and auditable | ✓ Good — signed/notarized/stapled, published as GitHub Latest, 15-item stop-condition checklist |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-21 after v0.9.0 milestone close — v0.9.0 shipped (signed/notarized/stapled macOS artifact published as GitHub Latest ahead of the 2026-08-31 target; 38/38 requirements, 12/12 phases, six REL-01 gates green, 17-step packaged-app UAT approved, downloaded-artifact verification + 15-item stop-condition checklist zero-active). Milestone archived to `milestones/v0.9.0-ROADMAP.md` / `v0.9.0-REQUIREMENTS.md`. Next milestone: v1.0 multi-track (via `/gsd-new-milestone`).*
